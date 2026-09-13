import { DataTypes, type ModelAttributes, type Sequelize } from 'sequelize';

export const uuidPrimaryKey = () => ({
  type: DataTypes.UUID,
  defaultValue: DataTypes.UUIDV4,
  allowNull: false,
  primaryKey: true,
});

export const timestampAttributes = (paranoid = false): ModelAttributes => ({
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'created_at',
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'updated_at',
  },
  ...(paranoid
    ? {
        deletedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: 'deleted_at',
        },
      }
    : {}),
});

export const modelOptions = (
  sequelize: Sequelize,
  tableName: string,
  paranoid = false,
) => ({
  sequelize,
  tableName,
  modelName: tableName,
  timestamps: true,
  paranoid,
  underscored: true,
});
