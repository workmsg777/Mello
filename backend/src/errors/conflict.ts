import { CustomApiError } from './customApiError';

export class ConflictError extends CustomApiError {
  constructor(message = 'Resource conflict') {
    super(message, 409);
  }
}
