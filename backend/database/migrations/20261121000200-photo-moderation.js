'use strict';

module.exports = {
  async up({ sequelize }) {
    await sequelize.query(`
      ALTER TABLE user_photos
        ADD COLUMN moderation_claim uuid,
        ADD COLUMN moderation_retry_at timestamptz NOT NULL DEFAULT now(),
        ADD COLUMN moderation_attempts integer NOT NULL DEFAULT 0,
        ADD COLUMN moderation_assessment jsonb;
      CREATE INDEX pending_photo_moderation_idx ON user_photos(moderation_retry_at, id)
        WHERE deleted_at IS NULL AND moderation_status='PENDING';
    `);
  },
  async down({ sequelize }) {
    await sequelize.query(`
      DROP INDEX pending_photo_moderation_idx;
      ALTER TABLE user_photos DROP COLUMN moderation_claim, DROP COLUMN moderation_retry_at,
        DROP COLUMN moderation_attempts, DROP COLUMN moderation_assessment;
    `);
  },
};
