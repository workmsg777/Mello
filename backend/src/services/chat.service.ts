import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sequelize } from '../config/database';
import Errors from '../errors';
import { rows, mutualLikesSql } from '../repositories/discovery.repository';
import { DiscoveryService } from './discovery.service';
import { NotificationService } from '../notifications/notification.service';
import { NotificationKind } from '../notifications/types';

export const chatId = z.string().uuid();
export const sendMessageSchema = z.object({
  matchId: chatId,
  clientMessageId: chatId,
  body: z.string().trim().min(1).max(2000),
});
export const readMessageSchema = z.object({
  matchId: chatId,
  messageId: chatId,
});
export interface ChatMessage {
  id: string;
  matchId: string;
  senderId: string;
  clientMessageId: string;
  sequence: number;
  body: string;
  createdAt: string;
}
const messageColumns = `id,match_id AS "matchId",sender_id AS "senderId",client_message_id AS "clientMessageId",sequence,body,created_at AS "createdAt"`;

export class ChatService {
  private readonly discovery = new DiscoveryService();

  async history(userId: string, matchId: string, before?: number) {
    const match = await this.discovery.assertMatch(userId, matchId);
    const messages = await rows<ChatMessage>(
      `SELECT ${messageColumns} FROM chat_messages WHERE match_id=:matchId AND (:before IS NULL OR sequence < :before) ORDER BY sequence DESC LIMIT 51`,
      { matchId, before: before ?? null },
    );
    const [receipt] = await rows<{ lastReadSequence: number }>(
      `SELECT last_read_sequence AS "lastReadSequence" FROM chat_reads WHERE match_id=:matchId AND user_id=:peerId`,
      {
        matchId,
        peerId: match.user_low === userId ? match.user_high : match.user_low,
      },
    );
    return {
      messages: messages.slice(0, 50).reverse(),
      nextBefore: messages.length > 50 ? messages[49]!.sequence : null,
      peerReadSequence: receipt?.lastReadSequence ?? 0,
    };
  }

  async summaries(userId: string) {
    return rows<{
      matchId: string;
      unreadCount: number;
      lastMessage: ChatMessage | null;
      peerReadSequence: number;
    }>(
      `
      SELECT m.id AS "matchId", latest.message AS "lastMessage",
        (SELECT count(*)::int FROM chat_messages cm WHERE cm.match_id=m.id AND cm.sender_id<>:userId AND cm.sequence>COALESCE(mine.last_read_sequence,0)) AS "unreadCount",
        COALESCE(peer.last_read_sequence,0) AS "peerReadSequence"
      FROM matches m
      JOIN users u1 ON u1.id=m.user_low AND u1.deleted_at IS NULL JOIN users u2 ON u2.id=m.user_high AND u2.deleted_at IS NULL
      JOIN accounts a1 ON a1.id=u1.account_id AND a1.status='ACTIVE' AND a1.deleted_at IS NULL
      JOIN accounts a2 ON a2.id=u2.account_id AND a2.status='ACTIVE' AND a2.deleted_at IS NULL
      LEFT JOIN chat_reads mine ON mine.match_id=m.id AND mine.user_id=:userId
      LEFT JOIN chat_reads peer ON peer.match_id=m.id AND peer.user_id=CASE WHEN m.user_low=:userId THEN m.user_high ELSE m.user_low END
      LEFT JOIN LATERAL (SELECT json_build_object('id',id,'matchId',match_id,'senderId',sender_id,'clientMessageId',client_message_id,'sequence',sequence,'body',body,'createdAt',created_at) AS message, created_at FROM chat_messages WHERE match_id=m.id ORDER BY sequence DESC LIMIT 1) latest ON true
      WHERE :userId IN (m.user_low,m.user_high) AND ${mutualLikesSql} ORDER BY COALESCE(latest.created_at,m.created_at) DESC LIMIT 100`,
      { userId },
    );
  }

