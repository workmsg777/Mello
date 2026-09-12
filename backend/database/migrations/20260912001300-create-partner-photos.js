'use strict';

const { addComments, dropEnums, timestamps, uuid } = require('../migration-utils');

module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable('partner_photos', {
        id: uuid(DataTypes, { primaryKey: true }),
        partner_id: uuid(DataTypes, { references: { model: 'partners', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' }),
        media_id: uuid(DataTypes, { references: { model: 'media', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' }),
        category: { type: DataTypes.ENUM('COVER', 'GALLERY', 'MENU', 'VENUE', 'OTHER'), allowNull: false },
        display_order: { type: DataTypes.INTEGER, allowNull: false },
        is_primary: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        ...timestamps(DataTypes, true),
      }, { transaction });
      await queryInterface.addConstraint('partner_photos', { fields: ['partner_id', 'media_id'], type: 'unique', name: 'partner_photos_partner_id_media_id_key', transaction });
      await queryInterface.addIndex('partner_photos', ['media_id'], { name: 'partner_photos_media_id_idx', transaction });
      await queryInterface.addIndex('partner_photos', ['partner_id', 'display_order'], { name: 'partner_photos_live_display_order_key', unique: true, where: { deleted_at: null }, transaction });
      await queryInterface.addIndex('partner_photos', ['partner_id'], { name: 'partner_photos_one_primary_per_partner', unique: true, where: { is_primary: true, deleted_at: null }, transaction });
      await queryInterface.sequelize.query('ALTER TABLE "partner_photos" ADD CONSTRAINT "partner_photos_display_order_nonnegative" CHECK ("display_order" >= 0)', { transaction });
      await addComments(queryInterface, 'partner_photos', 'Partner-specific presentation and gallery metadata layered over reusable media assets.', {
        id: 'Application-generated UUID identifying the mapping.', partner_id: 'Partner business presented by this photo.', media_id: 'Reusable media asset used by the partner.', category: 'Presentation purpose of the partner photo.', display_order: 'Nonnegative partner-gallery ordering unique among live photos.', is_primary: 'Marks the principal partner image; a partial unique index allows one live primary image per partner.', created_at: 'Time at which the photo mapping was created.', updated_at: 'Time at which photo metadata was last changed.', deleted_at: 'Soft-deletion time for removing a photo from the partner presentation.',
      }, transaction);
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable('partner_photos', { transaction });
      await dropEnums(queryInterface, ['enum_partner_photos_category'], transaction);
    });
  },
};
