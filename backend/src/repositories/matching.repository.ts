import { randomUUID } from 'node:crypto';
import { sequelize } from '../config/database';
import { matchingConfig } from '../config/matching';
import { rows } from './discovery.repository';
import type { MatchingProfile, PairRanking } from '../types/matching';

/** One batched projection; never sends contact details, DOB, sensitive options or chats to AI. */
export async function matchingProfiles(
  ids: string[],
  includeText = true,
): Promise<Map<string, MatchingProfile>> {
  if (!ids.length) return new Map();
  const records = await rows<MatchingProfile>(
    `
    SELECT p.user_id AS "userId", EXTRACT(YEAR FROM age(p.date_of_birth))::int AS age,
      p.current_city_id AS "cityId", c.latitude::float AS latitude,c.longitude::float AS longitude,p.created_at AS "createdAt",
      COALESCE((SELECT consent.status='GRANTED' AND consent.policy_version=:policyVersion FROM user_consents consent
        WHERE consent.user_id=p.user_id AND consent.consent_code='PERSONALIZED_MATCHING'
        ORDER BY consent.created_at DESC,COALESCE(consent.revoked_at,consent.granted_at) DESC,(consent.status='REVOKED') DESC LIMIT 1),false) AS personalized,
      COALESCE(mp.min_age,18) AS "minAge",COALESCE(mp.max_age,120) AS "maxAge",COALESCE(mp.age_is_dealbreaker,true) AS "ageIsDealbreaker",
      COALESCE(mp.max_distance_km,50) AS "maxDistanceKm",COALESCE(mp.prefer_same_city,false) AS "preferSameCity",
      NOT EXISTS(SELECT 1 FROM user_profile_visibility vis WHERE vis.user_id=p.user_id AND vis.field_code='INTERESTS' AND vis.visibility<>'PROFILE') AS "publicInterests",
      NOT EXISTS(SELECT 1 FROM user_profile_visibility vis WHERE vis.user_id=p.user_id AND vis.field_code='LANGUAGES' AND vis.visibility<>'PROFILE') AS "publicLanguages",
      p.prefer_shared_intention AS "preferSharedIntention",
      EXISTS(SELECT 1 FROM user_profile_visibility vis WHERE vis.user_id=p.user_id AND vis.field_code='DATING_INTENTION' AND vis.visibility='PROFILE') AS "publicIntentions",
      ARRAY(SELECT ui.interest_id::text FROM user_interests ui JOIN interests i ON i.id=ui.interest_id AND i.is_active WHERE ui.user_id=p.user_id AND NOT EXISTS(SELECT 1 FROM user_profile_visibility vis WHERE vis.user_id=p.user_id AND vis.field_code='INTERESTS' AND vis.visibility='PRIVATE') ORDER BY ui.interest_id) AS interests,
      ARRAY(SELECT ul.language_id::text FROM user_languages ul JOIN languages l ON l.id=ul.language_id AND l.is_active WHERE ul.user_id=p.user_id AND NOT EXISTS(SELECT 1 FROM user_profile_visibility vis WHERE vis.user_id=p.user_id AND vis.field_code='LANGUAGES' AND vis.visibility='PRIVATE') ORDER BY ul.language_id) AS languages,
      ARRAY(SELECT uv.value_id::text FROM user_values uv JOIN "values" v ON v.id=uv.value_id AND v.is_active WHERE uv.user_id=p.user_id AND NOT EXISTS(SELECT 1 FROM user_profile_visibility vis WHERE vis.user_id=p.user_id AND vis.field_code='VALUES' AND vis.visibility='PRIVATE') ORDER BY uv.value_id) AS values,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id',vp.value_id,'weight',vp.importance)) FROM user_partner_value_preferences vp JOIN "values" v ON v.id=vp.value_id AND v.is_active WHERE vp.user_id=p.user_id),'[]'::jsonb) AS "valuePreferences",
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id',lp.language_id,'weight',lp.priority)) FROM user_language_preferences lp JOIN languages l ON l.id=lp.language_id AND l.is_active WHERE lp.user_id=p.user_id),'[]'::jsonb) AS "languagePreferences",
      COALESCE((SELECT jsonb_object_agg(selected.code,selected.ids) FROM (
        SELECT cat.code,jsonb_agg(sel.option_id::text ORDER BY sel.option_id) AS ids FROM user_profile_options sel
        JOIN profile_option_categories cat ON cat.id=sel.category_id AND cat.is_active AND NOT cat.is_sensitive AND cat.allow_match_preference
        JOIN profile_options opt ON opt.id=sel.option_id AND opt.is_active
        JOIN user_profile_visibility vis ON vis.user_id=sel.user_id AND vis.field_code=cat.code AND vis.visibility IN ('PROFILE','MATCHING_ONLY')
        WHERE sel.user_id=p.user_id GROUP BY cat.code
      ) selected),'{}'::jsonb) AS options,
      COALESCE((SELECT jsonb_object_agg(preferred.code,preferred.preferences) FROM (
        SELECT cat.code,jsonb_agg(jsonb_build_object('id',pref.option_id,'weight',pref.priority)) AS preferences
        FROM user_profile_option_preferences pref
        JOIN profile_option_categories cat ON cat.id=pref.category_id AND cat.is_active AND NOT cat.is_sensitive AND cat.allow_match_preference
        JOIN profile_options opt ON opt.id=pref.option_id AND opt.is_active
        WHERE pref.user_id=p.user_id AND (NOT pref.is_dealbreaker OR cat.code='DATING_INTENTION') AND cat.code<>'GENDER_IDENTITY' GROUP BY cat.code
      ) preferred),'{}'::jsonb) AS "optionPreferences",
      CASE WHEN :includeText THEN concat_ws(E'\n',CASE WHEN p.bio_moderation_status IN ('APPROVED','NOT_REVIEWED') AND NOT EXISTS(SELECT 1 FROM user_profile_visibility vis WHERE vis.user_id=p.user_id AND vis.field_code='BIO' AND vis.visibility='PRIVATE') THEN p.bio ELSE NULL END,
        (SELECT string_agg(answer.answer_text,E'\n' ORDER BY answer.display_order) FROM (
          SELECT pa.answer_text,pa.display_order FROM user_prompt_answers pa JOIN prompts prompt ON prompt.id=pa.prompt_id AND prompt.is_active
          WHERE pa.user_id=p.user_id AND pa.is_active AND pa.deleted_at IS NULL AND pa.moderation_status IN ('APPROVED','NOT_REVIEWED') AND NOT EXISTS(SELECT 1 FROM user_profile_visibility vis WHERE vis.user_id=p.user_id AND vis.field_code='PROMPTS' AND vis.visibility='PRIVATE') ORDER BY pa.display_order LIMIT 3
        ) answer)) ELSE '' END AS "semanticText"
    FROM user_profiles p LEFT JOIN cities c ON c.id=p.current_city_id LEFT JOIN user_match_preferences mp ON mp.user_id=p.user_id
    WHERE p.user_id IN (:ids)`,
    { ids, includeText, policyVersion: matchingConfig.policyVersion },
  );
  const names = await rows<{ id: string; name: string }>(
    `SELECT id,name FROM interests WHERE is_active UNION ALL SELECT id,name FROM languages WHERE is_active UNION ALL SELECT o.id,o.label AS name FROM profile_options o JOIN profile_option_categories c ON c.id=o.category_id WHERE c.code='DATING_INTENTION' AND o.is_active`,
  );
  const labels = new Map(names.map((row) => [row.id, row.name]));
  return new Map(records.map((p) => [p.userId, { ...p, labels }]));
}

