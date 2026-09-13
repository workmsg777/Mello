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
        'user_sessions',
        {
          id: uuid(DataTypes, { primaryKey: true }),
          account_id: uuid(DataTypes, {
            references: { model: 'accounts', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          }),
          refresh_token_hash: {
            type: DataTypes.TEXT,
            allowNull: false,
            unique: true,
          },
          device_id: { type: DataTypes.STRING(255), allowNull: true },
          device_name: { type: DataTypes.STRING(255), allowNull: true },
          platform: {
            type: DataTypes.ENUM('ANDROID', 'IOS', 'WEB', 'UNKNOWN'),
            allowNull: false,
            defaultValue: 'UNKNOWN',
          },
          ip_address: { type: DataTypes.INET, allowNull: true },
          user_agent: { type: DataTypes.TEXT, allowNull: true },
          last_seen_at: { type: DataTypes.DATE, allowNull: true },
          expires_at: { type: DataTypes.DATE, allowNull: false },
          revoked_at: { type: DataTypes.DATE, allowNull: true },
          ...timestamps(DataTypes),
        },
        { transaction },
      );
      await queryInterface.addIndex('user_sessions', ['account_id'], {
        name: 'user_sessions_account_id_idx',
        transaction,
      });
      await queryInterface.addIndex('user_sessions', ['expires_at'], {
        name: 'user_sessions_expires_at_idx',
        transaction,
      });
      await queryInterface.addIndex('user_sessions', ['revoked_at'], {
        name: 'user_sessions_revoked_at_idx',
        transaction,
      });
      await queryInterface.addIndex(
        'user_sessions',
        ['account_id', 'expires_at'],
        {
          name: 'user_sessions_active_by_account_idx',
          where: { revoked_at: null },
          transaction,
        },
      );
      await addComments(
        queryInterface,
        'user_sessions',
        'Refresh-token and device sessions used for revocation, logout, and suspicious-activity response.',
        {
          id: 'Application-generated UUID identifying the session.',
          account_id: 'Account authenticated by the session.',
          refresh_token_hash:
            'Unique secure hash of the refresh token; raw tokens must never be persisted.',
          device_id: 'Optional stable client-provided device identifier.',
          device_name: 'Optional human-readable device label.',
          platform: 'Client platform category for session management.',
          ip_address: 'Optional most recently recorded network address.',
          user_agent: 'Optional client metadata for security review.',
          last_seen_at: 'Most recent observed session activity.',
          expires_at: 'Required time after which the session is invalid.',
          revoked_at:
            'Explicit invalidation time used instead of soft deletion.',
          created_at: 'Time at which the session was created.',
          updated_at: 'Time at which session metadata was last changed.',
        },
        transaction,
      );
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable('user_sessions', { transaction });
      await dropEnums(
        queryInterface,
        ['enum_user_sessions_platform'],
        transaction,
      );
    });
  },
};
