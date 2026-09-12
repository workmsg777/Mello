import type { Model, ModelStatic } from 'sequelize';

/** Shared repository mechanics. Concrete repositories bind this to exactly one model. */
export abstract class BaseRepository<TModel extends Model> {
  protected constructor(protected readonly model: ModelStatic<TModel>) {}

  findById(id: string): Promise<TModel | null> {
    return this.model.findByPk(id);
  }
}
