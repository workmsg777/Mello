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
        'user_photos',
        {
          id: uuid(DataTypes, { primaryKey: true }),
          user_id: uuid(DataTypes, {
            references: { model: 'users', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          }),
          media_id: uuid(DataTypes, {
            references: { model: 'media', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          }),
          display_order: { type: DataTypes.INTEGER, allowNull: false },
          is_primary: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
          },
          moderation_status: {
            type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
            allowNull: false,
            defaultValue: 'PENDING',
          },
          ...timestamps(DataTypes, true),
        },
        { transaction },
      );
      await queryInterface.addConstraint('user_photos', {
        fields: ['user_id', 'media_id'],
        type: 'unique',
        name: 'user_photos_user_id_media_id_key',
        transaction,
      });
      await queryInterface.addIndex('user_photos', ['media_id'], {
        name: 'user_photos_media_id_idx',
        transaction,
      });
      await queryInterface.addIndex(
        'user_photos',
        ['user_id', 'display_order'],
        {
          name: 'user_photos_live_display_order_key',
          unique: true,
          where: { deleted_at: null },
          transaction,
        },
      );
      await queryInterface.addIndex('user_photos', ['user_id'], {
        name: 'user_photos_one_primary_per_user',
        unique: true,
        where: { is_primary: true, deleted_at: null },
        transaction,
      });
      await queryInterface.sequelize.query(
        'ALTER TABLE "user_photos" ADD CONSTRAINT "user_photos_display_order_nonnegative" CHECK ("display_order" >= 0)',
        { transaction },
      );
      await addComments(
        queryInterface,
        'user_photos',
        'Dating-user photo mappings and profile-photo metadata layered over reusable media assets.',
        {
          id: 'Application-generated UUID identifying the mapping.',
          user_id: 'Dating user owning the photo relationship.',
          media_id: 'Reusable media asset used as a dating photo.',
          display_order:
            'Nonnegative profile ordering unique among the user live photos.',
          is_primary:
            'Marks the profile photo; a partial unique index allows one live primary photo per user.',
          moderation_status:
            'Safety review state without implementing a moderation engine.',
          created_at: 'Time at which the photo mapping was created.',
          updated_at: 'Time at which photo metadata was last changed.',
          deleted_at:
            'Soft-deletion time for removing a photo from a profile without destroying media metadata.',
        },
        transaction,
      );
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable('user_photos', { transaction });
      await dropEnums(
        queryInterface,
        ['enum_user_photos_moderation_status'],
        transaction,
      );
    });
  },
};
