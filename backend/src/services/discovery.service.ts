import { randomUUID } from 'node:crypto';
import { type Transaction } from 'sequelize';
import { sequelize } from '../config/database';
import { datingProfileConfig } from '../config/datingProfile';
import Errors from '../errors';
import {
  eligibleProfilesSql,
  mutualLikesSql,
  rows,
} from '../repositories/discovery.repository';
import { DatingStateService } from './dating/dating-state.service';
import { demoCompatibility, nextPlanStatus } from './discovery.rules';
import { NotificationService } from '../notifications/notification.service';
import { NotificationKind } from '../notifications/types';

interface MatchRow {
  id: string;
  user_low: string;
  user_high: string;
  created_at: string;
}
interface PlanRow {
  id: string;
  creatorUserId: string;
  status: string;
  proposedAt: string;
  partnerStatus: string;
  partnerId: string;
}
export class DiscoveryService {
  private readonly state = new DatingStateService();

  async assertReady(userId: string): Promise<void> {
    const [profile] = await rows(
      `SELECT p.user_id FROM user_profiles p JOIN user_onboarding_progress o ON o.user_id=p.user_id WHERE p.user_id=:userId AND p.profile_status='ACTIVE' AND p.deleted_at IS NULL AND o.status='COMPLETED'`,
      { userId },
    );
    if (!profile)
      throw new Errors.ForbiddenError(
        'Complete your profile before discovering people',
      );
  }

  private async card(viewerId: string, userId: string) {
    const preview = await this.state.getPreview(userId);
    return {
      userId,
      ...preview,
      compatibility: {
        percentage: demoCompatibility(viewerId, userId),
        isDemo: true,
        label: 'Demo compatibility',
      },
    };
  }

  async feed(
    userId: string,
    limit: number,
    offset: number,
    cycle: {
      shuffleSeed?: string | undefined;
      after?: string | undefined;
    } = {},
  ) {
    const replacements = {
      userId,
      minimumPhotos: datingProfileConfig.minimumPhotos,
      limit: limit + 1,
      offset,
    };
    const available = `${eligibleProfilesSql}
      AND NOT EXISTS (SELECT 1 FROM matches m WHERE ((m.user_low=:userId AND m.user_high=u.id) OR (m.user_high=:userId AND m.user_low=u.id)) AND ${mutualLikesSql})`;
    const fresh = await rows<{ userId: string }>(
      `SELECT u.id AS "userId" ${available}
       AND NOT EXISTS (SELECT 1 FROM discovery_actions d WHERE d.actor_id=:userId AND d.target_id=u.id AND d.source='USER')
       ORDER BY (p.current_city_id = me.current_city_id) DESC,p.created_at DESC,u.id LIMIT :limit OFFSET :offset`,
      replacements,
    );
    if (fresh.length || offset > 0)
      return {
        profiles: await Promise.all(
          fresh
            .slice(0, limit)
            .map((person) => this.card(userId, person.userId)),
        ),
        nextOffset: fresh.length > limit ? offset + limit : null,
        feedMode: 'FRESH' as const,
        shuffleSeed: null,
        nextCursor: null,
        compatibilityMode: 'DEMO',
      };
    // Once fresh profiles are exhausted, revisit passes in a stable shuffled round.
    // Seeded ordering plus a cursor avoids skipping/repeating people between batches.
    let seed = cycle.shuffleSeed ?? randomUUID();
    const passed = `SELECT u.id AS "userId" ${available}
      AND EXISTS (SELECT 1 FROM discovery_actions d WHERE d.actor_id=:userId AND d.target_id=u.id AND d.action='PASS' AND d.source='USER')
      AND NOT EXISTS (SELECT 1 FROM discovery_actions d WHERE d.actor_id=:userId AND d.target_id=u.id AND d.action='LIKE' AND d.source='USER')
      AND (:after IS NULL OR (md5(CAST(u.id AS text) || :seed),u.id) > (md5(CAST(:after AS text) || :seed),CAST(:after AS uuid)))
      ORDER BY md5(CAST(u.id AS text) || :seed),u.id LIMIT :limit`;
    let candidates = await rows<{ userId: string }>(passed, {
      ...replacements,
      seed,
      after: cycle.after ?? null,
    });
    if (!candidates.length && cycle.after) {
      seed = randomUUID();
      candidates = await rows<{ userId: string }>(passed, {
        ...replacements,
        seed,
        after: null,
      });
    }
    return {
      profiles: await Promise.all(
        candidates
          .slice(0, limit)
          .map((person) => this.card(userId, person.userId)),
      ),
      nextOffset: null,
      feedMode: 'RECYCLED' as const,
      shuffleSeed: seed,
      nextCursor:
        candidates.length > limit ? candidates[limit - 1]!.userId : null,
      compatibilityMode: 'DEMO',
    };
  }

