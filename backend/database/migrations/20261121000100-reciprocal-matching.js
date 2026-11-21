'use strict';

module.exports = {
  async up({ sequelize }) {
    await sequelize.transaction(async (transaction) => {
      await sequelize.query(
        `
        ALTER TABLE user_profiles ADD COLUMN prefer_shared_intention boolean NOT NULL DEFAULT true;
        CREATE TABLE discovery_exclusions (
          actor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          target_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at timestamptz NOT NULL DEFAULT now(),
          report_reason text CHECK(report_reason IN ('SPAM','IMPERSONATION','HARASSMENT','OTHER_SAFETY')), reported_at timestamptz,
          PRIMARY KEY(actor_id,target_id), CHECK(actor_id <> target_id)
        );
        CREATE TABLE match_feedback (
          match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
          user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          worthwhile boolean NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY(match_id,user_id)
        );
        ALTER TABLE discovery_feed_items ADD COLUMN rank_version text, ADD COLUMN served_version text;
        ALTER TABLE discovery_impressions ADD COLUMN served_version text;
        UPDATE profile_option_categories SET allow_dealbreaker=true WHERE code='DATING_INTENTION';
        INSERT INTO user_profile_visibility(id,user_id,field_code,visibility,created_at,updated_at)
        SELECT gen_random_uuid(),selected.user_id,'DATING_INTENTION','MATCHING_ONLY',now(),now()
        FROM (SELECT DISTINCT o.user_id FROM user_profile_options o JOIN profile_option_categories c
              ON c.id=o.category_id WHERE c.code='DATING_INTENTION') selected
        ON CONFLICT(user_id,field_code) DO NOTHING;
      `,
        { transaction },
      );
    });
  },
  async down({ sequelize }) {
    await sequelize.transaction(async (transaction) => {
      await sequelize.query(
        `
        DROP TABLE match_feedback, discovery_exclusions;
        ALTER TABLE user_profiles DROP COLUMN prefer_shared_intention;
        ALTER TABLE discovery_impressions DROP COLUMN served_version;
        ALTER TABLE discovery_feed_items DROP COLUMN rank_version, DROP COLUMN served_version;
        UPDATE profile_option_categories SET allow_dealbreaker=false WHERE code='DATING_INTENTION';
      `,
        { transaction },
      );
    });
  },
};
