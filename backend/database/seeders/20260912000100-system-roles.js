'use strict';

const { randomUUID } = require('node:crypto');

const roles = [
  { code: 'CUSTOMER', name: 'Customer', description: 'Normal Mello dating application user.' },
  { code: 'ADMIN', name: 'Administrator', description: 'Internal Mello administrator.' },
  { code: 'SUPERADMIN', name: 'Super Administrator', description: 'Highest-level Mello administrative access.' },
];

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const role of roles) {
        await queryInterface.sequelize.query(
          `INSERT INTO "roles" ("id", "code", "name", "description", "is_system", "created_at", "updated_at")
           VALUES (:id, :code, :name, :description, TRUE, NOW(), NOW())
           ON CONFLICT ("code") DO UPDATE SET
             "name" = EXCLUDED."name",
             "description" = EXCLUDED."description",
             "is_system" = TRUE,
             "updated_at" = NOW()`,
          { replacements: { id: randomUUID(), ...role }, transaction },
        );
      }
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `DELETE FROM "roles" r
         WHERE r."code" IN ('CUSTOMER', 'ADMIN', 'SUPERADMIN')
           AND r."is_system" = TRUE
           AND NOT EXISTS (SELECT 1 FROM "account_roles" ar WHERE ar."role_id" = r."id")`,
        { transaction },
      );
    });
  },
};