  async incomingLikes(userId: string, limit: number, offset: number) {
    const pendingSql = `${eligibleProfilesSql}
      AND EXISTS (SELECT 1 FROM discovery_actions incoming WHERE incoming.actor_id=u.id AND incoming.target_id=:userId AND incoming.action='LIKE' AND incoming.source='USER')
      AND NOT EXISTS (SELECT 1 FROM discovery_actions mine WHERE mine.actor_id=:userId AND mine.target_id=u.id AND mine.source='USER')`;
    const replacements = {
      userId,
      minimumPhotos: datingProfileConfig.minimumPhotos,
      limit,
      offset,
    };
    const [people, counts] = await Promise.all([
      rows<{ userId: string; likedAt: string }>(
        `SELECT u.id AS "userId",(SELECT created_at FROM discovery_actions d WHERE d.actor_id=u.id AND d.target_id=:userId) AS "likedAt" ${pendingSql} ORDER BY "likedAt" DESC,u.id LIMIT :limit OFFSET :offset`,
        replacements,
      ),
      rows<{ total: number }>(
        `SELECT count(*)::int AS total ${pendingSql}`,
        replacements,
      ),
    ]);
    const total = counts[0]!.total;
    return {
      profiles: await Promise.all(
        people.map(async (person) => ({
          ...(await this.card(userId, person.userId)),
          likedAt: person.likedAt,
        })),
      ),
      total,
      nextOffset:
        offset + people.length < total ? offset + people.length : null,
    };
  }

  async act(userId: string, targetId: string, action: 'LIKE' | 'PASS') {
    if (userId === targetId)
      throw new Errors.BadRequestError('You cannot like your own profile');
    return sequelize.transaction(async (transaction) => {
      // Ordered row locks serialize simultaneous reciprocal likes without deadlocks.
      await rows(
        'SELECT id FROM users WHERE id IN (:userId,:targetId) ORDER BY id FOR UPDATE',
        { userId, targetId },
        transaction,
      );
      const [eligible] = await rows(
        `SELECT u.id ${eligibleProfilesSql} AND u.id=:targetId`,
        { userId, targetId, minimumPhotos: datingProfileConfig.minimumPhotos },
        transaction,
      );
      if (!eligible)
        throw new Errors.NotFoundError('This profile is no longer available');
      const [prior] = await rows<{ action: string; source: string }>(
        'SELECT action,source FROM discovery_actions WHERE actor_id=:userId AND target_id=:targetId',
        { userId, targetId },
        transaction,
      );
      if (
        prior?.source === 'USER' &&
        prior.action === 'LIKE' &&
        action !== 'LIKE'
      )
        throw new Errors.ConflictError(
          'You have already responded to this profile',
        );
      await rows(
        `INSERT INTO discovery_actions (actor_id,target_id,action,source) VALUES (:userId,:targetId,:action,'USER') ON CONFLICT (actor_id,target_id) DO UPDATE SET action=EXCLUDED.action,source='USER',created_at=now() WHERE discovery_actions.source='DEMO' OR discovery_actions.action='PASS' RETURNING actor_id`,
        { userId, targetId, action },
        transaction,
      );
      if (action === 'PASS') return { matched: false, matchId: null };
      const [reciprocal] = await rows(
        "SELECT actor_id FROM discovery_actions WHERE actor_id=:targetId AND target_id=:userId AND action='LIKE' AND source='USER'",
        { userId, targetId },
        transaction,
      );
      if (!reciprocal) {
        await new NotificationService().users(
          [targetId],
          {
            key: `like:${userId}:${targetId}`,
            kind: NotificationKind.LIKE,
            category: 'likes',
            title: 'Someone noticed you',
            body: 'You have a new like. See who caught a little spark.',
            data: {},
          },
          transaction,
        );
        return { matched: false, matchId: null };
      }
      const [low, high] = [userId, targetId].sort();
      const [match] = await rows<{ id: string }>(
        `INSERT INTO matches (id,user_low,user_high) VALUES (:id,:low,:high) ON CONFLICT (user_low,user_high) DO UPDATE SET user_low=EXCLUDED.user_low RETURNING id`,
        { id: randomUUID(), low, high },
        transaction,
      );
      await new NotificationService().users(
        [userId, targetId],
        {
          key: `match:${match!.id}`,
          kind: NotificationKind.MATCH,
          category: 'matches',
          title: 'It’s a mutual spark',
          body: 'You liked each other. Say a little hello.',
          data: { matchId: match!.id },
        },
        transaction,
      );
      return { matched: true, matchId: match!.id };
    });
  }

