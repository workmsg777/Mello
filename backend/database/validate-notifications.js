'use strict';
require('dotenv').config();
const assert = require('node:assert/strict');
const { Sequelize, QueryTypes } = require('sequelize');
const configs = require('./config');
const db = new Sequelize(configs[process.env.NODE_ENV || 'development']);
(async () => {
  try {
    const query = (sql) => db.query(sql, { type: QueryTypes.SELECT });
    const tables = await query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('notifications','notification_jobs','notification_devices','notification_preferences','notification_campaigns','notification_push_receipts')",
    );
    assert.equal(tables.length, 6);
    const [partitions] = await query(
      "SELECT count(*)::int AS total FROM pg_inherits WHERE inhparent='notifications'::regclass",
    );
    assert.equal(partitions.total, 32);
    const indexes = await query(
      "SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname IN ('notification_jobs_ready_idx','notification_jobs_live_unique','notification_jobs_push_unique','notification_jobs_campaign_unique','notifications_feed_idx','notifications_unread_idx')",
    );
    assert.equal(indexes.length, 6);
    console.log(
      JSON.stringify({
        tables: tables.length,
        inboxPartitions: partitions.total,
        indexes: indexes.length,
      }),
    );
  } finally {
    await db.close();
  }
})().catch(() => {
  console.error('Notification schema validation failed.');
  process.exitCode = 1;
});
