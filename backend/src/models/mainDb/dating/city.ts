import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../../modelHelpers';

export class City extends Model {
  declare id: string;
  declare name: string;
  declare stateName: string | null;
  declare stateCode: string | null;
  declare countryCode: string;
  declare latitude: string | null;
  declare longitude: string | null;
  declare cityTier: 'TIER_1' | 'TIER_2' | 'TIER_3' | 'OTHER' | null;
  declare timezone: string | null;
  declare isActive: boolean;
  declare createdAt: Date;
  declare updatedAt: Date;

  static initialize(sequelize: Sequelize): void {
    City.init(
      {
        id: uuidPrimaryKey(),
        name: { type: DataTypes.STRING(150), allowNull: false },
        stateName: {
          type: DataTypes.STRING(150),
          allowNull: true,
          field: 'state_name',
        },
        stateCode: {
          type: DataTypes.STRING(20),
          allowNull: true,
          field: 'state_code',
        },
        countryCode: {
          type: DataTypes.CHAR(2),
          allowNull: false,
          field: 'country_code',
        },
        latitude: { type: DataTypes.DECIMAL(9, 6), allowNull: true },
        longitude: { type: DataTypes.DECIMAL(9, 6), allowNull: true },
        cityTier: {
          type: DataTypes.ENUM('TIER_1', 'TIER_2', 'TIER_3', 'OTHER'),
          allowNull: true,
          field: 'city_tier',
        },
        timezone: { type: DataTypes.STRING(100), allowNull: true },
        isActive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          field: 'is_active',
        },
        ...timestampAttributes(),
      },
      modelOptions(sequelize, 'cities'),
    );
  }
}
