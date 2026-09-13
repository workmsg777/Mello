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
        'otp_challenges',
        {
          id: uuid(DataTypes, { primaryKey: true }),
          account_id: uuid(DataTypes, {
            allowNull: true,
            references: { model: 'accounts', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          }),
          identifier: { type: DataTypes.STRING(320), allowNull: false },
          channel: { type: DataTypes.ENUM('PHONE', 'EMAIL'), allowNull: false },
          purpose: {
            type: DataTypes.ENUM(
              'SIGNUP',
              'LOGIN',
              'VERIFY_PHONE',
              'VERIFY_EMAIL',
              'CHANGE_PHONE',
              'CHANGE_EMAIL',
              'ACCOUNT_RECOVERY',
              'PASSWORD_RESET',
            ),
            allowNull: false,
          },
          code_hash: { type: DataTypes.TEXT, allowNull: false },
          attempt_count: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
          },
          max_attempts: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 5,
          },
          expires_at: { type: DataTypes.DATE, allowNull: false },
          consumed_at: { type: DataTypes.DATE, allowNull: true },
          request_ip: { type: DataTypes.INET, allowNull: true },
          user_agent: { type: DataTypes.TEXT, allowNull: true },
          ...timestamps(DataTypes),
        },
        { transaction },
      );
      await queryInterface.addIndex('otp_challenges', ['account_id'], {
        name: 'otp_challenges_account_id_idx',
        transaction,
      });
      await queryInterface.addIndex(
        'otp_challenges',
        ['identifier', 'purpose', 'created_at'],
        {
          name: 'otp_challenges_identifier_purpose_created_at_idx',
          transaction,
        },
      );
      await queryInterface.addIndex('otp_challenges', ['expires_at'], {
        name: 'otp_challenges_expires_at_idx',
        transaction,
      });
      await queryInterface.sequelize.query(
        'ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_attempt_count_nonnegative" CHECK ("attempt_count" >= 0)',
        { transaction },
      );
      await queryInterface.sequelize.query(
        'ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_max_attempts_positive" CHECK ("max_attempts" > 0)',
        { transaction },
      );
      await addComments(
        queryInterface,
        'otp_challenges',
        'Single-use, expiring OTP verification challenges for signup, login, identity changes, and recovery.',
        {
          id: 'Application-generated UUID identifying the challenge.',
          account_id:
            'Optional account reference; signup challenges can exist before an account is created.',
          identifier: 'Normalized phone or email receiving the OTP.',
          channel: 'Delivery channel for the challenge.',
          purpose: 'Security flow for which the challenge may be consumed.',
          code_hash:
            'Secure hash of the OTP; plaintext OTP values must never be stored.',
          attempt_count: 'Failed verification attempts already consumed.',
          max_attempts:
            'Maximum allowed verification attempts before rejection.',
          expires_at: 'Required time after which the OTP cannot be accepted.',
          consumed_at:
            'Successful consumption time; non-null prevents OTP reuse.',
          request_ip:
            'Optional originating network address for security review.',
          user_agent:
            'Optional requesting client metadata for security review.',
          created_at: 'Time at which the challenge was created.',
          updated_at: 'Time at which challenge state was last changed.',
        },
        transaction,
      );
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable('otp_challenges', { transaction });
      await dropEnums(
        queryInterface,
        ['enum_otp_challenges_channel', 'enum_otp_challenges_purpose'],
        transaction,
      );
    });
  },
};
