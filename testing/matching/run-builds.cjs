const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { PROJECT, RESULTS, writeJson } = require("./runtime.cjs");
async function run(
  id,
  title,
  cwd,
  command,
  args,
  expected,
  owner = "Matching",
) {
  const file = path.join(RESULTS, `${id.toLowerCase()}.log`),
    out = fs.createWriteStream(file),
    started = Date.now();
  const code = await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true });
    child.stdout.pipe(out, { end: false });
    child.stderr.pipe(out, { end: false });
    child.on("error", reject);
    child.on("close", resolve);
  });
  await new Promise((resolve) => out.end(resolve));
  const log = fs.readFileSync(file, "utf8");
  return {
    id,
    module: "Performance & Setup",
    title,
    type: "Build/config verification",
    priority: "P1",
    preconditions: "Existing workspace dependencies installed.",
    users: "n.a.",
    steps: [
      `Open ${path.relative(PROJECT, cwd)}.`,
      `Run ${command === "node" ? "node" : path.basename(command)} ${args.join(" ")}.`,
      `Inspect exit code and saved log.`,
    ],
    expected,
    actual: code === 0 ? "Command exited successfully." : log.slice(0, 1300),
    status: code === 0 ? "PASS" : "FAIL",
    testedBy: "Codex",
    testedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    evidence: path.relative(PROJECT, file).replace(/\\/g, "/"),
    suggestion:
      code === 0
        ? ""
        : "Correct the partner app type import and rerun the combined check.",
    improvement:
      code === 0
        ? ""
        : "Existing partner-app TextInputInstance type import prevents combined typecheck.",
    fixApplied: "",
    retest: "",
    owner,
  };
}
async function main() {
  fs.mkdirSync(RESULTS, { recursive: true });
  const backend = path.join(PROJECT, "backend"),
    frontend = path.join(PROJECT, "frontend");
  const results = await Promise.all([
    run(
      "BUILD-001",
      "Backend production compilation",
      backend,
      process.execPath,
      ["node_modules/typescript/bin/tsc", "-p", "tsconfig.json"],
      "Exit 0; backend compiles.",
    ),
    run(
      "BUILD-002",
      "Dating frontend typecheck",
      frontend,
      process.execPath,
      [
        "node_modules/typescript/bin/tsc",
        "--noEmit",
        "-p",
        "tsconfig.dating.json",
      ],
      "Exit 0; dating frontend typecheck passes.",
    ),
    run(
      "BUILD-003",
      "Combined frontend and partner typecheck",
      frontend,
      process.execPath,
      ["node_modules/typescript/bin/tsc", "--noEmit"],
      "Exit 0 for all frontend workspaces.",
      "Partner app",
    ),
    run(
      "BUILD-004",
      "Dating web production export",
      frontend,
      "cmd.exe",
      ["/d", "/s", "/c", "npm.cmd run build:web"],
      "Exit 0; web-build is produced.",
    ),
    run(
      "BUILD-005",
      "Docker Compose configuration",
      backend,
      "docker",
      ["compose", "config", "--quiet"],
      "Exit 0; Compose configuration parses.",
    ),
  ]);
  writeJson(path.join(RESULTS, "builds.json"), {
    at: new Date().toISOString(),
    tests: results,
  });
  for (const r of results) console.log(`${r.id} ${r.status}: ${r.title}`);
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
