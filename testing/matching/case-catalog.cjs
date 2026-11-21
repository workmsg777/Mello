// Workbook metadata only. Results always come from executed runner evidence files.
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { RESULTS, PROJECT } = require("./runtime.cjs");
const modules = [
  "Data & Credentials",
  "Access & Eligibility",
  "Discovery Feed",
  "Rules Ranking",
  "Consent & Privacy",
  "Likes & Matches",
  "Chat & Receipts",
  "Realtime",
  "Notifications",
  "Impressions & Metrics",
  "AI Service",
  "Conversation Assist",
  "Performance & Setup",
  "Integration Regression",
];
const read = (name) =>
  JSON.parse(fs.readFileSync(path.join(RESULTS, name), "utf8"));

function regressionDetails(name) {
  const has = (x) => name.includes(x);
  if (has("app:"))
    return [
      "Integration Regression",
      [
        "Select the platform/configuration named in this test.",
        "Call resolveApiBaseUrl with the fixture Expo host and configured URL.",
        "Compare the resulting origin with the expected reachable API.",
      ],
      "Correct host/port is preserved for that platform; no invented tunnel.",
    ];
  if (has("reconnect, acknowledgement"))
    return [
      "Realtime",
      [
        "Create queued, acknowledged and duplicate broadcast copies.",
        "Merge them through the frontend message-state helper.",
        "Confirm one saved message survives each retry/reconnect.",
      ],
      "No duplicate or downgraded saved messages.",
    ];
  if (has("identifiers remain valid"))
    return [
      "Chat & Receipts",
      [
        "Generate 100 client message IDs using the fallback random source.",
        "Count distinct values.",
        "Validate UUID v4 syntax for every ID.",
      ],
      "100 unique valid UUIDs.",
    ];
  if (has("completed onboarding"))
    return [
      "Access & Eligibility",
      [
        "Create authenticated complete and incomplete profiles.",
        "Call discovery without a token and with each profile.",
        "Compare protected-route status codes.",
      ],
      "401 for anonymous, 403 for incomplete, 200 for completed.",
    ];
  if (has("reciprocal gender and age"))
    return [
      "Access & Eligibility",
      [
        "Create users with reciprocal and conflicting gender/age choices.",
        "Change account activity and query eligible discovery.",
        "Verify both sides must accept the pair.",
      ],
      "Only reciprocal eligible active adult profiles appear.",
    ];
  if (has("likes create one"))
    return [
      "Likes & Matches",
      [
        "Submit the first user LIKE.",
        "Submit the reciprocal LIKE and repeat requests.",
        "Check match uniqueness and discovery exclusion.",
      ],
      "One canonical match; retries retain it; matched peer removed.",
    ];
  if (has("one-sided likes"))
    return [
      "Likes & Matches",
      [
        "Submit a one-sided LIKE and read Liked you.",
        "Insert a stale match without mutual explicit likes and try chat.",
        "PASS the incoming like and reload the inbox.",
      ],
      "Pending like visible; stale match does not authorize chat; PASS dismisses it.",
    ];
  if (has("chat is match-only"))
    return [
      "Chat & Receipts",
      [
        "Try chat as an outsider and as the matched pair.",
        "Send ordered messages and retry a client ID.",
        "Read the conversation and compare unread/read state.",
      ],
      "Match-only access, stored ordered messages, idempotency and correct read state.",
    ];
  if (has("real WebSockets"))
    return [
      "Realtime",
      [
        "Connect two matched users and an outsider using real WebSockets.",
        "Send message, typing and read events with acknowledgements.",
        "Check participant delivery and revoked-session behavior.",
      ],
      "Only authorized participants receive private events.",
    ];
  if (has("gap-free cursor"))
    return [
      "Chat & Receipts",
      [
        "Send enough messages to cross a history page.",
        "Walk all before-sequence pages.",
        "Exercise the shared HTTP/WebSocket sender rate limit.",
      ],
      "Gap-free unique messages; over-limit sends rejected.",
    ];
  if (has("partners publish"))
    return [
      "Integration Regression",
      [
        "Create partner owners and content.",
        "Publish venue/listing data for each kind.",
        "Try another owner’s update.",
      ],
      "Published listings are visible; cross-owner writes are forbidden.",
    ];
  if (has("propose, accept"))
    return [
      "Integration Regression",
      [
        "Create an explicit mutual match and a published venue.",
        "Propose, accept and cancel using permitted actors.",
        "Try venue confirmation as another owner.",
      ],
      "Valid lifecycle transitions succeed; foreign actors are rejected.",
    ];
  if (has("invalid dates"))
    return [
      "Integration Regression",
      [
        "Submit malformed IDs.",
        "Submit dates too close or beyond the allowed planning window.",
        "Inspect HTTP validation.",
      ],
      "400 for invalid identifiers and dates.",
    ];
  if (has("revoked access sessions"))
    return [
      "Access & Eligibility",
      [
        "Create a valid access session.",
        "Revoke its database session.",
        "Repeat a protected request with the old token.",
      ],
      "401 after revocation.",
    ];
  if (has("photo ordering"))
    return [
      "Integration Regression",
      [
        "Create ordered photos.",
        "Remove a middle photo and add/reorder the remaining photos.",
        "Inspect uniqueness and display order.",
      ],
      "No duplicate display-order constraint failure.",
    ];
  if (has("browser photo upload"))
    return [
      "Integration Regression",
      [
        "Create a browser multipart File.",
        "Upload through the authenticated photo route.",
        "Read saved metadata and verify bytes.",
      ],
      "Real file bytes reach storage with correct metadata.",
    ];
  if (has("demo seed"))
    return [
      "Data & Credentials",
      [
        "Run the existing 22-profile demo seed in its isolated fixture DB.",
        "Inspect adult profiles, local photos and action counts.",
        "Rerun and compare identifiers/counts.",
      ],
      "22 adults, valid photos, zero manufactured likes and repeat-safe IDs.",
    ];
  if (has("reshuffles passes"))
    return [
      "Discovery Feed",
      [
        "Exhaust fresh candidates and PASS some profiles.",
        "Walk stable seeded recycled cursor pages.",
        "Verify likes/matches are never recycled.",
      ],
      "No within-round duplicates; eligibility retained; likes excluded.",
    ];
  if (has("cafe offerings"))
    return [
      "Integration Regression",
      [
        "Publish venue offerings and photos.",
        "Browse as a dating user.",
        "Attempt a content-management write as that dating user.",
      ],
      "Read permitted; unauthorized content writes forbidden.",
    ];
  if (has("scores the full pool"))
    return [
      "Discovery Feed",
      [
        "Create consented profiles and a strong candidate outside the baseline first row.",
        "Request ranked pages; record/deduplicate impressions and submit actions.",
        "Edit preferences/revoke consent; continue the original cursor; test session expiry/ownership.",
      ],
      "Full-pool ranking, stable cursor, deduplication and current consent all hold.",
    ];
  if (has("language and partner-value"))
    return [
      "Access & Eligibility",
      [
        "Set reciprocal required language alternatives.",
        "Set required partner values and remove a required answer.",
        "Query both sides of discovery after each change.",
      ],
      "Language OR and value AND rules apply reciprocally; missing required values exclude.",
    ];
  if (has("private/sensitive"))
    return [
      "Consent & Privacy",
      [
        "Mark structured answers, biography and prompts private.",
        "Inspect the matching repository projection.",
        "Request openers for non-mutual and mutual pairs.",
      ],
      "Private/sensitive projection excluded; openers require explicit mutual likes.",
    ];
  if (has("hybrid service calls"))
    return [
      "AI Service",
      [
        "Start a local authenticated semantic stub.",
        "Compare consented, revoked and outdated-policy pairs in HYBRID mode.",
        "Inspect semantic requests, merged scores and explicit match requirements.",
      ],
      "AI only receives allowed consented text and cannot manufacture a mutual match.",
    ];
  if (has("AI adapter"))
    return [
      "AI Service",
      [
        "Start an internal HTTP stub and configure an independent service key.",
        "Return valid, malformed, oversized, foreign-key and unavailable responses.",
        "Call the Node adapter after every response variant.",
      ],
      "Validated bounded similarities or null fallback; correct internal authentication.",
    ];
  if (has("real overlap"))
    return [
      "Rules Ranking",
      [
        "Build profiles with known Jaccard interest overlap and desired values.",
        "Score both directions.",
        "Compare conservative symmetric pair scores and public explanations.",
      ],
      "Actual overlap drives the weaker-direction score; no private preferences leak.",
    ];
  if (has("missing answers stay"))
    return [
      "Rules Ranking",
      [
        "Score two profiles without evidence.",
        "Add one matching interest component.",
        "Compare score, coverage and neutral shrinkage.",
      ],
      "Unknown remains null; sparse evidence coverage prevents false certainty.",
    ];
  if (has("current personalization"))
    return [
      "Consent & Privacy",
      [
        "Give one profile consent and the other none.",
        "Compute rules and semantic-assisted pair ranking.",
        "Inspect score/mode/reasons.",
      ],
      "Null score, BASELINE and no personalization reasons.",
    ];
  if (has("semantic signals are bounded"))
    return [
      "Rules Ranking",
      [
        "Score a known mismatch with valid semantic evidence.",
        "Repeat with NaN, infinity, negative and above-one semantic inputs.",
        "Score evidence-free profiles with a valid semantic value.",
      ],
      "Invalid evidence ignored; semantic values cannot fabricate baseline scores.",
    ];
  if (has("city-centre distance"))
    return [
      "Rules Ranking",
      [
        "Use two known city centroids.",
        "Compute distances in both directions and to self.",
        "Repeat with missing coordinates.",
      ],
      "Finite symmetric distance, self zero, missing coordinates unknown.",
    ];
  if (has("soft age preference"))
    return [
      "Rules Ranking",
      [
        "Set age as a soft preference.",
        "Score one within-range and one outside-range pair.",
        "Repeat with only age evidence.",
      ],
      "Soft age influences alignment; age alone does not create a displayed score.",
    ];
  if (has("rollout is stable"))
    return [
      "Rules Ranking",
      [
        "Set HYBRID rollout to 0%, 100% and 50%.",
        "Evaluate fixed user IDs twice.",
        "Compare modes and restore environment settings.",
      ],
      "Stable assignments; 0% baseline; 100% treatment; live switch supported.",
    ];
  if (has("OTP") || has("SMS") || has("provider credentials"))
    return [
      "Integration Regression",
      [
        "Inject the OTP delivery provider fixture.",
        "Exercise the success/failure/configuration named in this case.",
        "Check safe errors/addressing without sending real SMS.",
      ],
      "Existing OTP delivery behavior is preserved; no real SMS sent.",
    ];
  return [
    "Integration Regression",
    [
      "Construct the exact media or upload fixture named in this test.",
      "Call the existing URL/FormData helper.",
      "Compare generated URL, bytes, MIME type or rejection behavior.",
    ],
    "The existing media/upload contract named by the case is preserved.",
  ];
}

