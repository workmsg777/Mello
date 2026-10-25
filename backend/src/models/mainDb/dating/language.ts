import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../../modelHelpers';

export class Language extends Model {
  declare id: string;
  declare isoCode: string;
  declare name: string;
  declare nativeName: string | null;
  declare isActive: boolean;

  static initialize(sequelize: Sequelize): void {
    Language.init(
      {
        id: uuidPrimaryKey(),
        isoCode: {
          type: DataTypes.STRING(10),
          allowNull: false,
          unique: true,
          field: 'iso_code',
        },
        name: { type: DataTypes.STRING(100), allowNull: false },
        nativeName: {
          type: DataTypes.STRING(100),
          allowNull: true,
          field: 'native_name',
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          field: 'is_active',
        },
        ...timestampAttributes(),
      },
      modelOptions(sequelize, 'languages'),
    );
  }
}
