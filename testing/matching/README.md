# Matching QA workbook and 10,000-user fixture

All scripts in this folder are standalone testing tools. Application startup, routes and production seeds do not import them. The fixture uses fictional adult profiles, `example.test` identifiers and locally generated avatar images. No personal data was collected and no SMS or push notification is sent by the seed.

The persisted database is **mello_qa_10000**, in its own PostgreSQL 18 cluster under `.cache/postgres`. The development database is never selected by these utilities. Its host is localhost only; its generated connection details and independent QA JWT key are in `.env.qa`. This file and the cache are ignored by Git. Do not copy those settings into production.

Run from the repository root. PostgreSQL executables default to `C:/Program Files/PostgreSQL/18/bin`; set `PG_BIN` if needed. Node dependencies are reused from the existing backend; scripts are kept outside the application.

1. Keep one terminal open for the database:

   ```powershell
   node testing/matching/prepare-db.cjs start --keep-alive
   ```

   First initialization applies all existing migrations and catalog seeds to this QA database. Starting it later retains its data. `status` inspects the cluster; `stop` stops this cluster without deleting data. Ctrl+C in the keep-alive terminal also stops it. A managed execution environment may stop detached child processes when their parent exits; keep the terminal alive while testing.

2. Populate or safely rerun the exact 10,000-user fixture:

   ```powershell
   node testing/matching/seed-users.cjs
   node testing/matching/export-roster.cjs
   ```

   Usernames are `qa00001` through `qa10000`. Stable IDs and conflict-safe inserts preserve existing test changes. Rerunning is not a reset. There are 9 shared synthetic avatar files and normalized hobby/language/value/preference records. Edge cohorts intentionally include incomplete, suspended, insufficient-photo and verified-only profiles. Optional personalization consent varies independently.

3. Run the actual application HTTP/WebSocket flows on the QA database in another terminal:

   ```powershell
   node testing/matching/start-api.cjs
   node testing/matching/qa-login.cjs qa00003
   ```

   The QA API listens on `http://127.0.0.1:4200/api`. Run the login command in a separate terminal while the API stays open. The normal app uses **phone OTP**, not username/password. Seeded `example.test` addresses are identifiers, not an implemented email-login flow. The offline helper creates a normal database session and signs a normal app token only for inserted local QA users. It adds no login bypass endpoint. Choose active fixtures for successful login.

   Session JSON is written to `testing/matching/results/credentials/qa00003.json`; use `tokens.accessToken` as a Postman Bearer token. Access tokens expire after 15 minutes; rerun the helper or use the normal refresh API. Credentials are generated on demand rather than placing soon-expired tokens in Excel.

   For the existing **web** client, start Expo with its API pointed at the QA server (`EXPO_PUBLIC_API_URL=http://127.0.0.1:4200/api`). Paste the matching generated `qa00003.browser.js` into that local QA site's browser console and reload. It uses the existing `mello.auth.session.v1` local-storage key. Native secure-storage login still needs the ordinary device/test authentication flow; no native-device test is claimed here.

4. Reproduce automated evidence:

   ```powershell
   node testing/matching/run-regressions.cjs
   ai/.venv/Scripts/python.exe testing/matching/run-python.py
   node testing/matching/run-qa.cjs
   node testing/matching/run-builds.cjs
   ```

   The existing 48-case backend suite creates its own disposable embedded database. The 46 new QA checks use the persisted 10,000-user PostgreSQL database, real HTTP, simultaneous likes, chat and an actual pinned multilingual Python model. The Python unit suite uses a deterministic fake encoder. The real-model checks require `ai/.venv` with embedding dependencies and the existing `ai/.cache/huggingface/hub` model cache; missing readiness is BLOCKED rather than fabricated PASS. `run-qa` launches and stops its own private AI service and temporary API. It leaves its saved QA actions/messages as reproducible examples.

5. Workbook results and updates:

   The first sheet is the full roster exported from persisted PostgreSQL. The second sheet has live module totals and run instructions; the third explains discovery/matching/AI flow. Each later sheet owns module cases with separate step columns, expected/actual results, tester, time, evidence, suggestions, improvements, fixes and retest fields.

   Edit each case's Status (`PASS`, `FAIL`, `BLOCKED`, `NOT RUN`) and Tested By with your username. Update actual result/evidence/time and increase Run Count for a new attempt. Summary counts update from the module rows. Executed means PASS + FAIL; BLOCKED means an inspected prerequisite prevents execution; NOT RUN means planned but unexecuted. Missing/invalid statuses appear in the Unclassified count. Counts describe current case statuses, not all historical attempts. Filter by ID, status or priority. Keep notes on the same case row when sorting.

   The separate `.mjs` builder uses the bundled spreadsheet runtime through a local ignored `node_modules` junction. It is an artifact authoring utility, not a backend dependency or app build step. To refresh the existing workbook after rerunning evidence, use that bundled Node executable with `testing/matching/build-workbook.mjs` in a spreadsheet authoring session.

Known observations are recorded in the workbook: the combined frontend check has an existing `TextInputInstance` import error; dating-only checks pass. Five sequential local feed requests measured roughly 3–4 seconds, suggesting query/preview profiling before a production SLA. Native push/device checks and representative relationship-outcome evaluation require their stated prerequisites. Similarity smoke checks do not establish dating-outcome improvement.

To create a fresh independent fixture in future, use a new explicitly named QA namespace/cluster; these scripts intentionally provide no blanket database deletion command.
