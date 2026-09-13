/**
 * Backward-compatible model barrel.
 * New model definitions live as individual files under mainDb.
 */
export * from './mainDb';
export { melloModelConfig as persistedModels } from './modelConfig';
