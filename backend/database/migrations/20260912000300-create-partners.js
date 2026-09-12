'use strict';

const { addComments, dropEnums, timestamps, uuid } = require('../migration-utils');

module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable('partners', {
        id: uuid(DataTypes, { primaryKey: true }),
        name: { type: DataTypes.STRING(200), allowNull: false },
        category: { type: DataTypes.ENUM('CAFE', 'HOTEL', 'ACTIVITY', 'OTHER'), allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: true },
        address_line_1: { type: DataTypes.STRING(255), allowNull: false },
        address_line_2: { type: DataTypes.STRING(255), allowNull: true },
        city: { type: DataTypes.STRING(120), allowNull: false },
        state: { type: DataTypes.STRING(120), allowNull: false },
        postal_code: { type: DataTypes.STRING(20), allowNull: false },
        country_code: { type: DataTypes.STRING(2), allowNull: false },
        latitude: { type: DataTypes.DECIMAL(9, 6), allowNull: true },
        longitude: { type: DataTypes.DECIMAL(9, 6), allowNull: true },
        phone: { type: DataTypes.STRING(32), allowNull: true },
        email: { type: DataTypes.STRING(320), allowNull: true },
        status: { type: DataTypes.ENUM('ACTIVE', 'INACTIVE'), allowNull: false, defaultValue: 'ACTIVE' },
        ...timestamps(DataTypes, true),
      }, { transaction });
      await queryInterface.addIndex('partners', ['city'], { name: 'partners_city_idx', transaction });
      await queryInterface.addIndex('partners', ['category'], { name: 'partners_category_idx', transaction });
      await queryInterface.addIndex('partners', ['status'], { name: 'partners_status_idx', transaction });
      await queryInterface.addIndex('partners', ['city', 'category', 'status'], { name: 'partners_city_category_status_idx', transaction });
      await addComments(queryInterface, 'partners', 'Businesses and venues that may host future Mello dates or experiences.', {
        id: 'Application-generated UUID identifying the partner business.', name: 'Partner business display name.', category: 'Initial extensible classification of the partner business.', description: 'Optional public description of the business.',
        address_line_1: 'Primary street-address line.', address_line_2: 'Optional additional street-address detail.', city: 'City used in partner discovery and filtering.', state: 'State or first-level administrative area.', postal_code: 'Postal code retained as text to preserve formatting.', country_code: 'Two-letter ISO 3166-1 alpha-2 country code.',
        latitude: 'Optional WGS84 latitude with six decimal places; PostGIS is intentionally not required initially.', longitude: 'Optional WGS84 longitude with six decimal places; PostGIS is intentionally not required initially.', phone: 'Optional business contact phone, not a staff login identity.', email: 'Optional business contact email, not a staff login identity.', status: 'Whether the partner is currently available to the application.',
        created_at: 'Time at which the partner was created.', updated_at: 'Time at which the partner was last changed.', deleted_at: 'Soft-deletion time for retained business records.',
      }, transaction);
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable('partners', { transaction });
      await dropEnums(queryInterface, ['enum_partners_category', 'enum_partners_status'], transaction);
    });
  },
};
