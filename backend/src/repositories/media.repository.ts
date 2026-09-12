import { Media } from '../models';
import { BaseRepository } from './base.repository';

export class MediaRepository extends BaseRepository<Media> {
  constructor() { super(Media); }
}
