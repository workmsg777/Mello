import { AccountRole } from '../models';
import { BaseRepository } from './base.repository';

export class AccountRoleRepository extends BaseRepository<AccountRole> {
  constructor() { super(AccountRole); }
}
