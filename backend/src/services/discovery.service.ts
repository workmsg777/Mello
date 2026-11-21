import { randomUUID } from 'node:crypto';
import { type Transaction } from 'sequelize';
import { sequelize } from '../config/database';
import Errors from '../errors';
import {
  rows,
  DiscoveryRepository,
  type MatchRow,
} from '../repositories/discovery.repository';
import {
  createFeedSession,
  sessionExists,
  markPageServed,
  recordImpressions,
} from '../repositories/matching.repository';
import { DatingCatalogService } from './dating/dating-catalog.service';
import { DatingStateService } from './dating/dating-state.service';
import { nextPlanStatus } from './discovery.rules';
import { MatchingService } from './matching/matching.service';
import { RANKING_VERSION } from './matching/scoring';
import type { FeedCycle, PairRanking } from '../types/matching';
import { NotificationService } from '../notifications/notification.service';
import { NotificationKind } from '../notifications/types';
import { matchingConfig } from '../config/matching';

interface PlanRow {
  id: string;
  creatorUserId: string;
  status: string;
  proposedAt: string;
  partnerStatus: string;
  partnerId: string;
}
export class DiscoveryService {
  private readonly catalog = new DatingCatalogService();
  private readonly state = new DatingStateService();
  private readonly matching = new MatchingService();
  private readonly repository = new DiscoveryRepository();

  async impressions(userId: string, sessionId: string, targets: string[]) {
    const count = await recordImpressions(userId, sessionId, [
      ...new Set(targets),
    ]);
    if (count === null)
      throw new Errors.NotFoundError('Discovery session not found');
    return count;
  }

  async assertReady(userId: string): Promise<void> {
    const [profile] = await this.repository.ready(userId);
    if (!profile)
      throw new Errors.ForbiddenError(
        'Complete your profile before discovering people',
      );
  }

  private async card(
    viewerId: string,
    userId: string,
    provided?: PairRanking,
    catalog?: ReturnType<DatingCatalogService['get']>,
  ) {
    const preview = await this.state.getPreview(userId, catalog);
    const rank =
      provided ??
      (await this.matching.rank(viewerId, [userId])).rankings.get(userId)!;
    const { effectiveScore: _internal, ...ranking } = rank;
    return {
      userId,
      ...preview,
      ranking,
      compatibility: {
        percentage: ranking.score,
        isDemo: false,
        label:
          ranking.score === null
            ? 'More profile information needed'
            : 'Profile alignment',
      },
    };
  }

  private cards(
    viewerId: string,
    ids: string[],
    rankings: ReadonlyMap<string, PairRanking>,
  ) {
    if (!ids.length) return [];
    const catalog = this.catalog.get();
    return Promise.all(
      ids.map((id) => this.card(viewerId, id, rankings.get(id), catalog)),
    );
  }

  async feed(
    userId: string,
    limit: number,
    offset: number,
    cycle: FeedCycle = {},
  ) {
    if (cycle.feedSessionId) {
      if (!(await sessionExists(userId, cycle.feedSessionId)))
        throw new Errors.NotFoundError(
          'Discovery session expired. Refresh Discover.',
        );
      // Freeze IDs/order, never eligibility, consent, text, or public explanations.
      const remaining = await this.repository.sessionPage(
        userId,
        cycle.feedSessionId,
        cycle.cursor ?? -1,
        limit + 1,
      );
      const page = remaining.slice(0, limit);
      const ranked = await this.matching.rank(
        userId,
        page.map((p) => p.userId),
        new Set(
          page
            .filter((p) => p.servedVersion?.startsWith('HYBRID:'))
            .map((p) => p.userId),
        ),
      );
      await markPageServed(cycle.feedSessionId, ranked.rankings);
      return {
        profiles: await this.cards(
          userId,
          page.map((p) => p.userId),
          ranked.rankings,
        ),
        nextOffset: null,
        feedMode: 'FRESH' as const,
        shuffleSeed: null,
        nextCursor: null,
        feedSessionId: cycle.feedSessionId,
        nextRankCursor:
          remaining.length > limit ? page[page.length - 1]!.position : null,
        needsApprovedPhotos:
          !page.length &&
          !(await this.repository.hasApprovedPublicPhotos(userId)),
        compatibilityMode: 'PROFILE_ALIGNMENT',
      };
    }
    const fresh = await this.repository.fresh(userId);
    if (fresh.length || offset > 0) {
      // Complete eligible pool is scored before selecting the first page.
      const ranked = await this.matching.rank(
        userId,
        fresh.map((p) => p.userId),
      );
      const page = ranked.ids.slice(offset, offset + limit);
      const feedSessionId = await createFeedSession(
        userId,
        ranked.ids,
        `${matchingConfig.modeFor(userId)}:${RANKING_VERSION}`,
        ranked.rankings,
        page,
      );
      return {
        profiles: await this.cards(userId, page, ranked.rankings),
        nextOffset: ranked.ids.length > offset + limit ? offset + limit : null,
        feedMode: 'FRESH' as const,
        shuffleSeed: null,
        nextCursor: null,
        feedSessionId,
        nextRankCursor:
          ranked.ids.length > offset + limit ? offset + page.length - 1 : null,
        needsApprovedPhotos:
          !page.length &&
          !(await this.repository.hasApprovedPublicPhotos(userId)),
        compatibilityMode: 'PROFILE_ALIGNMENT',
      };
    }
    // Passed profiles get another chance in stable seeded rounds; never recycle likes.
    let seed = cycle.shuffleSeed ?? randomUUID();
    let candidates = await this.repository.passed(
      userId,
      seed,
      cycle.after ?? null,
      limit + 1,
    );
    if (!candidates.length && cycle.after) {
      seed = randomUUID();
      candidates = await this.repository.passed(userId, seed, null, limit + 1);
    }
    const page = candidates.slice(0, limit);
    const ranked = await this.matching.rank(
      userId,
      page.map((p) => p.userId),
    );
    return {
      profiles: await this.cards(
        userId,
        page.map((p) => p.userId),
        ranked.rankings,
      ),
      nextOffset: null,
      feedMode: 'RECYCLED' as const,
      shuffleSeed: seed,
      nextCursor:
        candidates.length > limit ? candidates[limit - 1]!.userId : null,
      feedSessionId: null,
      nextRankCursor: null,
      needsApprovedPhotos:
        !page.length &&
        !(await this.repository.hasApprovedPublicPhotos(userId)),
      compatibilityMode: 'PROFILE_ALIGNMENT',
    };
  }

