import { CustomApiError } from './customApiError';

export class UnauthorizedError extends CustomApiError {
  constructor(message = 'Authentication required') {
    super(message, 401);
  }
}
