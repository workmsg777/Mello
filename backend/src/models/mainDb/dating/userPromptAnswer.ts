import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../../modelHelpers';

export class UserPromptAnswer extends Model {
  declare id: string;
  declare userId: string;
  declare promptId: string;
  declare answerText: string | null;
  declare mediaId: string | null;
  declare displayOrder: number;
  declare moderationStatus:
    'NOT_REVIEWED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  declare isActive: boolean;
  declare deletedAt: Date | null;

  static initialize(sequelize: Sequelize): void {
    UserPromptAnswer.init(
      {
        id: uuidPrimaryKey(),
        userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
        promptId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'prompt_id',
        },
        answerText: {
          type: DataTypes.TEXT,
          allowNull: true,
          field: 'answer_text',
        },
        mediaId: { type: DataTypes.UUID, allowNull: true, field: 'media_id' },
        displayOrder: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'display_order',
        },
        moderationStatus: {
          type: DataTypes.ENUM(
            'NOT_REVIEWED',
            'PENDING',
            'APPROVED',
            'REJECTED',
          ),
          allowNull: false,
          defaultValue: 'NOT_REVIEWED',
          field: 'moderation_status',
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          field: 'is_active',
        },
        ...timestampAttributes(true),
      },
      modelOptions(sequelize, 'user_prompt_answers', true),
    );
  }
}
