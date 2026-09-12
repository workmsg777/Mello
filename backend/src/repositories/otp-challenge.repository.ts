import { OtpChallenge } from '../models';
import { BaseRepository } from './base.repository';

export class OtpChallengeRepository extends BaseRepository<OtpChallenge> {
  constructor() { super(OtpChallenge); }
}
