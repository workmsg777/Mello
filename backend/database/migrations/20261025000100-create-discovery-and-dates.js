'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        CREATE TABLE discovery_actions (
          actor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          target_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          action varchar(4) NOT NULL CHECK (action IN ('LIKE', 'PASS')),
          created_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (actor_id, target_id), CHECK (actor_id <> target_id)
        );
        CREATE TABLE matches (
          id uuid PRIMARY KEY, user_low uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          user_high uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE (user_low, user_high), CHECK (user_low < user_high)
        );
        CREATE INDEX matches_high_idx ON matches(user_high);
        CREATE TABLE partner_listings (
          partner_id uuid PRIMARY KEY REFERENCES partners(id) ON DELETE CASCADE,
          kind varchar(10) NOT NULL CHECK (kind IN ('CAFE', 'RESTAURANT', 'ACTIVITY')),
          headline varchar(160) NOT NULL, image_url text,
          price_for_two_inr integer CHECK (price_for_two_inr >= 0),
          duration_minutes integer NOT NULL DEFAULT 90 CHECK (duration_minutes BETWEEN 15 AND 1440),
          tags jsonb NOT NULL DEFAULT '[]'::jsonb,
          is_published boolean NOT NULL DEFAULT false,
          created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE date_plans (
          id uuid PRIMARY KEY, match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
          partner_id uuid NOT NULL REFERENCES partners(id),
          creator_user_id uuid NOT NULL REFERENCES users(id),
          proposed_at timestamptz NOT NULL, note varchar(500) NOT NULL DEFAULT '',
          status varchar(10) NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED', 'ACCEPTED', 'DECLINED', 'CANCELLED')),
          partner_status varchar(10) NOT NULL DEFAULT 'PENDING' CHECK (partner_status IN ('PENDING', 'CONFIRMED', 'DECLINED')),
          created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX date_plans_match_idx ON date_plans(match_id, created_at DESC);
        CREATE INDEX date_plans_partner_idx ON date_plans(partner_id, proposed_at);
      `,
        { transaction },
      );
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        'DROP TABLE date_plans, partner_listings, matches, discovery_actions',
        { transaction },
      );
    });
  },
};