  async send(userId: string, raw: unknown) {
    const parsed = sendMessageSchema.safeParse(raw);
    if (!parsed.success)
      throw new Errors.BadRequestError(
        'Enter a message of 1–2000 characters with a valid conversation and message ID',
      );
    const input = parsed.data;
    return sequelize.transaction(async (transaction) => {
      // One sender lock makes the per-account limit and idempotency work across API instances.
      await rows(
        'SELECT id FROM users WHERE id=:userId FOR UPDATE',
        { userId },
        transaction,
      );
      const match = await this.discovery.assertMatch(
        userId,
        input.matchId,
        transaction,
      );
      const peerId =
        match.user_low === userId ? match.user_high : match.user_low;
      const [prior] = await rows<ChatMessage>(
        `SELECT ${messageColumns} FROM chat_messages WHERE sender_id=:userId AND client_message_id=:clientMessageId`,
        { userId, clientMessageId: input.clientMessageId },
        transaction,
      );
      if (prior) {
        if (prior.matchId !== input.matchId || prior.body !== input.body)
          throw new Errors.ConflictError(
            'This message ID has already been used',
          );
        return { message: prior, peerId, duplicate: true };
      }
      const [count] = await rows<{ total: number }>(
        `SELECT count(*)::int AS total FROM chat_messages WHERE sender_id=:userId AND created_at > now()-interval '1 minute'`,
        { userId },
        transaction,
      );
      if (count!.total >= 30)
        throw new Errors.TooManyRequestsError(
          'You’re sending messages quickly. Try again in a minute.',
        );
      // The match row serializes both senders, assigning a stable committed conversation order.
      const [position] = await rows<{ sequence: number }>(
        'UPDATE matches SET chat_sequence=chat_sequence+1 WHERE id=:matchId RETURNING chat_sequence AS sequence',
        { matchId: input.matchId },
        transaction,
      );
      const [message] = await rows<ChatMessage>(
        `INSERT INTO chat_messages (id,match_id,sender_id,client_message_id,sequence,body) VALUES (:id,:matchId,:userId,:clientMessageId,:sequence,:body) RETURNING ${messageColumns}`,
        { ...input, id: randomUUID(), userId, sequence: position!.sequence },
        transaction,
      );
      await new NotificationService().users(
        [peerId],
        {
          key: `message:${message!.id}`,
          kind: NotificationKind.MESSAGE,
          category: 'messages',
          title: 'A new message',
          body: 'Your match sent you a message.',
          data: {
            matchId: input.matchId,
            messageId: message!.id,
            sequence: message!.sequence,
          },
        },
        transaction,
      );
      return { message: message!, peerId, duplicate: false };
    });
  }

  async read(userId: string, raw: unknown) {
    const parsed = readMessageSchema.safeParse(raw);
    if (!parsed.success)
      throw new Errors.BadRequestError(
        'A valid conversation and message ID are required',
      );
    const { matchId, messageId } = parsed.data;
    const match = await this.discovery.assertMatch(userId, matchId);
    const [message] = await rows<{ sequence: number }>(
      'SELECT sequence FROM chat_messages WHERE id=:messageId AND match_id=:matchId',
      { messageId, matchId },
    );
    if (!message) throw new Errors.NotFoundError('Message not found');
    const [receipt] = await rows<{ lastReadSequence: number }>(
      `INSERT INTO chat_reads (match_id,user_id,last_read_sequence) VALUES (:matchId,:userId,:sequence) ON CONFLICT (match_id,user_id) DO UPDATE SET last_read_sequence=GREATEST(chat_reads.last_read_sequence,EXCLUDED.last_read_sequence),updated_at=now() RETURNING last_read_sequence AS "lastReadSequence"`,
      { matchId, userId, sequence: message.sequence },
    );
    return {
      matchId,
      userId,
      lastReadSequence: receipt!.lastReadSequence,
      peerId: match.user_low === userId ? match.user_high : match.user_low,
    };
  }
}
