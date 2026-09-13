'use strict';

const { addComments, timestamps, uuid } = require('../migration-utils');

module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        'account_roles',
        {
          id: uuid(DataTypes, { primaryKey: true }),
          account_id: uuid(DataTypes, {
            references: { model: 'accounts', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          }),
          role_id: uuid(DataTypes, {
            references: { model: 'roles', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          }),
          ...timestamps(DataTypes),
        },
        { transaction },
      );
      await queryInterface.addConstraint('account_roles', {
        fields: ['account_id', 'role_id'],
        type: 'unique',
        name: 'account_roles_account_id_role_id_key',
        transaction,
      });
      await queryInterface.addIndex('account_roles', ['role_id'], {
        name: 'account_roles_role_id_idx',
        transaction,
      });
      await addComments(
        queryInterface,
        'account_roles',
        'Many-to-many assignments connecting authenticated accounts to reusable access-control roles.',
        {
          id: 'Application-generated UUID identifying the assignment.',
          account_id: 'Account receiving the role.',
          role_id: 'Reusable authorization role assigned to the account.',
          created_at: 'Time at which the role was assigned.',
          updated_at: 'Time at which the assignment was last changed.',
        },
        transaction,
      );
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) =>
      queryInterface.dropTable('account_roles', { transaction }),
    );
  },
};
