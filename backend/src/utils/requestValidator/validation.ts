import Errors from '../../errors';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export type ParamType =
  | 'string'
  | 'number'
  | 'uuid'
  | 'date'
  | 'boolean'
  | 'string[]'
  | 'number[]'
  | 'uuid[]'
  | 'enum'
  | 'object'
  | 'password'
  | 'array'
  | 'identifier';

export interface QueryValidationRule {
  required?: boolean;
  type: ParamType;
  min?: number;
  max?: number;
  minDate?: Date;
  separator?: string;
  values?: readonly unknown[];
  default?: unknown;
  minArrayLength?: number;
  maxArrayLength?: number;
  pattern?: RegExp;
}

export type QueryValidationRules = Record<string, QueryValidationRule>;

export interface ValidateQueryParamsOptions {
  removeNotDefinedInStructure?: boolean;
}

const isEmptyValue = (value: unknown): boolean =>
  value === undefined || value === null || value === '';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const assertScalar = (value: unknown, key: string): void => {
  if (value !== null && typeof value === 'object') {
    throw new Errors.BadRequestError(`${key} must be a scalar value`);
  }
};

const assertStringLength = (
  value: string,
  key: string,
  rule: QueryValidationRule,
): void => {
  if (rule.min !== undefined && value.length < rule.min) {
    throw new Errors.BadRequestError(
      `${key} must be at least ${rule.min} characters long`,
    );
  }
  if (rule.max !== undefined && value.length > rule.max) {
    throw new Errors.BadRequestError(
      `${key} must be at most ${rule.max} characters long`,
    );
  }
};

const assertArrayLength = (
  value: readonly unknown[],
  key: string,
  rule: QueryValidationRule,
): void => {
  if (rule.minArrayLength !== undefined && value.length < rule.minArrayLength) {
    throw new Errors.BadRequestError(
      `${key} must contain at least ${rule.minArrayLength} items`,
    );
  }
  if (rule.maxArrayLength !== undefined && value.length > rule.maxArrayLength) {
    throw new Errors.BadRequestError(
      `${key} cannot exceed ${rule.maxArrayLength} items`,
    );
  }
};

const parseArray = (
  value: unknown,
  key: string,
  separator = ',',
): unknown[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value
      .split(separator)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  throw new Errors.BadRequestError(`${key} must be an array`);
};

/**
 * Validates and normalizes request query/body values in place.
 * This mirrors Novixer's shared validation contract without requiring cubixer-core.
 */
