import { PlatformUser } from '../models';
import { BaseRepository } from './base.repository';

export class PlatformUserRepository extends BaseRepository<PlatformUser> {
  constructor() {
    super(PlatformUser);
  }
}
