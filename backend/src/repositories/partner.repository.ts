import { Partner } from '../models';
import { BaseRepository } from './base.repository';

export class PartnerRepository extends BaseRepository<Partner> {
  constructor() {
    super(Partner);
  }
}
