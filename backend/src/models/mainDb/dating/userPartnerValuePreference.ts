import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../../modelHelpers';

export class UserPartnerValuePreference extends Model {
  declare id: string;
  declare userId: string;
  declare valueId: string;
  declare importance: number;
  declare isDealbreaker: boolean;

  static initialize(sequelize: Sequelize): void {
    UserPartnerValuePreference.init(
      {
        id: uuidPrimaryKey(),
        userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
        valueId: { type: DataTypes.UUID, allowNull: false, field: 'value_id' },
        importance: {
          type: DataTypes.SMALLINT,
          allowNull: false,
          defaultValue: 3,
        },
        isDealbreaker: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          field: 'is_dealbreaker',
        },
        ...timestampAttributes(),
      },
      modelOptions(sequelize, 'user_partner_value_preferences'),
    );
  }
}
