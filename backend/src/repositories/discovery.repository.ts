import { QueryTypes, type Transaction } from 'sequelize';
import { sequelize } from '../config/database';
import { displayablePhotoStatus } from '../services/dating/public-display';
import { datingProfileConfig } from '../config/datingProfile';

export interface MatchRow {
  id: string;
  user_low: string;
  user_high: string;
  created_at: string;
}

export function rows<T extends object>(
  sql: string,
  replacements: Record<string, unknown> = {},
  transaction?: Transaction,
): Promise<T[]> {
  return sequelize.query<T>(sql, {
    replacements,
    type: QueryTypes.SELECT,
    ...(transaction ? { transaction } : {}),
  });
}

// Both sides must be active adults with completed onboarding. Preferences are reciprocal.
function canInteract(left: string, right: string) {
  return `NOT EXISTS (SELECT 1 FROM discovery_exclusions x WHERE (x.actor_id=${left} AND x.target_id=${right}) OR (x.actor_id=${right} AND x.target_id=${left}))`;
}
export const mutualLikesSql = `
  ${canInteract('m.user_low', 'm.user_high')} AND
  EXISTS (SELECT 1 FROM discovery_actions low_like WHERE low_like.actor_id=m.user_low AND low_like.target_id=m.user_high AND low_like.action='LIKE' AND low_like.source='USER')
  AND EXISTS (SELECT 1 FROM discovery_actions high_like WHERE high_like.actor_id=m.user_high AND high_like.target_id=m.user_low AND high_like.action='LIKE' AND high_like.source='USER')
`;