  async assertMatch(
    userId: string,
    matchId: string,
    transaction?: Transaction,
  ): Promise<MatchRow> {
    const [match] = await rows<MatchRow>(
      `SELECT m.* FROM matches m
      JOIN users u1 ON u1.id=m.user_low AND u1.deleted_at IS NULL JOIN users u2 ON u2.id=m.user_high AND u2.deleted_at IS NULL
      JOIN accounts a1 ON a1.id=u1.account_id AND a1.status='ACTIVE' AND a1.deleted_at IS NULL
      JOIN accounts a2 ON a2.id=u2.account_id AND a2.status='ACTIVE' AND a2.deleted_at IS NULL
      WHERE m.id=:matchId AND :userId IN (m.user_low,m.user_high) AND ${mutualLikesSql}`,
      { userId, matchId },
      transaction,
    );
    if (!match) throw new Errors.NotFoundError('Match not found');
    return match;
  }

  async matches(userId: string) {
    const matches = await rows<MatchRow>(
      `SELECT m.* FROM matches m WHERE :userId IN (user_low,user_high) AND ${mutualLikesSql} ORDER BY created_at DESC LIMIT 100`,
      { userId },
    );
    const visible = await Promise.all(
      matches.map(async (match) => {
        try {
          await this.assertMatch(userId, match.id);
          return {
            id: match.id,
            createdAt: match.created_at,
            person: await this.card(
              userId,
              match.user_low === userId ? match.user_high : match.user_low,
            ),
          };
        } catch (error) {
          if (error instanceof Errors.NotFoundError) return null;
          throw error;
        }
      }),
    );
    return visible.filter((x) => x !== null);
  }

  async venues(userId: string, kind?: string) {
    const [location] = await rows<{
      city: string;
      latitude: number | null;
      longitude: number | null;
    }>(
      `SELECT c.name AS city,c.latitude::float,c.longitude::float FROM user_profiles p JOIN cities c ON c.id=p.current_city_id WHERE p.user_id=:userId`,
      { userId },
    );
    if (!location)
      return { city: null, distanceBasis: 'CITY_CENTRE', venues: [] };
    const venues = await rows(
      `SELECT p.id,p.name,p.description,p.city,p.state,p.address_line_1 AS "address",l.kind,l.headline,l.image_url AS "imageUrl",l.price_for_two_inr AS "priceForTwoInr",l.duration_minutes AS "durationMinutes",l.tags,
      CASE WHEN p.latitude IS NOT NULL AND p.longitude IS NOT NULL AND :latitude IS NOT NULL AND :longitude IS NOT NULL THEN round((6371*acos(LEAST(1.0,GREATEST(-1.0,sin(radians(p.latitude::float))*sin(radians(CAST(:latitude AS float)))+cos(radians(p.latitude::float))*cos(radians(CAST(:latitude AS float)))*cos(radians(p.longitude::float-CAST(:longitude AS float)))))))::numeric,1)::float ELSE NULL END AS "distanceKm"
      FROM partners p JOIN partner_listings l ON l.partner_id=p.id AND l.is_published
      WHERE p.deleted_at IS NULL AND p.status='ACTIVE' AND lower(p.city)=lower(:city) AND p.country_code=(SELECT country_code FROM cities c JOIN user_profiles up ON up.current_city_id=c.id WHERE up.user_id=:userId)
      AND (:kind IS NULL OR l.kind=:kind) ORDER BY "distanceKm" ASC NULLS LAST,p.name LIMIT 100`,
      { ...location, userId, kind: kind ?? null },
    );
    return { city: location.city, distanceBasis: 'CITY_CENTRE', venues };
  }

  async plans(userId: string, matchId: string) {
    await this.assertMatch(userId, matchId);
    return rows(
      `SELECT d.id,d.match_id AS "matchId",d.creator_user_id AS "creatorUserId",d.proposed_at AS "proposedAt",d.note,d.status,d.partner_status AS "partnerStatus",p.name AS "venueName",p.city,p.address_line_1 AS "address",l.kind,l.image_url AS "imageUrl",l.price_for_two_inr AS "priceForTwoInr"
      FROM date_plans d JOIN partners p ON p.id=d.partner_id JOIN partner_listings l ON l.partner_id=p.id WHERE d.match_id=:matchId ORDER BY d.created_at DESC LIMIT 100`,
      { matchId },
    );
  }

