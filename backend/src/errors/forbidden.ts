import { CustomApiError } from './customApiError';

export class ForbiddenError extends CustomApiError {
  constructor(message = 'Access denied') {
    super(message, 403);
  }
}
