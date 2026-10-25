import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../../modelHelpers';

export class PersonalityType extends Model {
  declare id: string;
  declare frameworkId: string;
  declare code: string;
  declare name: string;
  declare description: string | null;
  declare metadata: Record<string, unknown> | null;
  declare isActive: boolean;

  static initialize(sequelize: Sequelize): void {
    PersonalityType.init(
      {
        id: uuidPrimaryKey(),
        frameworkId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'framework_id',
        },
        code: { type: DataTypes.STRING(100), allowNull: false },
        name: { type: DataTypes.STRING(150), allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: true },
        metadata: { type: DataTypes.JSONB, allowNull: true },
        isActive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          field: 'is_active',
        },
        ...timestampAttributes(),
      },
      modelOptions(sequelize, 'personality_types'),
    );
  }
}
