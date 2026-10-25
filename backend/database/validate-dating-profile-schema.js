'use strict';

require('dotenv').config();
const assert = require('node:assert/strict');
const { Sequelize, QueryTypes } = require('sequelize');
const configs = require('./config');

const expectedTables = [
  'cities',
  'interest_categories',
  'interests',
  'languages',
  'onboarding_steps',
  'personality_frameworks',
  'personality_types',
  'profile_option_categories',
  'profile_options',
  'prompt_categories',
  'prompts',
  'user_consents',
  'user_interests',
  'user_language_preferences',
  'user_languages',
  'user_match_preferences',
  'user_onboarding_progress',
  'user_onboarding_step_progress',
  'user_partner_value_preferences',
  'user_personality_results',
  'user_profile_option_preferences',
  'user_profile_options',
  'user_profile_visibility',
  'user_profiles',
  'user_prompt_answers',
  'user_values',
  'values',
];

const expectedEnums = {
  enum_cities_city_tier: ['TIER_1', 'TIER_2', 'TIER_3', 'OTHER'],
  enum_personality_frameworks_result_mode: [
    'CATEGORICAL',
    'DIMENSIONAL',
    'HYBRID',
  ],
  enum_profile_option_categories_selection_mode: ['SINGLE', 'MULTIPLE'],
  enum_prompts_response_type: ['TEXT', 'MEDIA', 'TEXT_OR_MEDIA'],
  enum_user_consents_status: ['GRANTED', 'REVOKED'],
  enum_user_interests_source: ['SELF_SELECTED', 'SUGGESTED', 'INFERRED'],
  enum_user_languages_proficiency: [
    'NATIVE',
    'FLUENT',
    'CONVERSATIONAL',
    'BASIC',
  ],
  enum_user_onboarding_progress_status: [
    'NOT_STARTED',
    'IN_PROGRESS',
    'COMPLETED',
  ],
  enum_user_onboarding_step_progress_status: [
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED',
    'SKIPPED',
  ],
  enum_user_personality_results_source: [
    'SELF_DECLARED',
    'IN_APP_TEST',
    'IMPORTED',
    'INFERRED',
  ],
  enum_user_profile_visibility_visibility: [
    'PROFILE',
    'MATCHING_ONLY',
    'PRIVATE',
  ],
  enum_user_profiles_bio_moderation_status: [
    'PENDING',
    'APPROVED',
    'REJECTED',
    'NOT_REVIEWED',
  ],
  enum_user_profiles_profile_status: ['DRAFT', 'ACTIVE', 'PAUSED'],
  enum_user_prompt_answers_moderation_status: [
    'NOT_REVIEWED',
    'PENDING',
    'APPROVED',
    'REJECTED',
  ],
};

const requiredIndexes = [
  'cities_country_code_idx',
  'cities_is_active_idx',
  'cities_name_idx',
  'cities_state_code_idx',
  'interests_category_id_idx',
  'languages_is_active_idx',
  'prompts_category_id_idx',
  'user_consents_lookup_idx',
  'user_consents_user_id_idx',
  'user_interests_interest_id_idx',
  'user_language_preferences_language_id_idx',
  'user_languages_language_id_idx',
  'user_onboarding_progress_current_step_id_idx',
  'user_onboarding_step_progress_step_id_idx',
  'user_partner_value_preferences_value_id_idx',
  'user_personality_results_framework_id_idx',
  'user_personality_results_one_live_framework',
  'user_personality_results_personality_type_id_idx',
  'user_profile_option_preferences_category_option_idx',
  'user_profile_option_preferences_option_id_idx',
  'user_profile_options_category_id_option_id_idx',
  'user_profile_options_option_id_idx',
  'user_profiles_current_city_id_idx',
  'user_profiles_hometown_city_id_idx',
  'user_prompt_answers_media_id_idx',
  'user_prompt_answers_prompt_id_idx',
  'user_values_value_id_idx',
];

const requiredConstraints = [
  'onboarding_steps_required_not_skippable',
  'profile_option_categories_selection_bounds',
  'user_match_preferences_age_order',
  'user_match_preferences_distance_positive',
  'user_match_preferences_min_age_adult',
  'user_personality_results_confidence_range',
  'user_personality_results_framework_type_fk',
  'user_profile_option_preferences_category_option_fk',
  'user_profile_option_preferences_priority_range',
  'user_profile_options_category_option_fk',
  'user_prompt_answers_content_present',
  'user_values_importance_range',
];

function makeSequelize() {
  const config = configs[process.env.NODE_ENV || 'development'];
  if (config.use_env_variable)
    return new Sequelize(process.env[config.use_env_variable], config);
  return new Sequelize(
    config.database,
    config.username,
    config.password,
    config,
  );
}

