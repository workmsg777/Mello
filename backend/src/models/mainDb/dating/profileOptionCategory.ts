import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../../modelHelpers';

export class ProfileOptionCategory extends Model {
  declare id: string;
  declare code: string;
  declare name: string;
  declare labelKey: string | null;
  declare selectionMode: 'SINGLE' | 'MULTIPLE';
  declare minSelections: number;
  declare maxSelections: number | null;
  declare isSensitive: boolean;
  declare allowProfileVisibility: boolean;
  declare allowMatchPreference: boolean;
  declare allowDealbreaker: boolean;
  declare isRequiredForOnboarding: boolean;
  declare isActive: boolean;
  declare displayOrder: number;

  static initialize(sequelize: Sequelize): void {
    ProfileOptionCategory.init(
      {
        id: uuidPrimaryKey(),
        code: { type: DataTypes.STRING(100), allowNull: false, unique: true },
        name: { type: DataTypes.STRING(150), allowNull: false },
        labelKey: {
          type: DataTypes.STRING(200),
          allowNull: true,
          field: 'label_key',
        },
        selectionMode: {
          type: DataTypes.ENUM('SINGLE', 'MULTIPLE'),
          allowNull: false,
          field: 'selection_mode',
        },
        minSelections: {
          type: DataTypes.SMALLINT,
          allowNull: false,
          defaultValue: 0,
          field: 'min_selections',
        },
        maxSelections: {
          type: DataTypes.SMALLINT,
          allowNull: true,
          field: 'max_selections',
        },
        isSensitive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          field: 'is_sensitive',
        },
        allowProfileVisibility: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          field: 'allow_profile_visibility',
        },
        allowMatchPreference: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          field: 'allow_match_preference',
        },
        allowDealbreaker: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          field: 'allow_dealbreaker',
        },
        isRequiredForOnboarding: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          field: 'is_required_for_onboarding',
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          field: 'is_active',
        },
        displayOrder: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
          field: 'display_order',
        },
        ...timestampAttributes(),
      },
      modelOptions(sequelize, 'profile_option_categories'),
    );
  }
}
