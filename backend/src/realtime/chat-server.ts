import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { z } from 'zod';
import Errors from '../errors';
import { TokenService } from '../services/auth/token.service';
import { rows } from '../repositories/discovery.repository';
import { ChatService } from '../services/chat.service';
import { DiscoveryService } from '../services/discovery.service';
import { publishChat, registerChatPublisher } from './chat-events';
import jwt from 'jsonwebtoken';

export function createChatServer(server: HttpServer) {
  const io = new Server(server, {
    cors: { origin: true },
    maxHttpBufferSize: 16_384,
    transports: ['websocket'],
  });
  const tokens = new TokenService(),
    chat = new ChatService(),
    discovery = new DiscoveryService();
  // No client chooses rooms. Every authenticated device joins only its own user's room.
  const unregister = registerChatPublisher((userIds, event, payload) => {
    // Check receiving sessions too: a revoked idle device must not receive private messages.
    void (async () => {
      const sockets = await io
        .in(userIds.map((id) => `user:${id}`))
        .fetchSockets();
      if (!sockets.length) return;
      const sessions = await rows<{ id: string }>(
        `SELECT s.id FROM user_sessions s JOIN accounts a ON a.id=s.account_id AND a.status='ACTIVE' AND a.deleted_at IS NULL WHERE s.id IN (:ids) AND s.revoked_at IS NULL AND s.expires_at>now()`,
        { ids: sockets.map((socket) => socket.data.sessionId) },
      );
      const active = new Set(sessions.map((session) => session.id));
      for (const socket of sockets) {
        if (
          active.has(socket.data.sessionId) &&
          socket.data.tokenExpiresAt > Date.now()
        )
          socket.emit(event, payload);
        else socket.disconnect(true);
      }
    })().catch(() =>
      console.error(
        'Chat event delivery interrupted; clients can recover saved history.',
      ),
    );
  });
  const authenticate = async (token: unknown) => {
    if (typeof token !== 'string')
      throw new Errors.UnauthorizedError('Please log in to chat');
    const context = tokens.verifyAccessToken(token);
    if (context.accountType !== 'DATING_USER')
      throw new Errors.ForbiddenError('Dating-user access is required');
    const [user] = await rows<{ id: string }>(
      `SELECT u.id FROM users u JOIN accounts a ON a.id=u.account_id AND a.status='ACTIVE' AND a.deleted_at IS NULL JOIN user_sessions s ON s.account_id=a.id AND s.id=:sessionId AND s.revoked_at IS NULL AND s.expires_at>now() WHERE u.account_id=:accountId AND u.deleted_at IS NULL`,
      { ...context },
    );
    if (!user)
      throw new Errors.UnauthorizedError(
        'Your session has ended. Please log in again.',
      );
    return user.id;
  };
  const safeError = (error: unknown) => ({
    ok: false,
    error:
      error instanceof Errors.CustomApiError
        ? error.message
        : 'Chat is temporarily unavailable. Please retry.',
    status: error instanceof Errors.CustomApiError ? error.statusCode : 500,
  });
  io.use((socket, next) => {
    void authenticate(socket.handshake.auth.token)
      .then(async (userId) => {
        await discovery.assertReady(userId);
        socket.data.userId = userId;
        const context = tokens.verifyAccessToken(socket.handshake.auth.token);
        socket.data.sessionId = context.sessionId;
        const decoded = jwt.decode(
          socket.handshake.auth.token,
        ) as jwt.JwtPayload;
        socket.data.tokenExpiresAt = (decoded.exp ?? 0) * 1000;
        next();
      })
      .catch((error: unknown) =>
        next(
          Object.assign(new Error(safeError(error).error), {
            data: safeError(error),
          }),
        ),
      );
  });
  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    void socket.join(`user:${userId}`);
    const check = async () => {
      await authenticate(socket.handshake.auth.token);
    };
    // Revalidate idle sockets as well as each operation; expired sessions cannot keep receiving.
    const timer = setInterval(() => {
      void check().catch(() => socket.disconnect(true));
    }, 15_000);
    timer.unref();
    socket.on('disconnect', () => clearInterval(timer));
    let typingAt = 0;
    const handle = (
      event: string,
      action: (input: unknown) => Promise<unknown>,
    ) => {
      socket.on(event, (input: unknown, ack: unknown) => {
        if (typeof ack !== 'function') return;
        void check()
          .then(() => action(input))
          .then((data) => ack({ ok: true, data }))
          .catch((error: unknown) => {
            ack(safeError(error));
            if (error instanceof Errors.UnauthorizedError)
              socket.disconnect(true);
          });
      });
    };
    handle('chat:send', async (input) => {
      const result = await chat.send(userId, input);
      // Publish only after commit. A retry re-emits the same ID; clients deduplicate it.
      publishChat([userId, result.peerId], 'chat:message', result.message);
      return result.message;
    });
    handle('chat:read', async (input) => {
      const receipt = await chat.read(userId, input);
      const { peerId, ...event } = receipt;
      publishChat([userId, peerId], 'chat:read', event);
      return event;
    });
    handle('chat:typing', async (input) => {
      if (Date.now() - typingAt < 750) return null;
      typingAt = Date.now();
      const parsed = z
        .object({ matchId: z.string().uuid(), typing: z.boolean() })
        .safeParse(input);
      if (!parsed.success)
        throw new Errors.BadRequestError('Invalid typing event');
      const match = await discovery.assertMatch(userId, parsed.data.matchId);
      const peerId =
        match.user_low === userId ? match.user_high : match.user_low;
      publishChat([peerId], 'chat:typing', { ...parsed.data, userId });
      return null;
    });
  });
  io.engine.on('close', unregister);
  return io;
}
