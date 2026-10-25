import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../../modelHelpers';

export class UserOnboardingStepProgress extends Model {
  declare id: string;
  declare userId: string;
  declare onboardingStepId: string;
  declare status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  declare startedAt: Date | null;
  declare completedAt: Date | null;
  declare skippedAt: Date | null;

  static initialize(sequelize: Sequelize): void {
    UserOnboardingStepProgress.init(
      {
        id: uuidPrimaryKey(),
        userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
        onboardingStepId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'onboarding_step_id',
        },
        status: {
          type: DataTypes.ENUM(
            'PENDING',
            'IN_PROGRESS',
            'COMPLETED',
            'SKIPPED',
          ),
          allowNull: false,
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
        skippedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: 'skipped_at',
        },
        ...timestampAttributes(),
      },
      modelOptions(sequelize, 'user_onboarding_step_progress'),
    );
  }
}
