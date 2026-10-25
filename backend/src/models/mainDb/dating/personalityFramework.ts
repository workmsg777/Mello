import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../../modelHelpers';

export class PersonalityFramework extends Model {
  declare id: string;
  declare code: string;
  declare name: string;
  declare description: string | null;
  declare resultMode: 'CATEGORICAL' | 'DIMENSIONAL' | 'HYBRID';
  declare isActive: boolean;

  static initialize(sequelize: Sequelize): void {
    PersonalityFramework.init(
      {
        id: uuidPrimaryKey(),
        code: { type: DataTypes.STRING(100), allowNull: false, unique: true },
        name: { type: DataTypes.STRING(150), allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: true },
        resultMode: {
          type: DataTypes.ENUM('CATEGORICAL', 'DIMENSIONAL', 'HYBRID'),
          allowNull: false,
          field: 'result_mode',
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          field: 'is_active',
        },
        ...timestampAttributes(),
      },
      modelOptions(sequelize, 'personality_frameworks'),
    );
  }
}
