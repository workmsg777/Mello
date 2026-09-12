'use strict';

const { addComments, dropEnums, timestamps, uuid } = require('../migration-utils');

module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable('accounts', {
        id: uuid(DataTypes, { primaryKey: true }),
        account_type: { type: DataTypes.ENUM('DATING_USER', 'PARTNER_USER', 'PLATFORM_USER'), allowNull: false },
        status: { type: DataTypes.ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'BLOCKED', 'DEACTIVATED', 'DELETED'), allowNull: false, defaultValue: 'PENDING' },
        ...timestamps(DataTypes, true),
      }, { transaction });
      await queryInterface.addIndex('accounts', ['account_type'], { name: 'accounts_account_type_idx', transaction });
      await queryInterface.addIndex('accounts', ['status'], { name: 'accounts_status_idx', transaction });
      await queryInterface.addIndex('accounts', ['account_type', 'status'], { name: 'accounts_type_status_idx', transaction });
      await addComments(queryInterface, 'accounts', 'Central authentication/account entity shared by dating users, partner staff, and Mello platform staff.', {
        id: 'Application-generated UUID identifying the authenticated actor.',
        account_type: 'Identifies which type of Mello actor owns this account.',
        status: 'Central lifecycle and access status consulted before authentication is allowed.',
        created_at: 'Time at which the account record was created.',
        updated_at: 'Time at which the account record was last changed.',
        deleted_at: 'Soft-deletion time; important account records are retained for integrity and audit purposes.',
      }, transaction);
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable('accounts', { transaction });
      await dropEnums(queryInterface, ['enum_accounts_account_type', 'enum_accounts_status'], transaction);
    });
  },
};
