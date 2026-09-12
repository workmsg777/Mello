'use strict';

const { addComments, timestamps, uuid } = require('../migration-utils');

module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable('platform_users', {
        id: uuid(DataTypes, { primaryKey: true }),
        account_id: uuid(DataTypes, { unique: true, references: { model: 'accounts', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' }),
        name: { type: DataTypes.STRING(200), allowNull: false },
        ...timestamps(DataTypes, true),
      }, { transaction });
      await addComments(queryInterface, 'platform_users', 'Internal Mello team members whose authorization is assigned through account roles.', {
        id: 'Application-generated UUID identifying the internal staff profile.', account_id: 'Unique owning account; service logic requires account type PLATFORM_USER.', name: 'Internal staff member display name.', created_at: 'Time at which the platform-user record was created.', updated_at: 'Time at which the platform-user record was last changed.', deleted_at: 'Soft-deletion time for the internal staff profile.',
      }, transaction);
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => queryInterface.dropTable('platform_users', { transaction }));
  },
};
