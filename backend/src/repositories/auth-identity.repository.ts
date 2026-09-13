import { AuthIdentity } from '../models';
import { BaseRepository } from './base.repository';

export class AuthIdentityRepository extends BaseRepository<AuthIdentity> {
  constructor() {
    super(AuthIdentity);
  }
}
