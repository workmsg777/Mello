import { Account } from '../models';
import { BaseRepository } from './base.repository';

export class AccountRepository extends BaseRepository<Account> {
  constructor() {
    super(Account);
  }
}