export function validateQueryParams(
  query: Record<string, unknown>,
  rules: QueryValidationRules,
  options: ValidateQueryParamsOptions = {},
): void {
  if (!isPlainObject(query)) {
    throw new Errors.BadRequestError('Request parameters must be an object');
  }

  if (options.removeNotDefinedInStructure) {
    for (const key of Object.keys(query)) {
      if (!Object.prototype.hasOwnProperty.call(rules, key)) delete query[key];
    }
  }

  for (const [key, rule] of Object.entries(rules)) {
    let value = query[key];

    if (rule.required && isEmptyValue(value)) {
      throw new Errors.BadRequestError(`Missing required parameter: ${key}`);
    }

    if (isEmptyValue(value) && rule.default !== undefined) {
      query[key] = rule.default;
      value = rule.default;
    }

    if (isEmptyValue(value)) continue;

    switch (rule.type) {
      case 'number': {
        assertScalar(value, key);
        const numberValue = Number(value);
        if (!Number.isFinite(numberValue)) {
          throw new Errors.BadRequestError(`${key} must be a number`);
        }
        if (rule.min !== undefined && numberValue < rule.min) {
          throw new Errors.BadRequestError(`${key} must be >= ${rule.min}`);
        }
        if (rule.max !== undefined && numberValue > rule.max) {
          throw new Errors.BadRequestError(`${key} must be <= ${rule.max}`);
        }
        query[key] = numberValue;
        break;
      }

      case 'string': {
        assertScalar(value, key);
        const stringValue = typeof value === 'string' ? value : String(value);
        assertStringLength(stringValue, key, rule);
        if (rule.pattern && !rule.pattern.test(stringValue)) {
          throw new Errors.BadRequestError(`${key} has an invalid format`);
        }
        query[key] = stringValue;
        break;
      }

      case 'password': {
        if (typeof value !== 'string') {
          throw new Errors.BadRequestError(`${key} must be a string`);
        }
        const minLength = rule.min ?? 8;
        const maxLength = rule.max ?? 100;
        if (value.length < minLength || value.length > maxLength) {
          throw new Errors.BadRequestError(
            `${key} must be between ${minLength} and ${maxLength} characters long`,
          );
        }
        if (
          !/[a-z]/.test(value) ||
          !/[A-Z]/.test(value) ||
          !/[0-9]/.test(value) ||
          !/[^a-zA-Z0-9]/.test(value)
        ) {
          throw new Errors.BadRequestError(
            `${key} must contain uppercase, lowercase, number, and special characters`,
          );
        }
        break;
      }

      case 'uuid':
        assertScalar(value, key);
        if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
          throw new Errors.BadRequestError(`${key} must be a valid UUID`);
        }
        break;

      case 'boolean':
        assertScalar(value, key);
        if (typeof value === 'boolean') break;
        if (
          typeof value === 'string' &&
          ['true', 'false'].includes(value.toLowerCase())
        ) {
          query[key] = value.toLowerCase() === 'true';
          break;
        }
        throw new Errors.BadRequestError(
          `${key} must be a boolean (true or false)`,
        );

      case 'date': {
        assertScalar(value, key);
        const dateValue = new Date(value as string | number | Date);
        if (Number.isNaN(dateValue.getTime())) {
          throw new Errors.BadRequestError(`${key} must be a valid date`);
        }
        if (rule.minDate && dateValue < rule.minDate) {
          throw new Errors.BadRequestError(
            `${key} must be >= ${rule.minDate.toISOString()}`,
          );
        }
        query[key] = dateValue;
        break;
      }

      case 'object':
        if (!isPlainObject(value)) {
          throw new Errors.BadRequestError(`${key} must be a valid object`);
        }
        break;

      case 'string[]': {
        const values = parseArray(value, key, rule.separator).map((item) => {
          if (typeof item !== 'string') {
            throw new Errors.BadRequestError(
              `All items in ${key} must be strings`,
            );
          }
          assertStringLength(item, key, rule);
          if (rule.pattern && !rule.pattern.test(item)) {
            throw new Errors.BadRequestError(
              `All items in ${key} must have a valid format`,
            );
          }
          return item;
        });
        assertArrayLength(values, key, rule);
        query[key] = values;
        break;
      }

      case 'number[]': {
        const values = parseArray(value, key, rule.separator).map((item) => {
          const numberValue = Number(item);
          if (!Number.isFinite(numberValue)) {
            throw new Errors.BadRequestError(
              `All items in ${key} must be valid numbers`,
            );
          }
          if (rule.min !== undefined && numberValue < rule.min) {
            throw new Errors.BadRequestError(
              `All items in ${key} must be >= ${rule.min}`,
            );
          }
          if (rule.max !== undefined && numberValue > rule.max) {
            throw new Errors.BadRequestError(
              `All items in ${key} must be <= ${rule.max}`,
            );
          }
          return numberValue;
        });
        assertArrayLength(values, key, rule);
        query[key] = values;
        break;
      }

      case 'uuid[]': {
        const values = parseArray(value, key, rule.separator).map((item) => {
          if (typeof item !== 'string' || !UUID_PATTERN.test(item)) {
            throw new Errors.BadRequestError(
              `All items in ${key} must be valid UUIDs`,
            );
          }
          return item;
        });
        assertArrayLength(values, key, rule);
        query[key] = values;
        break;
      }

      case 'array':
        if (!Array.isArray(value)) {
          throw new Errors.BadRequestError(`${key} must be an array`);
        }
        assertArrayLength(value, key, rule);
        break;

      case 'enum':
        assertScalar(value, key);
        if (!rule.values?.includes(value)) {
          throw new Errors.BadRequestError(
            `${key} must be one of: ${rule.values?.join(', ') ?? ''}`,
          );
        }
        break;

      case 'identifier': {
        assertScalar(value, key);
        const identifier = String(value);
        const pattern = rule.pattern ?? IDENTIFIER_PATTERN;
        if (!pattern.test(identifier)) {
          throw new Errors.BadRequestError(`${key} must be a valid identifier`);
        }
        assertStringLength(identifier, key, rule);
        query[key] = identifier;
        break;
      }

      default: {
        const exhaustive: never = rule.type;
        throw new Error(`Unknown validation type: ${String(exhaustive)}`);
      }
    }
  }
}

export const lengthsOfFields = {
  email: 320,
  name: 200,
  password: 100,
  description: 1000,
  phoneNumber: 32,
  postalCode: 20,
  storageKey: 1024,
  generic: 255,
} as const;
