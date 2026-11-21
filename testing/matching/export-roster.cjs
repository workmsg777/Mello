const path = require("node:path");
const {
  CACHE,
  backendRequire,
  openDatabase,
  writeJson,
} = require("./runtime.cjs");
async function main() {
  const db = openDatabase(),
    { QueryTypes } = backendRequire("sequelize");
  try {
    const rows = await db.query(
      `SELECT q.username,q.user_id AS "userId",u.account_id AS "accountId",p.display_name AS "displayName",
      EXTRACT(YEAR FROM age(p.date_of_birth))::int AS age,c.name AS city,p.job_title AS job,p.bio,
      a.status,o.status AS onboarding,q.scenario,
      pref.min_age AS "minAge",pref.max_age AS "maxAge",pref.max_distance_km AS "maxDistanceKm",pref.distance_is_dealbreaker AS "distanceIsDealbreaker",
      (SELECT po.code FROM user_profile_options sel JOIN profile_options po ON po.id=sel.option_id JOIN profile_option_categories cat ON cat.id=sel.category_id WHERE sel.user_id=q.user_id AND cat.code='GENDER_IDENTITY' LIMIT 1) AS gender,
      (SELECT po.code FROM user_profile_option_preferences wanted JOIN profile_options po ON po.id=wanted.option_id JOIN profile_option_categories cat ON cat.id=wanted.category_id WHERE wanted.user_id=q.user_id AND cat.code='GENDER_IDENTITY' LIMIT 1) AS seeking,
      (SELECT po.label FROM user_profile_options sel JOIN profile_options po ON po.id=sel.option_id JOIN profile_option_categories cat ON cat.id=sel.category_id WHERE sel.user_id=q.user_id AND cat.code='DATING_INTENTION' LIMIT 1) AS intention,
      ARRAY(SELECT i.name FROM user_interests ui JOIN interests i ON i.id=ui.interest_id WHERE ui.user_id=q.user_id ORDER BY ui.display_order,i.name) AS interests,
      ARRAY(SELECT l.name FROM user_languages ul JOIN languages l ON l.id=ul.language_id WHERE ul.user_id=q.user_id ORDER BY ul.display_order,l.name) AS languages,
      ARRAY(SELECT v.name FROM user_values uv JOIN "values" v ON v.id=uv.value_id WHERE uv.user_id=q.user_id ORDER BY uv.display_order,v.name) AS values,
      EXISTS(SELECT 1 FROM user_profile_visibility vis WHERE vis.user_id=q.user_id AND vis.field_code='INTERESTS' AND vis.visibility='PRIVATE') AS "privateInterests",
      (SELECT count(*)::int FROM user_photos photo WHERE photo.user_id=q.user_id AND photo.deleted_at IS NULL) AS "photoCount",
      COALESCE((SELECT uc.status::text FROM user_consents uc WHERE uc.user_id=q.user_id AND uc.consent_code='PERSONALIZED_MATCHING' ORDER BY uc.created_at DESC,COALESCE(uc.revoked_at,uc.granted_at) DESC,(uc.status='REVOKED') DESC LIMIT 1),'MISSING') AS consent,
      (SELECT i.identifier FROM auth_identities i WHERE i.account_id=u.account_id AND i.is_primary AND i.deleted_at IS NULL LIMIT 1) AS identifier
      FROM qa_fixture_users q JOIN users u ON u.id=q.user_id JOIN accounts a ON a.id=u.account_id
      JOIN user_profiles p ON p.user_id=q.user_id JOIN cities c ON c.id=p.current_city_id
      JOIN user_match_preferences pref ON pref.user_id=q.user_id JOIN user_onboarding_progress o ON o.user_id=q.user_id
      ORDER BY q.ordinal`,
      { type: QueryTypes.SELECT },
    );
    if (rows.length !== 10000)
      throw new Error(
        `Expected 10,000 persisted roster rows; got ${rows.length}`,
      );
    writeJson(path.join(CACHE, "roster.json"), {
      exportedAt: new Date().toISOString(),
      database: "mello_qa_10000",
      source: "Persisted PostgreSQL records joined to normalized catalogs",
      rows,
    });
    console.log(`Exported ${rows.length} persisted users for Excel.`);
  } finally {
    await db.close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