export async function createFeedSession(
  userId: string,
  targetIds: string[],
  version: string,
  rankings: ReadonlyMap<string, PairRanking>,
  page: string[],
): Promise<string> {
  const id = randomUUID();
  await sequelize.transaction(async (transaction) => {
    // Keep exposure attribution for 30 days, then remove the snapshot and its impressions together.
    await rows(
      "DELETE FROM discovery_feed_sessions WHERE user_id=:userId AND created_at<now()-interval '30 days' RETURNING id",
      { userId },
      transaction,
    );
    await rows(
      `INSERT INTO discovery_feed_sessions(id,user_id,algorithm_version,expires_at) VALUES (:id,:userId,:version,now()+CAST(:minutes AS int)*interval '1 minute') RETURNING id`,
      { id, userId, version, minutes: matchingConfig.sessionMinutes },
      transaction,
    );
    const delivered = new Set(page);
    if (targetIds.length)
      await rows(
        `INSERT INTO discovery_feed_items(session_id,target_id,position,rank_version,served_version)
      SELECT :id,(target->>'id')::uuid,(ordinality-1)::int,target->>'version',CASE WHEN (target->>'served')::boolean THEN target->>'version' END FROM jsonb_array_elements(CAST(:targets AS jsonb)) WITH ORDINALITY AS item(target,ordinality) RETURNING position`,
        {
          id,
          targets: JSON.stringify(
            targetIds.map((id) => {
              const ranking = rankings.get(id)!;
              return {
                id,
                served: delivered.has(id),
                version: ranking.mode + ':' + ranking.version,
              };
            }),
          ),
        },
        transaction,
      );
  });
  return id;
}

export async function markPageServed(
  sessionId: string,
  rankings: ReadonlyMap<string, PairRanking>,
) {
  if (!rankings.size) return;
  const versions = Object.fromEntries(
    [...rankings].map(([id, r]) => [id, r.mode + ':' + r.version]),
  );
  await rows(
    `UPDATE discovery_feed_items i SET served_version=v.value
    FROM jsonb_each_text(CAST(:versions AS jsonb)) v
    WHERE i.session_id=:sessionId AND i.target_id=v.key::uuid RETURNING i.target_id`,
    { sessionId, versions: JSON.stringify(versions) },
  );
}
export async function sessionExists(userId: string, sessionId: string) {
  const [session] = await rows<{ id: string }>(
    'SELECT id FROM discovery_feed_sessions WHERE id=:sessionId AND user_id=:userId AND expires_at>now()',
    { userId, sessionId },
  );
  return Boolean(session);
}

export async function recordImpressions(
  userId: string,
  sessionId: string,
  targets: string[],
) {
  const members = await rows<{ total: number }>(
    `SELECT count(*)::int AS total FROM discovery_feed_items i JOIN discovery_feed_sessions s ON s.id=i.session_id WHERE s.user_id=:userId AND s.id=:sessionId AND s.expires_at>now() AND (i.served_version IS NOT NULL OR i.rank_version IS NULL) AND i.target_id IN (:targets)`,
    { userId, sessionId, targets },
  );
  if (members[0]?.total !== targets.length) return null;
  const inserted = await rows<{ targetId: string }>(
    `
    INSERT INTO discovery_impressions(session_id,user_id,target_id,algorithm_version,served_version)
    SELECT s.id,s.user_id,i.target_id,s.algorithm_version,i.served_version FROM discovery_feed_sessions s JOIN discovery_feed_items i ON i.session_id=s.id
    WHERE s.id=:sessionId AND s.user_id=:userId AND s.expires_at>now() AND i.target_id IN (:targets)
    ON CONFLICT(session_id,target_id) DO NOTHING RETURNING target_id AS "targetId"`,
    { userId, sessionId, targets },
  );
  return inserted.length;
}
