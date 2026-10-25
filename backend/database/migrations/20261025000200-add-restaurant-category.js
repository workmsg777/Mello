'use strict';
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TYPE enum_partners_category ADD VALUE IF NOT EXISTS 'RESTAURANT'",
    );
  },
  async down(queryInterface) {
    // PostgreSQL cannot remove an enum value. Preserve the harmless additive value
    // so rollback never destroys or silently relabels an existing restaurant.
    await queryInterface.sequelize.query('SELECT 1');
  },
};
