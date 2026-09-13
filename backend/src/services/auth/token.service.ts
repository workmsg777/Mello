import { createHash, randomBytes } from 'node:crypto';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { authConfig, requireJwtSecret } from '../../config/auth';
import Errors from '../../errors';
import {
  accountTypes,
  type AccountType,
  type AuthContext,
} from '../../types/auth';

interface AccessTokenPayload extends JwtPayload {
  accountType: AccountType;
  sid: string;
  typ: 'access';
}

export class TokenService {
  createAccessToken(context: AuthContext): string {
    return jwt.sign(
      {
        accountType: context.accountType,
        sid: context.sessionId,
        typ: 'access',
      },
      requireJwtSecret(),
      {
        subject: context.accountId,
        expiresIn: authConfig.accessTokenTtlSeconds,
        issuer: authConfig.jwtIssuer,
        audience: authConfig.jwtAudience,
      },
    );
  }

  createRefreshToken(): string {
    return randomBytes(64).toString('base64url');
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  verifyAccessToken(token: string): AuthContext {
    let payload: string | JwtPayload;
    try {
      payload = jwt.verify(token, requireJwtSecret(), {
        issuer: authConfig.jwtIssuer,
        audience: authConfig.jwtAudience,
      });
    } catch {
      throw new Errors.UnauthorizedError('Access token is invalid or expired');
    }

    if (
      typeof payload === 'string' ||
      payload.typ !== 'access' ||
      typeof payload.sub !== 'string' ||
      typeof payload.sid !== 'string' ||
      !accountTypes.includes(payload.accountType as AccountType)
    ) {
      throw new Errors.UnauthorizedError('Access token payload is invalid');
    }

    const claims = payload as AccessTokenPayload;
    return {
      accountId: claims.sub as string,
      accountType: claims.accountType,
      sessionId: claims.sid,
    };
  }
}