function matchable(field: string, user: string) {
  return `NOT EXISTS(SELECT 1 FROM user_profile_visibility vis WHERE vis.user_id=${user} AND vis.field_code=${field} AND vis.visibility='PRIVATE')`;
}
function hasDisplayablePhotos(user: string) {
  return `NOT EXISTS (SELECT 1 FROM user_profile_visibility v WHERE v.user_id=${user} AND v.field_code='PHOTOS' AND v.visibility<>'PROFILE')
    AND (SELECT count(*) FROM user_photos photo JOIN media asset ON asset.id=photo.media_id AND asset.url IS NOT NULL AND asset.deleted_at IS NULL WHERE photo.user_id=${user} AND photo.deleted_at IS NULL AND photo.moderation_status='${displayablePhotoStatus}') >= :minimumPhotos`;
}
export const eligibleProfilesSql = `
  FROM user_profiles p JOIN users u ON u.id = p.user_id AND u.deleted_at IS NULL
  JOIN accounts a ON a.id = u.account_id AND a.status = 'ACTIVE' AND a.deleted_at IS NULL
  JOIN user_onboarding_progress o ON o.user_id = u.id AND o.status = 'COMPLETED'
  JOIN user_profiles me ON me.user_id = :userId
  LEFT JOIN user_match_preferences mine ON mine.user_id = :userId
  LEFT JOIN user_match_preferences theirs ON theirs.user_id = u.id
  LEFT JOIN cities c ON c.id = p.current_city_id
  LEFT JOIN cities mycity ON mycity.id = me.current_city_id
  WHERE p.profile_status = 'ACTIVE' AND p.deleted_at IS NULL AND u.id <> :userId
  AND me.profile_status='ACTIVE' AND me.deleted_at IS NULL AND me.date_of_birth <= CURRENT_DATE - INTERVAL '18 years'
  AND p.date_of_birth <= CURRENT_DATE - INTERVAL '18 years'
  AND ${canInteract(':userId', 'u.id')}
  AND ${hasDisplayablePhotos('u.id')} AND ${hasDisplayablePhotos(':userId')}
  AND (NOT COALESCE(mine.age_is_dealbreaker, true) OR EXTRACT(YEAR FROM age(p.date_of_birth)) BETWEEN COALESCE(mine.min_age,18) AND COALESCE(mine.max_age,120))
  AND (NOT COALESCE(theirs.age_is_dealbreaker, true) OR EXTRACT(YEAR FROM age(me.date_of_birth)) BETWEEN COALESCE(theirs.min_age,18) AND COALESCE(theirs.max_age,120))
  AND NOT COALESCE(mine.verified_profiles_only, false)
  AND NOT COALESCE(theirs.verified_profiles_only, false)
  AND (NOT COALESCE(mine.distance_is_dealbreaker, false) OR CASE WHEN c.latitude IS NOT NULL AND c.longitude IS NOT NULL AND mycity.latitude IS NOT NULL AND mycity.longitude IS NOT NULL THEN
    6371 * acos(LEAST(1.0,GREATEST(-1.0,sin(radians(c.latitude::float))*sin(radians(mycity.latitude::float))+cos(radians(c.latitude::float))*cos(radians(mycity.latitude::float))*cos(radians((c.longitude-mycity.longitude)::float))))) <= mine.max_distance_km
    ELSE p.current_city_id = me.current_city_id END)
  AND (NOT COALESCE(theirs.distance_is_dealbreaker, false) OR CASE WHEN c.latitude IS NOT NULL AND c.longitude IS NOT NULL AND mycity.latitude IS NOT NULL AND mycity.longitude IS NOT NULL THEN
    6371 * acos(LEAST(1.0,GREATEST(-1.0,sin(radians(c.latitude::float))*sin(radians(mycity.latitude::float))+cos(radians(c.latitude::float))*cos(radians(mycity.latitude::float))*cos(radians((c.longitude-mycity.longitude)::float))))) <= theirs.max_distance_km
    ELSE p.current_city_id = me.current_city_id END)
  AND NOT EXISTS (
    SELECT 1 FROM user_profile_option_preferences pref
    JOIN profile_option_categories cat ON cat.id = pref.category_id
    WHERE pref.user_id = :userId AND (pref.is_dealbreaker OR cat.code = 'GENDER_IDENTITY')
    GROUP BY pref.category_id,cat.code
    HAVING NOT EXISTS (SELECT 1 FROM user_profile_options sel WHERE sel.user_id = u.id AND ${matchable('cat.code', 'u.id')} AND sel.option_id = ANY(array_agg(pref.option_id)))
  )
  AND NOT EXISTS (
    SELECT 1 FROM user_profile_option_preferences pref
    JOIN profile_option_categories cat ON cat.id = pref.category_id
    WHERE pref.user_id = u.id AND (pref.is_dealbreaker OR cat.code = 'GENDER_IDENTITY')
    GROUP BY pref.category_id,cat.code
    HAVING NOT EXISTS (SELECT 1 FROM user_profile_options sel WHERE sel.user_id = :userId AND ${matchable('cat.code', ':userId')} AND sel.option_id = ANY(array_agg(pref.option_id)))
  )
  AND NOT EXISTS (
    SELECT 1 FROM user_language_preferences pref JOIN languages l ON l.id=pref.language_id AND l.is_active
    WHERE pref.user_id=:userId AND pref.is_dealbreaker
    HAVING count(*)>0 AND NOT EXISTS (
      SELECT 1 FROM user_languages actual WHERE actual.user_id=u.id AND ${matchable("'LANGUAGES'", 'u.id')} AND actual.language_id=ANY(array_agg(pref.language_id))
    )
  )
  AND NOT EXISTS (
    SELECT 1 FROM user_language_preferences pref JOIN languages l ON l.id=pref.language_id AND l.is_active
    WHERE pref.user_id=u.id AND pref.is_dealbreaker
    HAVING count(*)>0 AND NOT EXISTS (
      SELECT 1 FROM user_languages actual WHERE actual.user_id=:userId AND ${matchable("'LANGUAGES'", ':userId')} AND actual.language_id=ANY(array_agg(pref.language_id))
    )
  )
  AND NOT EXISTS (
    SELECT 1 FROM user_partner_value_preferences pref JOIN "values" v ON v.id=pref.value_id AND v.is_active
    WHERE pref.user_id=:userId AND pref.is_dealbreaker AND NOT EXISTS (
      SELECT 1 FROM user_values actual WHERE actual.user_id=u.id AND ${matchable("'VALUES'", 'u.id')} AND actual.value_id=pref.value_id
    )
  )
  AND NOT EXISTS (
    SELECT 1 FROM user_partner_value_preferences pref JOIN "values" v ON v.id=pref.value_id AND v.is_active
    WHERE pref.user_id=u.id AND pref.is_dealbreaker AND NOT EXISTS (
      SELECT 1 FROM user_values actual WHERE actual.user_id=:userId AND ${matchable("'VALUES'", ':userId')} AND actual.value_id=pref.value_id
    )
  )
`;

