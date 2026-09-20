import Errors from '../../errors';
import { UserRepository } from '../../repositories';

export class DatingUserService {
  constructor(private readonly repository = new UserRepository()) {}

  async requireByAccountId(accountId: string): Promise<{ id: string }> {
    const user = await this.repository.findOne({ where: { accountId } });
    if (!user)
      throw new Errors.ForbiddenError('Dating-user access is required');
    return { id: user.id };
  }
}
