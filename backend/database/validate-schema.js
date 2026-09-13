'use strict';

require('dotenv').config();
const assert = require('node:assert/strict');
const { Sequelize, QueryTypes } = require('sequelize');
const configs = require('./config');

const expectedTables = [
  'account_roles',
  'accounts',
  'auth_identities',
  'media',
  'otp_challenges',
  'partner_photos',
  'partner_users',
  'partners',
  'platform_users',
  'roles',
  'user_photos',
  'user_sessions',
  'users',
];

const expectedEnums = {
  enum_accounts_account_type: ['DATING_USER', 'PARTNER_USER', 'PLATFORM_USER'],
  enum_accounts_status: [
    'PENDING',
    'ACTIVE',
    'SUSPENDED',
    'BLOCKED',
    'DEACTIVATED',
    'DELETED',
  ],
  enum_auth_identities_provider: ['PHONE', 'EMAIL', 'GOOGLE', 'APPLE'],
  enum_media_media_type: ['IMAGE', 'VIDEO', 'AUDIO', 'OTHER'],
  enum_otp_challenges_channel: ['PHONE', 'EMAIL'],
  enum_otp_challenges_purpose: [
    'SIGNUP',
    'LOGIN',
    'VERIFY_PHONE',
    'VERIFY_EMAIL',
    'CHANGE_PHONE',
    'CHANGE_EMAIL',
    'ACCOUNT_RECOVERY',
    'PASSWORD_RESET',
  ],
  enum_partner_photos_category: ['COVER', 'GALLERY', 'MENU', 'VENUE', 'OTHER'],
  enum_partner_users_staff_role: ['OWNER', 'MANAGER', 'STAFF'],
  enum_partners_category: ['CAFE', 'HOTEL', 'ACTIVITY', 'OTHER'],
  enum_partners_status: ['ACTIVE', 'INACTIVE'],
  enum_user_photos_moderation_status: ['PENDING', 'APPROVED', 'REJECTED'],
  enum_user_sessions_platform: ['ANDROID', 'IOS', 'WEB', 'UNKNOWN'],
};

