import { CustomApiError } from './customApiError';

export class TooManyRequestsError extends CustomApiError {
  constructor(message = 'Too many requests; please try again later') {
    super(message, 429);
  }
}
