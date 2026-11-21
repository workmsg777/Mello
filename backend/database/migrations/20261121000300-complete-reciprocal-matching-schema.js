'use strict';

module.exports = {
  async up({ sequelize }) {
    await sequelize.transaction(async (transaction) => {
      await sequelize.query(
        `
        ALTER TABLE discovery_feed_items
          ADD COLUMN IF NOT EXISTS rank_version text,
          ADD COLUMN IF NOT EXISTS served_version text;
        ALTER TABLE discovery_impressions
          ADD COLUMN IF NOT EXISTS served_version text;
        ALTER TABLE discovery_exclusions
          ADD COLUMN IF NOT EXISTS report_reason text
            CHECK (report_reason IN ('SPAM', 'IMPERSONATION', 'HARASSMENT', 'OTHER_SAFETY')),
          ADD COLUMN IF NOT EXISTS reported_at timestamptz;
        CREATE TABLE IF NOT EXISTS match_feedback (
          match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
          user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          worthwhile boolean NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (match_id, user_id)
        );
        `,
        { transaction },
      );
    });
  },
  async down() {
    // The reciprocal matching migration owns these fields on fresh databases.
    // Keep the reconciled schema and any new feedback when undoing this repair.
  },
};
