'use strict';

const { addComments, timestamps, uuid } = require('../migration-utils');

module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable('users', {
        id: uuid(DataTypes, { primaryKey: true }),
        account_id: uuid(DataTypes, { unique: true, references: { model: 'accounts', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' }),
        ...timestamps(DataTypes, true),
      }, { transaction });
      await addComments(queryInterface, 'users', 'Dating-user domain extension of a central Mello account; profile and dating data intentionally live elsewhere.', {
        id: 'Application-generated UUID identifying the dating user.',
        account_id: 'Unique owning account; service logic requires that account to have type DATING_USER.',
        created_at: 'Time at which the dating-user extension was created.',
        updated_at: 'Time at which the dating-user extension was last changed.',
        deleted_at: 'Soft-deletion time retained separately from the central account lifecycle.',
      }, transaction);
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => queryInterface.dropTable('users', { transaction }));
  },
};