function makeSequelize() {
  const config = configs[process.env.NODE_ENV || 'development'];
  if (config.use_env_variable) {
    return new Sequelize(process.env[config.use_env_variable], config);
  }
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
       WHERE table_schema = 'public' AND table_name IN (:tables)
       ORDER BY table_name`,
      { replacements: { tables: expectedTables }, type: QueryTypes.SELECT },
    );
    assert.deepEqual(
      tables.map(({ tableName }) => tableName),
      expectedTables,
    );

    const [{ count: foreignKeyCount }] = await sequelize.query(
      `SELECT count(*)::int AS count FROM information_schema.table_constraints
       WHERE constraint_schema = 'public' AND constraint_type = 'FOREIGN KEY'
         AND table_name IN (:tables)`,
      { replacements: { tables: expectedTables }, type: QueryTypes.SELECT },
    );
    assert.equal(foreignKeyCount, 14);
    const foreignKeyRules = await sequelize.query(
      `SELECT rc.update_rule AS "updateRule", rc.delete_rule AS "deleteRule", count(*)::int AS count
       FROM information_schema.referential_constraints rc
       JOIN information_schema.table_constraints tc ON tc.constraint_name = rc.constraint_name
         AND tc.constraint_schema = rc.constraint_schema
       WHERE tc.constraint_schema = 'public' AND tc.table_name IN (:tables)
       GROUP BY rc.update_rule, rc.delete_rule
       ORDER BY rc.delete_rule`,
      { replacements: { tables: expectedTables }, type: QueryTypes.SELECT },
    );
    assert.deepEqual(foreignKeyRules, [
      { updateRule: 'CASCADE', deleteRule: 'CASCADE', count: 12 },
      { updateRule: 'CASCADE', deleteRule: 'RESTRICT', count: 1 },
      { updateRule: 'CASCADE', deleteRule: 'SET NULL', count: 1 },
    ]);

    const comments = await sequelize.query(
      `SELECT c.relname AS "tableName",
              obj_description(c.oid) AS "tableComment",
              count(a.attnum)::int AS "columnCount",
              count(col_description(c.oid, a.attnum))::int AS "commentedColumnCount"
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
       WHERE n.nspname = 'public' AND c.relname IN (:tables)
       GROUP BY c.oid, c.relname
       ORDER BY c.relname`,
      { replacements: { tables: expectedTables }, type: QueryTypes.SELECT },
    );
    assert.equal(comments.length, expectedTables.length);
    assert.ok(comments.every(({ tableComment }) => Boolean(tableComment)));
    assert.ok(
      comments.every(
        ({ columnCount, commentedColumnCount }) =>
          columnCount === commentedColumnCount,
      ),
    );

    const enums = await sequelize.query(
      `SELECT t.typname AS "enumName", array_agg(e.enumlabel ORDER BY e.enumsortorder) AS values
       FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
       JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = 'public' AND t.typname IN (:enums)
       GROUP BY t.typname`,
      {
        replacements: { enums: Object.keys(expectedEnums) },
        type: QueryTypes.SELECT,
      },
    );
    assert.equal(enums.length, Object.keys(expectedEnums).length);
    for (const { enumName, values } of enums) {
      const normalizedValues = Array.isArray(values)
        ? values
        : values.slice(1, -1).split(',');
      assert.deepEqual(normalizedValues, expectedEnums[enumName]);
    }

    const requiredPartialIndexes = [
      'auth_identities_one_primary_per_account',
      'user_photos_one_primary_per_user',
      'user_photos_live_display_order_key',
      'partner_photos_one_primary_per_partner',
      'partner_photos_live_display_order_key',
      'user_sessions_active_by_account_idx',
    ];
    const partialIndexes = await sequelize.query(
      `SELECT indexname, indexdef FROM pg_indexes
       WHERE schemaname = 'public' AND indexname IN (:indexes)`,
      {
        replacements: { indexes: requiredPartialIndexes },
        type: QueryTypes.SELECT,
      },
    );
    assert.deepEqual(
      partialIndexes.map(({ indexname }) => indexname).sort(),
      [...requiredPartialIndexes].sort(),
    );
    assert.ok(
      partialIndexes.every(({ indexdef }) => indexdef.includes(' WHERE ')),
    );

    const requiredUniqueConstraints = [
      'account_roles_account_id_role_id_key',
      'auth_identities_provider_identifier_key',
      'media_storage_provider_storage_key_key',
      'partner_photos_partner_id_media_id_key',
      'partner_users_account_id_key',
      'platform_users_account_id_key',
      'roles_code_key',
      'user_photos_user_id_media_id_key',
      'user_sessions_refresh_token_hash_key',
      'users_account_id_key',
    ];
    const uniqueConstraints = await sequelize.query(
      `SELECT constraint_name AS "constraintName" FROM information_schema.table_constraints
       WHERE constraint_schema = 'public' AND constraint_type = 'UNIQUE'
         AND constraint_name IN (:constraints) ORDER BY constraint_name`,
      {
        replacements: { constraints: requiredUniqueConstraints },
        type: QueryTypes.SELECT,
      },
    );
    assert.deepEqual(
      uniqueConstraints.map(({ constraintName }) => constraintName),
      [...requiredUniqueConstraints].sort(),
    );

    const significantIndexes = [
      'accounts_account_type_idx',
      'accounts_status_idx',
      'accounts_type_status_idx',
      'partners_city_idx',
      'partners_category_idx',
      'partners_status_idx',
      'partners_city_category_status_idx',
      'partner_users_partner_id_idx',
      'account_roles_role_id_idx',
      'auth_identities_account_id_idx',
      'otp_challenges_account_id_idx',
      'otp_challenges_identifier_purpose_created_at_idx',
      'otp_challenges_expires_at_idx',
      'user_sessions_account_id_idx',
      'user_sessions_expires_at_idx',
      'user_sessions_revoked_at_idx',
      'media_uploaded_by_account_id_idx',
      'user_photos_media_id_idx',
      'partner_photos_media_id_idx',
      ...requiredPartialIndexes,
    ];
    const indexes = await sequelize.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname IN (:indexes)`,
      {
        replacements: { indexes: significantIndexes },
        type: QueryTypes.SELECT,
      },
    );
    assert.deepEqual(
      indexes.map(({ indexname }) => indexname).sort(),
      [...significantIndexes].sort(),
    );

    const roles = await sequelize.query(
      `SELECT code FROM roles WHERE is_system = TRUE AND code IN ('CUSTOMER', 'ADMIN', 'SUPERADMIN') ORDER BY code`,
      { type: QueryTypes.SELECT },
    );
    assert.deepEqual(
      roles.map(({ code }) => code),
      ['ADMIN', 'CUSTOMER', 'SUPERADMIN'],
    );

    console.log(
      JSON.stringify({
        tables: tables.length,
        foreignKeys: foreignKeyCount,
        tableComments: comments.length,
        columnComments: comments.reduce(
          (sum, row) => sum + row.commentedColumnCount,
          0,
        ),
        enums: enums.length,
        uniqueConstraints: uniqueConstraints.length,
        significantIndexes: indexes.length,
        requiredPartialIndexes: partialIndexes.length,
        systemRoles: roles.length,
      }),
    );
  } finally {
    await sequelize.close();
  }
}

main().catch((error) => {
  console.error(`Schema validation failed: ${error.message}`);
  process.exitCode = 1;
});
