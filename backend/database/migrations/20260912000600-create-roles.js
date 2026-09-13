'use strict';

const { addComments, timestamps, uuid } = require('../migration-utils');

module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        'roles',
        {
          id: uuid(DataTypes, { primaryKey: true }),
          code: { type: DataTypes.STRING(64), allowNull: false, unique: true },
          name: { type: DataTypes.STRING(120), allowNull: false },
          description: { type: DataTypes.TEXT, allowNull: true },
          is_system: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
          },
          ...timestamps(DataTypes),
        },
        { transaction },
      );
      await addComments(
        queryInterface,
        'roles',
        'Reusable account authorization roles controlled through Mello RBAC.',
        {
          id: 'Application-generated UUID; role IDs are never hardcoded.',
          code: 'Stable unique role code used by authorization policy.',
          name: 'Human-readable role name.',
          description: 'Optional explanation of the access role.',
          is_system:
            'Marks application-controlled roles that normal administration must not delete.',
          created_at: 'Time at which the role was created.',
          updated_at: 'Time at which the role was last changed.',
        },
        transaction,
      );
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) =>
      queryInterface.dropTable('roles', { transaction }),
    );
  },
};
