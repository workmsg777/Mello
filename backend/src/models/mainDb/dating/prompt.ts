import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../../modelHelpers';

export class Prompt extends Model {
  declare id: string;
  declare categoryId: string;
  declare code: string;
  declare promptText: string;
  declare labelKey: string | null;
  declare responseType: 'TEXT' | 'MEDIA' | 'TEXT_OR_MEDIA';
  declare maxAnswerLength: number | null;
  declare isActive: boolean;
  declare displayOrder: number | null;
  declare metadata: Record<string, unknown> | null;

  static initialize(sequelize: Sequelize): void {
    Prompt.init(
      {
        id: uuidPrimaryKey(),
        categoryId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'category_id',
        },
        code: { type: DataTypes.STRING(100), allowNull: false, unique: true },
        promptText: {
          type: DataTypes.STRING(500),
          allowNull: false,
          field: 'prompt_text',
        },
        labelKey: {
          type: DataTypes.STRING(200),
          allowNull: true,
          field: 'label_key',
        },
        responseType: {
          type: DataTypes.ENUM('TEXT', 'MEDIA', 'TEXT_OR_MEDIA'),
          allowNull: false,
          field: 'response_type',
        },
        maxAnswerLength: {
          type: DataTypes.INTEGER,
          allowNull: true,
          field: 'max_answer_length',
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          field: 'is_active',
        },
        displayOrder: {
          type: DataTypes.INTEGER,
          allowNull: true,
          field: 'display_order',
        },
        metadata: { type: DataTypes.JSONB, allowNull: true },
        ...timestampAttributes(),
      },
      modelOptions(sequelize, 'prompts'),
    );
  }
}
