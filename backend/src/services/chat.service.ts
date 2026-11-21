import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sequelize } from '../config/database';
import Errors from '../errors';
import { ChatRepository } from '../repositories/chat.repository';
import { DiscoveryService } from './discovery.service';
import { NotificationService } from '../notifications/notification.service';
import { NotificationKind } from '../notifications/types';
import { MatchingAiClient } from './matching/ai-client';

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
export type { ChatMessage } from '../types/chat';

export class ChatService {
  private readonly discovery = new DiscoveryService();
  private readonly repository = new ChatRepository();

  async icebreakers(userId: string, matchId: string) {
    const match = await this.discovery.assertMatch(userId, matchId);
    const peerId = match.user_low === userId ? match.user_high : match.user_low;
    const common = await this.repository.sharedInterests(userId, peerId);
    const labels = common.map((i) => i.name);
    const suggestions = await new MatchingAiClient().icebreakers(labels);
    return {
      suggestions:
        suggestions ??
        (labels.length
          ? labels.map(
              (name) =>
                `I noticed we both enjoy ${name}. What got you into it?`,
            )
          : [
              'What does a great weekend look like for you?',
              'What is something you have enjoyed recently?',
            ]),
      source: suggestions ? 'ASSIST_SERVICE' : 'GROUNDED_TEMPLATE',
    };
  }

  async history(userId: string, matchId: string, before?: number) {
    const match = await this.discovery.assertMatch(userId, matchId);
    const messages = await this.repository.history(matchId, before);
    const [receipt] = await this.repository.peerRead(
      matchId,
      match.user_low === userId ? match.user_high : match.user_low,
    );
    return {
      messages: messages.slice(0, 50).reverse(),
      nextBefore: messages.length > 50 ? messages[49]!.sequence : null,
      peerReadSequence: receipt?.lastReadSequence ?? 0,
    };
  }

  async summaries(userId: string) {
    return this.repository.summaries(userId);
  }

  async send(userId: string, raw: unknown) {
    const parsed = sendMessageSchema.safeParse(raw);
    if (!parsed.success)
      throw new Errors.BadRequestError(
        'Enter a message of 1-2000 characters with a valid conversation and message ID',
      );
    const input = parsed.data;
    return sequelize.transaction(async (transaction) => {
      // Shared across HTTP/WebSocket and every API instance.
      await this.repository.lockSender(userId, transaction);
      const match = await this.discovery.assertMatch(
        userId,
        input.matchId,
        transaction,
      );
      const peerId =
        match.user_low === userId ? match.user_high : match.user_low;
      const [prior] = await this.repository.priorMessage(
        userId,
        input.clientMessageId,
        transaction,
      );
      if (prior) {
        if (prior.matchId !== input.matchId || prior.body !== input.body)
          throw new Errors.ConflictError(
            'This message ID has already been used',
          );
        return { message: prior, peerId, duplicate: true };
      }
      const [count] = await this.repository.recentCount(userId, transaction);
      if (count!.total >= 30)
        throw new Errors.TooManyRequestsError(
          'You are sending messages quickly. Try again in a minute.',
        );
      const [position] = await this.repository.incrementSequence(
        input.matchId,
        transaction,
      );
      const [message] = await this.repository.insertMessage(
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
    const [message] = await this.repository.messageSequence(matchId, messageId);
    if (!message) throw new Errors.NotFoundError('Message not found');
    const [receipt] = await this.repository.upsertRead(
      matchId,
      userId,
      message.sequence,
    );
    return {
      matchId,
      userId,
      lastReadSequence: receipt!.lastReadSequence,
      peerId: match.user_low === userId ? match.user_high : match.user_low,
    };
  }
}
