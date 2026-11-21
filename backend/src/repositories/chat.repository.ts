import type { Transaction } from 'sequelize';
import { rows, mutualLikesSql } from './discovery.repository';
import type { ChatMessage } from '../types/chat';

const columns = `id,match_id AS "matchId",sender_id AS "senderId",client_message_id AS "clientMessageId",sequence,body,created_at AS "createdAt"`;
export class ChatRepository {
  history(matchId: string, before?: number) {
    return rows<ChatMessage>(
      `SELECT ${columns} FROM chat_messages WHERE match_id=:matchId AND (:before IS NULL OR sequence < :before) ORDER BY sequence DESC LIMIT 51`,
      { matchId, before: before ?? null },
    );
  }
  peerRead(matchId: string, peerId: string) {
    return rows<{ lastReadSequence: number }>(
      'SELECT last_read_sequence AS "lastReadSequence" FROM chat_reads WHERE match_id=:matchId AND user_id=:peerId',
      { matchId, peerId },
    );
  }
  sharedInterests(userId: string, peerId: string) {
    return rows<{ name: string }>(
      `SELECT i.name FROM user_interests mine JOIN user_interests theirs ON theirs.interest_id=mine.interest_id AND theirs.user_id=:peerId
      JOIN interests i ON i.id=mine.interest_id AND i.is_active WHERE mine.user_id=:userId
      AND NOT EXISTS(SELECT 1 FROM user_profile_visibility vis WHERE vis.user_id IN (:userId,:peerId) AND vis.field_code='INTERESTS' AND vis.visibility<>'PROFILE')
      ORDER BY i.display_order,i.id LIMIT 3`,
      { userId, peerId },
    );
  }
  summaries(userId: string) {
    return rows<{
      matchId: string;
      unreadCount: number;
      lastMessage: ChatMessage | null;
      peerReadSequence: number;
    }>(
      `
      SELECT m.id AS "matchId",latest.message AS "lastMessage",
      (SELECT count(*)::int FROM chat_messages cm WHERE cm.match_id=m.id AND cm.sender_id<>:userId AND cm.sequence>COALESCE(mine.last_read_sequence,0)) AS "unreadCount",COALESCE(peer.last_read_sequence,0) AS "peerReadSequence"
      FROM matches m JOIN users u1 ON u1.id=m.user_low AND u1.deleted_at IS NULL JOIN users u2 ON u2.id=m.user_high AND u2.deleted_at IS NULL
      JOIN accounts a1 ON a1.id=u1.account_id AND a1.status='ACTIVE' AND a1.deleted_at IS NULL JOIN accounts a2 ON a2.id=u2.account_id AND a2.status='ACTIVE' AND a2.deleted_at IS NULL
      LEFT JOIN chat_reads mine ON mine.match_id=m.id AND mine.user_id=:userId LEFT JOIN chat_reads peer ON peer.match_id=m.id AND peer.user_id=CASE WHEN m.user_low=:userId THEN m.user_high ELSE m.user_low END
      LEFT JOIN LATERAL(SELECT json_build_object('id',id,'matchId',match_id,'senderId',sender_id,'clientMessageId',client_message_id,'sequence',sequence,'body',body,'createdAt',created_at) AS message,created_at FROM chat_messages WHERE match_id=m.id ORDER BY sequence DESC LIMIT 1) latest ON true
      WHERE :userId IN(m.user_low,m.user_high) AND ${mutualLikesSql} ORDER BY COALESCE(latest.created_at,m.created_at) DESC LIMIT 100`,
      { userId },
    );
  }
  lockSender(userId: string, transaction: Transaction) {
    return rows(
      'SELECT id FROM users WHERE id=:userId FOR UPDATE',
      { userId },
      transaction,
    );
  }
  priorMessage(
    userId: string,
    clientMessageId: string,
    transaction: Transaction,
  ) {
    return rows<ChatMessage>(
      `SELECT ${columns} FROM chat_messages WHERE sender_id=:userId AND client_message_id=:clientMessageId`,
      { userId, clientMessageId },
      transaction,
    );
  }
  recentCount(userId: string, transaction: Transaction) {
    return rows<{ total: number }>(
      "SELECT count(*)::int AS total FROM chat_messages WHERE sender_id=:userId AND created_at>now()-interval '1 minute'",
      { userId },
      transaction,
    );
  }
  incrementSequence(matchId: string, transaction: Transaction) {
    return rows<{ sequence: number }>(
      'UPDATE matches SET chat_sequence=chat_sequence+1 WHERE id=:matchId RETURNING chat_sequence AS sequence',
      { matchId },
      transaction,
    );
  }
  insertMessage(
    input: {
      id: string;
      matchId: string;
      userId: string;
      clientMessageId: string;
      sequence: number;
      body: string;
    },
    transaction: Transaction,
  ) {
    return rows<ChatMessage>(
      `INSERT INTO chat_messages(id,match_id,sender_id,client_message_id,sequence,body) VALUES (:id,:matchId,:userId,:clientMessageId,:sequence,:body) RETURNING ${columns}`,
      input,
      transaction,
    );
  }
  messageSequence(matchId: string, messageId: string) {
    return rows<{ sequence: number }>(
      'SELECT sequence FROM chat_messages WHERE id=:messageId AND match_id=:matchId',
      { matchId, messageId },
    );
  }
  upsertRead(matchId: string, userId: string, sequence: number) {
    return rows<{ lastReadSequence: number }>(
      `INSERT INTO chat_reads(match_id,user_id,last_read_sequence) VALUES (:matchId,:userId,:sequence) ON CONFLICT(match_id,user_id) DO UPDATE SET last_read_sequence=GREATEST(chat_reads.last_read_sequence,EXCLUDED.last_read_sequence),updated_at=now() RETURNING last_read_sequence AS "lastReadSequence"`,
      { matchId, userId, sequence },
    );
  }
}
