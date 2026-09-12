import { UserSession } from '../models';
import { BaseRepository } from './base.repository';

export class UserSessionRepository extends BaseRepository<UserSession> {
  constructor() { super(UserSession); }
}
