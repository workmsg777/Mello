import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../../modelHelpers';

export class UserMatchPreference extends Model {
  declare id: string;
  declare userId: string;
  declare minAge: number;
  declare maxAge: number;
  declare maxDistanceKm: number;
  declare ageIsDealbreaker: boolean;
  declare distanceIsDealbreaker: boolean;
  declare verifiedProfilesOnly: boolean;
  declare preferSameCity: boolean;

  static initialize(sequelize: Sequelize): void {
    UserMatchPreference.init(
      {
        id: uuidPrimaryKey(),
        userId: {
          type: DataTypes.UUID,
          allowNull: false,
          unique: true,
          field: 'user_id',
        },
        minAge: {
          type: DataTypes.SMALLINT,
          allowNull: false,
          field: 'min_age',
        },
        maxAge: {
          type: DataTypes.SMALLINT,
          allowNull: false,
          field: 'max_age',
        },
        maxDistanceKm: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'max_distance_km',
        },
        ageIsDealbreaker: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          field: 'age_is_dealbreaker',
        },
        distanceIsDealbreaker: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          field: 'distance_is_dealbreaker',
        },
        verifiedProfilesOnly: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          field: 'verified_profiles_only',
        },
        preferSameCity: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          field: 'prefer_same_city',
        },
        ...timestampAttributes(),
      },
      modelOptions(sequelize, 'user_match_preferences'),
    );
  }
}
