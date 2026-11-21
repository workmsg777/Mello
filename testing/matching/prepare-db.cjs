// Own persistent localhost cluster. Does not inspect or modify the development DB.
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const { randomBytes } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { ROOT, CACHE, backendRequire, writeJson } = require("./runtime.cjs");

async function main() {
  fs.mkdirSync(CACHE, { recursive: true });
  const directory = path.join(CACHE, "postgres");
  const stateFile = path.join(CACHE, "postgres-state.json");
  const executable = (name) =>
    path.join(
      process.env.PG_BIN || "C:/Program Files/PostgreSQL/18/bin",
      name + (process.platform === "win32" ? ".exe" : ""),
    );
  const run = (name, args) =>
    execFileSync(executable(name), args, {
      windowsHide: true,
      stdio: "ignore",
      timeout: 60000,
    });
  const isRunning = () => {
    try {
      run("pg_ctl", ["-D", directory, "status"]);
      return true;
    } catch {
      return false;
    }
  };
  const action = process.argv[2] || "init";
  let state = fs.existsSync(stateFile)
    ? JSON.parse(fs.readFileSync(stateFile, "utf8"))
    : null;
  if (action === "stop") {
    if (state && isRunning())
      run("pg_ctl", ["-D", directory, "-m", "fast", "-w", "stop"]);
    console.log("QA PostgreSQL stopped. Persisted data has been retained.");
    return;
  }
  if (action === "status") {
    console.log(
      JSON.stringify({
        initialized: !!state,
        running: !!state && isRunning(),
        port: state?.port,
        database: "mello_qa_10000",
      }),
    );
    return;
  }
  if (!["init", "start"].includes(action))
    throw new Error("Use init, start, status, or stop");
  if (!fs.existsSync(executable("initdb")))
    throw new Error("Set PG_BIN to the folder containing initdb and pg_ctl");
  if (!state) {
    if (fs.existsSync(directory))
      throw new Error(
        "Unregistered cluster directory exists; inspect it before proceeding",
      );
    const probe = net.createServer();
    await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
    const port = probe.address().port;
    await new Promise((resolve) => probe.close(resolve));
    state = {
      port,
      user: "mello_qa",
      password: randomBytes(24).toString("hex"),
      createdAt: new Date().toISOString(),
    };
    const passwordFile = path.join(CACHE, "initial-password.txt");
    fs.writeFileSync(passwordFile, state.password, { mode: 0o600 });
    try {
      console.log("Initializing persistent QA PostgreSQL...");
      run("initdb", [
        "-D",
        directory,
        "-U",
        state.user,
        "--pwfile",
        passwordFile,
        "--auth-host=scram-sha-256",
        "--auth-local=trust",
        "--encoding=UTF8",
        "--no-locale",
      ]);
    } finally {
      fs.unlinkSync(passwordFile);
    }
    writeJson(stateFile, state);
    const secret = randomBytes(32).toString("hex");
    const env = {
      DATABASE_URL: `postgres://${state.user}:${state.password}@127.0.0.1:${state.port}/mello_qa_10000`,
      NODE_ENV: "test",
      JWT_SECRET: secret,
      OTP_HASH_SECRET: randomBytes(32).toString("hex"),
      CONSENT_POLICY_VERSION: "1.0",
      MATCHING_MODE: "RULES",
      MATCHING_ROLLOUT_PERCENT: "100",
      MATCHING_AI_URL: "",
      MATCHING_AI_KEY: randomBytes(32).toString("hex"),
      NOTIFICATION_WORKER_ENABLED: "false",
      NOTIFICATION_PUSH_ENABLED: "false",
      OTP_DELIVERY_MODE: "console",
      OTP_EXPOSE_IN_RESPONSE: "true",
      UPLOAD_DIR: path.join(CACHE, "uploads").replace(/\\/g, "/"),
      PORT: "4200",
    };
    fs.writeFileSync(
      path.join(ROOT, ".env.qa"),
      Object.entries(env)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n") + "\n",
      { mode: 0o600 },
    );
  }
  if (!isRunning()) {
    run("pg_ctl", [
      "-D",
      directory,
      "-l",
      path.join(CACHE, "postgres.log"),
      "-o",
      `-h 127.0.0.1 -p ${state.port} -c max_connections=40`,
      "-w",
      "start",
    ]);
  }
  const { Client } = backendRequire("pg");
  const admin = new Client({
    host: "127.0.0.1",
    port: state.port,
    user: state.user,
    password: state.password,
    database: "postgres",
  });
  await admin.connect();
  try {
    const result = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname='mello_qa_10000'",
    );
    if (!result.rowCount) await admin.query("CREATE DATABASE mello_qa_10000");
  } finally {
    await admin.end();
  }
  const db = require("./runtime.cjs").openDatabase();
  try {
    const qi = db.getQueryInterface(),
      { DataTypes, QueryTypes } = backendRequire("sequelize");
    await db.query(
      "CREATE TABLE IF NOT EXISTS sequelize_meta(name varchar(255) PRIMARY KEY)",
    );
    const done = new Set(
      (
        await db.query("SELECT name FROM sequelize_meta", {
          type: QueryTypes.SELECT,
        })
      ).map((r) => r.name),
    );
    const migrationRoot = path.resolve(
      ROOT,
      "../../backend/database/migrations",
    );
    for (const file of fs.readdirSync(migrationRoot).sort())
      if (!done.has(file)) {
        await require(path.join(migrationRoot, file)).up(qi, DataTypes);
        await db.query("INSERT INTO sequelize_meta(name) VALUES (:name)", {
          replacements: { name: file },
        });
      }
    const seedRoot = path.resolve(ROOT, "../../backend/database/seeders");
    await db.query(
      "CREATE TABLE IF NOT EXISTS qa_catalog_seeds(name text PRIMARY KEY)",
    );
    const seeds = new Set(
      (
        await db.query("SELECT name FROM qa_catalog_seeds", {
          type: QueryTypes.SELECT,
        })
      ).map((r) => r.name),
    );
    for (const file of fs.readdirSync(seedRoot).sort())
      if (!seeds.has(file)) {
        await require(path.join(seedRoot, file)).up(qi, DataTypes);
        await db.query("INSERT INTO qa_catalog_seeds(name) VALUES (:name)", {
          replacements: { name: file },
        });
      }
    console.log(
      `QA database ready on 127.0.0.1:${state.port}; all migrations/catalogs applied.`,
    );
  } finally {
    await db.close();
  }
  if (process.argv.includes("--keep-alive")) {
    console.log(
      "QA database running. Keep this terminal open; Ctrl+C stops only this QA cluster.",
    );
    const interval = setInterval(() => {}, 30000);
    process.on("SIGINT", () => {
      clearInterval(interval);
      if (isRunning())
        run("pg_ctl", ["-D", directory, "-m", "fast", "-w", "stop"]);
      process.exit();
    });
    process.on("SIGTERM", () => {
      clearInterval(interval);
      if (isRunning())
        run("pg_ctl", ["-D", directory, "-m", "fast", "-w", "stop"]);
      process.exit();
    });
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