async function main() {
  const sequelize = makeSequelize();
  try {
    const tables = await sequelize.query(
      `SELECT table_name AS "tableName" FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name IN (:tables) ORDER BY table_name`,
      {
        replacements: { tables: expectedTables },
        type: QueryTypes.SELECT,
      },
    );
    assert.deepEqual(
      tables.map(({ tableName }) => tableName),
      expectedTables,
    );

    const comments = await sequelize.query(
      `SELECT c.relname AS "tableName", obj_description(c.oid) AS "tableComment",
              count(a.attnum)::int AS "columnCount",
              count(col_description(c.oid, a.attnum))::int AS "commentedColumnCount"
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
       WHERE n.nspname = 'public' AND c.relname IN (:tables)
       GROUP BY c.oid, c.relname ORDER BY c.relname`,
      {
        replacements: { tables: expectedTables },
        type: QueryTypes.SELECT,
      },
    );
    assert.equal(comments.length, expectedTables.length);
    assert.ok(comments.every(({ tableComment }) => Boolean(tableComment)));
    assert.ok(
      comments.every(
        ({ columnCount, commentedColumnCount }) =>
          columnCount === commentedColumnCount,
      ),
    );

    const [{ primaryKeys, foreignKeys }] = await sequelize.query(
      `SELECT count(*) FILTER (WHERE constraint_type = 'PRIMARY KEY')::int AS "primaryKeys",
              count(*) FILTER (WHERE constraint_type = 'FOREIGN KEY')::int AS "foreignKeys"
       FROM information_schema.table_constraints
       WHERE constraint_schema = 'public' AND table_name IN (:tables)`,
      {
        replacements: { tables: expectedTables },
        type: QueryTypes.SELECT,
      },
    );
    assert.equal(primaryKeys, expectedTables.length);
    assert.equal(foreignKeys, 36);

    const foreignKeyRules = await sequelize.query(
      `SELECT rc.update_rule AS "updateRule", rc.delete_rule AS "deleteRule", count(*)::int AS count
       FROM information_schema.referential_constraints rc
       JOIN information_schema.table_constraints tc ON tc.constraint_name = rc.constraint_name
         AND tc.constraint_schema = rc.constraint_schema
       WHERE tc.constraint_schema = 'public' AND tc.table_name IN (:tables)
       GROUP BY rc.update_rule, rc.delete_rule ORDER BY rc.delete_rule`,
      {
        replacements: { tables: expectedTables },
        type: QueryTypes.SELECT,
      },
    );
    assert.deepEqual(foreignKeyRules, [
      { updateRule: 'CASCADE', deleteRule: 'CASCADE', count: 15 },
      { updateRule: 'CASCADE', deleteRule: 'RESTRICT', count: 21 },
    ]);

    const constraints = await sequelize.query(
      `SELECT conname AS name FROM pg_constraint WHERE conname IN (:constraints) ORDER BY conname`,
      {
        replacements: { constraints: requiredConstraints },
        type: QueryTypes.SELECT,
      },
    );
    assert.deepEqual(
      constraints.map(({ name }) => name),
      [...requiredConstraints].sort(),
    );

    const indexes = await sequelize.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname IN (:indexes) ORDER BY indexname`,
      {
        replacements: { indexes: requiredIndexes },
        type: QueryTypes.SELECT,
      },
    );
    assert.deepEqual(
      indexes.map(({ indexname }) => indexname),
      [...requiredIndexes].sort(),
    );
    const personalityIndex = await sequelize.query(
      `SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'user_personality_results_one_live_framework'`,
      { type: QueryTypes.SELECT },
    );
    assert.match(personalityIndex[0].indexdef, / WHERE /);

    const enums = await sequelize.query(
      `SELECT t.typname AS "enumName", array_agg(e.enumlabel ORDER BY e.enumsortorder) AS values
       FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
       JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = 'public' AND t.typname IN (:enums) GROUP BY t.typname`,
      {
        replacements: { enums: Object.keys(expectedEnums) },
        type: QueryTypes.SELECT,
      },
    );
    assert.equal(enums.length, Object.keys(expectedEnums).length);
    for (const { enumName, values } of enums) {
      const normalized = Array.isArray(values)
        ? values
        : values.slice(1, -1).split(',');
      assert.deepEqual(normalized, expectedEnums[enumName]);
    }

    const [seedCounts] = await sequelize.query(
      `SELECT
         (SELECT count(*)::int FROM cities) AS cities,
         (SELECT count(*)::int FROM profile_option_categories) AS "optionCategories",
         (SELECT count(*)::int FROM languages) AS languages,
         (SELECT count(*)::int FROM interest_categories) AS "interestCategories",
         (SELECT count(*)::int FROM prompt_categories) AS "promptCategories",
         (SELECT count(*)::int FROM personality_frameworks) AS "personalityFrameworks",
         (SELECT count(*)::int FROM personality_types) AS "personalityTypes",
         (SELECT count(*)::int FROM onboarding_steps WHERE onboarding_version = 1) AS "onboardingSteps"`,
      { type: QueryTypes.SELECT },
    );
    assert.ok(seedCounts.cities >= 15);
    assert.ok(seedCounts.optionCategories >= 14);
    assert.ok(seedCounts.languages >= 10);
    assert.ok(seedCounts.interestCategories >= 15);
    assert.ok(seedCounts.promptCategories >= 8);
    assert.ok(seedCounts.personalityFrameworks >= 5);
    assert.ok(seedCounts.personalityTypes >= 16);
    assert.ok(seedCounts.onboardingSteps >= 12);

    console.log(
      JSON.stringify({
        tables: tables.length,
        primaryKeys,
        foreignKeys,
        tableComments: comments.length,
        columnComments: comments.reduce(
          (sum, row) => sum + row.commentedColumnCount,
          0,
        ),
        enums: enums.length,
        checkedConstraints: constraints.length,
        checkedIndexes: indexes.length,
        seedCounts,
      }),
    );
  } finally {
    await sequelize.close();
  }
}

main().catch((error) => {
  console.error(`Dating-profile schema validation failed: ${error.message}`);
  process.exitCode = 1;
});
