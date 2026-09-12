'use strict';

const { addComments, dropEnums, timestamps, uuid } = require('../migration-utils');

module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable('media', {
        id: uuid(DataTypes, { primaryKey: true }),
        uploaded_by_account_id: uuid(DataTypes, { allowNull: true, references: { model: 'accounts', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' }),
        storage_provider: { type: DataTypes.STRING(50), allowNull: false },
        storage_key: { type: DataTypes.STRING(1024), allowNull: false },
        url: { type: DataTypes.TEXT, allowNull: true },
        media_type: { type: DataTypes.ENUM('IMAGE', 'VIDEO', 'AUDIO', 'OTHER'), allowNull: false },
        mime_type: { type: DataTypes.STRING(255), allowNull: false },
        size_bytes: { type: DataTypes.BIGINT, allowNull: false },
        width: { type: DataTypes.INTEGER, allowNull: true },
        height: { type: DataTypes.INTEGER, allowNull: true },
        checksum: { type: DataTypes.STRING(255), allowNull: true },
        ...timestamps(DataTypes, true),
      }, { transaction });
      await queryInterface.addConstraint('media', { fields: ['storage_provider', 'storage_key'], type: 'unique', name: 'media_storage_provider_storage_key_key', transaction });
      await queryInterface.addIndex('media', ['uploaded_by_account_id'], { name: 'media_uploaded_by_account_id_idx', transaction });
      await queryInterface.sequelize.query('ALTER TABLE "media" ADD CONSTRAINT "media_size_bytes_nonnegative" CHECK ("size_bytes" >= 0)', { transaction });
      await queryInterface.sequelize.query('ALTER TABLE "media" ADD CONSTRAINT "media_dimensions_positive" CHECK (("width" IS NULL OR "width" > 0) AND ("height" IS NULL OR "height" > 0))', { transaction });
      await addComments(queryInterface, 'media', 'Metadata and object-storage references for reusable uploaded files; binary content is never stored in PostgreSQL.', {
        id: 'Application-generated UUID identifying the asset metadata.', uploaded_by_account_id: 'Optional uploader audit reference; hard-deleting an uploader preserves media by setting this value null.', storage_provider: 'Backing object-storage provider identifier kept open for S3, R2, local, or future providers.', storage_key: 'Canonical provider-local object key; uniqueness is scoped to the provider.', url: 'Optional accessible URL; it is not the canonical object identity and may be temporary.', media_type: 'Reusable broad media category.', mime_type: 'Validated MIME content type reported for the object.', size_bytes: 'Nonnegative object size in bytes stored as BIGINT.', width: 'Optional positive pixel width for visual media.', height: 'Optional positive pixel height for visual media.', checksum: 'Optional digest used for integrity or future deduplication.', created_at: 'Time at which media metadata was created.', updated_at: 'Time at which media metadata was last changed.', deleted_at: 'Soft-deletion time; physical object cleanup is a separate lifecycle operation.',
      }, transaction);
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable('media', { transaction });
      await dropEnums(queryInterface, ['enum_media_media_type'], transaction);
    });
  },
};
