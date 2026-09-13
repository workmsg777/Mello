import { UserPhoto } from '../models';
import { BaseRepository } from './base.repository';

export class UserPhotoRepository extends BaseRepository<UserPhoto> {
  constructor() {
    super(UserPhoto);
  }
}
