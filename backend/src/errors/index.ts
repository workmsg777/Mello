import { BadRequestError } from './badRequest';
import { ConflictError } from './conflict';
import { CustomApiError } from './customApiError';
import { ForbiddenError } from './forbidden';
import { NotFoundError } from './notFound';
import { SystemError } from './systemError';
import { UnauthorizedError } from './unauthorized';

export {
  BadRequestError,
  ConflictError,
  CustomApiError,
  ForbiddenError,
  NotFoundError,
  SystemError,
  UnauthorizedError,
};

/** Namespace-style export matching the error usage pattern in Novixer. */
const Errors = {
  BadRequestError,
  ConflictError,
  CustomApiError,
  ForbiddenError,
  NotFoundError,
  SystemError,
  UnauthorizedError,
};

export default Errors;
