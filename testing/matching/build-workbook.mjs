import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { Workbook, SpreadsheetFile, FileBlob } from "@oai/artifact-tool";
const require = createRequire(import.meta.url);
const { collect } = require("./case-catalog.cjs");
const root = path.dirname(fileURLToPath(import.meta.url)),
  project = path.resolve(root, "../..");
const outputDir = path.join(
  project,
  "outputs/01a192d1-2f30-7532-a754-39dbb9ba9e30",
);
const previewDir = path.join(root, ".cache/workbook-previews");
await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });
const roster = JSON.parse(
  await fs.readFile(path.join(root, ".cache/roster.json"), "utf8"),
);
const { modules, tests, runAt } = collect();
const performance = JSON.parse(
  await fs.readFile(path.join(root, "results/performance.json"), "utf8"),
);
const counts = Object.fromEntries(
  ["PASS", "FAIL", "BLOCKED", "NOT RUN"].map((s) => [
    s,
    tests.filter((t) => t.status === s).length,
  ]),
);
const polishing = process.argv.includes("--polish");
const outputPath = path.join(outputDir, "Matching-QA.xlsx");
const wb = polishing
    ? await SpreadsheetFile.importXlsx(await FileBlob.load(outputPath))
    : Workbook.create(),
  names = ["Users & Credentials", "Run Guide", "System Flow", ...modules];
const sheets = new Map(
  names.map((name) => [
    name,
    polishing ? wb.worksheets.getItem(name) : wb.worksheets.add(name),
  ]),
);
const ink = "#2D2636",
  plum = "#51364E",
  muted = "#756879",
  line = "#DDD4DF",
  amber = "#FFF3D3";
