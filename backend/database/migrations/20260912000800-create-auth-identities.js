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
        'auth_identities',
        {
          id: uuid(DataTypes, { primaryKey: true }),
          account_id: uuid(DataTypes, {
            references: { model: 'accounts', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          }),
          provider: {
            type: DataTypes.ENUM('PHONE', 'EMAIL', 'GOOGLE', 'APPLE'),
            allowNull: false,
          },
          identifier: { type: DataTypes.STRING(320), allowNull: false },
          password_hash: { type: DataTypes.TEXT, allowNull: true },
          is_primary: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
          },
          verified_at: { type: DataTypes.DATE, allowNull: true },
          last_used_at: { type: DataTypes.DATE, allowNull: true },
          ...timestamps(DataTypes, true),
        },
        { transaction },
      );
      await queryInterface.addConstraint('auth_identities', {
        fields: ['provider', 'identifier'],
        type: 'unique',
        name: 'auth_identities_provider_identifier_key',
        transaction,
      });
      await queryInterface.addIndex('auth_identities', ['account_id'], {
        name: 'auth_identities_account_id_idx',
        transaction,
      });
      await queryInterface.addIndex('auth_identities', ['account_id'], {
        name: 'auth_identities_one_primary_per_account',
        unique: true,
        where: { is_primary: true, deleted_at: null },
        transaction,
      });
      await addComments(
        queryInterface,
        'auth_identities',
        'Normalized login identities attached to a central account so one actor can use multiple authentication providers.',
        {
          id: 'Application-generated UUID identifying the login identity.',
          account_id: 'Account authenticated by this identity.',
          provider:
            'Authentication provider namespace for interpreting identifier.',
          identifier:
            'Provider-unique identifier normalized by service logic, including E.164 phones and lowercase email.',
          password_hash:
            'Optional secure password hash; plaintext passwords must never be stored.',
          is_primary:
            'Marks the primary identity; a partial unique index allows one live primary identity per account.',
          verified_at:
            'Time at which provider ownership was verified; null means unverified.',
          last_used_at: 'Most recent successful use of this identity.',
          created_at: 'Time at which the identity was created.',
          updated_at: 'Time at which the identity was last changed.',
          deleted_at:
            'Soft-deletion time; deleted identities remain auditable.',
        },
        transaction,
      );
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable('auth_identities', { transaction });
      await dropEnums(
        queryInterface,
        ['enum_auth_identities_provider'],
        transaction,
      );
    });
  },
};
