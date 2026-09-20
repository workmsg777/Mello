import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../../modelHelpers';

export class OnboardingStep extends Model {
  declare id: string;
  declare onboardingVersion: number;
  declare code: string;
  declare name: string;
  declare sequence: number;
  declare isRequired: boolean;
  declare isSkippable: boolean;
  declare isActive: boolean;
  declare metadata: Record<string, unknown> | null;

  static initialize(sequelize: Sequelize): void {
    OnboardingStep.init(
      {
        id: uuidPrimaryKey(),
        onboardingVersion: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'onboarding_version',
        },
        code: { type: DataTypes.STRING(100), allowNull: false },
        name: { type: DataTypes.STRING(150), allowNull: false },
        sequence: { type: DataTypes.INTEGER, allowNull: false },
        isRequired: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          field: 'is_required',
        },
        isSkippable: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          field: 'is_skippable',
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          field: 'is_active',
        },
        metadata: { type: DataTypes.JSONB, allowNull: true },
        ...timestampAttributes(),
      },
      modelOptions(sequelize, 'onboarding_steps'),
    );
  }
}
