'use strict';

const {
  addComments,
  dropEnums,
  timestamps,
  uuid,
} = require('../migration-utils');

module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        'partner_users',
        {
          id: uuid(DataTypes, { primaryKey: true }),
          account_id: uuid(DataTypes, {
            unique: true,
            references: { model: 'accounts', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          }),
          partner_id: uuid(DataTypes, {
            references: { model: 'partners', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
          }),
          name: { type: DataTypes.STRING(200), allowNull: false },
          staff_role: {
            type: DataTypes.ENUM('OWNER', 'MANAGER', 'STAFF'),
            allowNull: false,
          },
          ...timestamps(DataTypes, true),
        },
        { transaction },
      );
      await queryInterface.addIndex('partner_users', ['partner_id'], {
        name: 'partner_users_partner_id_idx',
        transaction,
      });
      await addComments(
        queryInterface,
        'partner_users',
        'People authorized to manage a partner business, separate from platform-level RBAC roles.',
        {
          id: 'Application-generated UUID identifying the partner staff record.',
          account_id:
            'Unique owning account; service logic requires account type PARTNER_USER.',
          partner_id:
            'Partner business managed by this staff member; hard deletion is restricted while staff records exist.',
          name: 'Staff member display name.',
          staff_role:
            'Organizational responsibility within the partner business, not a platform RBAC role.',
          created_at: 'Time at which the staff record was created.',
          updated_at: 'Time at which the staff record was last changed.',
          deleted_at: 'Soft-deletion time for the staff record.',
        },
        transaction,
      );
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable('partner_users', { transaction });
      await dropEnums(
        queryInterface,
        ['enum_partner_users_staff_role'],
        transaction,
      );
    });
  },
};
