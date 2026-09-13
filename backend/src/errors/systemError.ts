import { CustomApiError } from './customApiError';

export class SystemError extends CustomApiError {
  constructor(message = 'Something went wrong; please try again later') {
    super(message, 500);
  }
}
