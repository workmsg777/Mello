'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE discovery_feed_sessions (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        algorithm_version varchar(80) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL
      );
      CREATE INDEX discovery_feed_sessions_owner_idx ON discovery_feed_sessions(user_id,expires_at);
      CREATE INDEX discovery_feed_sessions_expiry_idx ON discovery_feed_sessions(expires_at);
      CREATE TABLE discovery_feed_items (
        session_id uuid NOT NULL REFERENCES discovery_feed_sessions(id) ON DELETE CASCADE,
        target_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        position integer NOT NULL CHECK(position>=0),
        PRIMARY KEY(session_id,target_id), UNIQUE(session_id,position)
      );
      CREATE TABLE discovery_impressions (
        session_id uuid NOT NULL,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        algorithm_version varchar(80) NOT NULL,
        first_seen_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(session_id,target_id),
        FOREIGN KEY(session_id,target_id) REFERENCES discovery_feed_items(session_id,target_id) ON DELETE CASCADE
      );
      CREATE INDEX discovery_impressions_user_time_idx ON discovery_impressions(user_id,first_seen_at);
    `);
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'DROP TABLE discovery_impressions, discovery_feed_items, discovery_feed_sessions',
    );
  },
};