  async incomingLikes(userId: string, limit: number, offset: number) {
    const { people, total } = await this.repository.incoming(
      userId,
      limit,
      offset,
    );
    const ranked = await this.matching.rank(
      userId,
      people.map((p) => p.userId),
    );
    return {
      profiles: await Promise.all(
        people.map(async (p) => ({
          ...(await this.card(userId, p.userId, ranked.rankings.get(p.userId))),
          likedAt: p.likedAt,
        })),
      ),
      total,
      nextOffset:
        offset + people.length < total ? offset + people.length : null,
    };
  }

  async exclude(userId: string, targetId: string, reportReason?: string) {
    if (userId === targetId)
      throw new Errors.BadRequestError('Choose another profile');
    return sequelize.transaction(async (transaction) => {
      const users = await this.repository.lockPair(
        userId,
        targetId,
        transaction,
      );
      if (users.length !== 2)
        throw new Errors.NotFoundError('Profile unavailable');
      const inserted = await this.repository.exclude(
        userId,
        targetId,
        transaction,
        reportReason ?? null,
      );
      return inserted.length > 0;
    });
  }

  async act(userId: string, targetId: string, action: 'LIKE' | 'PASS') {
    if (userId === targetId)
      throw new Errors.BadRequestError('You cannot like your own profile');
    return sequelize.transaction(async (transaction) => {
      // Same lock order serializes reciprocal likes across API instances.
      await this.repository.lockPair(userId, targetId, transaction);
      const [eligible] = await this.repository.eligible(
        userId,
        targetId,
        transaction,
      );
      if (!eligible)
        throw new Errors.NotFoundError('This profile is no longer available');
      const [prior] = await this.repository.priorAction(
        userId,
        targetId,
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
      await this.repository.saveAction(userId, targetId, action, transaction);
      if (action === 'PASS') return { matched: false, matchId: null };
      const [reciprocal] = await this.repository.reciprocalLike(
        userId,
        targetId,
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
      const [match] = await this.repository.createMatch(
        randomUUID(),
        low!,
        high!,
        transaction,
      );
      await new NotificationService().users(
        [userId, targetId],
        {
          key: `match:${match!.id}`,
          kind: NotificationKind.MATCH,
          category: 'matches',
          title: 'It is a mutual spark',
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
    const [match] = await this.repository.match(userId, matchId, transaction);
    if (!match) throw new Errors.NotFoundError('Match not found');
    return match;
  }

  async feedback(userId: string, matchId: string, worthwhile: boolean) {
    await sequelize.transaction(async (transaction) => {
      await this.assertMatch(userId, matchId, transaction);
      await rows(
        `INSERT INTO match_feedback(match_id,user_id,worthwhile) VALUES (:matchId,:userId,:worthwhile)
        ON CONFLICT(match_id,user_id) DO UPDATE SET worthwhile=EXCLUDED.worthwhile,updated_at=now() RETURNING match_id`,
        { matchId, userId, worthwhile },
        transaction,
      );
    });
  }
  async matches(userId: string) {
    const matches = await this.repository.matches(userId);
    const other = (match: MatchRow) =>
      match.user_low === userId ? match.user_high : match.user_low;
    const ranked = await this.matching.rank(userId, matches.map(other));
    const visible = await Promise.all(
      matches.map(async (match) => {
        try {
          await this.assertMatch(userId, match.id);
          return {
            id: match.id,
            createdAt: match.created_at,
            person: await this.card(
              userId,
              other(match),
              ranked.rankings.get(other(match)),
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
