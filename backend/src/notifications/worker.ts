import { randomUUID } from 'node:crypto';
import { sequelize } from '../config/database';
import { redis } from '../config/redis';
import { rows } from '../repositories/discovery.repository';
import { NotificationService } from './notification.service';
import { NotificationKind } from './types';
import { notificationChannel } from './gateway';
import { sendNativePush, closeNativePushConnections } from './native-push';

interface Job {
  id: string;
  account_id: string;
  notification_id: string;
  device_id: string;
  campaign_id: string;
  lease_id: string;
  attempts: number;
}
interface Ticket {
  status: 'ok' | 'error';
  id?: string;
  details?: { error?: string };
}
interface PushJob extends Job {
  token: string;
  project_id: string;
  title: string;
  category: string;
  kind: string;
  provider: 'EXPO' | 'FCM' | 'APNS';
  app: 'USER' | 'PARTNER';
}
const limit = Math.min(
  500,
  Math.max(1, Number(process.env.EXPO_PUSH_RATE_LIMIT ?? 400)),
);
const rateScript = `local n=tonumber(redis.call('GET',KEYS[1]) or '0'); if n+tonumber(ARGV[1])>tonumber(ARGV[2]) then return 0 end; redis.call('INCRBY',KEYS[1],ARGV[1]); redis.call('EXPIRE',KEYS[1],2); return 1`;
export class NotificationWorker {
  private readonly service = new NotificationService();
  constructor(
    private readonly publish: (accounts: string[]) => Promise<unknown> = (
      accounts,
    ) => redis.publish(notificationChannel, JSON.stringify(accounts)),
  ) {}
  async claim(
    channel: 'LIVE' | 'PUSH' | 'CAMPAIGN',
    batch = 100,
  ): Promise<Job[]> {
    return rows<Job>(
      `WITH candidates AS (SELECT id FROM notification_jobs WHERE channel=:channel AND
      ((state='PENDING' AND available_at<=now()) OR (state='PROCESSING' AND lease_until<now()))
      ORDER BY priority,available_at,id FOR UPDATE SKIP LOCKED LIMIT :batch)
      UPDATE notification_jobs j SET state='PROCESSING',lease_id=:lease,lease_until=now()+interval '60 seconds',attempts=attempts+1
      FROM candidates c WHERE j.id=c.id RETURNING j.*`,
      { channel, batch, lease: randomUUID() },
    );
  }
  private async finish(job: Job) {
    await rows(
      `UPDATE notification_jobs SET state='DONE',completed_at=now(),lease_until=NULL WHERE id=:id AND lease_id=:lease_id AND state='PROCESSING' RETURNING id`,
      { ...job },
    );
  }
  private async retry(job: Job, error: string, delay?: number) {
    await rows(
      `UPDATE notification_jobs SET state=CASE WHEN attempts>=12 THEN 'DEAD' ELSE 'PENDING' END,
      available_at=now()+(CAST(:delay AS double precision) * interval '1 second'),lease_until=NULL,last_error=:error WHERE id=:id AND lease_id=:lease_id AND state='PROCESSING' RETURNING id`,
      {
        ...job,
        error: error.slice(0, 120),
        delay:
          delay ??
          Math.min(3600, 2 ** Math.min(11, job.attempts) + Math.random() * 3),
      },
    );
  }
  private async defer(job: Job) {
    await rows(
      `UPDATE notification_jobs SET state='PENDING',attempts=GREATEST(0,attempts-1),available_at=now()+interval '1 second',lease_until=NULL,last_error='PUSH_RATE_LIMIT' WHERE id=:id AND lease_id=:lease_id AND state='PROCESSING' RETURNING id`,
      { ...job },
    );
  }
  async live() {
    const jobs = await this.claim('LIVE');
    if (!jobs.length) return;
    try {
      await this.publish([...new Set(jobs.map((job) => job.account_id))]);
      await rows(
        `UPDATE notification_jobs SET state='DONE',completed_at=now(),lease_until=NULL WHERE id IN (:ids) AND lease_id=:lease RETURNING id`,
        { ids: jobs.map((j) => j.id), lease: jobs[0]!.lease_id },
      );
    } catch {
      await Promise.all(
        jobs.map((job) => this.retry(job, 'LIVE_TRANSPORT_UNAVAILABLE')),
      );
    }
  }
  async campaign() {
    const [job] = await this.claim('CAMPAIGN', 1);
    if (!job) return;
    try {
      await sequelize.transaction(async (transaction) => {
        // Fence reclaimed jobs: an old worker may not advance the audience cursor.
        const [lease] = await rows(
          'SELECT id FROM notification_jobs WHERE id=:id AND lease_id=:lease_id FOR UPDATE',
          { ...job },
          transaction,
        );
        if (!lease) return;
        const [campaign] = await rows<{
          content_id: string;
          cursor_account: string | null;
          created_at: string;
        }>(
          `SELECT content_id,cursor_account,created_at FROM notification_campaigns WHERE id=:id AND completed_at IS NULL FOR UPDATE`,
          { id: job.campaign_id },
          transaction,
        );
        if (!campaign) {
          await this.finishInTransaction(job, transaction);
          return;
        }
        const [content] = await rows<{
          kind: string;
          title: string;
          partner_id: string;
          city: string;
          country_code: string;
          name: string;
        }>(
          `SELECT c.kind,c.title,c.partner_id,p.city,p.country_code,p.name FROM partner_content c
          JOIN partners p ON p.id=c.partner_id AND p.status='ACTIVE' AND p.deleted_at IS NULL
          JOIN partner_listings l ON l.partner_id=p.id AND l.is_published
          WHERE c.id=:id AND c.is_published AND c.deleted_at IS NULL AND (c.kind<>'EVENT' OR COALESCE(c.ends_at,c.starts_at)>now())`,
          { id: campaign.content_id },
          transaction,
        );
        if (!content) {
          await rows(
            'UPDATE notification_campaigns SET completed_at=now() WHERE id=:id RETURNING id',
            { id: job.campaign_id },
            transaction,
          );
          await this.finishInTransaction(job, transaction);
          return;
        }
        const audience = await rows<{ id: string }>(
          `SELECT u.account_id AS id FROM user_profiles p JOIN cities c ON c.id=p.current_city_id
          JOIN users u ON u.id=p.user_id AND u.deleted_at IS NULL JOIN accounts a ON a.id=u.account_id AND a.status='ACTIVE' AND a.deleted_at IS NULL
          JOIN user_onboarding_progress o ON o.user_id=u.id AND o.status='COMPLETED'
          LEFT JOIN notification_preferences pref ON pref.account_id=a.id
          WHERE p.profile_status='ACTIVE' AND p.deleted_at IS NULL AND lower(c.name)=lower(:city) AND c.country_code=:country_code
          AND a.created_at<=CAST(:created_at AS timestamptz) AND COALESCE(pref.offers,true)
          AND (:cursor IS NULL OR u.account_id>CAST(:cursor AS uuid)) ORDER BY u.account_id LIMIT 250`,
          {
            ...content,
            created_at: campaign.created_at,
            cursor: campaign.cursor_account,
          },
          transaction,
        );
        await this.service.enqueue(
          audience.map((a) => a.id),
          {
            key: `offer:${campaign.content_id}`,
            kind:
              content.kind === 'EVENT'
                ? NotificationKind.EVENT_PUBLISHED
                : NotificationKind.OFFER_PUBLISHED,
            category: 'offers',
            title:
              content.kind === 'EVENT'
                ? 'Something happening nearby'
                : 'A new experience nearby',
            body: `${content.name}: ${content.title}`.slice(0, 600),
            data: {
              venueId: content.partner_id,
              contentId: campaign.content_id,
            },
          },
          transaction,
        );
        const last = audience.at(-1);
        await rows(
          `UPDATE notification_campaigns SET cursor_account=COALESCE(CAST(:cursor AS uuid),cursor_account),completed_at=CASE WHEN :done THEN now() ELSE NULL END WHERE id=:id RETURNING id`,
          {
            id: job.campaign_id,
            cursor: last?.id ?? null,
            done: audience.length < 250,
          },
          transaction,
        );
        await rows(
          `UPDATE notification_jobs SET state=:state,completed_at=CASE WHEN :done THEN now() ELSE NULL END,attempts=0,available_at=now(),lease_until=NULL WHERE id=:id AND lease_id=:lease_id AND state='PROCESSING' RETURNING id`,
          {
            ...job,
            state: audience.length < 250 ? 'DONE' : 'PENDING',
            done: audience.length < 250,
          },
          transaction,
        );
      });
    } catch {
      await this.retry(job, 'CAMPAIGN_RETRY');
    }
  }
  private async finishInTransaction(
    job: Job,
    transaction: import('sequelize').Transaction,
  ) {
    await rows(
      "UPDATE notification_jobs SET state='DONE',completed_at=now(),lease_until=NULL WHERE id=:id AND lease_id=:lease_id AND state='PROCESSING' RETURNING id",
      { ...job },
      transaction,
    );
  }
  private async request(path: string, body: unknown) {
    const response = await fetch(`https://exp.host/--/api/v2/push/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.EXPO_ACCESS_TOKEN
          ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`PUSH_HTTP_${response.status}`);
    return (await response.json()) as { data?: unknown };
  }
  async push() {
    if (process.env.NOTIFICATION_PUSH_ENABLED !== 'true') return;
    const jobs = await this.claim('PUSH', Math.min(50, limit));
    if (!jobs.length) return;
    try {
      const active = await rows<PushJob>(
        `SELECT j.*,d.token,d.project_id,d.provider,d.app,n.title,n.kind,n.category FROM notification_jobs j
        JOIN notifications n ON n.account_id=j.account_id AND n.id=j.notification_id AND n.read_at IS NULL AND n.created_at>now()-interval '24 hours'
        JOIN notification_devices d ON d.id=j.device_id AND d.account_id=j.account_id AND d.enabled
        JOIN user_sessions s ON s.id=d.session_id AND s.revoked_at IS NULL AND s.expires_at>now()
        JOIN accounts a ON a.id=d.account_id AND a.status='ACTIVE' AND a.deleted_at IS NULL
        LEFT JOIN notification_preferences p ON p.account_id=a.id
        WHERE j.id IN (:ids) AND COALESCE(p.push,true) AND COALESCE((to_jsonb(p)->>n.category)::boolean,true)`,
        { ids: jobs.map((j) => j.id) },
      );
      const ids = new Set(active.map((j) => j.id));
      for (const job of jobs) if (!ids.has(job.id)) await this.finish(job);
      const native = active.filter((job) => job.provider !== 'EXPO');
      for (let offset = 0; offset < native.length; offset += 10) {
        await Promise.all(
          native.slice(offset, offset + 10).map(async (job) => {
            try {
              const allowed = await redis.eval(
                rateScript,
                1,
                `mello:push:rate:${job.provider}:${job.project_id}:${Math.floor(Date.now() / 1000)}`,
                '1',
                String(
                  Math.max(
                    1,
                    Number(process.env.NATIVE_PUSH_RATE_LIMIT ?? 1000),
                  ),
                ),
              );
              if (!allowed) {
                await this.defer(job);
                return;
              }
              const result = await sendNativePush({
                provider: job.provider as 'FCM' | 'APNS',
                app: job.app,
                token: job.token,
                notificationId: job.notification_id,
                offers: job.category === 'offers',
              });
              if (result.invalidDevice)
                await rows(
                  'UPDATE notification_devices SET enabled=false WHERE id=:id RETURNING id',
                  { id: job.device_id },
                );
              if (result.accepted || result.invalidDevice)
                await this.finish(job);
              else await this.retry(job, result.error ?? 'NATIVE_PUSH_RETRY');
            } catch {
              await this.retry(job, 'NATIVE_PUSH_RETRY');
            }
          }),
        );
      }
      const expo = active.filter((job) => job.provider === 'EXPO');
      for (const project of new Set(expo.map((j) => j.project_id))) {
        const batch = expo.filter((j) => j.project_id === project);
        const allowed = await redis.eval(
          rateScript,
          1,
          `mello:push:rate:${project}:${Math.floor(Date.now() / 1000)}`,
          String(batch.length),
          String(limit),
        );
        if (!allowed) {
          for (const job of batch) await this.defer(job);
          continue;
        }
        const result = await this.request(
          'send',
          batch.map((j) => ({
            to: j.token,
            title: 'Mello',
            body:
              j.category === 'offers'
                ? 'There’s something new nearby. Open Mello to explore.'
                : 'You have a new update. Open Mello to see it.',
            sound: 'default',
            channelId: 'mello-updates',
            data: { notificationId: j.notification_id },
            ttl: 86400,
          })),
        );
        const tickets = result.data as Ticket[];
        if (!Array.isArray(tickets) || tickets.length !== batch.length)
          throw new Error('PUSH_INVALID_TICKETS');
        for (let index = 0; index < batch.length; index++) {
          const job = batch[index]!,
            ticket = tickets[index]!;
          if (ticket.status === 'ok' && ticket.id) {
            await rows(
              'INSERT INTO notification_push_receipts(ticket_id,device_id) VALUES (:ticket,:device) ON CONFLICT DO NOTHING RETURNING ticket_id',
              { ticket: ticket.id, device: job.device_id },
            );
            await this.finish(job);
          } else if (ticket.details?.error === 'DeviceNotRegistered') {
            await rows(
              'UPDATE notification_devices SET enabled=false WHERE id=:id RETURNING id',
              { id: job.device_id },
            );
            await this.finish(job);
          } else
            await this.retry(
              job,
              ticket.details?.error ?? 'PUSH_TICKET_REJECTED',
            );
        }
      }
    } catch {
      for (const job of jobs) await this.retry(job, 'PUSH_PROVIDER_RETRY');
    }
  }
  async receipts() {
    if (process.env.NOTIFICATION_PUSH_ENABLED !== 'true') return;
    // Row leasing avoids multiple workers repeatedly requesting the same receipts.
    const due = await rows<{
      ticket_id: string;
      device_id: string;
      attempts: number;
      created_at: string;
    }>(`WITH batch AS (SELECT ticket_id FROM notification_push_receipts WHERE checked_at IS NULL AND available_at<=now() ORDER BY available_at FOR UPDATE SKIP LOCKED LIMIT 100)
      UPDATE notification_push_receipts r SET available_at=now()+interval '1 minute',attempts=attempts+1 FROM batch b WHERE r.ticket_id=b.ticket_id RETURNING r.*`);
    if (!due.length) return;
    try {
      const result = await this.request('getReceipts', {
        ids: due.map((r) => r.ticket_id),
      });
      const data = result.data as Record<string, Ticket>;
      for (const receipt of due) {
        const ticket = data?.[receipt.ticket_id];
        if (
          !ticket &&
          Date.now() - new Date(receipt.created_at).getTime() < 86400000
        )
          continue;
        if (ticket?.details?.error === 'DeviceNotRegistered')
          await rows(
            'UPDATE notification_devices SET enabled=false WHERE id=:id RETURNING id',
            { id: receipt.device_id },
          );
        await rows(
          'UPDATE notification_push_receipts SET checked_at=now(),status=:status WHERE ticket_id=:id RETURNING ticket_id',
          {
            id: receipt.ticket_id,
            status:
              ticket?.status === 'ok'
                ? 'ACCEPTED'
                : (ticket?.details?.error ?? 'RECEIPT_EXPIRED'),
          },
        );
      }
    } catch {
      console.error('Notification push receipt check will retry.');
    }
  }
}
export function startNotificationWorker() {
  const worker = new NotificationWorker();
  let stopped = false;
  const sleepers = new Set<() => void>();
  const loop = async (action: () => Promise<void>, delay: number) => {
    while (!stopped) {
      try {
        await action();
      } catch {
        console.error(
          'Notification worker cycle interrupted; durable jobs will retry.',
        );
      }
      if (!stopped)
        await new Promise<void>((resolve) => {
          const wake = () => {
            clearTimeout(timer);
            sleepers.delete(wake);
            resolve();
          };
          const timer = setTimeout(wake, delay);
          sleepers.add(wake);
        });
    }
  };
  const channels = new Set(
    (process.env.NOTIFICATION_WORKER_CHANNELS ?? 'LIVE,CAMPAIGN,PUSH,RECEIPTS')
      .split(',')
      .map((name) => name.trim()),
  );
  const tasks = [
    { channel: 'LIVE', action: () => worker.live(), delay: 200 },
    { channel: 'CAMPAIGN', action: () => worker.campaign(), delay: 300 },
    { channel: 'PUSH', action: () => worker.push(), delay: 250 },
    { channel: 'RECEIPTS', action: () => worker.receipts(), delay: 30000 },
  ];
  if (
    !channels.size ||
    [...channels].some(
      (channel) => !tasks.some((task) => task.channel === channel),
    )
  )
    throw new Error('Unknown notification worker channel');
  const done = Promise.all(
    tasks
      .filter((task) => channels.has(task.channel))
      .map((task) => loop(task.action, task.delay)),
  );
  return async () => {
    stopped = true;
    for (const wake of sleepers) wake();
    await done;
    closeNativePushConnections();
  };
}
