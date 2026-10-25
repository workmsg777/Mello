'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        ALTER TABLE matches ADD COLUMN chat_sequence integer NOT NULL DEFAULT 0;
        CREATE TABLE chat_messages (
          id uuid PRIMARY KEY,
          match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
          sender_id uuid NOT NULL REFERENCES users(id),
          client_message_id uuid NOT NULL,
          sequence integer NOT NULL CHECK (sequence > 0),
          body varchar(2000) NOT NULL CHECK (length(trim(body)) > 0),
          created_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE (match_id, sequence),
          UNIQUE (sender_id, client_message_id)
        );
        CREATE INDEX chat_messages_sender_time_idx ON chat_messages(sender_id, created_at DESC);
        CREATE TABLE chat_reads (
          match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
          user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          last_read_sequence integer NOT NULL DEFAULT 0 CHECK (last_read_sequence >= 0),
          updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (match_id, user_id)
        );
      `,
        { transaction },
      );
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `DROP TABLE chat_reads; DROP TABLE chat_messages; ALTER TABLE matches DROP COLUMN chat_sequence;`,
        { transaction },
      );
    });
  },
};
