import { CustomApiError } from './customApiError';

export class NotFoundError extends CustomApiError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}
