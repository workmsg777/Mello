import { CustomApiError } from './customApiError';

export class BadRequestError extends CustomApiError {
  constructor(message = 'Bad request') {
    super(message, 400);
  }
}
