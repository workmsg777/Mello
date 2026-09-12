import type { Sequelize } from 'sequelize';
import { initializeAssociations } from './associations';
import { persistedModels } from './entities';

let initialized = false;

/** Initializes every model before associations, avoiding circular model imports. */
export function initializeModels(sequelize: Sequelize): void {
  if (initialized) return;
  for (const model of persistedModels) model.initialize(sequelize);
  initializeAssociations();
  initialized = true;
}

export * from './entities';
