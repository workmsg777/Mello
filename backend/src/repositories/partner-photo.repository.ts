import { PartnerPhoto } from '../models';
import { BaseRepository } from './base.repository';

export class PartnerPhotoRepository extends BaseRepository<PartnerPhoto> {
  constructor() { super(PartnerPhoto); }
}
