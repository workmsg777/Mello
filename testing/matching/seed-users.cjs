// Separate, repeatable QA fixture loader. No application startup hook imports it.
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const {
  ROOT,
  PROJECT,
  CACHE,
  RESULTS,
  backendRequire,
  openDatabase,
  writeJson,
} = require("./runtime.cjs");
const { QueryTypes } = backendRequire("sequelize");
const { demoAvatar } = require(
  path.join(PROJECT, "backend/scripts/demo-avatar.cjs"),
);
const uuid = (kind, index) => {
  const hex = createHash("sha256")
    .update(`mello:qa:10000:v1:${kind}:${index}`)
    .digest("hex")
    .slice(0, 32)
    .split("");
  hex[12] = "5";
  hex[16] = "a";
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
};
const women = [
  "Anaya",
  "Meera",
  "Kavya",
  "Ishita",
  "Aditi",
  "Sana",
  "Tara",
  "Naina",
  "Diya",
  "Riya",
  "Pooja",
  "Neha",
  "Zoya",
  "Simran",
  "Ira",
  "Shruti",
];
const men = [
  "Aarav",
  "Kabir",
  "Arjun",
  "Rohan",
  "Dev",
  "Ishaan",
  "Kunal",
  "Aditya",
  "Nikhil",
  "Vihaan",
  "Aman",
  "Yash",
  "Rehan",
  "Harsh",
  "Neil",
  "Sahil",
];
const surnames = [
  "Sharma",
  "Patel",
  "Khan",
  "Singh",
  "Rao",
  "Mehta",
  "Iyer",
  "Das",
  "Verma",
  "Kapoor",
  "Bose",
  "Nair",
  "Joshi",
  "Reddy",
  "Shah",
  "Malhotra",
];
const jobs = [
  "Software engineer",
  "Product designer",
  "Teacher",
  "Architect",
  "Doctor",
  "Chef",
  "Researcher",
  "Photographer",
  "Writer",
  "Data analyst",
  "Musician",
  "Entrepreneur",
  "Marketing manager",
  "Civil engineer",
  "Lawyer",
  "Accountant",
];

