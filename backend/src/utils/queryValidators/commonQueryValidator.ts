import { validateQueryParams } from '../requestValidator';

export interface PaginationQuery extends Record<string, unknown> {
  page?: number;
  limit?: number;
}

export function validateIdParam(
  params: Record<string, unknown>,
  key = 'id',
): void {
  validateQueryParams(
    params,
    { [key]: { type: 'uuid', required: true } },
    { removeNotDefinedInStructure: true },
  );
}

export function validatePaginationQuery(query: PaginationQuery): void {
  validateQueryParams(
    query,
    {
      page: { type: 'number', min: 1, default: 1 },
      limit: { type: 'number', min: 1, max: 100, default: 20 },
    },
    { removeNotDefinedInStructure: true },
  );
}
