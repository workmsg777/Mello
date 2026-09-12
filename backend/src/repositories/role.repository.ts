import { Role } from '../models';
import { BaseRepository } from './base.repository';

export class RoleRepository extends BaseRepository<Role> {
  constructor() { super(Role); }
}