function col(n) {
  let value = "";
  for (let v = n + 1; v; v = Math.floor((v - 1) / 26))
    value = String.fromCharCode(65 + ((v - 1) % 26)) + value;
  return value;
}
function sheetBase(sheet, lastCol, lastRow, title) {
  sheet.showGridLines = false;
  sheet.getRange(`A1:${lastCol}${lastRow}`).format = {
    font: { name: "Arial", size: 10, color: ink },
    verticalAlignment: "center",
    rowHeight: 22,
  };
  sheet.getRange("A2").values = [[title]];
  sheet.getRange("A2").format.font = {
    name: "Arial",
    size: 14,
    bold: true,
    color: plum,
  };
  sheet.getRange(`A2:${lastCol}2`).format.borders = {
    bottom: { style: "thin", color: line },
  };
  sheet.getRange("A2").format.rowHeight = 30;
}
function header(sheet, range) {
  sheet.getRange(range).format = {
    fill: plum,
    font: { name: "Arial", size: 10, bold: true, color: "#FFFFFF" },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
    rowHeight: 36,
    borders: { insideVertical: { style: "thin", color: "#FFFFFF" } },
  };
}
function table(sheet, range, name) {
  const t = sheet.tables.add(range, true, name);
  t.style = "TableStyleLight1";
  t.showFilterButton = true;
  return t;
}
function atIst(value) {
  return value ? new Date(new Date(value).getTime() + 330 * 60000) : null;
}
function checkpoint(message) {
  console.log(message);
}
function commandFor(t) {
  if (t.command) return t.command;
  if (t.type === "Manual verification")
    return "Manual: use the QA dating client and follow the steps.";
  if (t.status === "BLOCKED")
    return "Prerequisite required: see Preconditions and Actual result.";
  if (t.id.startsWith("BUILD-"))
    return "node testing/matching/run-builds.cjs";
  if (t.id === "DATA-007") return "node testing/matching/seed-users.cjs";
  return "node testing/matching/run-qa.cjs";
}
function fitCaseRows(sheet, rows) {
  const widths = [
    17, 48, 10, 25, 47, 28, 62, 42, 42, 42, 42, 47, 64, 14, 18, 22, 12, 15, 65,
    51, 56, 55, 28, 34,
  ];
  for (const [i, t] of rows.entries()) {
    const texts = [
      t.id,
      t.title,
      t.priority,
      t.type,
      t.preconditions,
      t.users,
      commandFor(t),
      ...Array.from({ length: 4 }, (_, n) => t.steps[n] || ""),
      t.expected,
      t.actual,
      t.status,
      t.testedBy,
      "",
      0,
      0,
      t.evidence || "",
      t.suggestion || "",
      t.improvement || "",
      t.fixApplied || "",
      t.retest || "",
      t.owner || "Matching",
    ];
    const lines = Math.max(
      ...texts.map((text, j) =>
        Math.ceil(String(text).length / Math.max(8, widths[j] * 0.82)),
      ),
    );
    sheet.getRange(`A${i + 7}:X${i + 7}`).format.rowHeight = Math.max(
      40,
      lines * 13 + 10,
    );
  }
}
if (polishing) {
  console.log(
    wb.help("table.style", { include: "index,examples,notes", maxChars: 2200 })
      .ndjson,
  );
  for (const name of names)
    for (const t of sheets.get(name).tables.items) t.style = "TableStyleLight1";
  for (const name of modules) {
    const s = sheets.get(name),
      rows = tests.filter((t) => t.module === name),
      last = rows.length + 6;
    s.getRange(`E7:E${last}`).values = rows.map((t) => [t.preconditions]);
    s.getRange(`G7:G${last}`).values = rows.map((t) => [commandFor(t)]);
    fitCaseRows(s, rows);
  }
  sheets.get("System Flow").getRange("A6:F20").format.rowHeight = 52;
  wb.recalculate();
  const guide = sheets.get("Run Guide");
  assert.deepEqual(
    guide.getRange("B22:H22").values[0],
    [134, 108, 107, 1, 3, 23, 0],
  );
  assert.equal(
    sheets.get("Users & Credentials").getRange("B4").values[0][0],
    10000,
  );
  const errorScan = await wb.inspect({
    kind: "match",
    searchTerm:
      "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
    options: { useRegex: true, maxResults: 30 },
    maxChars: 1500,
  });
  console.log(errorScan.ndjson);
  for (const [i, name] of names.entries()) {
    const range =
      name === "Run Guide"
        ? "A1:I22"
        : name === "System Flow"
          ? "A1:C9"
          : name === "Users & Credentials"
            ? "A1:H10"
            : "A1:F9";
    const blob = await wb.render({
      sheetName: name,
      range,
      scale: 1,
      format: "png",
    });
    await fs.writeFile(
      path.join(previewDir, `${String(i + 1).padStart(2, "0")}-opening.png`),
      new Uint8Array(await blob.arrayBuffer()),
    );
    if (modules.includes(name)) {
      const blob = await wb.render({
        sheetName: name,
        range: "L5:R9",
        scale: 1,
        format: "png",
      });
      await fs.writeFile(
        path.join(previewDir, `${String(i + 1).padStart(2, "0")}-results.png`),
        new Uint8Array(await blob.arrayBuffer()),
      );
    }
    checkpoint(`Reviewed ${i + 1}/${names.length}: ${name}`);
  }
  const guideNotes = await wb.render({
    sheetName: "Run Guide",
    range: "A25:I52",
    scale: 1,
    format: "png",
  });
  await fs.writeFile(
    path.join(previewDir, "02-instructions.png"),
    new Uint8Array(await guideNotes.arrayBuffer()),
  );
  const flowAi = await wb.render({
    sheetName: "System Flow",
    range: "D10:F19",
    scale: 1,
    format: "png",
  });
  await fs.writeFile(
    path.join(previewDir, "03-ai-flow.png"),
    new Uint8Array(await flowAi.arrayBuffer()),
  );
  const output = await SpreadsheetFile.exportXlsx(wb);
  await output.save(outputPath);
  const validation = JSON.parse(
    await fs.readFile(
      path.join(root, "results/workbook-validation.json"),
      "utf8",
    ),
  );
  await fs.writeFile(
    path.join(root, "results/workbook-validation.json"),
    JSON.stringify(
      {
        ...validation,
        polished: true,
        formulaErrorScan: errorScan.ndjson,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  await fs.writeFile(
    path.join(root, "results/case-catalog.json"),
    JSON.stringify({ modules, tests, counts }, null, 2),
  );
  checkpoint(
    JSON.stringify({
      outputPath,
      totalCases: tests.length,
      counts,
      sheets: names.length,
      polished: true,
    }),
  );
  process.exit(0);
}

// User explicitly requested this roster first, followed by guide, flow and module cases.
const users = sheets.get("Users & Credentials");
users.tabColor = "#8E7C8F";
const userHeaders = [
  "QA username",
  "Display name",
  "Gender",
  "Age",
  "City",
  "Job",
  "Hobbies / interests",
  "Languages",
  "Dating intention",
  "Personal values",
  "Seeking gender",
  "Min age",
  "Max age",
  "Distance (km)",
  "Hard distance",
  "Matching consent",
  "Private interests",
  "Photo count",
  "Account status",
  "Onboarding",
  "Fixture scenario",
  "User ID",
  "Account ID",
  "Fictional identifier",
  "QA login command",
  "Login method",
];
sheetBase(users, "Z", roster.rows.length + 6, "Mello QA users and credentials");
users.getRange("A3").values = [
  [
    "Fictional adult profiles exported from persisted PostgreSQL. App login is phone OTP; QA usernames use the separate session helper. No passwords or expired tokens are listed.",
  ],
];
users.getRange("A4:B4").values = [["Persisted users", null]];
users.getRange("B4").formulas = [[`=COUNTA(A7:A${roster.rows.length + 6})`]];
users.getRange("D4:E4").values = [["Database", "mello_qa_10000"]];
users.getRange("G4:H4").values = [["Exported (IST)", atIst(roster.exportedAt)]];
users.getRange("H4").setNumberFormat("dd-mmm-yyyy hh:mm");
users.getRange("A6:Z6").values = [userHeaders];
const userWidths = [
  16, 34, 16, 8, 18, 24, 37, 23, 29, 30, 17, 10, 10, 14, 14, 19, 16, 12, 20, 19,
  31, 40, 40, 32, 67, 42,
];
userWidths.forEach(
  (width, i) =>
    (users.getRange(
      `${col(i)}1:${col(i)}${roster.rows.length + 6}`,
    ).format.columnWidth = width),
);
for (let start = 0; start < roster.rows.length; start += 500) {
  const values = roster.rows
    .slice(start, start + 500)
    .map((r) => [
      r.username,
      r.displayName,
      r.gender.replaceAll("_", " "),
      r.age,
      r.city,
      r.job,
      r.interests.join(", "),
      r.languages.join(", "),
      r.intention,
      r.values.join(", "),
      r.seeking.replaceAll("_", " "),
      r.minAge,
      r.maxAge,
      r.maxDistanceKm,
      r.distanceIsDealbreaker,
      r.consent,
      r.privateInterests,
      r.photoCount,
      r.status,
      r.onboarding,
      r.scenario,
      r.userId,
      r.accountId,
      r.identifier,
      `node testing/matching/qa-login.cjs ${r.username}`,
      "QA helper session; password n.a.",
    ]);
  users.getRange(`A${start + 7}:Z${start + 6 + values.length}`).values = values;
}
table(users, `A6:Z${roster.rows.length + 6}`, "QaUsers");
header(users, "A6:Z6");
users.getRange(`A7:Z${roster.rows.length + 6}`).format.wrapText = true;
users.getRange(`A7:Z${roster.rows.length + 6}`).format.rowHeight = 42;
for (const c of ["D", "L", "M", "N", "R"])
  users
    .getRange(`${c}7:${c}${roster.rows.length + 6}`)
    .setNumberFormat("#,##0");
users.freezePanes.freezeRows(6);
users.freezePanes.freezeColumns(2);
checkpoint("Populated 10,000 persisted roster rows.");

const fields = [
  "Case ID",
  "Scenario",
  "Priority",
  "Test type",
  "Preconditions",
  "QA users / data",
  "Endpoint / command",
  "Step 1",
  "Step 2",
  "Step 3",
  "Step 4",
  "Expected result",
  "Actual result",
  "Status",
  "Tested by",
  "Tested at (IST)",
  "Run count",
  "Duration (ms)",
  "Evidence",
  "Suggestions",
  "Improvements required",
  "Fix implemented",
  "Retest result",
  "Owner",
];
const moduleLastRows = new Map();
for (const [index, name] of modules.entries()) {
  const s = sheets.get(name),
    rows = tests.filter((t) => t.module === name),
    last = rows.length + 6;
  moduleLastRows.set(name, last);
  sheetBase(s, "X", last, `${name} test cases`);
  s.getRange("A3").values = [
    [
      "Edit amber cells for a new run. Keep the case ID, steps and evidence attached to the same row when sorting.",
    ],
  ];
  const labels = {
    A4: "Total",
    C4: "PASS",
    E4: "FAIL",
    G4: "BLOCKED",
    I4: "NOT RUN",
    K4: "Executed",
    M4: "Unclassified",
  };
  for (const [cell, label] of Object.entries(labels))
    s.getRange(cell).values = [[label]];
  s.getRange("B4").formulas = [[`=COUNTA(A7:A${last})`]];
  for (const [cell, status] of [
    ["D4", "PASS"],
    ["F4", "FAIL"],
    ["H4", "BLOCKED"],
    ["J4", "NOT RUN"],
  ])
    s.getRange(cell).formulas = [[`=COUNTIFS(N7:N${last},"${status}")`]];
  s.getRange("L4").formulas = [["=SUM(D4,F4)"]];
  s.getRange("N4").formulas = [["=B4-SUM(D4,F4,H4,J4)"]];
  s.getRange("A6:X6").values = [fields];
  const values = rows.map((t) => [
    t.id,
    t.title,
    t.priority,
    t.type,
    t.preconditions,
    t.users,
    commandFor(t),
    ...Array.from({ length: 4 }, (_, i) => t.steps[i] || ""),
    t.expected,
    t.actual,
    t.status,
    t.testedBy,
    atIst(t.testedAt),
    t.status === "NOT RUN" ? 0 : 1,
    t.durationMs ?? null,
    t.evidence || "",
    t.suggestion || "",
    t.improvement || "",
    t.fixApplied || "",
    t.retest || "",
    t.owner || "Matching",
  ]);
  s.getRange(`A7:X${last}`).values = values;
  table(s, `A6:X${last}`, `ModuleCases${index + 1}`);
  header(s, "A6:X6");
  const widths = [
    17, 48, 10, 25, 47, 28, 62, 42, 42, 42, 42, 47, 64, 14, 18, 22, 12, 15, 65,
    51, 56, 55, 28, 34,
  ];
  widths.forEach(
    (width, i) =>
      (s.getRange(`${col(i)}1:${col(i)}${last}`).format.columnWidth = width),
  );
  s.getRange(`A7:X${last}`).format.wrapText = true;
  fitCaseRows(s, rows);
  s.getRange(`A7:X${last}`).format.verticalAlignment = "top";
  for (const range of [`N7:Q${last}`, `T7:W${last}`])
    s.getRange(range).format.fill = amber;
  s.getRange(`N7:N${last}`).dataValidation = {
    rule: { type: "list", values: ["PASS", "FAIL", "BLOCKED", "NOT RUN"] },
  };
  s.getRange(`W7:W${last}`).dataValidation = {
    rule: {
      type: "list",
      values: ["PASS", "FAIL", "BLOCKED", "NOT RUN", "PENDING"],
    },
  };
  s.getRange(`N7:N${last}`).conditionalFormats.addCustom('$N7="FAIL"', {
    fill: "#FDE5E5",
    font: { color: "#A52323", bold: true },
  });
  s.getRange(`N7:N${last}`).conditionalFormats.addCustom('$N7="BLOCKED"', {
    fill: "#FFE7B7",
    font: { color: "#805100", bold: true },
  });
  s.getRange(`N7:N${last}`).conditionalFormats.addCustom('$N7="NOT RUN"', {
    fill: "#ECE8ED",
    font: { color: muted },
  });
  s.getRange(`N7:N${last}`).conditionalFormats.addCustom('$N7="PASS"', {
    fill: "#F4F5F4",
    font: { color: "#344B3E" },
  });
  s.getRange("N4").conditionalFormats.add("cellIs", {
    operator: "greaterThan",
    formula: 0,
    format: { fill: "#FDE5E5", font: { color: "#A52323", bold: true } },
  });
  s.getRange(`P7:P${last}`).setNumberFormat("dd-mmm-yyyy hh:mm");
  s.getRange(`Q7:R${last}`).setNumberFormat("#,##0");
  s.freezePanes.freezeRows(6);
  s.freezePanes.freezeColumns(2);
}
checkpoint("Populated module cases and editable run fields.");

const guide = sheets.get("Run Guide");
guide.tabColor = plum;
sheetBase(guide, "J", 62, "Matching QA run guide");
const summaryStart = 8,
  summaryEnd = summaryStart + modules.length - 1,
  totalRow = summaryEnd + 1;
guide.getRange("A3").values = [
  [
    "Current-case status counts. Executed = PASS + FAIL. BLOCKED prerequisites and unexecuted manual cases remain visible.",
  ],
];
guide.getRange("A4:B4").values = [["Run time (IST)", atIst(runAt)]];
guide.getRange("B4").setNumberFormat("dd-mmm-yyyy hh:mm");
guide.getRange("D4:E4").values = [["Database users", roster.rows.length]];
guide.getRange("G4:H4").values = [["Tester", "Codex + editable human runs"]];
guide.getRange("A7:I7").values = [
  [
    "Module",
    "Total",
    "Executed",
    "PASS",
    "FAIL",
    "BLOCKED",
    "NOT RUN",
    "Unclassified",
    "Execution %",
  ],
];
for (const [i, name] of modules.entries()) {
  const r = summaryStart + i;
  guide.getRange(`A${r}`).values = [[name]];
  guide.getRange(`B${r}:I${r}`).formulas = [
    [
      `='${name}'!B4`,
      `='${name}'!L4`,
      `='${name}'!D4`,
      `='${name}'!F4`,
      `='${name}'!H4`,
      `='${name}'!J4`,
      `='${name}'!N4`,
      `=IF(B${r}=0,0,C${r}/B${r})`,
    ],
  ];
}
guide.getRange(`A${totalRow}`).values = [["All modules"]];
for (let c = 1; c <= 7; c++)
  guide.getRange(`${col(c)}${totalRow}`).formulas = [
    [`=SUM(${col(c)}${summaryStart}:${col(c)}${summaryEnd})`],
  ];
guide.getRange(`I${totalRow}`).formulas = [[`=C${totalRow}/B${totalRow}`]];
guide.getRange(`I8:I${totalRow}`).setNumberFormat("0.0%");
header(guide, "A7:I7");
guide.getRange(`A${totalRow}:I${totalRow}`).format.font.bold = true;
guide.getRange(`A${totalRow}:I${totalRow}`).format.borders = {
  top: { style: "thin", color: line },
};
guide
  .getRange(`E8:E${totalRow}`)
  .conditionalFormats.add("cellIs", {
    operator: "greaterThan",
    formula: 0,
    format: { fill: "#FDE5E5", font: { color: "#A52323", bold: true } },
  });
guide
  .getRange(`F8:F${totalRow}`)
  .conditionalFormats.add("cellIs", {
    operator: "greaterThan",
    formula: 0,
    format: { fill: "#FFE7B7", font: { color: "#805100" } },
  });
guide
  .getRange(`H8:H${totalRow}`)
  .conditionalFormats.add("cellIs", {
    operator: "greaterThan",
    formula: 0,
    format: { fill: "#FDE5E5", font: { color: "#A52323" } },
  });
const instructions = [
  [
    "Run instructions",
    "Commands are run from the repository root. Full setup and credential details: testing/matching/README.md.",
  ],
  [
    "1. Start QA database",
    "node testing/matching/prepare-db.cjs start --keep-alive   (keep this terminal open)",
  ],
  [
    "2. Seed / export roster",
    "node testing/matching/seed-users.cjs   then   node testing/matching/export-roster.cjs",
  ],
  [
    "3. Start QA API",
    "node testing/matching/start-api.cjs   (http://127.0.0.1:4200/api; keep a separate terminal open)",
  ],
  [
    "4. Get user credentials",
    "node testing/matching/qa-login.cjs qa00003   (choose any active QA username from the first sheet)",
  ],
  [
    "Session location",
    "testing/matching/results/credentials/qa00003.json; use tokens.accessToken as a Bearer token.",
  ],
  [
    "App login",
    "Phone OTP is the normal app flow. QA aliases/example.test emails are not a new password/email login endpoint.",
  ],
  [
    "QA browser session",
    "Point the web client at the QA API; paste the generated qa00003.browser.js into that local QA site console.",
  ],
  [
    "Token expiry",
    "Access token lasts 15 minutes. Rerun qa-login or use the normal refresh API. Native-device login verification remains manual.",
  ],
  [
    "5. Backend regressions",
    "node testing/matching/run-regressions.cjs   (48 cases; own disposable fixture DB, separate from the 10k DB)",
  ],
  [
    "6. Python unit cases",
    "ai/.venv/Scripts/python.exe testing/matching/run-python.py   (8 cases with a deterministic fake encoder)",
  ],
  [
    "7. 10k-user QA cases",
    "node testing/matching/run-qa.cjs   (46 cases; real PostgreSQL, HTTP, chat and actual pinned multilingual AI)",
  ],
  [
    "8. Builds / config",
    "node testing/matching/run-builds.cjs   (backend, dating frontend, combined frontend, web export, Compose)",
  ],
  [
    "9. Record a manual run",
    "Choose the case ID; enter your username in Tested by, steps/evidence, time, actual result and one allowed Status.",
  ],
  [
    "10. Record a fix / retest",
    "Describe the actual fix in Fix implemented; update Retest result and current Status; increase Run count for another attempt.",
  ],
  [
    "PASS",
    "Executed assertions met the stated expected result. A performance-measurement PASS is not a production SLA guarantee.",
  ],
  [
    "FAIL",
    "Executed behavior missed the expected result. Keep exact evidence and assign the owner before retesting.",
  ],
  [
    "BLOCKED",
    "A checked prerequisite prevents the functional run. Current blockers: native FCM/APNs setup and representative outcome labels.",
  ],
  [
    "NOT RUN",
    "Planned case has not been executed. Manual mobile/UI cases are never counted as automated PASS.",
  ],
  [
    "Unclassified",
    "Blank/invalid statuses remain visible in this count. Use the Status dropdown instead of clearing a case status.",
  ],
  [
    "Counts and sorting",
    "Counts show each case’s latest status. Run count is attempts, not a second case count. Filter/sort the full native table.",
  ],
  [
    "Existing failure",
    "Combined frontend typecheck: apps/partner/src/screens/PartnerAuthScreen.tsx:13 imports TextInputInstance. Area: Partner app.",
  ],
  [
    "Latency observation",
    `10k stored users; 5 sequential feed requests: p50 ${performance.p50Ms} ms, p95 ${performance.p95Ms} ms. Profile full-pool projection/preview hydration.`,
  ],
  [
    "Evidence limits",
    "Real-model smoke verifies a few English/Hindi/Hinglish text comparisons. Relationship-outcome superiority and sustained load are unverified.",
  ],
  [
    "Source evidence",
    "testing/matching/results/: qa.json, regressions.json, backend.events.ndjson, python.json, builds.json, seed.json and performance.json.",
  ],
  [
    "Workbook refresh",
    "Rerun evidence/export; rebuild with the bundled spreadsheet runtime. Archive a copy before replacing human notes with a regenerated workbook.",
  ],
  [
    "Stop QA database",
    "Ctrl+C in the database terminal, or node testing/matching/prepare-db.cjs stop. Data stays in the dedicated QA cluster.",
  ],
];
for (const [i, row] of instructions.entries())
  guide.getRange(`A${totalRow + 3 + i}:B${totalRow + 3 + i}`).values = [row];
guide.getRange(
  `A${totalRow + 3}:A${totalRow + 2 + instructions.length}`,
).format.font.bold = true;
guide.getRange("A1:A62").format.columnWidth = 33;
guide.getRange("B1:B62").format.columnWidth = 24;
for (const c of ["C", "D", "E", "F", "G", "H", "I"])
  guide.getRange(`${c}1:${c}62`).format.columnWidth = c === "H" ? 17 : 13;
guide.getRange("J1:J62").format.columnWidth = 8;
guide.getRange(`A8:I${totalRow}`).format.rowHeight = 25;
guide.getRange(
  `A${totalRow + 3}:I${totalRow + 2 + instructions.length}`,
).format.rowHeight = 25;
guide.freezePanes.freezeRows(7);

const flow = sheets.get("System Flow");
flow.tabColor = "#9C7191";
sheetBase(flow, "F", 39, "Discovery, matching and AI flow");
flow.getRange("A3").values = [
  [
    "Route, controller, service and repository responsibilities are separate. AI is optional evidence; explicit mutual likes create a match.",
  ],
];
flow.getRange("A5:F5").values = [
  [
    "Stage",
    "Trigger / input",
    "What happens",
    "Owning layer / contract",
    "AI used?",
    "Example / failure behavior",
  ],
];
const stages = [
  [
    "1. Sign-in and readiness",
    "Bearer session; completed profile",
    "Existing auth validates active account/session; discovery requires completed adult profile.",
    "Middleware; existing identity/onboarding services",
    "No",
    "qa00006 incomplete -> 403; qa00005 suspended -> 401.",
  ],
  [
    "2. Reciprocal eligibility",
    "Viewer and candidate hard preferences",
    "Filter adults, active status, photos, reciprocal gender/age/distance, required language alternatives and all required values.",
    "DiscoveryService calls DiscoveryRepository",
    "No",
    "Both sides must allow the pair. A high score never bypasses a hard rule.",
  ],
  [
    "3. Candidate retrieval",
    "Fresh eligible IDs",
    "Retrieve the complete fresh eligible pool in deterministic baseline order before choosing a page.",
    "DiscoveryRepository.fresh",
    "No",
    "Likes/matches excluded. Passes are handled in a later recycled round.",
  ],
  [
    "4. Current consent",
    "Latest event for each person and policy",
    "Use optional personalization only when both latest events grant the current policy.",
    "MatchingService; MatchingRepository projection",
    "No",
    "qa00007 missing and qa00008 revoked get null personalized score.",
  ],
  [
    "5. Rule components",
    "Allowed structured answers",
    "Score intentions, desired values, interests, soft options, languages, location and soft age in both directions.",
    "MatchingService; pure scoring functions",
    "No",
    "Missing data is unknown. Use lower directional alignment and minimum coverage.",
  ],
  [
    "6. Evidence coverage",
    "Available rule weight",
    "Below 20% evidence withhold display score; shrink sparse internal ordering towards neutral 50.",
    "scorePair",
    "No",
    "One matching interest has 20% coverage; it is not a probability of success.",
  ],
  [
    "7. Optional semantic rerank",
    "HYBRID mode; both consented; non-empty allowed text",
    "Send only allowed biography/prompt text for at most 64 top rule candidates to the private Python service.",
    "MatchingService -> MatchingAiClient -> FastAPI route/controller",
    "Yes, only here",
    "RULES mode never makes this call; private/sensitive fields stay excluded.",
  ],
  [
    "8. Python embedding service",
    "X-Service-Key; bounded request",
    "Validate request, deduplicate text within batch, encode with pinned multilingual model and return bounded cosine similarities.",
    "FastAPI controller -> AI service -> embedding repository/provider",
    "Yes",
    "Stateless profile text/vectors; one loaded model; no chat history is sent.",
  ],
  [
    "9. Combine / fallback",
    "Valid semantic evidence or safe failure",
    "Use 80% rule score + 20% semantic evidence when valid; retain rule ranking if unavailable, timed out or malformed.",
    "MatchingService; MatchingAiClient validation",
    "Optional",
    "Missing key/configuration, 503 or invalid response cannot stop discovery.",
  ],
  [
    "10. Feed snapshot",
    "Ranked eligible ID order",
    "Store owner-bound IDs/order for 15 minutes; return page plus feedSessionId/nextRankCursor.",
    "DiscoveryService -> matching repository",
    "No new AI decision",
    "Each next page revalidates eligibility and current consent; issued order remains stable.",
  ],
  [
    "11. Card exposure",
    "Loaded front card on Discover",
    "Record impression after 700 uninterrupted foreground ms; deduplicate per session/target.",
    "Dating client -> controller -> DiscoveryService -> repository",
    "No",
    "Backgrounding restarts the interval. This is client-reported exposure, not measured attention.",
  ],
  [
    "12. Like / Pass",
    "Explicit user action",
    "Validate and lock canonical user pair; write action. Two explicit reciprocal likes create one canonical match transactionally.",
    "DiscoveryService -> DiscoveryRepository -> NotificationService",
    "No",
    "20 concurrent reciprocal likes in QA produced one match and two recipient notifications.",
  ],
  [
    "13. Matched chat",
    "Authorized explicit mutual match",
    "Persist ordered/idempotent messages, monotonic read receipts and notification outbox; publish realtime after commit.",
    "ChatService -> ChatRepository; DiscoveryService; NotificationService",
    "No",
    "Outsiders receive 404. Retry keeps the same message ID; conflicting retry returns 409.",
  ],
  [
    "14. Optional icebreaker",
    "Matched user requests suggestions",
    "Read shared public interests; request grounded drafts, with local templates as fallback. Fill editable draft only after user selects.",
    "ChatService -> ChatRepository + private assist service",
    "Assist templates",
    "These are grounded templates, not LLM claims. They never auto-send.",
  ],
  [
    "15. Measurement and next run",
    "Exposures, explicit likes, matches and replies",
    "Review mature-window aggregate metrics, latency and errors; evaluate changes using representative labelled outcomes.",
    "Read-only SQL report; QA workbook",
    "No",
    "Five local requests do not establish production p95. Better relationship outcomes require evidence.",
  ],
];
flow.getRange("A6:F20").values = stages;
header(flow, "A5:F5");
flow.getRange("A6:F20").format.wrapText = true;
flow.getRange("A6:F20").format.rowHeight = 76;
flow.getRange("A23:C23").values = [["Rule component", "Weight", "Meaning"]];
header(flow, "A23:C23");
flow.getRange("A24:C30").values = [
  [
    "Dating intention",
    25,
    "Explicit desired intention or known intention overlap.",
  ],
  [
    "Desired partner values",
    25,
    "Weighted wanted-versus-reported values in each direction.",
  ],
  ["Interests", 20, "Jaccard overlap of allowed interests."],
  ["Soft options", 10, "Allowed non-sensitive optional preferences."],
  ["Languages", 10, "Weighted preferences or known language overlap."],
  ["Location", 5, "Same-city preference or known city-centre distance."],
  ["Soft age", 5, "Age fit when it is a soft preference."],
];
flow.getRange("A32").values = [["Score interpretation"]];
flow.getRange("C32").values = [
  [
    "Alignment out of 100; starting weights are not empirically validated relationship predictors.",
  ],
];
flow.getRange("A34").values = [["Technical source"]];
flow.getRange("C34").values = [
  [
    "backend/docs/matching.md; backend/src/services/matching/; root ai/README.md",
  ],
];
const fw = [27, 30, 67, 59, 23, 69];
fw.forEach(
  (width, i) =>
    (flow.getRange(`${col(i)}1:${col(i)}39`).format.columnWidth = width),
);
flow.getRange("C24:C34").format.wrapText = true;
flow.getRange("A24:C30").format.rowHeight = 35;
flow.getRange("C32").format.rowHeight = 42;
flow.freezePanes.freezeRows(5);

// Recalculation proof: mutate a real input, observe module + linked guide, restore it.
wb.recalculate();
const firstModule = sheets.get(modules[0]),
  beforePass = firstModule.getRange("D4").values[0][0],
  beforeFail = firstModule.getRange("F4").values[0][0];
firstModule.getRange("N7").values = [["FAIL"]];
wb.recalculate();
assert.equal(firstModule.getRange("D4").values[0][0], beforePass - 1);
assert.equal(firstModule.getRange("F4").values[0][0], beforeFail + 1);
assert.equal(guide.getRange("E8").values[0][0], beforeFail + 1);
firstModule.getRange("N7").values = [["NOT RUN"]];
wb.recalculate();
assert.equal(firstModule.getRange("J4").values[0][0], 1);
firstModule.getRange("N7").values = [[null]];
wb.recalculate();
assert.equal(firstModule.getRange("N4").values[0][0], 1);
firstModule.getRange("N7").values = [["PASS"]];
wb.recalculate();
assert.equal(users.getRange("B4").values[0][0], 10000);
assert.equal(guide.getRange(`B${totalRow}`).values[0][0], tests.length);
assert.equal(guide.getRange(`D${totalRow}`).values[0][0], counts.PASS);
assert.equal(guide.getRange(`E${totalRow}`).values[0][0], counts.FAIL);
assert.equal(guide.getRange(`F${totalRow}`).values[0][0], counts.BLOCKED);
assert.equal(guide.getRange(`G${totalRow}`).values[0][0], counts["NOT RUN"]);
assert.equal(guide.getRange(`H${totalRow}`).values[0][0], 0);
const inspection = await wb.inspect({
  kind: "table",
  range: `'Run Guide'!A7:I${totalRow}`,
  include: "values,formulas",
  tableMaxRows: 18,
  tableMaxCols: 9,
  maxChars: 2500,
});
console.log(inspection.ndjson);
const errors = await wb.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 30 },
  summary: "Final formula error scan",
  maxChars: 2000,
});
console.log(errors.ndjson);

