import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../../modelHelpers';

export class UserOnboardingProgress extends Model {
  declare id: string;
  declare userId: string;
  declare onboardingVersion: number;
  declare status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  declare currentStepId: string | null;
  declare startedAt: Date | null;
  declare completedAt: Date | null;

  static initialize(sequelize: Sequelize): void {
    UserOnboardingProgress.init(
      {
        id: uuidPrimaryKey(),
        userId: {
          type: DataTypes.UUID,
          allowNull: false,
          unique: true,
          field: 'user_id',
        },
        onboardingVersion: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'onboarding_version',
        },
        status: {
          type: DataTypes.ENUM('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'),
          allowNull: false,
        },
        currentStepId: {
          type: DataTypes.UUID,
          allowNull: true,
          field: 'current_step_id',
        },
        startedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: 'started_at',
        },
        completedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: 'completed_at',
        },
        ...timestampAttributes(),
      },
      modelOptions(sequelize, 'user_onboarding_progress'),
    );
  }
}
