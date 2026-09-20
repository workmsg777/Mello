'use strict';

const {
  createTableByName,
  dropTableByName,
} = require('./dating-profile-schema');

module.exports = (tableName) => ({
  async up(queryInterface, DataTypes) {
    await createTableByName(queryInterface, DataTypes, tableName);
  },
  async down(queryInterface, DataTypes) {
    await dropTableByName(queryInterface, DataTypes, tableName);
  },
});
