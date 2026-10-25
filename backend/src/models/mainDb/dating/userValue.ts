import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../../modelHelpers';

export class UserValue extends Model {
  declare id: string;
  declare userId: string;
  declare valueId: string;
  declare importance: number;
  declare displayOrder: number | null;

  static initialize(sequelize: Sequelize): void {
    UserValue.init(
      {
        id: uuidPrimaryKey(),
        userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
        valueId: { type: DataTypes.UUID, allowNull: false, field: 'value_id' },
        importance: {
          type: DataTypes.SMALLINT,
          allowNull: false,
          defaultValue: 3,
        },
        displayOrder: {
          type: DataTypes.INTEGER,
          allowNull: true,
          field: 'display_order',
        },
        ...timestampAttributes(),
      },
      modelOptions(sequelize, 'user_values'),
    );
  }
}
