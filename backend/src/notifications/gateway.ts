import type { Server } from 'socket.io';
import { TokenService } from '../services/auth/token.service';
import { rows } from '../repositories/discovery.repository';
import jwt from 'jsonwebtoken';

export const notificationChannel = 'mello:notifications:v1';
export function createNotificationGateway(io: Server) {
  const namespace = io.of('/notifications');
  const tokens = new TokenService();
  namespace.use((socket, next) => {
    void (async () => {
      const token = socket.handshake.auth.token;
      if (typeof token !== 'string') throw new Error('Please log in');
      const context = tokens.verifyAccessToken(token);
      const [active] = await rows(
        `SELECT a.id FROM accounts a JOIN user_sessions s ON s.account_id=a.id AND s.id=:sessionId
        WHERE a.id=:accountId AND a.status='ACTIVE' AND a.deleted_at IS NULL AND s.revoked_at IS NULL AND s.expires_at>now()`,
        { ...context },
      );
      if (!active) throw new Error('Session ended');
      socket.data.accountId = context.accountId;
      socket.data.expiresAt =
        ((jwt.decode(token) as jwt.JwtPayload).exp ?? 0) * 1000;
    })()
      .then(() => next())
      .catch(() =>
        next(
          Object.assign(new Error('Please log in again'), {
            data: { status: 401 },
          }),
        ),
      );
  });
  namespace.on('connection', (socket) => {
    void socket.join(`account:${socket.data.accountId}`);
    // No private payloads travel over this namespace. Fetches always recheck the session.
    socket.emit('notifications:changed');
    const expiry = setTimeout(
      () => socket.disconnect(true),
      Math.max(0, socket.data.expiresAt - Date.now()),
    );
    expiry.unref();
    socket.on('disconnect', () => clearTimeout(expiry));
  });
  return (accountIds: string[]) => {
    namespace.local
      .to(accountIds.map((id) => `account:${id}`))
      .emit('notifications:changed');
  };
}
