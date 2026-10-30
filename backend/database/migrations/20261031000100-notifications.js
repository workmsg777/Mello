'use strict';
module.exports = {
  async up(q) {
    await q.sequelize.query(`
      CREATE TABLE notification_preferences (
        account_id uuid PRIMARY KEY REFERENCES accounts(id), messages boolean NOT NULL DEFAULT true,
        dates boolean NOT NULL DEFAULT true, matches boolean NOT NULL DEFAULT true, likes boolean NOT NULL DEFAULT true,
        offers boolean NOT NULL DEFAULT true, push boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE notifications (
        account_id uuid NOT NULL REFERENCES accounts(id), id uuid NOT NULL, event_key varchar(240) NOT NULL,
        kind varchar(40) NOT NULL, category varchar(12) NOT NULL, title varchar(160) NOT NULL, body varchar(600) NOT NULL,
        data jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz,
        PRIMARY KEY(account_id,id), UNIQUE(account_id,event_key)
      ) PARTITION BY HASH(account_id);
      DO $$ BEGIN FOR i IN 0..31 LOOP EXECUTE format('CREATE TABLE notifications_p%s PARTITION OF notifications FOR VALUES WITH (MODULUS 32, REMAINDER %s)',i,i); END LOOP; END $$;
      CREATE INDEX notifications_feed_idx ON notifications(account_id,created_at DESC,id DESC);
      CREATE INDEX notifications_unread_idx ON notifications(account_id,created_at DESC) WHERE read_at IS NULL;
      CREATE TABLE notification_devices (
        id uuid PRIMARY KEY, account_id uuid NOT NULL REFERENCES accounts(id), session_id uuid NOT NULL REFERENCES user_sessions(id),
        app varchar(10) NOT NULL CHECK(app IN ('USER','PARTNER')), token varchar(2048) NOT NULL, project_id uuid NOT NULL,
        provider varchar(8) NOT NULL DEFAULT 'EXPO' CHECK(provider IN ('EXPO','FCM','APNS')), platform varchar(10) NOT NULL CHECK(platform IN ('android','ios')), enabled boolean NOT NULL DEFAULT true,
        updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(app,provider,token)
      );
      CREATE INDEX notification_devices_account_idx ON notification_devices(account_id) WHERE enabled;
      CREATE TABLE notification_campaigns (
        id uuid PRIMARY KEY, content_id uuid NOT NULL REFERENCES partner_content(id), cursor_account uuid,
        created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
      );
      ALTER TABLE partner_content ADD COLUMN announcement_created_at timestamptz;
      CREATE TABLE notification_jobs (
        id bigserial PRIMARY KEY, account_id uuid, notification_id uuid, device_id uuid REFERENCES notification_devices(id),
        campaign_id uuid REFERENCES notification_campaigns(id), channel varchar(12) NOT NULL CHECK(channel IN ('LIVE','PUSH','CAMPAIGN')),
        priority smallint NOT NULL DEFAULT 1, state varchar(12) NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','PROCESSING','DONE','DEAD')),
        attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(),
        lease_id uuid, lease_until timestamptz, last_error varchar(120), created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
      );
      CREATE INDEX notification_jobs_ready_idx ON notification_jobs(channel,priority,available_at,id) WHERE state IN ('PENDING','PROCESSING');
      CREATE UNIQUE INDEX notification_jobs_live_unique ON notification_jobs(account_id,notification_id) WHERE channel='LIVE';
      CREATE UNIQUE INDEX notification_jobs_push_unique ON notification_jobs(account_id,notification_id,device_id) WHERE channel='PUSH';
      CREATE UNIQUE INDEX notification_jobs_campaign_unique ON notification_jobs(campaign_id) WHERE channel='CAMPAIGN';
      CREATE TABLE notification_push_receipts (
        ticket_id varchar(240) PRIMARY KEY, device_id uuid NOT NULL REFERENCES notification_devices(id),
        created_at timestamptz NOT NULL DEFAULT now(), available_at timestamptz NOT NULL DEFAULT now()+interval '15 minutes',
        attempts integer NOT NULL DEFAULT 0, checked_at timestamptz, status varchar(40)
      );
      CREATE INDEX notification_receipts_due_idx ON notification_push_receipts(available_at) WHERE checked_at IS NULL;
      CREATE INDEX notification_city_audience_idx ON user_profiles(current_city_id,user_id) WHERE deleted_at IS NULL AND profile_status='ACTIVE';
    `);
  },
  async down(q) {
    await q.sequelize
      .query(`DROP TABLE notification_push_receipts; DROP TABLE notification_jobs; DROP TABLE notification_campaigns;
      DROP TABLE notification_devices; DROP TABLE notifications; DROP TABLE notification_preferences;
      ALTER TABLE partner_content DROP COLUMN announcement_created_at; DROP INDEX notification_city_audience_idx;`);
  },
};