export class DiscoveryRepository {
  private parameters(userId: string) {
    return { userId, minimumPhotos: datingProfileConfig.minimumPhotos };
  }
  private get available() {
    return `${eligibleProfilesSql} AND NOT EXISTS(SELECT 1 FROM matches m WHERE ((m.user_low=:userId AND m.user_high=u.id) OR (m.user_high=:userId AND m.user_low=u.id)) AND ${mutualLikesSql})`;
  }
  ready(userId: string) {
    return rows(
      `SELECT p.user_id FROM user_profiles p JOIN users u ON u.id=p.user_id AND u.deleted_at IS NULL JOIN accounts a ON a.id=u.account_id AND a.status='ACTIVE' AND a.deleted_at IS NULL JOIN user_onboarding_progress o ON o.user_id=p.user_id WHERE p.user_id=:userId AND p.profile_status='ACTIVE' AND p.deleted_at IS NULL AND p.date_of_birth<=CURRENT_DATE-INTERVAL '18 years' AND o.status='COMPLETED'`,
      { userId },
    );
  }
  async hasApprovedPublicPhotos(userId: string) {
    const [result] = await rows<{ eligible: boolean }>(
      `SELECT (${hasDisplayablePhotos(':userId')}) AS eligible`,
      this.parameters(userId),
    );
    return result!.eligible;
  }
  sessionPage(
    userId: string,
    sessionId: string,
    cursor: number,
    limit: number,
  ) {
    return rows<{
      userId: string;
      position: number;
      servedVersion: string | null;
    }>(
      `
      SELECT item.target_id AS "userId",item.position,item.rank_version AS "servedVersion"
      FROM discovery_feed_items item JOIN discovery_feed_sessions s ON s.id=item.session_id
      WHERE s.id=:sessionId AND s.user_id=:userId AND s.expires_at>now() AND item.position>:cursor
      AND EXISTS(SELECT 1 ${this.available} AND u.id=item.target_id
      AND NOT EXISTS(SELECT 1 FROM discovery_actions d WHERE d.actor_id=:userId AND d.target_id=item.target_id AND d.source='USER'))
      ORDER BY item.position LIMIT :limit`,
      { ...this.parameters(userId), sessionId, cursor, limit },
    );
  }
  fresh(userId: string) {
    return rows<{ userId: string }>(
      `SELECT u.id AS "userId" ${this.available}
      AND NOT EXISTS(SELECT 1 FROM discovery_actions d WHERE d.actor_id=:userId AND d.target_id=u.id AND d.source='USER')
      ORDER BY (p.current_city_id=me.current_city_id) DESC NULLS LAST,p.created_at DESC,u.id`,
      this.parameters(userId),
    );
  }
  passed(userId: string, seed: string, after: string | null, limit: number) {
    return rows<{ userId: string }>(
      `SELECT u.id AS "userId" ${this.available}
      AND EXISTS(SELECT 1 FROM discovery_actions d WHERE d.actor_id=:userId AND d.target_id=u.id AND d.action='PASS' AND d.source='USER')
      AND NOT EXISTS(SELECT 1 FROM discovery_actions d WHERE d.actor_id=:userId AND d.target_id=u.id AND d.action='LIKE' AND d.source='USER')
      AND (:after IS NULL OR (md5(CAST(u.id AS text) || :seed),u.id)>(md5(CAST(:after AS text) || :seed),CAST(:after AS uuid)))
      ORDER BY md5(CAST(u.id AS text) || :seed),u.id LIMIT :limit`,
      { ...this.parameters(userId), seed, after, limit },
    );
  }
  async incoming(userId: string, limit: number, offset: number) {
    const pending = `${eligibleProfilesSql}
      AND EXISTS(SELECT 1 FROM discovery_actions d WHERE d.actor_id=u.id AND d.target_id=:userId AND d.action='LIKE' AND d.source='USER')
      AND NOT EXISTS(SELECT 1 FROM discovery_actions d WHERE d.actor_id=:userId AND d.target_id=u.id AND d.source='USER')`;
    const params = { ...this.parameters(userId), limit, offset };
    const [people, counts] = await Promise.all([
      rows<{ userId: string; likedAt: string }>(
        `SELECT u.id AS "userId",(SELECT created_at FROM discovery_actions d WHERE d.actor_id=u.id AND d.target_id=:userId) AS "likedAt" ${pending} ORDER BY "likedAt" DESC,u.id LIMIT :limit OFFSET :offset`,
        params,
      ),
      rows<{ total: number }>(
        `SELECT count(*)::int AS total ${pending}`,
        params,
      ),
    ]);
    return { people, total: counts[0]!.total };
  }
  lockPair(userId: string, targetId: string, transaction: Transaction) {
    return rows(
      'SELECT id FROM users WHERE id IN (:userId,:targetId) ORDER BY id FOR UPDATE',
      { userId, targetId },
      transaction,
    );
  }
  exclude(
    userId: string,
    targetId: string,
    transaction: Transaction,
    reportReason: string | null,
  ) {
    return rows(
      `INSERT INTO discovery_exclusions(actor_id,target_id,report_reason,reported_at) VALUES (:userId,:targetId,:reportReason,CASE WHEN CAST(:reportReason AS text) IS NOT NULL THEN now() END)
       ON CONFLICT(actor_id,target_id) DO UPDATE SET report_reason=EXCLUDED.report_reason,reported_at=EXCLUDED.reported_at
       WHERE discovery_exclusions.report_reason IS NULL AND EXCLUDED.report_reason IS NOT NULL RETURNING target_id`,
      { userId, targetId, reportReason },
      transaction,
    );
  }
  eligible(userId: string, targetId: string, transaction: Transaction) {
    return rows(
      `SELECT u.id ${eligibleProfilesSql} AND u.id=:targetId`,
      { ...this.parameters(userId), targetId },
      transaction,
    );
  }
  priorAction(userId: string, targetId: string, transaction: Transaction) {
    return rows<{ action: string; source: string }>(
      'SELECT action,source FROM discovery_actions WHERE actor_id=:userId AND target_id=:targetId',
      { userId, targetId },
      transaction,
    );
  }
  saveAction(
    userId: string,
    targetId: string,
    action: 'LIKE' | 'PASS',
    transaction: Transaction,
  ) {
    return rows(
      `INSERT INTO discovery_actions(actor_id,target_id,action,source) VALUES (:userId,:targetId,:action,'USER') ON CONFLICT(actor_id,target_id) DO UPDATE SET action=EXCLUDED.action,source='USER',created_at=now() WHERE discovery_actions.source='DEMO' OR discovery_actions.action='PASS' RETURNING actor_id`,
      { userId, targetId, action },
      transaction,
    );
  }
  reciprocalLike(userId: string, targetId: string, transaction: Transaction) {
    return rows(
      "SELECT actor_id FROM discovery_actions WHERE actor_id=:targetId AND target_id=:userId AND action='LIKE' AND source='USER'",
      { userId, targetId },
      transaction,
    );
  }
  createMatch(id: string, low: string, high: string, transaction: Transaction) {
    return rows<{ id: string }>(
      `INSERT INTO matches(id,user_low,user_high) VALUES (:id,:low,:high) ON CONFLICT(user_low,user_high) DO UPDATE SET user_low=EXCLUDED.user_low RETURNING id`,
      { id, low, high },
      transaction,
    );
  }
  match(userId: string, matchId: string, transaction?: Transaction) {
    return rows<MatchRow>(
      `SELECT m.* FROM matches m
      JOIN users u1 ON u1.id=m.user_low AND u1.deleted_at IS NULL JOIN users u2 ON u2.id=m.user_high AND u2.deleted_at IS NULL
      JOIN accounts a1 ON a1.id=u1.account_id AND a1.status='ACTIVE' AND a1.deleted_at IS NULL
      JOIN accounts a2 ON a2.id=u2.account_id AND a2.status='ACTIVE' AND a2.deleted_at IS NULL
      WHERE m.id=:matchId AND :userId IN(m.user_low,m.user_high) AND ${mutualLikesSql}`,
      { userId, matchId },
      transaction,
    );
  }
  matches(userId: string) {
    return rows<MatchRow>(
      `SELECT m.* FROM matches m WHERE :userId IN(user_low,user_high) AND ${mutualLikesSql} ORDER BY created_at DESC LIMIT 100`,
      { userId },
    );
  }
}
