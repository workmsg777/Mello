require('dotenv').config();

const common = {
  dialect: 'postgres',
  logging: false,
  migrationStorage: 'sequelize',
  migrationStorageTableName: 'sequelize_meta',
};

function environmentConfig() {
  if (process.env.DATABASE_URL) {
    return {
      ...common,
      use_env_variable: 'DATABASE_URL',
      dialectOptions: process.env.DB_SSL === 'true'
        ? { ssl: { require: true, rejectUnauthorized: false } }
        : {},
    };
  }

  return {
    ...common,
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'dating_db',
    username: process.env.DB_USER || 'dating_user',
    password: process.env.DB_PASSWORD || 'dating_password',
  };
}

module.exports = {
  development: environmentConfig(),
  test: environmentConfig(),
  production: environmentConfig(),
};
