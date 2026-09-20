import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../../modelHelpers';

export class UserPersonalityResult extends Model {
  declare id: string;
  declare userId: string;
  declare frameworkId: string;
  declare personalityTypeId: string | null;
  declare scores: Record<string, number> | null;
  declare source: 'SELF_DECLARED' | 'IN_APP_TEST' | 'IMPORTED' | 'INFERRED';
  declare confidence: string | null;
  declare isUsedForMatching: boolean;
  declare deletedAt: Date | null;

  static initialize(sequelize: Sequelize): void {
    UserPersonalityResult.init(
      {
        id: uuidPrimaryKey(),
        userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
        frameworkId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'framework_id',
        },
        personalityTypeId: {
          type: DataTypes.UUID,
          allowNull: true,
          field: 'personality_type_id',
        },
        scores: { type: DataTypes.JSONB, allowNull: true },
        source: {
          type: DataTypes.ENUM(
            'SELF_DECLARED',
            'IN_APP_TEST',
            'IMPORTED',
            'INFERRED',
          ),
          allowNull: false,
        },
        confidence: { type: DataTypes.DECIMAL(5, 4), allowNull: true },
        isUsedForMatching: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          field: 'is_used_for_matching',
        },
        ...timestampAttributes(true),
      },
      modelOptions(sequelize, 'user_personality_results', true),
    );
  }
}