function collect() {
  const qa = read("qa.json"),
    reg = read("regressions.json"),
    python = read("python.json"),
    builds = read("builds.json"),
    seed = read("seed.json");
  const tests = [...qa.tests];
  tests.push({
    id: "DATA-007",
    module: "Data & Credentials",
    title: "10,000-user seed is idempotent on an actual rerun",
    type: "Automated QA",
    priority: "P1",
    preconditions:
      "Initial seed completed; same deterministic namespace retained.",
    users: "qa00001..qa10000",
    steps: [
      "Run node testing/matching/seed-users.cjs a second time.",
      "Compare count and ordered user-ID checksum before and after.",
      "Verify no duplicate users are created.",
    ],
    expected: "10,000 unchanged user IDs and zero duplicate accounts.",
    actual: `Previous count=${seed.previousCount}; current count=${seed.count}; idempotencyVerified=${seed.idempotencyVerified}`,
    status: seed.idempotencyVerified ? "PASS" : "FAIL",
    testedBy: "Codex",
    testedAt: seed.seededAt,
    durationMs: seed.elapsedMs,
    evidence: "testing/matching/results/seed.json",
    fixApplied: "Deterministic fixture namespace and conflict-safe inserts.",
    owner: "Matching",
  });
  for (const item of reg.tests) {
    const [module, steps, expected] = regressionDetails(item.name),
      key = createHash("sha1")
        .update(item.name)
        .digest("hex")
        .slice(0, 6)
        .toUpperCase();
    const source = path.relative(PROJECT, item.file).replace(/\\/g, "/");
    const ownership = /partner|venue|cafe|dates|propose/.test(item.name)
      ? "Partner app (regression)"
      : module === "Integration Regression"
        ? "Onboarding (regression)"
        : "Matching";
    tests.push({
      id: `REG-${key}`,
      module,
      title: item.name,
      type: "Existing automated regression",
      priority:
        module === "Realtime" || module === "Consent & Privacy" ? "P0" : "P1",
      preconditions:
        "Run the full ordered regression suite: integration cases share setup/state. Its fixture DB/stubs are independent of the 10k QA DB.",
      users: "Named fictional users inside the existing test harness.",
      steps,
      command:
        "node testing/matching/run-regressions.cjs (full ordered suite; inspect this case in the saved results)",
      expected,
      actual:
        item.event === "test:pass"
          ? `Executed assertion group passed (${Math.round(item.durationMs)} ms).`
          : item.error?.message || "Runner reported a failing case.",
      status: item.event === "test:pass" ? "PASS" : "FAIL",
      testedBy: "Codex",
      testedAt: reg.at,
      durationMs: Math.round(item.durationMs),
      evidence: `testing/matching/results/backend.events.ndjson; ${source}:${item.line}`,
      owner: ownership,
      fixApplied: /scores the full pool/.test(item.name)
        ? "Implemented ranked snapshots and current-consent revalidation."
        : /real overlap/.test(item.name)
          ? "Replaced the earlier ID-derived demo percentage with real reciprocal scoring."
          : /private\/sensitive/.test(item.name)
            ? "Excluded private/sensitive soft-ranking fields."
            : "",
    });
  }
  const pyMeta = {
    test_body_limit_and_no_public_openapi: [
      [
        "POST a body larger than 1,200,000 bytes.",
        "Request /openapi.json.",
        "Check size rejection and disabled public documentation.",
      ],
      "413 for oversized body; 404 for OpenAPI.",
    ],
    test_cosine_rejects_invalid_provider_outputs: [
      [
        "Supply empty, unequal, zero and NaN vectors.",
        "Call cosine_similarity.",
        "Check explicit errors.",
      ],
      "Invalid vectors raise ValueError.",
    ],
    test_icebreakers_are_drafts_from_supplied_facts: [
      [
        "POST duplicate shared interest labels.",
        "Read returned grounded template suggestions.",
        "Check deduplication and supplied fact usage.",
      ],
      "One unique grounded suggestion for the repeated fact.",
    ],
    test_internal_auth_required: [
      [
        "POST both protected AI endpoints without a valid key.",
        "Inspect HTTP responses.",
        "Check the fake encoder was never called.",
      ],
      "401 and zero inference.",
    ],
    test_missing_secret_fails_closed: [
      [
        "Construct app Settings with an empty service key.",
        "Enter application lifespan.",
        "Check startup failure.",
      ],
      "Startup raises ValueError.",
    ],
    test_semantic_batch_is_grounded_bounded_and_not_persistent: [
      [
        "Use deterministic test encoder and duplicate within-request text.",
        "Call semantic endpoint twice.",
        "Inspect scores and the encoder batch list.",
      ],
      "Bounded scores; within-request dedup; no cross-request profile cache.",
    ],
    test_strict_validation_does_not_echo_private_input: [
      [
        "Submit oversized private biography, duplicate keys and extra fields.",
        "Inspect status and validation body.",
        "Search error output for the private input.",
      ],
      "422 without private text echoes.",
    ],
    test_unavailable_model_preserves_health_and_assist: [
      [
        "Start the app with no embedding provider.",
        "Call /health, /ready, semantic and assist.",
        "Compare each response.",
      ],
      "Health and assist work; readiness and semantics return 503.",
    ],
  };
  for (const [i, item] of python.tests.entries()) {
    const method = item.name.split(".").at(-1),
      [steps, expected] = pyMeta[method];
    tests.push({
      id: `PY-${String(i + 1).padStart(3, "0")}`,
      module: method.includes("icebreakers")
        ? "Conversation Assist"
        : "AI Service",
      title: method.replace(/^test_/, "").replaceAll("_", " "),
      type: "Python API/domain regression",
      priority: "P1",
      preconditions:
        "FastAPI TestClient with deterministic fake encoder; no real-model quality claim.",
      users: "Fictional text fixtures",
      steps,
      command: "ai/.venv/Scripts/python.exe testing/matching/run-python.py",
      expected,
      actual:
        item.status === "PASS"
          ? "Existing unittest assertions passed."
          : item.detail,
      status: item.status,
      testedBy: "Codex",
      testedAt: item.at,
      durationMs: item.durationMs,
      evidence: `testing/matching/results/python.json; ai/tests/test_matching.py::${method}`,
      owner: "Matching",
    });
  }
  tests.push(...builds.tests);
  const manual = (id, module, title, steps, expected, options = {}) =>
    tests.push({
      id,
      module,
      title,
      type: "Manual verification",
      priority: "P2",
      preconditions:
        "QA database + API + dating client pointed at the QA API; use fresh qa-login session.",
      users: "qa00003, qa00004",
      steps,
      expected,
      actual: "Manual verification has not been executed.",
      status: "NOT RUN",
      testedBy: "",
      testedAt: null,
      durationMs: null,
      evidence: "",
      suggestion:
        "Record the human tester username and attach screenshot/video or API evidence.",
      improvement: "",
      fixApplied: "",
      retest: "",
      owner: "Matching",
      ...options,
    });
  manual(
    "UI-DISC-001",
    "Discovery Feed",
    "Swipe gesture and action buttons agree",
    [
      "Open the loaded Discover tab.",
      "Swipe right on one card and left on another.",
      "Repeat using Like/Pass buttons and refresh.",
    ],
    "Each gesture/button saves one intended action; answered cards disappear.",
  );
  manual(
    "UI-DISC-002",
    "Discovery Feed",
    "Expired feed session recovers in the client",
    [
      "Load a ranked feed and wait over 15 minutes.",
      "Exhaust the currently loaded cards.",
      "Observe the next fetch.",
    ],
    "Client refreshes the expired session and continues without an endless spinner.",
  );
  manual(
    "UI-DISC-003",
    "Discovery Feed",
    "Empty feed provides a useful recovery path",
    [
      "Sign in as verified-only qa00013.",
      "Open Discover and refresh.",
      "Change preferences through the owning profile flow and return.",
    ],
    "Empty state appears; refresh/preferences allow recovery.",
    { users: "qa00013" },
  );
  manual(
    "UI-DISC-004",
    "Discovery Feed",
    "A sparse profile does not display a fabricated percentage",
    [
      "Use a profile pair below the evidence threshold.",
      "Open the card and score explanation.",
      "Inspect unknown alignment rendering.",
    ],
    "An em dash/unknown label appears; no fake match probability.",
  );
  manual(
    "UI-CONSENT-001",
    "Consent & Privacy",
    "Personalization toggle persists after reload",
    [
      "Sign in as qa00003.",
      "Turn personalization off and reload.",
      "Turn it on, reload and inspect API consent history.",
    ],
    "Latest chosen state persists; feed refreshes with the current consent.",
  );
  manual(
    "UI-CONSENT-002",
    "Consent & Privacy",
    "Private fields remain absent from the full profile modal",
    [
      "Set interests, prompts and biography PRIVATE.",
      "View the profile as another eligible user.",
      "Inspect card, details and explanations.",
    ],
    "Private content is not rendered in public views.",
    { users: "qa00012 and an eligible peer" },
  );
  manual(
    "UI-LIKE-001",
    "Likes & Matches",
    "Mutual-match celebration reflects one match",
    [
      "Use a fresh eligible pair.",
      "Like in the first session and reciprocate in the second.",
      "Reload both clients.",
    ],
    "One match is shown in each Chats list; no duplicate celebration entries.",
  );
  manual(
    "UI-LIKE-002",
    "Likes & Matches",
    "Incoming-like count updates after dismissal",
    [
      "Create an incoming like from another QA user.",
      "Open Liked you and PASS that user.",
      "Reload the list and unread notification indicators.",
    ],
    "Incoming-like count and list reflect dismissal.",
  );
  manual(
    "UI-CHAT-001",
    "Chat & Receipts",
    "Draft survives changing conversations",
    [
      "Type a draft in conversation A.",
      "Switch to B, type another draft and reload.",
      "Return to A.",
    ],
    "Each conversation restores its own draft.",
  );
  manual(
    "UI-CHAT-002",
    "Chat & Receipts",
    "Offline retry preserves the original message",
    [
      "Disconnect the device and send a message.",
      "Reconnect and retry the queued item.",
      "Inspect both devices and API history.",
    ],
    "One stored message; correct pending/failed/sent state.",
  );
  manual(
    "UI-CHAT-003",
    "Chat & Receipts",
    "Read receipt requires actual foreground message visibility",
    [
      "Open a conversation with unread messages.",
      "Scroll newest messages out of view and background the app.",
      "Return and bring the newest message into view.",
    ],
    "Receipt advances when that message is visible in the foreground.",
  );
  manual(
    "UI-RT-001",
    "Realtime",
    "Typing indicator expires after the peer stops",
    [
      "Open the matched conversation on two devices.",
      "Type then stop without sending.",
      "Observe the peer indicator and disconnect behavior.",
    ],
    "Typing appears only for the matched peer and expires.",
  );
  manual(
    "UI-RT-002",
    "Realtime",
    "Reconnect catches up after missed broadcasts",
    [
      "Disconnect one device during incoming messages.",
      "Reconnect and return to the conversation.",
      "Compare ordered history with the sender.",
    ],
    "Missed persisted messages are recovered without duplicates.",
  );
  manual(
    "UI-NOTIF-001",
    "Notifications",
    "In-app notification opens the correct conversation",
    [
      "Receive a new-message in-app notification.",
      "Open it from the notification list.",
      "Verify conversation ID and read state.",
    ],
    "The correct matched conversation opens and notification state updates.",
  );
  manual(
    "UI-IMP-001",
    "Impressions & Metrics",
    "Backgrounding resets the 700 ms exposure interval",
    [
      "Show a fresh card for under 700 ms.",
      "Background the app/browser for two seconds.",
      "Return and check impressions after 700 uninterrupted foreground ms.",
    ],
    "No background exposure; one deduplicated row after returning.",
    {
      fixApplied:
        "Foreground/browser visibility tracking was implemented before this test plan; manual verification pending.",
    },
  );
  manual(
    "UI-IMP-002",
    "Impressions & Metrics",
    "Quickly skipped fetched cards do not create exposures",
    [
      "Fetch a page with multiple cards.",
      "Skip the front card in under 700 ms.",
      "Inspect impression rows for fetched-but-unseen cards.",
    ],
    "Only cards meeting the exposure interval are attributed.",
  );
  manual(
    "UI-ASSIST-001",
    "Conversation Assist",
    "Suggestion chip fills only an empty draft",
    [
      "Request suggestions in a mutual-match chat.",
      "Select a chip with an empty draft.",
      "Type custom text and select another chip.",
    ],
    "First chip fills the draft; existing typed text remains.",
  );
  manual(
    "UI-ASSIST-002",
    "Conversation Assist",
    "Suggestions never auto-send or leak across chats",
    [
      "Request suggestions in conversation A.",
      "Immediately switch to B before the response arrives.",
      "Inspect B and the persisted message list.",
    ],
    "A response cannot populate B; no suggestion is automatically sent.",
  );
  manual(
    "UI-ASSIST-003",
    "Conversation Assist",
    "Chosen suggestion remains editable before Send",
    [
      "Select a grounded suggestion.",
      "Edit the text.",
      "Press Send and inspect both participants.",
    ],
    "Only the edited text is sent through the normal chat flow.",
  );
  manual(
    "UI-RANK-001",
    "Rules Ranking",
    "Score explanation is understandable and truthful",
    [
      "Open cards with real score and unknown score.",
      "Read the explanation and public reasons.",
      "Compare displayed score with ranking.score.",
    ],
    "Alignment is out of 100 and is not labelled a romantic-success probability.",
  );
  manual(
    "LOAD-001",
    "Performance & Setup",
    "Concurrent production-like feed load",
    [
      "Choose agreed virtual-user count and p95 target.",
      "Run sustained feed/chat load against a staging environment.",
      "Inspect database/CPU, error rates, fallback rate and latency percentiles.",
    ],
    "Agreed service targets pass under representative concurrent traffic.",
    {
      preconditions:
        "A staging deployment, agreed load/SLA and a load driver are required.",
      improvement:
        "Local 10k-user sequential feed smoke is approximately 3–4 seconds per request; profile query/hydration work before scale claims.",
      priority: "P1",
    },
  );
  manual(
    "DEPLOY-001",
    "Performance & Setup",
    "Container startup and model-cache persistence",
    [
      "Build the ai Compose profile in a disposable environment.",
      "Provision the model cache and restart the services.",
      "Check private connectivity, readiness and persisted model weights.",
    ],
    "Node reaches private Python service; embeddings use the pinned cached model.",
    {
      preconditions:
        "Docker engine and resources to build/run containers; separate disposable environment.",
    },
  );
  manual(
    "ACCESS-UI-001",
    "Integration Regression",
    "Android and iOS accessible navigation",
    [
      "Use screen readers on Android and iOS.",
      "Navigate card actions, chat input and suggestion chips.",
      "Check focus order, labels and text scaling.",
    ],
    "Primary controls remain labelled and usable.",
    { owner: "Onboarding and matching" },
  );
  const block = (id, module, title, missing, steps, expected, improvement) =>
    manual(id, module, title, steps, expected, {
      type: "External prerequisite check",
      priority: "P1",
      status: "BLOCKED",
      testedBy: "Codex",
      testedAt: qa.createdAt,
      actual: missing,
      preconditions: missing,
      improvement,
      evidence:
        "testing/matching/.env.qa (local configuration; secret values omitted)",
      suggestion:
        "Provide the stated test environment/prerequisite, then execute and record the actual result.",
    });
  block(
    "PUSH-001",
    "Notifications",
    "Native push reaches Android device",
    "QA push workers are disabled; no FCM test service account/device token configured.",
    [
      "Configure dedicated FCM test credentials and register an Android token.",
      "Send a matched message.",
      "Verify push delivery and navigation on a real test device.",
    ],
    "Only the intended recipient receives the push.",
    "Requires provider/device verification; database notification insertion is already tested.",
  );
  block(
    "PUSH-002",
    "Notifications",
    "Native push reaches iOS device",
    "QA push workers are disabled; no APNs test key/topic/device token configured.",
    [
      "Configure dedicated APNs sandbox credentials and register a device.",
      "Send a matched message.",
      "Verify delivery, payload and navigation.",
    ],
    "Only the intended recipient receives the sandbox push.",
    "Requires provider/device verification.",
  );
  block(
    "AI-QUALITY-001",
    "AI Service",
    "Real dating-outcome improvement is demonstrated",
    "No representative labelled dating-outcome dataset or controlled experiment is available.",
    [
      "Define reciprocal-match/reply outcome windows and consented cohorts.",
      "Evaluate a representative labelled sample and controlled rollout.",
      "Compare outcomes, subgroup errors and confidence intervals.",
    ],
    "Measured improvement under agreed metrics, without similarity-to-success claims.",
    "Current rule weights and three multilingual smoke examples require broader outcome validation.",
  );
  const seen = new Set();
  for (const row of tests) {
    if (seen.has(row.id)) throw new Error(`Duplicate case ID ${row.id}`);
    seen.add(row.id);
    if (!modules.includes(row.module))
      throw new Error(`Unknown module ${row.module}`);
  }
  return { modules, tests, runAt: new Date().toISOString(), qa, seed };
}
module.exports = { collect, modules };
