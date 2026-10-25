import type {
  Attributes,
  BulkCreateOptions,
  CountOptions,
  CreationAttributes,
  CreateOptions,
  DestroyOptions,
  FindOptions,
  Model,
  ModelStatic,
  UpdateOptions,
} from 'sequelize';

/** Shared repository mechanics. Concrete repositories bind this to exactly one model. */
export abstract class BaseRepository<TModel extends Model> {
  protected constructor(protected readonly model: ModelStatic<TModel>) {}

  findById(id: string): Promise<TModel | null> {
    return this.model.findByPk(id);
  }

  findOne(options: FindOptions<Attributes<TModel>>): Promise<TModel | null> {
    return this.model.findOne(options);
  }

  findAll(options?: FindOptions<Attributes<TModel>>): Promise<TModel[]> {
    return options ? this.model.findAll(options) : this.model.findAll();
  }

  count(options?: CountOptions<Attributes<TModel>>): Promise<number> {
    return options ? this.model.count(options) : this.model.count();
  }

  create(
    values: Record<string, unknown>,
    options?: CreateOptions<Attributes<TModel>>,
  ): Promise<TModel> {
    const input = values as CreationAttributes<TModel>;
    return options
      ? this.model.create(input, options)
      : this.model.create(input);
  }

  bulkCreate(
    values: Array<Record<string, unknown>>,
    options?: BulkCreateOptions<Attributes<TModel>>,
  ): Promise<TModel[]> {
    const input = values as Array<CreationAttributes<TModel>>;
    return options
      ? this.model.bulkCreate(input, options)
      : this.model.bulkCreate(input);
  }

  update(
    values: Record<string, unknown>,
    options: UpdateOptions<Attributes<TModel>>,
  ): Promise<[affectedCount: number]> {
    return this.model.update(values, options);
  }

  destroy(options: DestroyOptions<Attributes<TModel>>): Promise<number> {
    return this.model.destroy(options);
  }
}