// Every sheet receives a rendered opening view; result columns receive an additional view.
for (const [i, name] of names.entries()) {
  const range =
    name === "Run Guide"
      ? `A1:I${totalRow}`
      : name === "System Flow"
        ? "A1:C9"
        : name === "Users & Credentials"
          ? "A1:H10"
          : "A1:F9";
  const blob = await wb.render({
    sheetName: name,
    range,
    scale: 1,
    format: "png",
  });
  await fs.writeFile(
    path.join(previewDir, `${String(i + 1).padStart(2, "0")}-opening.png`),
    new Uint8Array(await blob.arrayBuffer()),
  );
  if (modules.includes(name)) {
    const result = await wb.render({
      sheetName: name,
      range: "L5:R9",
      scale: 1,
      format: "png",
    });
    await fs.writeFile(
      path.join(previewDir, `${String(i + 1).padStart(2, "0")}-results.png`),
      new Uint8Array(await result.arrayBuffer()),
    );
  }
  checkpoint(`Rendered ${i + 1}/${names.length}: ${name}`);
}
const output = await SpreadsheetFile.exportXlsx(wb);
await output.save(outputPath);
await fs.writeFile(
  path.join(root, "results/workbook-validation.json"),
  JSON.stringify(
    {
      file: outputPath,
      sheets: names,
      users: roster.rows.length,
      totalCases: tests.length,
      counts,
      unclassified: 0,
      independentCountsMatch: true,
      statusChangeRecalculationVerified: true,
      blankStatusDetectionVerified: true,
      formulaErrorScan: errors.ndjson,
      renderedSheets: names.length,
      generatedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
await fs.writeFile(
  path.join(root, "results/case-catalog.json"),
  JSON.stringify({ modules, tests, counts }, null, 2),
);
checkpoint(
  JSON.stringify({
    outputPath,
    totalCases: tests.length,
    counts,
    sheets: names.length,
  }),
);
