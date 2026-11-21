const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const { PROJECT, ROOT, RESULTS, writeJson } = require("./runtime.cjs");
fs.mkdirSync(RESULTS, { recursive: true });
async function run(name, args, cwd) {
  const start = Date.now(),
    log = path.join(RESULTS, `${name}.log`),
    stream = fs.createWriteStream(log);
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd,
      windowsHide: true,
      env: { ...process.env, NODE_ENV: "test" },
    });
    child.stdout.pipe(stream, { end: false });
    child.stderr.pipe(stream, { end: false });
    child.on("error", reject);
    child.on("close", resolve);
  });
  await new Promise((resolve) => stream.end(resolve));
  return {
    name,
    exitCode,
    durationMs: Date.now() - start,
    at: new Date().toISOString(),
    log: path.relative(PROJECT, log).replace(/\\/g, "/"),
  };
}
async function main() {
  const backend = path.join(PROJECT, "backend");
  const typecheck = await run(
    "backend-typecheck",
    ["node_modules/typescript/bin/tsc", "-p", "tsconfig.json", "--noEmit"],
    backend,
  );
  console.log(
    `Backend typecheck: ${typecheck.exitCode === 0 ? "PASS" : "FAIL"}`,
  );
  const tests = fs
    .readdirSync(path.join(backend, "tests"))
    .filter((f) => f.endsWith(".test.cjs"))
    .map((f) => `tests/${f}`);
  const events = path.join(RESULTS, "backend.events.ndjson");
  const suite = await run(
    "backend-tests",
    [
      "--import",
      "tsx",
      "--test",
      `--test-reporter=${pathToFileURL(path.join(ROOT, "test-reporter.cjs")).href}`,
      `--test-reporter-destination=${events}`,
      ...tests,
    ],
    backend,
  );
  const records = fs.existsSync(events)
    ? fs
        .readFileSync(events, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    : [];
  writeJson(path.join(RESULTS, "regressions.json"), {
    at: new Date().toISOString(),
    typecheck,
    suite,
    tests: records,
  });
  console.log(
    `Backend cases: ${records.length}; passed ${records.filter((r) => r.event === "test:pass").length}; failed ${records.filter((r) => r.event === "test:fail").length}`,
  );
  if (typecheck.exitCode || suite.exitCode) process.exitCode = 1;
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
