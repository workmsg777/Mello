import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../modelHelpers';

/** Internal Mello staff profile. All authorization is supplied by AccountRole. */
export class PlatformUser extends Model {
  declare id: string;
  declare accountId: string;
  declare name: string;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare deletedAt: Date | null;

  static initialize(sequelize: Sequelize): void {
    PlatformUser.init(
      {
        id: uuidPrimaryKey(),
        accountId: {
          type: DataTypes.UUID,
          allowNull: false,
          unique: true,
          field: 'account_id',
        },
        name: {
          type: DataTypes.STRING(200),
          allowNull: false,
        },
        ...timestampAttributes(true),
      },
      modelOptions(sequelize, 'platform_users', true),
    );
  }
}
