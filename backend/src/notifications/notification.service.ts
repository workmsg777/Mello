import { randomUUID } from 'node:crypto';
import type { Transaction } from 'sequelize';
import { sequelize } from '../config/database';
import { rows } from '../repositories/discovery.repository';
import { PartnerRole } from '../constants/partner';
import {
  defaultPreferences,
  notificationColumns,
  type InboxNotification,
  type NotificationInput,
} from './types';

export class NotificationService {
  // Call inside the originating business transaction: no notification can outlive a rollback.
  async enqueue(
    accountIds: string[],
    input: NotificationInput,
    transaction: Transaction,
  ) {
    if (!accountIds.length) return;
    const recipients = [...new Set(accountIds)].map((accountId) => ({
      accountId,
      id: randomUUID(),
    }));
    await rows(
      `WITH created AS (
      INSERT INTO notifications (account_id,id,event_key,kind,category,title,body,data)
      SELECT a.id,r.id,:key,:kind,:category,:title,:body,CAST(:data AS jsonb)
      FROM jsonb_to_recordset(CAST(:recipients AS jsonb)) AS r("accountId" uuid,id uuid)
      JOIN accounts a ON a.id=r."accountId" AND a.status='ACTIVE' AND a.deleted_at IS NULL
      LEFT JOIN notification_preferences p ON p.account_id=a.id
      WHERE COALESCE((to_jsonb(p)->>:category)::boolean,true)
      ON CONFLICT(account_id,event_key) DO NOTHING RETURNING account_id,id
    ), live AS (
      INSERT INTO notification_jobs(account_id,notification_id,channel,priority)
      SELECT account_id,id,'LIVE',CASE WHEN :category = 'offers' THEN 10 ELSE 1 END FROM created RETURNING id
    ), push AS (
      INSERT INTO notification_jobs(account_id,notification_id,channel,device_id,priority)
      SELECT c.account_id,c.id,'PUSH',d.id,CASE WHEN :category = 'offers' THEN 10 ELSE 1 END FROM created c
      JOIN notification_devices d ON d.account_id=c.account_id AND d.enabled
      JOIN user_sessions s ON s.id=d.session_id AND s.account_id=d.account_id AND s.revoked_at IS NULL AND s.expires_at>now()
      LEFT JOIN notification_preferences p ON p.account_id=c.account_id
      WHERE COALESCE(p.push,true) ON CONFLICT DO NOTHING RETURNING id
    ) SELECT count(*) FROM created`,
      {
        ...input,
        recipients: JSON.stringify(recipients),
        data: JSON.stringify(input.data),
      },
      transaction,
    );
  }

  async users(
    userIds: string[],
    input: NotificationInput,
    transaction: Transaction,
  ) {
    const accounts = await rows<{ id: string }>(
      'SELECT account_id AS id FROM users WHERE id IN (:ids) AND deleted_at IS NULL',
      { ids: userIds },
      transaction,
    );
    await this.enqueue(
      accounts.map((a) => a.id),
      input,
      transaction,
    );
  }
  async admins(
    partnerId: string,
    input: NotificationInput,
    transaction: Transaction,
  ) {
    const accounts = await rows<{ id: string }>(
      `SELECT account_id AS id FROM partner_users WHERE partner_id=:partnerId AND staff_role=:role AND deleted_at IS NULL`,
      { partnerId, role: PartnerRole.ADMIN },
      transaction,
    );
    await this.enqueue(
      accounts.map((a) => a.id),
      input,
      transaction,
    );
  }
  async list(accountId: string, cursor?: { at: string; id: string }) {
    const items = await rows<InboxNotification>(
      `SELECT ${notificationColumns} FROM notifications WHERE account_id=:accountId
      AND (:at IS NULL OR (created_at,id)<(CAST(:at AS timestamptz),CAST(:id AS uuid))) ORDER BY created_at DESC,id DESC LIMIT 31`,
      { accountId, at: cursor?.at ?? null, id: cursor?.id ?? null },
    );
    const [count] = await rows<{ total: number }>(
      'SELECT count(*)::int AS total FROM notifications WHERE account_id=:accountId AND read_at IS NULL',
      { accountId },
    );
    const last = items[29];
    return {
      items: items.slice(0, 30),
      unread: count!.total,
      nextCursor:
        items.length > 30 && last ? { at: last.createdAt, id: last.id } : null,
    };
  }
  async preferences(accountId: string) {
    const [preferences] = await rows<typeof defaultPreferences>(
      'SELECT messages,dates,matches,likes,offers,push FROM notification_preferences WHERE account_id=:accountId',
      { accountId },
    );
    return preferences ?? { ...defaultPreferences };
  }
  async markRead(accountId: string, ids: string[] | null, before?: string) {
    await sequelize.transaction(async (transaction) => {
      await rows(
        `UPDATE notifications SET read_at=now() WHERE account_id=:accountId AND read_at IS NULL AND ${ids ? 'id IN (:ids)' : 'created_at<=CAST(:before AS timestamptz)'} RETURNING id`,
        {
          accountId,
          ids: ids ?? [],
          before: before ?? new Date().toISOString(),
        },
        transaction,
      );
      // A small invalidation synchronizes badges on the account's other devices.
      await rows(
        `INSERT INTO notification_jobs(account_id,channel) VALUES (:accountId,'LIVE') RETURNING id`,
        { accountId },
        transaction,
      );
    });
  }
  async announceContent(partnerId: string, transaction: Transaction) {
    const content = await rows<{ id: string }>(
      `UPDATE partner_content c SET announcement_created_at=now()
      FROM partners p JOIN partner_listings l ON l.partner_id=p.id AND l.is_published
      WHERE c.partner_id=:partnerId AND p.id=c.partner_id AND p.status='ACTIVE' AND p.deleted_at IS NULL
      AND c.is_published AND c.deleted_at IS NULL AND c.announcement_created_at IS NULL
      AND (c.kind='PACKAGE' OR (c.kind='EVENT' AND COALESCE(c.ends_at,c.starts_at)>now())) RETURNING c.id`,
      { partnerId },
      transaction,
    );
    for (const item of content) {
      const id = randomUUID();
      await rows(
        'INSERT INTO notification_campaigns(id,content_id) VALUES (:id,:contentId) RETURNING id',
        { id, contentId: item.id },
        transaction,
      );
      await rows(
        "INSERT INTO notification_jobs(campaign_id,channel) VALUES (:id,'CAMPAIGN') RETURNING id",
        { id },
        transaction,
      );
    }
  }
}
