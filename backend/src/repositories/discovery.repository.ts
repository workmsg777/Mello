import { QueryTypes, type Transaction } from 'sequelize';
import { sequelize } from '../config/database';

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
export const mutualLikesSql = `
  EXISTS (SELECT 1 FROM discovery_actions low_like WHERE low_like.actor_id=m.user_low AND low_like.target_id=m.user_high AND low_like.action='LIKE' AND low_like.source='USER')
  AND EXISTS (SELECT 1 FROM discovery_actions high_like WHERE high_like.actor_id=m.user_high AND high_like.target_id=m.user_low AND high_like.action='LIKE' AND high_like.source='USER')
`;

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
  AND p.date_of_birth <= CURRENT_DATE - INTERVAL '18 years'
  AND (SELECT count(*) FROM user_photos photo WHERE photo.user_id=u.id AND photo.deleted_at IS NULL) >= :minimumPhotos
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
    GROUP BY pref.category_id
    HAVING NOT EXISTS (SELECT 1 FROM user_profile_options sel WHERE sel.user_id = u.id AND sel.option_id = ANY(array_agg(pref.option_id)))
  )
  AND NOT EXISTS (
    SELECT 1 FROM user_profile_option_preferences pref
    JOIN profile_option_categories cat ON cat.id = pref.category_id
    WHERE pref.user_id = u.id AND (pref.is_dealbreaker OR cat.code = 'GENDER_IDENTITY')
    GROUP BY pref.category_id
    HAVING NOT EXISTS (SELECT 1 FROM user_profile_options sel WHERE sel.user_id = :userId AND sel.option_id = ANY(array_agg(pref.option_id)))
  )
`;