  async propose(
    userId: string,
    matchId: string,
    input: { partnerId: string; proposedAt: string; note: string },
  ) {
    return sequelize.transaction(async (transaction) => {
      const match = await this.assertMatch(userId, matchId, transaction);
      const [venue] = await rows(
        `SELECT p.id FROM partners p JOIN partner_listings l ON l.partner_id=p.id AND l.is_published WHERE p.id=:partnerId AND p.status='ACTIVE' AND p.deleted_at IS NULL FOR SHARE OF p,l`,
        { partnerId: input.partnerId },
        transaction,
      );
      if (!venue)
        throw new Errors.NotFoundError(
          'This venue is no longer accepting date requests',
        );
      const [plan] = await rows<{ id: string }>(
        `INSERT INTO date_plans (id,match_id,partner_id,creator_user_id,proposed_at,note) VALUES (:id,:matchId,:partnerId,:userId,:proposedAt,:note) RETURNING id`,
        { id: randomUUID(), matchId, userId, ...input },
        transaction,
      );
      await new NotificationService().users(
        [match.user_low === userId ? match.user_high : match.user_low],
        {
          key: `date:${plan!.id}:invited`,
          kind: NotificationKind.DATE_INVITED,
          category: 'dates',
          title: 'A little date invitation',
          body: 'Your match invited you out. See the place and time, and let them know.',
          data: { matchId, planId: plan!.id, venueId: input.partnerId },
        },
        transaction,
      );
      return plan;
    });
  }

  async respond(
    userId: string,
    matchId: string,
    planId: string,
    action: string,
  ) {
    await sequelize.transaction(async (transaction) => {
      const match = await this.assertMatch(userId, matchId, transaction);
      const [plan] = await rows<PlanRow>(
        'SELECT id,creator_user_id AS "creatorUserId",status,proposed_at AS "proposedAt",partner_status AS "partnerStatus",partner_id AS "partnerId" FROM date_plans WHERE id=:planId AND match_id=:matchId FOR UPDATE',
        { planId, matchId },
        transaction,
      );
      if (!plan) throw new Errors.NotFoundError('Date plan not found');
      const next = nextPlanStatus(
        plan.status,
        action,
        plan.creatorUserId === userId,
      );
      if (
        !next ||
        (action !== 'CANCELLED' &&
          (new Date(plan.proposedAt).getTime() <= Date.now() ||
            plan.partnerStatus === 'DECLINED'))
      )
        throw new Errors.ConflictError(
          'This date invitation can no longer be changed that way',
        );
      await rows(
        'UPDATE date_plans SET status=:next,updated_at=now() WHERE id=:planId RETURNING id',
        { next, planId },
        transaction,
      );
      const notifications = new NotificationService();
      const data = { matchId, planId, venueId: plan.partnerId };
      await notifications.users(
        [match.user_low === userId ? match.user_high : match.user_low],
        {
          key: `date:${planId}:${next}`,
          kind:
            next === 'ACCEPTED'
              ? NotificationKind.DATE_ACCEPTED
              : next === 'DECLINED'
                ? NotificationKind.DATE_DECLINED
                : NotificationKind.DATE_CANCELLED,
          category: 'dates',
          title:
            next === 'ACCEPTED'
              ? 'Your date invitation was accepted'
              : next === 'DECLINED'
                ? 'A date invitation update'
                : 'Your date was cancelled',
          body:
            next === 'ACCEPTED'
              ? 'You’re both in. The venue will now confirm availability.'
              : next === 'DECLINED'
                ? 'Your match declined this invitation. You can keep chatting.'
                : 'Your match cancelled this plan.',
          data,
        },
        transaction,
      );
      if (
        next === 'ACCEPTED' ||
        (next === 'CANCELLED' && plan.status === 'ACCEPTED')
      ) {
        await notifications.admins(
          plan.partnerId,
          {
            key: `date:${planId}:partner:${next}`,
            kind:
              next === 'ACCEPTED'
                ? NotificationKind.DATE_REQUEST
                : NotificationKind.DATE_CANCELLED,
            category: 'dates',
            title:
              next === 'ACCEPTED'
                ? 'A new date request'
                : 'A date request was cancelled',
            body:
              next === 'ACCEPTED'
                ? 'A couple accepted their invitation. Review the time and confirm availability.'
                : 'The couple cancelled this date. Your requests have been updated.',
            data,
          },
          transaction,
        );
      }
    });
  }
}
