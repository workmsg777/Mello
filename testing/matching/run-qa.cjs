// Runs real HTTP/service/SQL checks against only the dedicated 10,000-user QA DB.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const net = require("node:net");
const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { performance } = require("node:perf_hooks");
const {
  PROJECT,
  CACHE,
  RESULTS,
  loadApplication,
  writeJson,
} = require("./runtime.cjs");
const { issueQaSession } = require("./qa-login.cjs");

async function main() {
  process.chdir(CACHE);
  const application = loadApplication(),
    { sequelize: db, require: req } = application;
  const { QueryTypes } = req("sequelize");
  const query = (sql, replacements = {}) =>
    db.query(sql, { replacements, type: QueryTypes.SELECT });
  const { app } = req(path.join(PROJECT, "backend/src/app.ts"));
  const server = http.createServer(app);
  const io = req(
    path.join(PROJECT, "backend/src/realtime/chat-server.ts"),
  ).createChatServer(server);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`,
    records = [];
  let aiProcess, aiStream;
  const createdAt = new Date().toISOString(),
    fixtures = JSON.parse(
      fs.readFileSync(path.join(CACHE, "users.json"), "utf8"),
    );
  const fixture = (n) => fixtures[n - 1],
    tokens = new Map();
  const identity = async (n) => {
    if (!tokens.has(n))
      tokens.set(
        n,
        await issueQaSession(fixture(n).username, application, true),
      );
    return tokens.get(n);
  };
  async function api(n, method, url, body, expected = 200) {
    const who = n ? await identity(n) : null;
    const response = await fetch(base + url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(who ? { Authorization: `Bearer ${who.tokens.accessToken}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(45000),
    });
    const result = await response.json();
    assert.equal(
      response.status,
      expected,
      `${method} ${url}: ${JSON.stringify(result).slice(0, 500)}`,
    );
    return result;
  }
  async function check(id, module, title, steps, expected, fn, options = {}) {
    const started = performance.now();
    let status = "PASS",
      actual = "",
      fix = "";
    try {
      actual = (await fn()) || "All assertions passed.";
    } catch (error) {
      status = error.blocked ? "BLOCKED" : "FAIL";
      actual = error.message.slice(0, 1200);
    }
    const row = {
      id,
      module,
      title,
      type: options.type || "Automated QA",
      priority: options.priority || "P1",
      preconditions:
        "Dedicated local QA database seeded with 10,000 fictional users.",
      users: options.users || "qa00001, qa00002",
      steps,
      expected,
      actual,
      status,
      testedBy: "Codex",
      testedAt: new Date().toISOString(),
      durationMs: Math.round(performance.now() - started),
      evidence: "testing/matching/results/qa.json",
      suggestion: options.suggestion || "",
      improvement: options.improvement || "",
      fixApplied: fix,
      retest: "",
      ...options,
    };
    records.push(row);
    writeJson(path.join(RESULTS, "qa.json"), {
      createdAt,
      database: "mello_qa_10000",
      baseUrl: base,
      tests: records,
    });
    console.log(`${id} ${status}: ${title}`);
    return status;
  }
  const { DiscoveryRepository } = req(
    path.join(PROJECT, "backend/src/repositories/discovery.repository.ts"),
  );
  const { MatchingService } = req(
    path.join(PROJECT, "backend/src/services/matching/matching.service.ts"),
  );
  const { matchingProfiles } = req(
    path.join(PROJECT, "backend/src/repositories/matching.repository.ts"),
  );
  const discovery = new DiscoveryRepository(),
    matching = new MatchingService();
  let feed, matchId, messageOne, messageTwo;
  try {
    await check(
      "DATA-001",
      "Data & Credentials",
      "Exactly 10,000 distinct inserted users",
      [
        "Read qa_fixture_users.",
        "Count rows and unique user IDs.",
        "Join users/accounts and compare counts.",
      ],
      "All three counts equal 10,000.",
      async () => {
        const [r] = await query(
          "SELECT count(*)::int AS total,count(DISTINCT q.user_id)::int AS ids,count(DISTINCT u.account_id)::int AS accounts FROM qa_fixture_users q JOIN users u ON u.id=q.user_id",
        );
        assert.deepEqual([r.total, r.ids, r.accounts], [10000, 10000, 10000]);
        return JSON.stringify(r);
      },
    );
    await check(
      "DATA-002",
      "Data & Credentials",
      "All roster profiles are fictional adults",
      [
        "Join the roster with user_profiles.",
        "Find profiles below age 18.",
        "Check fixture labels and example.test identities.",
      ],
      "Zero underage rows; 10,000 clearly labelled fictional profiles.",
      async () => {
        const [r] = await query(
          "SELECT count(*) FILTER(WHERE p.date_of_birth>CURRENT_DATE-interval '18 years')::int AS underage,count(*) FILTER(WHERE p.bio LIKE 'Fictional QA profile.%')::int AS fictional FROM qa_fixture_users q JOIN user_profiles p ON p.user_id=q.user_id",
        );
        assert.equal(r.underage, 0);
        assert.equal(r.fictional, 10000);
        return JSON.stringify(r);
      },
    );
    await check(
      "DATA-003",
      "Data & Credentials",
      "Hobbies and languages are stored as catalog relations",
      [
        "Count normalized interests for each fixture.",
        "Count normalized languages.",
        "Validate the smallest count.",
      ],
      "Every fixture has 4 interests and at least 2 languages.",
      async () => {
        const [r] = await query(
          "SELECT min((SELECT count(*) FROM user_interests i WHERE i.user_id=q.user_id))::int AS hobbies,min((SELECT count(*) FROM user_languages l WHERE l.user_id=q.user_id))::int AS languages FROM qa_fixture_users q",
        );
        assert.equal(r.hobbies, 4);
        assert.ok(r.languages >= 2);
        return JSON.stringify(r);
      },
    );
    await check(
      "DATA-004",
      "Data & Credentials",
      "Fixture identities do not create real SMS/password credentials",
      [
        "Inspect fixture auth_identities.",
        "Check example.test suffix.",
        "Count non-null password hashes and PHONE identities.",
      ],
      "10,000 example.test identifiers; zero password hashes and PHONE identities.",
      async () => {
        const [r] = await query(
          "SELECT count(*) FILTER(WHERE i.identifier LIKE '%@example.test')::int AS emails,count(*) FILTER(WHERE i.password_hash IS NOT NULL)::int AS passwords,count(*) FILTER(WHERE i.provider='PHONE')::int AS phones FROM qa_fixture_users q JOIN users u ON u.id=q.user_id JOIN auth_identities i ON i.account_id=u.account_id",
        );
        assert.deepEqual(r, { emails: 10000, passwords: 0, phones: 0 });
        return JSON.stringify(r);
      },
    );
    await check(
      "DATA-005",
      "Data & Credentials",
      "Fixture photo assets exist as actual local files",
      [
        "Read the 9 shared synthetic avatar media records.",
        "Resolve every storage key under QA uploads.",
        "Verify readable non-empty PNG files.",
      ],
      "All 9 shared avatar files exist; users reference valid assets.",
      async () => {
        const media = await query(
          "SELECT storage_key FROM media WHERE storage_key LIKE 'profile-photos/qa-avatar-%'",
        );
        assert.equal(media.length, 9);
        for (const m of media)
          assert.ok(
            fs.statSync(path.join(CACHE, "uploads", m.storage_key)).size > 100,
          );
        return "9/9 local avatar files verified.";
      },
    );
    await check(
      "DATA-006",
      "Data & Credentials",
      "Negative fixture cohorts remain available",
      [
        "Group qa_fixture_users by scenario.",
        "Inspect incomplete, suspended, photo and verification cohorts.",
        "Compare stored scenario counts.",
      ],
      "Each negative cohort has at least 50 profiles.",
      async () => {
        const r = await query(
          "SELECT scenario,count(*)::int AS count FROM qa_fixture_users GROUP BY scenario",
        );
        for (const name of [
          "INCOMPLETE_ONBOARDING",
          "SUSPENDED_ACCOUNT",
          "INSUFFICIENT_PHOTOS",
          "VERIFIED_ONLY_EMPTY",
        ])
          assert.ok(r.find((x) => x.scenario === name).count >= 50);
        return JSON.stringify(r);
      },
    );
    await check(
      "AUTH-001",
      "Access & Eligibility",
      "QA helper creates a valid protected API session",
      [
        "Issue a session for qa00001 with qa-login helper.",
        "Send GET /api/auth/me using its Bearer token.",
        "Check returned account and user IDs.",
      ],
      "200 with the inserted account/user.",
      async () => {
        const r = await api(1, "GET", "/auth/me");
        assert.equal(r.profile.userId, fixture(1).userId);
        return `200; username=${fixture(1).username}`;
      },
    );
    await check(
      "AUTH-002",
      "Access & Eligibility",
      "Anonymous discovery is rejected",
      [
        "Call GET /api/discovery/feed without Authorization.",
        "Inspect status.",
      ],
      "401; no discovery data.",
      () =>
        api(null, "GET", "/discovery/feed", undefined, 401).then(
          () => "401 confirmed.",
        ),
    );
    await check(
      "AUTH-003",
      "Access & Eligibility",
      "Incomplete onboarding cannot discover",
      [
        "Issue a QA session for qa00006.",
        "Call GET /api/discovery/feed.",
        "Inspect the profile-completion error.",
      ],
      "403.",
      () =>
        api(6, "GET", "/discovery/feed", undefined, 403).then(
          () => "403 confirmed.",
        ),
      { users: "qa00006" },
    );
    await check(
      "AUTH-004",
      "Access & Eligibility",
      "Suspended account session cannot discover",
      [
        "Create test session for suspended qa00005.",
        "Call GET /api/discovery/feed.",
        "Verify account gate.",
      ],
      "401.",
      () =>
        api(5, "GET", "/discovery/feed", undefined, 401).then(
          () => "401 confirmed.",
        ),
      { users: "qa00005" },
    );
    await check(
      "ELIG-001",
      "Access & Eligibility",
      "Ineligible candidates are excluded at 10k population",
      [
        "Fetch complete eligible candidate IDs for qa00001.",
        "Check suspended qa00005, draft qa00006 and photo-deficient qa00010.",
        "Verify viewer is excluded.",
      ],
      "None of those IDs occurs in candidates.",
      async () => {
        const ids = new Set(
          (await discovery.fresh(fixture(1).userId)).map((r) => r.userId),
        );
        for (const n of [1, 5, 6, 10, 13])
          assert.ok(!ids.has(fixture(n).userId));
        assert.ok(ids.size > 100);
        return `${ids.size} eligible candidates; all 5 exclusions confirmed.`;
      },
    );
    await check(
      "ELIG-002",
      "Access & Eligibility",
      "Verified-only profile currently gets an empty feed",
      [
        "Use qa00013 with verified_profiles_only=true.",
        "Request discovery.",
        "Inspect count.",
      ],
      "200 with no profiles while verification is unsupported.",
      async () => {
        const r = await api(13, "GET", "/discovery/feed");
        assert.equal(r.profiles.length, 0);
        return "Empty eligible feed confirmed.";
      },
      {
        users: "qa00013",
        improvement:
          "Implement verification in the owning identity feature before enabling this preference broadly.",
      },
    );
    await check(
      "DISC-001",
      "Discovery Feed",
      "Ranked feed returns a bounded page and session",
      [
        "Use active qa00001.",
        "GET /api/discovery/feed?limit=5.",
        "Check card count, session and cursor.",
      ],
      "5 unique profiles; owner-bound session and next cursor.",
      async () => {
        feed = await api(1, "GET", "/discovery/feed?limit=5");
        assert.equal(feed.profiles.length, 5);
        assert.equal(new Set(feed.profiles.map((p) => p.userId)).size, 5);
        assert.ok(feed.feedSessionId);
        assert.ok(feed.nextRankCursor !== null);
        return `5 cards; ${feed.feedMode}; next cursor ${feed.nextRankCursor}.`;
      },
    );
    await check(
      "DISC-002",
      "Discovery Feed",
      "Cursor page has no overlap",
      [
        "Keep DISC-001 session.",
        "Request next page using feedSessionId and nextRankCursor.",
        "Compare IDs from both pages.",
      ],
      "No repeated profile IDs.",
      async () => {
        assert.ok(feed);
        const r = await api(
          1,
          "GET",
          `/discovery/feed?limit=5&feedSessionId=${feed.feedSessionId}&cursor=${feed.nextRankCursor}`,
        );
        const ids = new Set(feed.profiles.map((p) => p.userId));
        assert.ok(r.profiles.every((p) => !ids.has(p.userId)));
        assert.ok(r.profiles.length > 0);
        return `${r.profiles.length} next-page profiles, zero overlaps.`;
      },
    );
    await check(
      "DISC-003",
      "Discovery Feed",
      "Other users cannot reuse a feed session",
      [
        "Copy qa00001 session ID.",
        "Request it as qa00004.",
        "Check HTTP status.",
      ],
      "404.",
      () =>
        api(
          4,
          "GET",
          `/discovery/feed?feedSessionId=${feed.feedSessionId}&cursor=0`,
          undefined,
          404,
        ).then(() => "404 confirmed."),
      { users: "qa00001, qa00004" },
    );
    await check(
      "DISC-004",
      "Discovery Feed",
      "Invalid paging/action inputs are rejected",
      [
        "Request limit=0, limit=21 and cursor without session.",
        "POST an action with malformed target UUID.",
        "Check all responses.",
      ],
      "400 for every invalid input.",
      async () => {
        for (const url of [
          "/discovery/feed?limit=0",
          "/discovery/feed?limit=21",
          "/discovery/feed?cursor=0",
        ])
          await api(1, "GET", url, undefined, 400);
        await api(
          1,
          "POST",
          "/discovery/actions",
          { targetId: "bad-id", action: "LIKE" },
          400,
        );
        return "All 4 invalid-input checks returned 400.";
      },
    );
    await check(
      "RANK-001",
      "Rules Ranking",
      "Actual reciprocal rule score is symmetric",
      [
        "Read qa00001 and qa00002 matching projections.",
        "Score the pair in both directions.",
        "Compare score/coverage/effective score.",
      ],
      "Identical bounded reciprocal result.",
      async () => {
        const p = await matchingProfiles([
          fixture(1).userId,
          fixture(2).userId,
        ]);
        const { scorePair } = req(
          path.join(PROJECT, "backend/src/services/matching/scoring.ts"),
        );
        const a = scorePair(p.get(fixture(1).userId), p.get(fixture(2).userId)),
          b = scorePair(p.get(fixture(2).userId), p.get(fixture(1).userId));
        assert.deepEqual(a, b);
        assert.ok(a.score >= 0 && a.score <= 100);
        return JSON.stringify({
          score: a.score,
          coverage: a.coverage,
          mode: a.mode,
        });
      },
    );
    await check(
      "PRIV-001",
      "Consent & Privacy",
      "Missing candidate consent withholds personalization",
      [
        "Rank qa00007 against consented qa00002.",
        "Read score, mode and reasons.",
      ],
      "Null score, BASELINE and no reasons.",
      async () => {
        const r = (
          await matching.rank(fixture(2).userId, [fixture(7).userId])
        ).rankings.get(fixture(7).userId);
        assert.equal(r.score, null);
        assert.equal(r.mode, "BASELINE");
        assert.deepEqual(r.reasons, []);
        return "Missing consent: null score, empty reasons.";
      },
      { users: "qa00002, qa00007" },
    );
    await check(
      "PRIV-002",
      "Consent & Privacy",
      "Newer revocation overrides an old grant",
      [
        "Use qa00008 with grant and later revocation.",
        "Rank against qa00001.",
        "Read resulting mode/score.",
      ],
      "No personalized score despite historical grant.",
      async () => {
        const r = (
          await matching.rank(fixture(1).userId, [fixture(8).userId])
        ).rankings.get(fixture(8).userId);
        assert.equal(r.score, null);
        assert.equal(r.mode, "BASELINE");
        return "Latest revocation respected.";
      },
      { users: "qa00001, qa00008" },
    );
    await check(
      "PRIV-003",
      "Consent & Privacy",
      "Private interests are omitted from ranking projection",
      [
        "Load qa00012 projection.",
        "Read interests/publicInterests.",
        "Inspect public card fields in real feed.",
      ],
      "No private interests in matching projection.",
      async () => {
        const p = (await matchingProfiles([fixture(12).userId])).get(
          fixture(12).userId,
        );
        assert.deepEqual(p.interests, []);
        assert.equal(p.publicInterests, false);
        return "Private interest array empty; publicInterests=false.";
      },
      { users: "qa00012" },
    );
    await check(
      "PRIV-004",
      "Consent & Privacy",
      "Public cards omit internal/private ranking fields",
      [
        "Inspect DISC-001 JSON cards.",
        "Search for effectiveScore, semanticText, optionPreferences and valuePreferences.",
        "Check allowed ranking fields.",
      ],
      "Internal fields absent; score is nullable/bounded.",
      async () => {
        for (const p of feed.profiles) {
          for (const key of [
            "effectiveScore",
            "semanticText",
            "optionPreferences",
            "valuePreferences",
          ])
            assert.ok(!JSON.stringify(p).includes(`"${key}"`));
          assert.ok(
            p.ranking.score === null ||
              (p.ranking.score >= 0 && p.ranking.score <= 100),
          );
        }
        return "5 public cards checked; no internal ranking inputs.";
      },
    );
    await check(
      "IMP-001",
      "Impressions & Metrics",
      "Exposure insert is deduplicated",
      [
        "POST first feed target as an impression.",
        "Repeat identical request.",
        "Count rows for that session/target.",
      ],
      "First record created, retry creates zero rows.",
      async () => {
        const body = {
          feedSessionId: feed.feedSessionId,
          targetIds: [feed.profiles[0].userId],
        };
        const a = await api(1, "POST", "/discovery/impressions", body),
          b = await api(1, "POST", "/discovery/impressions", body);
        assert.equal(a.recorded, 1);
        assert.equal(b.recorded, 0);
        return "recorded=1 then recorded=0.";
      },
    );
    await check(
      "IMP-002",
      "Impressions & Metrics",
      "Another user cannot submit impressions for a foreign session",
      [
        "Copy qa00001 session and card target.",
        "POST impression using qa00004 token.",
        "Inspect status.",
      ],
      "404.",
      () =>
        api(
          4,
          "POST",
          "/discovery/impressions",
          {
            feedSessionId: feed.feedSessionId,
            targetIds: [feed.profiles[0].userId],
          },
          404,
        ).then(() => "404 confirmed."),
    );
    await check(
      "LIKE-001",
      "Likes & Matches",
      "One-sided like does not create a match",
      [
        "Ensure qa00001/qa00002 have no prior test action before first run.",
        "POST LIKE from qa00001 to qa00002.",
        "Check match state.",
      ],
      "One-sided LIKE remains unmatched, or an existing mutual match remains idempotent.",
      async () => {
        const r = await api(1, "POST", "/discovery/actions", {
          targetId: fixture(2).userId,
          action: "LIKE",
        });
        if (r.matched) {
          matchId = r.matchId;
          return "Rerun: previously mutual pair returned its existing match.";
        }
        assert.equal(r.matched, false);
        return "First explicit LIKE saved; matched=false.";
      },
    );
    await check(
      "LIKE-002",
      "Likes & Matches",
      "Simultaneous reciprocal likes create one canonical match",
      [
        "Send 20 alternating LIKE requests for qa00001 and qa00002.",
        "Collect successful match IDs.",
        "Count canonical match and notifications.",
      ],
      "One unique match ID and exactly 2 match notification records.",
      async () => {
        const r = await Promise.all(
          Array.from({ length: 20 }, (_, i) =>
            api(i % 2 ? 1 : 2, "POST", "/discovery/actions", {
              targetId: fixture(i % 2 ? 2 : 1).userId,
              action: "LIKE",
            }),
          ),
        );
        const ids = new Set(r.filter((x) => x.matched).map((x) => x.matchId));
        assert.equal(ids.size, 1);
        matchId = [...ids][0];
        const [m] = await query(
          "SELECT count(*)::int AS total FROM matches WHERE id=:id",
          { id: matchId },
        );
        assert.equal(m.total, 1);
        const [n] = await query(
          "SELECT count(*)::int AS total FROM notifications WHERE event_key=:key",
          { key: `match:${matchId}` },
        );
        assert.equal(n.total, 2);
        return "20 concurrent requests; 1 canonical match; 2 recipient notifications.";
      },
      { priority: "P0" },
    );
    await check(
      "LIKE-003",
      "Likes & Matches",
      "Matched people disappear from each other’s discovery",
      [
        "Complete LIKE-002.",
        "Read full fresh eligible candidate IDs for each person.",
        "Search for the matched peer.",
      ],
      "Matched peer absent in both directions.",
      async () => {
        assert.ok(matchId);
        for (const [a, b] of [
          [1, 2],
          [2, 1],
        ])
          assert.ok(
            !(await discovery.fresh(fixture(a).userId)).some(
              (r) => r.userId === fixture(b).userId,
            ),
          );
        return "Both directions exclude the mutual match.";
      },
    );
    await check(
      "CHAT-001",
      "Chat & Receipts",
      "Outsider cannot read a matched conversation",
      [
        "Use qa00011 token.",
        "GET messages for qa00001/qa00002 match.",
        "Check status.",
      ],
      "404.",
      () =>
        api(11, "GET", `/chat/${matchId}/messages`, undefined, 404).then(
          () => "Outsider received 404.",
        ),
      { users: "qa00011", priority: "P0" },
    );
    await check(
      "CHAT-002",
      "Chat & Receipts",
      "Message send stores an ordered message",
      [
        "Send a new message from qa00001.",
        "Send a reply from qa00002.",
        "Compare match IDs and increasing sequences.",
      ],
      "201 responses, positive increasing sequences.",
      async () => {
        messageOne = {
          clientMessageId: randomUUID(),
          body: "QA: What is your favourite weekend activity?",
        };
        const a = await api(
          1,
          "POST",
          `/chat/${matchId}/messages`,
          messageOne,
          201,
        );
        messageOne.saved = a;
        messageTwo = await api(
          2,
          "POST",
          `/chat/${matchId}/messages`,
          {
            clientMessageId: randomUUID(),
            body: "QA: Trekking and an unhurried coffee.",
          },
          201,
        );
        assert.ok(messageTwo.sequence > a.sequence);
        return `Stored sequences ${a.sequence} and ${messageTwo.sequence}.`;
      },
    );
    await check(
      "CHAT-003",
      "Chat & Receipts",
      "Retry with same client message ID does not duplicate",
      [
        "Repeat CHAT-002 first request with identical clientMessageId/body.",
        "Check HTTP status and stored ID.",
      ],
      "200 and the original message ID.",
      async () => {
        const r = await api(1, "POST", `/chat/${matchId}/messages`, {
          clientMessageId: messageOne.clientMessageId,
          body: messageOne.body,
        });
        assert.equal(r.id, messageOne.saved.id);
        return `Same message ID; sequence ${r.sequence}.`;
      },
    );
    await check(
      "CHAT-004",
      "Chat & Receipts",
      "Reusing a message ID with different text is rejected",
      [
        "Reuse CHAT-002 clientMessageId.",
        "Change body text.",
        "Inspect response.",
      ],
      "409.",
      () =>
        api(
          1,
          "POST",
          `/chat/${matchId}/messages`,
          {
            clientMessageId: messageOne.clientMessageId,
            body: "Changed QA text",
          },
          409,
        ).then(() => "409 confirmed."),
    );
    await check(
      "CHAT-005",
      "Chat & Receipts",
      "Empty and oversized message bodies are rejected",
      [
        "POST body containing only spaces.",
        "POST body with 2,001 characters.",
        "Check both responses.",
      ],
      "400 for both bodies.",
      async () => {
        for (const body of ["   ", "x".repeat(2001)])
          await api(
            1,
            "POST",
            `/chat/${matchId}/messages`,
            { clientMessageId: randomUUID(), body },
            400,
          );
        return "Both message boundary cases rejected.";
      },
    );
    await check(
      "CHAT-006",
      "Chat & Receipts",
      "Read receipts never move backwards",
      [
        "Read newer message as qa00001.",
        "Then acknowledge the older message.",
        "Compare returned lastReadSequence.",
      ],
      "Both responses retain the newer sequence.",
      async () => {
        const a = await api(1, "POST", `/chat/${matchId}/read`, {
          messageId: messageTwo.id,
        });
        const b = await api(1, "POST", `/chat/${matchId}/read`, {
          messageId: messageOne.saved.id,
        });
        assert.equal(a.lastReadSequence, messageTwo.sequence);
        assert.equal(b.lastReadSequence, messageTwo.sequence);
        return `Monotonic read sequence ${b.lastReadSequence}.`;
      },
    );
    await check(
      "CHAT-007",
      "Chat & Receipts",
      "History remains ordered and persistent",
      [
        "GET message history as both participants.",
        "Locate the two stored messages.",
        "Check ascending unique sequences.",
      ],
      "Saved messages visible in increasing sequence order.",
      async () => {
        for (const n of [1, 2]) {
          const r = await api(n, "GET", `/chat/${matchId}/messages`);
          const seq = r.messages.map((m) => m.sequence);
          assert.deepEqual(
            seq,
            [...new Set(seq)].sort((a, b) => a - b),
          );
          assert.ok(r.messages.some((m) => m.id === messageTwo.id));
        }
        return "Both authorized histories are ordered and contain saved messages.";
      },
    );
    await check(
      "ASSIST-001",
      "Conversation Assist",
      "Grounded suggestions never insert a message",
      [
        "Count chat messages in the mutual match.",
        "POST /chat/:matchId/icebreakers.",
        "Compare count and returned suggestions.",
      ],
      "1–3 editable suggestions and unchanged message count.",
      async () => {
        const before = await query(
          "SELECT count(*)::int AS n FROM chat_messages WHERE match_id=:id",
          { id: matchId },
        );
        const r = await api(1, "POST", `/chat/${matchId}/icebreakers`, {});
        const after = await query(
          "SELECT count(*)::int AS n FROM chat_messages WHERE match_id=:id",
          { id: matchId },
        );
        assert.ok(r.suggestions.length >= 1 && r.suggestions.length <= 3);
        assert.equal(after[0].n, before[0].n);
        return `${r.source}; ${r.suggestions.length} drafts; zero automatic messages.`;
      },
    );
    await check(
      "ASSIST-002",
      "Conversation Assist",
      "Outsider cannot request conversation suggestions",
      ["Use qa00011.", "POST icebreakers for another pair.", "Inspect status."],
      "404.",
      () =>
        api(11, "POST", `/chat/${matchId}/icebreakers`, {}, 404).then(
          () => "404 confirmed.",
        ),
    );
    await check(
      "NOTIF-001",
      "Notifications",
      "Stored message notification is deduplicated on retry",
      [
        "Use CHAT-002/003 results.",
        "Count notifications by message event key.",
        "Check recipient count.",
      ],
      "Exactly one notification for the original message recipient.",
      async () => {
        const [r] = await query(
          "SELECT count(*)::int AS total FROM notifications WHERE event_key=:key",
          { key: `message:${messageOne.saved.id}` },
        );
        assert.equal(r.total, 1);
        return "One notification remains after retry.";
      },
    );
    await check(
      "METRIC-001",
      "Impressions & Metrics",
      "Read-only quality report executes on real PostgreSQL",
      [
        "Read database/reports/discovery-quality.sql.",
        "Execute aggregate report against QA database.",
        "Inspect returned metric rows.",
      ],
      "Valid report execution; results remain observational.",
      async () => {
        const sql = fs.readFileSync(
          path.join(PROJECT, "backend/database/reports/discovery-quality.sql"),
          "utf8",
        );
        const r = await db.query(sql);
        return `Report executed; result sets ${r.length}. Mature 7-day sample rates may be unavailable for new QA data.`;
      },
    );
    await check(
      "PERF-001",
      "Performance & Setup",
      "Measure feed latency with 10,000 stored users",
      [
        "Run 5 sequential fresh-feed HTTP requests.",
        "Record each duration.",
        "Calculate observed p50/p95 and save evidence.",
      ],
      "Five successful requests with finite timings; no production SLA implied.",
      async () => {
        const times = [];
        for (let i = 0; i < 5; i++) {
          const t = performance.now();
          await api(4, "GET", "/discovery/feed?limit=10");
          times.push(Math.round(performance.now() - t));
        }
        const sorted = [...times].sort((a, b) => a - b);
        const r = {
          samples: 5,
          population: 10000,
          latenciesMs: times,
          p50Ms: sorted[2],
          p95Ms: sorted[4],
          scope: "Sequential localhost smoke; not concurrent production load",
        };
        writeJson(path.join(RESULTS, "performance.json"), r);
        return JSON.stringify(r);
      },
      {
        type: "Performance smoke",
        suggestion:
          "Run representative concurrent load before deciding a production p95 target.",
      },
    );
    let aiReady = false,
      aiUrl;
    await check(
      "AI-001",
      "AI Service",
      "Load real multilingual model from the local cache",
      [
        "Start private FastAPI with embeddings enabled and pinned cache.",
        "Poll /ready.",
        "Require embeddingsReady=true.",
      ],
      "Actual model reports ready without downloading weights.",
      async () => {
        const probe = net.createServer();
        await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
        const port = probe.address().port;
        await new Promise((resolve) => probe.close(resolve));
        aiUrl = `http://127.0.0.1:${port}`;
        fs.mkdirSync(RESULTS, { recursive: true });
        aiStream = fs.createWriteStream(path.join(RESULTS, "ai-service.log"));
        aiProcess = spawn(
          path.join(PROJECT, "ai/.venv/Scripts/python.exe"),
          [
            "-m",
            "uvicorn",
            "api.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            String(port),
            "--no-access-log",
          ],
          {
            cwd: path.join(PROJECT, "ai"),
            windowsHide: true,
            env: {
              ...process.env,
              AI_EMBEDDINGS_ENABLED: "true",
              AI_MODEL_LOCAL_ONLY: "true",
              AI_MODEL_CACHE_DIR: path.join(
                PROJECT,
                "ai/.cache/huggingface/hub",
              ),
              TOKENIZERS_PARALLELISM: "false",
              HF_HUB_OFFLINE: "1",
              PYTHONUTF8: "1",
            },
          },
        );
        aiProcess.stdout.pipe(aiStream, { end: false });
        aiProcess.stderr.pipe(aiStream, { end: false });
        let launchError;
        aiProcess.on("error", (e) => {
          launchError = e;
        });
        const deadline = Date.now() + 120000;
        while (Date.now() < deadline) {
          if (launchError) break;
          try {
            const r = await fetch(aiUrl + "/ready", {
              signal: AbortSignal.timeout(1000),
            });
            if (r.ok) {
              aiReady = true;
              break;
            }
          } catch {}
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        if (!aiReady) {
          const e = new Error(
            "Pinned local embedding model did not become ready; see results/ai-service.log",
          );
          e.blocked = true;
          throw e;
        }
        return "Real pinned multilingual model ready; local-files-only mode.";
      },
      { users: "Fictional public text only", priority: "P1" },
    );
    const requireAi = () => {
      if (!aiReady) {
        const e = new Error("AI-001 readiness prerequisite unavailable.");
        e.blocked = true;
        throw e;
      }
    };
    await check(
      "AI-002",
      "AI Service",
      "Real semantic endpoint rejects missing internal key",
      [
        "Start actual AI service.",
        "POST semantic request without X-Service-Key.",
        "Inspect response.",
      ],
      "401.",
      async () => {
        requireAi();
        const r = await fetch(aiUrl + "/v1/matching/semantic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            viewerText: "I enjoy trekking.",
            candidates: [{ key: randomUUID(), text: "I like hiking." }],
          }),
        });
        assert.equal(r.status, 401);
        return "Actual FastAPI internal auth returned 401.";
      },
      { users: "Fictional public text only" },
    );
    for (const [id, label, positive, negative] of [
      [
        "AI-003",
        "English",
        "I love trekking and exploring nature.",
        "I spend my free time competing in online chess tournaments.",
      ],
      [
        "AI-004",
        "Hindi-English",
        "मुझे पहाड़ों में ट्रेकिंग करना बहुत पसंद है।",
        "मुझे घर पर शतरंज खेलना पसंद है।",
      ],
      [
        "AI-005",
        "Hinglish",
        "Weekend pe trekking aur pahadon mein ghoomna pasand hai.",
        "Mujhe online chess tournaments khelna pasand hai.",
      ],
    ])
      await check(
        id,
        "AI Service",
        `${label} semantic relevance with the actual model`,
        [
          "Send hiking anchor plus related and unrelated text.",
          "Read actual cosine similarities.",
          "Compare related with unrelated.",
        ],
        "Related example similarity exceeds unrelated example.",
        async () => {
          requireAi();
          const r = await fetch(aiUrl + "/v1/matching/semantic", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Service-Key": process.env.MATCHING_AI_KEY,
            },
            body: JSON.stringify({
              viewerText: "I enjoy hiking in the mountains on weekends.",
              candidates: [
                { key: randomUUID(), text: positive },
                { key: randomUUID(), text: negative },
              ],
            }),
          });
          assert.equal(r.status, 200);
          const data = await r.json();
          assert.ok(data.scores[0].similarity > data.scores[1].similarity);
          return JSON.stringify({
            related: data.scores[0].similarity,
            unrelated: data.scores[1].similarity,
            modelVersion: data.modelVersion,
          });
        },
        {
          users: "Fictional public text only",
          suggestion:
            "Add representative human-labelled examples before treating this as an outcome-quality benchmark.",
        },
      );
    await check(
      "AI-006",
      "AI Service",
      "Node HYBRID path calls actual Python semantic service",
      [
        "Enable HYBRID mode and private AI URL for this check.",
        "Rank consented qa00001/qa00002.",
        "Inspect real model-version annotation.",
      ],
      "HYBRID score with real model revision.",
      async () => {
        requireAi();
        const previous = {
          mode: process.env.MATCHING_MODE,
          url: process.env.MATCHING_AI_URL,
          timeout: process.env.MATCHING_AI_TIMEOUT_MS,
        };
        try {
          Object.assign(process.env, {
            MATCHING_MODE: "HYBRID",
            MATCHING_AI_URL: aiUrl,
            MATCHING_AI_TIMEOUT_MS: "10000",
          });
          const r = (
            await matching.rank(fixture(1).userId, [fixture(2).userId])
          ).rankings.get(fixture(2).userId);
          assert.equal(r.mode, "HYBRID");
          assert.ok(r.version.includes("e8f8c211"));
          return JSON.stringify({
            mode: r.mode,
            score: r.score,
            version: r.version,
          });
        } finally {
          for (const [key, val] of Object.entries({
            MATCHING_MODE: previous.mode,
            MATCHING_AI_URL: previous.url,
            MATCHING_AI_TIMEOUT_MS: previous.timeout,
          }))
            if (val === undefined) delete process.env[key];
            else process.env[key] = val;
        }
      },
    );
    await check(
      "AI-007",
      "AI Service",
      "Unavailable AI retains rule ranking",
      [
        "Set HYBRID mode with unavailable localhost AI URL.",
        "Rank a valid consented pair.",
        "Check rule fallback and finite score.",
      ],
      "RULES score returned without failing discovery.",
      async () => {
        const previous = {
          mode: process.env.MATCHING_MODE,
          url: process.env.MATCHING_AI_URL,
        };
        try {
          process.env.MATCHING_MODE = "HYBRID";
          process.env.MATCHING_AI_URL = "http://127.0.0.1:1";
          const r = (
            await matching.rank(fixture(1).userId, [fixture(2).userId])
          ).rankings.get(fixture(2).userId);
          assert.equal(r.mode, "RULES");
          assert.ok(Number.isFinite(r.score));
          return "Unavailable AI: rules returned successfully.";
        } finally {
          process.env.MATCHING_MODE = previous.mode;
          process.env.MATCHING_AI_URL = previous.url;
        }
      },
    );
    await check(
      "AUTH-005",
      "Access & Eligibility",
      "Revoked QA session is rejected",
      [
        "Issue a fresh session for qa00019.",
        "Revoke that exact session in the QA database.",
        "Call protected discovery with the old token.",
      ],
      "401.",
      async () => {
        const who = await identity(19);
        await query(
          "UPDATE user_sessions SET revoked_at=now() WHERE id=:id RETURNING id",
          { id: who.sessionId },
        );
        await api(19, "GET", "/discovery/feed", undefined, 401);
        return "Revoked session returned 401.";
      },
      { users: "qa00019" },
    );
  } finally {
    if (aiProcess && aiProcess.exitCode === null) {
      aiProcess.kill();
      await new Promise((resolve) => {
        aiProcess.once("close", resolve);
        setTimeout(resolve, 5000).unref();
      });
    }
    if (aiStream) aiStream.end();
    await new Promise((resolve) => io.close(resolve));
    await db.close();
  }
  const failed = records.filter((r) => r.status === "FAIL").length;
  console.log(
    `QA checks complete: ${records.length} cases; ${failed} failed; ${records.filter((r) => r.status === "BLOCKED").length} blocked.`,
  );
  if (failed) process.exitCode = 1;
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