async function seedUsers() {
  const started = Date.now(),
    db = openDatabase();
  const query = (sql, replacements = {}) =>
    db.query(sql, { replacements, type: QueryTypes.SELECT });
  try {
    await db.authenticate();
    await db.query(
      "CREATE TABLE IF NOT EXISTS qa_fixture_users(username text PRIMARY KEY, ordinal integer NOT NULL UNIQUE, user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, scenario text NOT NULL, seeded_at timestamptz NOT NULL DEFAULT now())",
    );
    const [before] = await query(
      "SELECT count(*)::int AS total,md5(COALESCE(string_agg(user_id::text,',' ORDER BY username),'')) AS checksum FROM qa_fixture_users",
    );
    const cities = await query(
      "SELECT id,name FROM cities WHERE is_active AND name IN ('Bengaluru','Mumbai','Delhi','Chandigarh','Pune','Hyderabad') ORDER BY name",
    );
    const interests = await query(
      "SELECT id,code,name FROM interests WHERE is_active ORDER BY code",
    );
    const languages = await query(
      "SELECT id,iso_code AS code,name FROM languages WHERE is_active ORDER BY iso_code",
    );
    const values = await query(
      'SELECT id,code,name FROM "values" WHERE is_active ORDER BY code',
    );
    const prompts = await query(
      "SELECT id FROM prompts WHERE is_active AND response_type IN ('TEXT','TEXT_OR_MEDIA') ORDER BY display_order,id LIMIT 2",
    );
    const steps = await query(
      "SELECT id,is_required FROM onboarding_steps WHERE is_active AND onboarding_version=1 ORDER BY sequence",
    );
    const options = await query(
      "SELECT opt.id,opt.code,cat.code AS category,cat.id AS category_id FROM profile_options opt JOIN profile_option_categories cat ON cat.id=opt.category_id WHERE opt.is_active AND cat.is_active",
    );
    const [role] = await query("SELECT id FROM roles WHERE code='CUSTOMER'");
    if (
      cities.length < 3 ||
      interests.length < 6 ||
      languages.length < 2 ||
      values.length < 3 ||
      !prompts.length ||
      !role
    )
      throw new Error("Catalog fixtures are incomplete");
    const city = cities.find((c) => c.name === "Bengaluru");
    const option = (category, code) => {
      const item = options.find(
        (o) => o.category === category && o.code === code,
      );
      if (!item) throw new Error(`Missing option ${category}/${code}`);
      return item;
    };
    const english =
      languages.find((l) => /^(en|eng|english)$/i.test(l.code)) ||
      languages.find((l) => /english/i.test(l.name));
    const hindi = languages.find((l) => /hindi/i.test(l.name));
    const now = new Date().toISOString();
    const previous = new Date(Date.now() - 86400000).toISOString();
    const base = (kind, index) => ({
      id: uuid(kind, index),
      created_at: now,
      updated_at: now,
    });
    const assets = [];
    const photoDir = path.join(CACHE, "uploads/profile-photos");
    fs.mkdirSync(photoDir, { recursive: true });
    for (const gender of ["MAN", "WOMAN", "NON_BINARY"])
      for (let p = 0; p < 3; p++) {
        const filename = `qa-avatar-${gender.toLowerCase()}-${p}.png`,
          bytes = demoAvatar(p, p, gender);
        fs.writeFileSync(path.join(photoDir, filename), bytes);
        assets.push({
          ...base(`shared-media-${gender}`, p),
          uploaded_by_account_id: null,
          storage_provider: "LOCAL",
          storage_key: `profile-photos/${filename}`,
          url: `/uploads/profile-photos/${filename}`,
          media_type: "IMAGE",
          mime_type: "image/png",
          size_bytes: bytes.length,
          width: 360,
          height: 480,
          deleted_at: null,
        });
      }
    const insert = async (table, records, transaction) => {
      if (!records.length) return;
      const fields = Object.keys(records[0]),
        cols = fields.map((f) => `"${f}"`).join(",");
      await db.query(
        `INSERT INTO "${table}" (${cols}) SELECT ${cols} FROM jsonb_populate_recordset(NULL::"${table}",CAST(:records AS jsonb)) ON CONFLICT DO NOTHING`,
        { replacements: { records: JSON.stringify(records) }, transaction },
      );
    };
    await insert("media", assets);
    const manifest = [];
    for (let start = 1; start <= 10000; start += 250) {
      const batches = {};
      const add = (table, row) => (batches[table] ??= []).push(row);
      for (let n = start; n < Math.min(start + 250, 10001); n++) {
        const username = `qa${String(n).padStart(5, "0")}`,
          userId = uuid("user", n),
          accountId = uuid("account", n);
        const pair = Math.floor((n - 1) / 2),
          special = n <= 20;
        let gender = n % 25 === 0 ? "NON_BINARY" : n % 2 ? "WOMAN" : "MAN";
        let seeking =
          gender === "WOMAN"
            ? "MAN"
            : gender === "MAN"
              ? "WOMAN"
              : "NON_BINARY";
        if (!special && pair % 12 === 0 && gender !== "NON_BINARY")
          seeking = gender;
        const targetCity = special ? city : cities[pair % cities.length];
        const age = special ? 27 : 21 + (pair % 30);
        const dob = new Date(Date.UTC(new Date().getUTCFullYear() - age, 0, 15))
          .toISOString()
          .slice(0, 10);
        const displayName = `${(gender === "WOMAN" ? women : men)[pair % 16]} ${surnames[Math.floor(pair / 16) % 16]} QA ${String(n).padStart(5, "0")}`;
        const interestOffset = special ? 0 : (pair * 3) % interests.length;
        const selectedInterests = Array.from(
          { length: 4 },
          (_, i) => interests[(interestOffset + i) % interests.length],
        );
        const selectedValues = [
          values[pair % values.length],
          values[(pair + 2) % values.length],
        ];
        const spoken = [
          english,
          hindi || languages[(pair + 1) % languages.length],
        ].filter((l, i, a) => l && a.findIndex((x) => x?.id === l.id) === i);
        const intention =
          pair % 7 === 0 && !special
            ? "SERIOUS_DATING"
            : "LONG_TERM_RELATIONSHIP";
        let scenario = "ACTIVE_PROFILE",
          status = "ACTIVE",
          onboarding = "COMPLETED",
          photoCount = 3,
          verified = false;
        if (n > 9800) {
          switch ((n - 9801) % 4) {
            case 0:
              scenario = "INCOMPLETE_ONBOARDING";
              onboarding = "IN_PROGRESS";
              break;
            case 1:
              scenario = "SUSPENDED_ACCOUNT";
              status = "SUSPENDED";
              break;
            case 2:
              scenario = "INSUFFICIENT_PHOTOS";
              photoCount = 1;
              break;
            case 3:
              scenario = "VERIFIED_ONLY_EMPTY";
              verified = true;
              break;
          }
        }
        if (n === 5) {
          scenario = "SUSPENDED_ACCOUNT";
          status = "SUSPENDED";
        }
        if (n === 6) {
          scenario = "INCOMPLETE_ONBOARDING";
          onboarding = "IN_PROGRESS";
        }
        if (n === 10) {
          scenario = "INSUFFICIENT_PHOTOS";
          photoCount = 1;
        }
        if (n === 13) {
          scenario = "VERIFIED_ONLY_EMPTY";
          verified = true;
        }
        const consent =
          n === 7
            ? "MISSING"
            : n === 8
              ? "REVOKED"
              : special
                ? "GRANTED"
                : n % 10 < 8
                  ? "GRANTED"
                  : n % 10 === 8
                    ? "REVOKED"
                    : "MISSING";
        const privateInterests = n === 12 || (!special && n % 37 === 0);
        const bio =
          pair % 3 === 0
            ? `Fictional QA profile. I enjoy ${selectedInterests.map((i) => i.name.toLowerCase()).join(", ")}. Looking for thoughtful conversations and a long-term connection.`
            : pair % 3 === 1
              ? `Fictional QA profile. मुझे ${selectedInterests[0].name} और नई जगहों पर घूमना पसंद है। मैं ईमानदार और सहज बातचीत चाहता/चाहती हूँ।`
              : `Fictional QA profile. Weekend pe ${selectedInterests[0].name} aur ${selectedInterests[1].name} pasand hai. Looking for kindness, hasi mazak aur meaningful conversations.`;
        add("accounts", {
          ...base("account", n),
          account_type: "DATING_USER",
          status,
          deleted_at: null,
        });
        add("users", {
          ...base("user", n),
          account_id: accountId,
          deleted_at: null,
        });
        add("account_roles", {
          ...base("account-role", n),
          account_id: accountId,
          role_id: role.id,
        });
        // example.test is a fictional identifier. This does not enable a new login endpoint.
        add("auth_identities", {
          ...base("identity", n),
          account_id: accountId,
          provider: "EMAIL",
          identifier: `${username}@example.test`,
          password_hash: null,
          is_primary: true,
          verified_at: null,
          deleted_at: null,
        });
        add("user_profiles", {
          ...base("profile", n),
          user_id: userId,
          display_name: displayName,
          date_of_birth: dob,
          bio,
          job_title: jobs[pair % jobs.length],
          height_cm: 155 + (n % 35),
          current_city_id: targetCity.id,
          profile_status: "ACTIVE",
          bio_moderation_status: "APPROVED",
          deleted_at: null,
        });
        add("user_match_preferences", {
          ...base("preferences", n),
          user_id: userId,
          min_age: special ? 18 : Math.max(18, age - 7),
          max_age: special ? 65 : Math.min(65, age + 8),
          max_distance_km: 100,
          age_is_dealbreaker: true,
          distance_is_dealbreaker: !special && n % 9 === 0,
          verified_profiles_only: verified,
          prefer_same_city: true,
        });
        const orientation =
          gender === "NON_BINARY"
            ? "BISEXUAL"
            : seeking === gender
              ? gender === "MAN"
                ? "GAY"
                : "LESBIAN"
              : "STRAIGHT";
        const selections = [
          ["GENDER_IDENTITY", gender],
          [
            "PRONOUN",
            gender === "WOMAN"
              ? "SHE_HER"
              : gender === "MAN"
                ? "HE_HIM"
                : "THEY_THEM",
          ],
          ["SEXUAL_ORIENTATION", orientation],
          ["DATING_INTENTION", intention],
          [
            "FAMILY_PLAN",
            pair % 2 ? "WANTS_CHILDREN" : "DOES_NOT_WANT_CHILDREN",
          ],
        ];
        for (const [cat, code] of selections) {
          const choice = option(cat, code);
          add("user_profile_options", {
            ...base(`selection-${cat}`, n),
            user_id: userId,
            category_id: choice.category_id,
            option_id: choice.id,
            is_primary: true,
            display_order: 0,
          });
          add("user_profile_visibility", {
            ...base(`visibility-${cat}`, n),
            user_id: userId,
            field_code: cat,
            visibility:
              cat === "SEXUAL_ORIENTATION" ? "MATCHING_ONLY" : "PROFILE",
          });
        }
        for (const field of [
          "BIO",
          "PROMPTS",
          "VALUES",
          "LANGUAGES",
          "INTERESTS",
        ])
          add("user_profile_visibility", {
            ...base(`visibility-${field}`, n),
            user_id: userId,
            field_code: field,
            visibility:
              field === "INTERESTS" && privateInterests ? "PRIVATE" : "PROFILE",
          });
        const genderPreference = option("GENDER_IDENTITY", seeking),
          intentionPreference = option("DATING_INTENTION", intention);
        for (const [choice, hard] of [
          [genderPreference, true],
          [intentionPreference, false],
        ])
          add("user_profile_option_preferences", {
            ...base(`wanted-${choice.category}`, n),
            user_id: userId,
            category_id: choice.category_id,
            option_id: choice.id,
            priority: 3,
            is_dealbreaker: hard,
          });
        for (const [i, item] of selectedInterests.entries())
          add("user_interests", {
            ...base(`interest-${i}`, n),
            user_id: userId,
            interest_id: item.id,
            is_favorite: i === 0,
            display_order: i,
            source: "SELF_SELECTED",
          });
        for (const [i, item] of spoken.entries()) {
          add("user_languages", {
            ...base(`language-${i}`, n),
            user_id: userId,
            language_id: item.id,
            proficiency: i === 0 ? "FLUENT" : "NATIVE",
            is_primary: i === 0,
            display_order: i,
          });
          add("user_language_preferences", {
            ...base(`wanted-language-${i}`, n),
            user_id: userId,
            language_id: item.id,
            is_dealbreaker: false,
            priority: i === 0 ? 3 : 5,
          });
        }
        for (const [i, item] of selectedValues.entries()) {
          add("user_values", {
            ...base(`value-${i}`, n),
            user_id: userId,
            value_id: item.id,
            importance: 4,
            display_order: i,
          });
          add("user_partner_value_preferences", {
            ...base(`wanted-value-${i}`, n),
            user_id: userId,
            value_id: item.id,
            importance: 4,
            is_dealbreaker: false,
          });
        }
        for (const [i, item] of prompts.entries())
          add("user_prompt_answers", {
            ...base(`prompt-${i}`, n),
            user_id: userId,
            prompt_id: item.id,
            answer_text:
              i === 0
                ? `A weekend with ${selectedInterests[0].name.toLowerCase()}, good food and unhurried conversation.`
                : `I would show you a favourite cafe in ${targetCity.name}.`,
            display_order: i,
            moderation_status: "APPROVED",
            is_active: true,
            deleted_at: null,
          });
        for (let p = 0; p < photoCount; p++)
          add("user_photos", {
            ...base(`photo-${p}`, n),
            user_id: userId,
            media_id: uuid(`shared-media-${gender}`, p),
            display_order: p,
            is_primary: p === 0,
            moderation_status: "APPROVED",
            deleted_at: null,
          });
        add("user_onboarding_progress", {
          ...base("progress", n),
          user_id: userId,
          onboarding_version: 1,
          status: onboarding,
          current_step_id: onboarding === "COMPLETED" ? null : steps[0].id,
          started_at: previous,
          completed_at: onboarding === "COMPLETED" ? now : null,
        });
        if (onboarding === "COMPLETED")
          for (const step of steps)
            add("user_onboarding_step_progress", {
              ...base(`step-${step.id}`, n),
              user_id: userId,
              onboarding_step_id: step.id,
              status: step.is_required ? "COMPLETED" : "SKIPPED",
              started_at: previous,
              completed_at: step.is_required ? now : null,
              skipped_at: step.is_required ? null : now,
            });
        for (const code of [
          "TERMS",
          "PRIVACY_POLICY",
          ...(consent === "MISSING" ? [] : ["PERSONALIZED_MATCHING"]),
        ]) {
          add("user_consents", {
            ...base(`consent-${code}`, n),
            user_id: userId,
            consent_code: code,
            policy_version: "1.0",
            status: "GRANTED",
            granted_at: previous,
            revoked_at: null,
          });
          if (code === "PERSONALIZED_MATCHING" && consent === "REVOKED")
            add("user_consents", {
              ...base("consent-personalization-revoked", n),
              user_id: userId,
              consent_code: code,
              policy_version: "1.0",
              status: "REVOKED",
              granted_at: null,
              revoked_at: now,
            });
        }
        add("qa_fixture_users", {
          username,
          ordinal: n,
          user_id: userId,
          scenario,
          seeded_at: now,
        });
        manifest.push({
          username,
          userId,
          accountId,
          displayName,
          gender,
          seeking,
          age,
          city: targetCity.name,
          job: jobs[pair % jobs.length],
          interests: selectedInterests.map((i) => i.name),
          languages: spoken.map((i) => i.name),
          values: selectedValues.map((i) => i.name),
          intention,
          minAge: special ? 18 : Math.max(18, age - 7),
          maxAge: special ? 65 : Math.min(65, age + 8),
          maxDistanceKm: 100,
          distanceIsDealbreaker: !special && n % 9 === 0,
          consent,
          privateInterests,
          status,
          onboarding,
          photoCount,
          scenario,
          bio,
          identifier: `${username}@example.test`,
        });
      }
      await db.transaction(async (transaction) => {
        for (const [table, records] of Object.entries(batches))
          await insert(table, records, transaction);
      });
      if (start === 1 || (start + 249) % 1000 === 0)
        console.log(
          `Seeded/verified ${Math.min(start + 249, 10000)} / 10000 QA users`,
        );
    }
    await db.query("ANALYZE");
    const [counts] = await query(
      "SELECT count(*)::int AS total,count(DISTINCT user_id)::int AS distinct_users FROM qa_fixture_users",
    );
    if (counts.total !== 10000 || counts.distinct_users !== 10000)
      throw new Error("QA roster count mismatch");
    writeJson(path.join(CACHE, "users.json"), manifest);
    const [after] = await query(
      "SELECT md5(string_agg(user_id::text,',' ORDER BY username)) AS checksum FROM qa_fixture_users",
    );
    const report = {
      count: counts.total,
      distinctUsers: counts.distinct_users,
      seededAt: new Date().toISOString(),
      elapsedMs: Date.now() - started,
      database: "mello_qa_10000",
      synthetic: true,
      namespace: "mello:qa:10000:v1",
      previousCount: before.total,
      idempotencyVerified:
        before.total === 10000 && before.checksum === after.checksum,
      cohorts: await query(
        "SELECT scenario,count(*)::int AS total FROM qa_fixture_users GROUP BY scenario ORDER BY scenario",
      ),
    };
    writeJson(path.join(RESULTS, "seed.json"), report);
    console.log(JSON.stringify(report));
    return report;
  } finally {
    await db.close();
  }
}
if (require.main === module)
  seedUsers().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
module.exports = { seedUsers, uuid };
