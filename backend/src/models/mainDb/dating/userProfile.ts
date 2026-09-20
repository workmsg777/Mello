import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../../modelHelpers';

export class UserProfile extends Model {
  declare id: string;
  declare userId: string;
  declare displayName: string;
  declare dateOfBirth: string;
  declare bio: string | null;
  declare heightCm: number | null;
  declare jobTitle: string | null;
  declare companyName: string | null;
  declare schoolName: string | null;
  declare currentCityId: string | null;
  declare hometownCityId: string | null;
  declare bioModerationStatus:
    'PENDING' | 'APPROVED' | 'REJECTED' | 'NOT_REVIEWED';
  declare profileStatus: 'DRAFT' | 'ACTIVE' | 'PAUSED';
  declare createdAt: Date;
  declare updatedAt: Date;
  declare deletedAt: Date | null;

  static initialize(sequelize: Sequelize): void {
    UserProfile.init(
      {
        id: uuidPrimaryKey(),
        userId: {
          type: DataTypes.UUID,
          allowNull: false,
          unique: true,
          field: 'user_id',
        },
        displayName: {
          type: DataTypes.STRING(100),
          allowNull: false,
          field: 'display_name',
        },
        dateOfBirth: {
          type: DataTypes.DATEONLY,
          allowNull: false,
          field: 'date_of_birth',
        },
        bio: { type: DataTypes.STRING(500), allowNull: true },
        heightCm: {
          type: DataTypes.SMALLINT,
          allowNull: true,
          field: 'height_cm',
        },
        jobTitle: {
          type: DataTypes.STRING(150),
          allowNull: true,
          field: 'job_title',
        },
        companyName: {
          type: DataTypes.STRING(150),
          allowNull: true,
          field: 'company_name',
        },
        schoolName: {
          type: DataTypes.STRING(200),
          allowNull: true,
          field: 'school_name',
        },
        currentCityId: {
          type: DataTypes.UUID,
          allowNull: true,
          field: 'current_city_id',
        },
        hometownCityId: {
          type: DataTypes.UUID,
          allowNull: true,
          field: 'hometown_city_id',
        },
        bioModerationStatus: {
          type: DataTypes.ENUM(
            'PENDING',
            'APPROVED',
            'REJECTED',
            'NOT_REVIEWED',
          ),
          allowNull: false,
          defaultValue: 'NOT_REVIEWED',
          field: 'bio_moderation_status',
        },
        profileStatus: {
          type: DataTypes.ENUM('DRAFT', 'ACTIVE', 'PAUSED'),
          allowNull: false,
          defaultValue: 'DRAFT',
          field: 'profile_status',
        },
        ...timestampAttributes(true),
      },
      modelOptions(sequelize, 'user_profiles', true),
    );
  }
}
