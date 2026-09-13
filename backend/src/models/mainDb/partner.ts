import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../modelHelpers';

/** Partner-domain business or venue, with one initial address and ordinary coordinates. */
export class Partner extends Model {
  declare id: string;
  declare name: string;
  declare category: 'CAFE' | 'HOTEL' | 'ACTIVITY' | 'OTHER';
  declare description: string | null;
  declare addressLine1: string;
  declare addressLine2: string | null;
  declare city: string;
  declare state: string;
  declare postalCode: string;
  declare countryCode: string;
  declare latitude: string | null;
  declare longitude: string | null;
  declare phone: string | null;
  declare email: string | null;
  declare status: 'ACTIVE' | 'INACTIVE';
  declare createdAt: Date;
  declare updatedAt: Date;
  declare deletedAt: Date | null;

  static initialize(sequelize: Sequelize): void {
    Partner.init(
      {
        id: uuidPrimaryKey(),
        name: {
          type: DataTypes.STRING(200),
          allowNull: false,
        },
        category: {
          type: DataTypes.ENUM('CAFE', 'HOTEL', 'ACTIVITY', 'OTHER'),
          allowNull: false,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        addressLine1: {
          type: DataTypes.STRING(255),
          allowNull: false,
          field: 'address_line_1',
        },
        addressLine2: {
          type: DataTypes.STRING(255),
          allowNull: true,
          field: 'address_line_2',
        },
        city: {
          type: DataTypes.STRING(120),
          allowNull: false,
        },
        state: {
          type: DataTypes.STRING(120),
          allowNull: false,
        },
        postalCode: {
          type: DataTypes.STRING(20),
          allowNull: false,
          field: 'postal_code',
        },
        countryCode: {
          type: DataTypes.STRING(2),
          allowNull: false,
          field: 'country_code',
          validate: {
            is: /^[A-Z]{2}$/,
          },
        },
        latitude: {
          type: DataTypes.DECIMAL(9, 6),
          allowNull: true,
        },
        longitude: {
          type: DataTypes.DECIMAL(9, 6),
          allowNull: true,
        },
        phone: {
          type: DataTypes.STRING(32),
          allowNull: true,
        },
        email: {
          type: DataTypes.STRING(320),
          allowNull: true,
        },
        status: {
          type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
          allowNull: false,
          defaultValue: 'ACTIVE',
        },
        ...timestampAttributes(true),
      },
      modelOptions(sequelize, 'partners', true),
    );
  }
}
