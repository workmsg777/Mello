import type { Sequelize } from 'sequelize';
import { initializeAssociations } from './associations';
import { melloModelConfig } from './modelConfig';

let initialized = false;

/** Initializes every model before associations, avoiding circular model imports. */
export function initializeModels(sequelize: Sequelize): void {
  if (initialized) return;
  for (const model of melloModelConfig) model.initialize(sequelize);
  initializeAssociations();
  initialized = true;
}

export * from './entities';
export * from './modelConfig';
