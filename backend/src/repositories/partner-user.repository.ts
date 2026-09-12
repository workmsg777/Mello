import { PartnerUser } from '../models';
import { BaseRepository } from './base.repository';

export class PartnerUserRepository extends BaseRepository<PartnerUser> {
  constructor() { super(PartnerUser); }
}
