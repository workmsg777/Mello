'use strict';

const quoteIdentifier = (value) => `"${String(value).replaceAll('"', '""')}"`;

function uuid(DataTypes, extra = {}) {
  return { type: DataTypes.UUID, allowNull: false, ...extra };
}

function timestamps(DataTypes, paranoid = false) {
  const columns = {
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  };
  if (paranoid) columns.deleted_at = { type: DataTypes.DATE, allowNull: true };
  return columns;
}

async function addComments(queryInterface, table, tableComment, columnComments, transaction) {
  const quotedTable = quoteIdentifier(table);
  await queryInterface.sequelize.query(
    `COMMENT ON TABLE ${quotedTable} IS ${queryInterface.sequelize.escape(tableComment)}`,
    { transaction },
  );
  for (const [column, comment] of Object.entries(columnComments)) {
    await queryInterface.sequelize.query(
      `COMMENT ON COLUMN ${quotedTable}.${quoteIdentifier(column)} IS ${queryInterface.sequelize.escape(comment)}`,
      { transaction },
    );
  }
}

async function dropEnums(queryInterface, names, transaction) {
  for (const name of names) {
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS ${quoteIdentifier(name)}`, { transaction });
  }
}

module.exports = { addComments, dropEnums, timestamps, uuid };
