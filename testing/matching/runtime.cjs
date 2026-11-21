// Standalone QA utilities. Nothing in application routes imports this folder.
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const ROOT = __dirname;
const PROJECT = path.resolve(ROOT, "../..");
const CACHE = path.join(ROOT, ".cache");
const RESULTS = path.join(ROOT, "results");
const backendRequire = createRequire(
  path.join(PROJECT, "backend/package.json"),
);

function loadQaEnvironment() {
  const file = path.join(ROOT, ".env.qa");
  if (!fs.existsSync(file)) throw new Error("Run prepare-db.cjs first");
  const values = backendRequire("dotenv").parse(fs.readFileSync(file));
  const url = new URL(values.DATABASE_URL);
  if (
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.pathname !== "/mello_qa_10000"
  )
    throw new Error(
      "QA utilities require the dedicated local mello_qa_10000 database",
    );
  // Only this file supplies QA connection/secret settings; never load backend/.env.
  Object.assign(process.env, values);
  return values;
}

function openDatabase() {
  loadQaEnvironment();
  const { Sequelize } = backendRequire("sequelize");
  return new Sequelize(process.env.DATABASE_URL, {
    dialect: "postgres",
    logging: false,
    pool: { max: 6, min: 0, idle: 5000 },
    define: { underscored: true, freezeTableName: true },
  });
}

function loadApplication() {
  loadQaEnvironment();
  backendRequire("tsx/cjs");
  const { sequelize } = backendRequire(
    path.join(PROJECT, "backend/src/config/database.ts"),
  );
  backendRequire(
    path.join(PROJECT, "backend/src/models/index.ts"),
  ).initializeModels(sequelize);
  return { sequelize, require: backendRequire };
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

module.exports = {
  ROOT,
  PROJECT,
  CACHE,
  RESULTS,
  backendRequire,
  loadQaEnvironment,
  openDatabase,
  loadApplication,
  writeJson,
};
