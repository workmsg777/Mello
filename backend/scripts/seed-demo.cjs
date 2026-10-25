const { createHash } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { QueryTypes, Sequelize } = require('sequelize');
const { demoAvatar } = require('./demo-avatar.cjs');

const women = [
  'Anaya',
  'Ishita',
  'Meera',
  'Kavya',
  'Riya',
  'Tara',
  'Diya',
  'Sana',
  'Naina',
  'Aditi',
];
const men = [
  'Aarav',
  'Rohan',
  'Kabir',
  'Arjun',
  'Vivaan',
  'Ishaan',
  'Dev',
  'Kunal',
  'Aditya',
  'Nikhil',
];
const gayMen = ['Reyansh', 'Neil'];
const jobs = [
  'Architect',
  'Product designer',
  'Writer',
  'Software engineer',
  'Photographer',
  'Chef',
  'Researcher',
  'Entrepreneur',
  'Teacher',
  'Illustrator',
  'Musician',
];
const stories = [
  'Coffee, bookstores, and finding a new favourite corner of the city.',
  'A long walk, a good playlist, and someone kind to share them with.',
  'Weekend adventures and a very serious love for great food.',
  'Making things, collecting stories, and laughing at little surprises.',
  'Looking for warm conversations and a thoughtful connection.',
];
const DEMO_PROFILES = [
  ...women.map((name) => ({
    name,
    gender: 'WOMAN',
    orientation: 'STRAIGHT',
    seeking: 'MAN',
  })),
  ...men.map((name) => ({
    name,
    gender: 'MAN',
    orientation: 'STRAIGHT',
    seeking: 'WOMAN',
  })),
  ...gayMen.map((name) => ({
    name,
    gender: 'MAN',
    orientation: 'GAY',
    seeking: 'MAN',
  })),
];
function stableId(type, name) {
  const hex = createHash('sha256')
    .update(`mello:demo:v1:${type}:${name}`)
    .digest('hex')
    .slice(0, 32)
    .split('');
  hex[12] = '5';
  hex[16] = 'a';
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`;
}

async function seedDemoData(db, options = {}) {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Demo data is disabled in production');
  const directory = path.resolve(
    options.uploadDirectory ||
      path.join(process.cwd(), 'uploads/profile-photos'),
  );
  const select = (sql, replacements = {}, transaction) =>
    db.query(sql, {
      replacements,
      type: QueryTypes.SELECT,
      ...(transaction ? { transaction } : {}),
    });
  const [city] = await select(
    'SELECT id,name FROM cities WHERE is_active=true AND lower(name)=lower(:name) LIMIT 1',
    { name: options.city || 'Chandigarh' },
  );
  if (!city)
    throw new Error(
      'Demo city is missing from the catalog. Run the normal catalog seed first.',
    );
  const [role] = await select("SELECT id FROM roles WHERE code='CUSTOMER'");
  const categories = await select(
    'SELECT id,code FROM profile_option_categories WHERE is_active',
  );
  const choices = await select(
    'SELECT o.id,o.code,c.code AS category FROM profile_options o JOIN profile_option_categories c ON c.id=o.category_id WHERE o.is_active AND c.is_active',
  );
  const interests = await select(
    'SELECT id FROM interests WHERE is_active ORDER BY display_order,id LIMIT 30',
  );
  const steps = await select(
    'SELECT id,is_required FROM onboarding_steps WHERE is_active AND onboarding_version=1 ORDER BY sequence',
  );
  const prompts = await select(
    "SELECT id FROM prompts WHERE is_active AND response_type IN ('TEXT','TEXT_OR_MEDIA') ORDER BY display_order,id LIMIT 1",
  );
  if (!role || interests.length < 3 || !steps.length)
    throw new Error('Required demo catalogs have not been seeded');
  const categoryId = (code) => {
    const value = categories.find((c) => c.code === code);
    if (!value) throw new Error(`Missing category ${code}`);
    return value.id;
  };
  const optionId = (category, code) => {
    const value = choices.find(
      (c) => c.category === category && c.code === code,
    );
    if (!value) throw new Error(`Missing option ${category}/${code}`);
    return value.id;
  };
  const fixtureIds = DEMO_PROFILES.map((p) => stableId('user', p.name));
  await fs.mkdir(directory, { recursive: true });
  const photoFiles = [];
  await db.transaction(async (transaction) => {
    const upsert = async (table, values) => {
      const fields = Object.keys(values),
        placeholders = fields.map((_, i) => `:v${i}`),
        replacements = Object.fromEntries(
          fields.map((field, i) => [`v${i}`, values[field]]),
        );
      await select(
        `INSERT INTO "${table}" (${fields.map((f) => `"${f}"`).join(',')}) VALUES (${placeholders.join(',')}) ON CONFLICT (id) DO UPDATE SET ${fields
          .filter((f) => f !== 'id' && f !== 'created_at')
          .map((f) => `"${f}"=EXCLUDED."${f}"`)
          .join(',')} RETURNING id`,
        replacements,
        transaction,
      );
    };
    const now = new Date();
    for (const [index, person] of DEMO_PROFILES.entries()) {
      const userId = fixtureIds[index],
        accountId = stableId('account', person.name);
      const base = (type) => ({
        id: stableId(type, person.name),
        created_at: now,
        updated_at: now,
      });
      await upsert('accounts', {
        ...base('account'),
        account_type: 'DATING_USER',
        status: 'ACTIVE',
        deleted_at: null,
      });
      await upsert('users', {
        ...base('user'),
        account_id: accountId,
        deleted_at: null,
      });
      // These fictional profiles intentionally have no phone identities: seeding never sends SMS.
      await upsert('account_roles', {
        ...base('account-role'),
        account_id: accountId,
        role_id: role.id,
      });
      await upsert('user_profiles', {
        ...base('profile'),
        user_id: userId,
        display_name: `${person.name} · Demo`,
        date_of_birth: `${1994 + (index % 9)}-${String(1 + (index % 12)).padStart(2, '0')}-15`,
        bio: `Fictional adult test profile. ${stories[index % stories.length]}`,
        job_title: jobs[index % jobs.length],
        height_cm: 158 + (index % 28),
        current_city_id: city.id,
        profile_status: 'ACTIVE',
        bio_moderation_status: 'APPROVED',
        deleted_at: null,
      });
      await upsert('user_match_preferences', {
        ...base('match-preferences'),
        user_id: userId,
        min_age: 18,
        max_age: 65,
        max_distance_km: 100,
        age_is_dealbreaker: true,
        distance_is_dealbreaker: false,
        verified_profiles_only: false,
        prefer_same_city: true,
      });
      for (const [code, value] of [
        ['GENDER_IDENTITY', person.gender],
        ['SEXUAL_ORIENTATION', person.orientation],
        ['DATING_INTENTION', 'LONG_TERM_RELATIONSHIP'],
        ['PRONOUN', person.gender === 'WOMAN' ? 'SHE_HER' : 'HE_HIM'],
      ]) {
        await upsert('user_profile_options', {
          ...base(`option:${code}`),
          user_id: userId,
          category_id: categoryId(code),
          option_id: optionId(code, value),
          is_primary: true,
          display_order: 0,
        });
        await upsert('user_profile_visibility', {
          ...base(`visibility:${code}`),
          user_id: userId,
          field_code: code,
          visibility:
            code === 'SEXUAL_ORIENTATION' ? 'MATCHING_ONLY' : 'PROFILE',
        });
      }
      await upsert('user_profile_option_preferences', {
        ...base('gender-preference'),
        user_id: userId,
        category_id: categoryId('GENDER_IDENTITY'),
        option_id: optionId('GENDER_IDENTITY', person.seeking),
        priority: 3,
        is_dealbreaker: true,
      });
      for (let offset = 0; offset < 4; offset++)
        await upsert('user_interests', {
          ...base(`interest:${offset}`),
          user_id: userId,
          interest_id: interests[(index + offset) % interests.length].id,
          is_favorite: offset === 0,
          display_order: offset,
          source: 'SELF_SELECTED',
        });
      if (prompts[0])
        await upsert('user_prompt_answers', {
          ...base('prompt-answer'),
          user_id: userId,
          prompt_id: prompts[0].id,
          answer_text: stories[(index + 1) % stories.length],
          display_order: 0,
          moderation_status: 'APPROVED',
          deleted_at: null,
        });
      for (let photo = 0; photo < 3; photo++) {
        const filename = `demo-${stableId('photo-file', person.name)}-${photo}.png`,
          bytes = demoAvatar(index, photo, person.gender);
        await fs.writeFile(path.join(directory, filename), bytes);
        photoFiles.push(filename);
        const mediaId = stableId(`media:${photo}`, person.name);
        await upsert('media', {
          ...base(`media:${photo}`),
          uploaded_by_account_id: accountId,
          storage_provider: 'LOCAL',
          storage_key: `profile-photos/${filename}`,
          url: `/uploads/profile-photos/${filename}`,
          media_type: 'IMAGE',
          mime_type: 'image/png',
          size_bytes: bytes.length,
          width: 360,
          height: 480,
          deleted_at: null,
        });
        await upsert('user_photos', {
          ...base(`photo:${photo}`),
          user_id: userId,
          media_id: mediaId,
          display_order: photo,
          is_primary: photo === 0,
          moderation_status: 'APPROVED',
          deleted_at: null,
        });
      }
      await upsert('user_onboarding_progress', {
        ...base('progress'),
        user_id: userId,
        onboarding_version: 1,
        status: 'COMPLETED',
        current_step_id: null,
        started_at: now,
        completed_at: now,
      });
      for (const step of steps)
        await upsert('user_onboarding_step_progress', {
          ...base(`step:${step.id}`),
          user_id: userId,
          onboarding_step_id: step.id,
          status: step.is_required ? 'COMPLETED' : 'SKIPPED',
          started_at: now,
          completed_at: step.is_required ? now : null,
          skipped_at: step.is_required ? null : now,
        });
      for (const code of ['TERMS', 'PRIVACY_POLICY'])
        await upsert('user_consents', {
          ...base(`consent:${code}`),
          user_id: userId,
          consent_code: code,
          policy_version: process.env.CONSENT_POLICY_VERSION || '1.0',
          status: 'GRANTED',
          granted_at: now,
          revoked_at: null,
        });
    }
  });
  // Demo profiles never manufacture incoming likes or consent to a match.
  return {
    total: 22,
    women: 10,
    men: 10,
    additionalGayMen: 2,
    city: city.name,
    photos: photoFiles.length,
    likesCreated: 0,
    photoFiles,
    userIds: fixtureIds,
  };
}

async function main() {
  require('dotenv').config({ quiet: true });
  const config =
    require('../database/config')[process.env.NODE_ENV || 'development'];
  const db = config.use_env_variable
    ? new Sequelize(process.env[config.use_env_variable], config)
    : new Sequelize(config.database, config.username, config.password, config);
  try {
    const cityIndex = process.argv.indexOf('--city');
    const result = await seedDemoData(db, {
      city: cityIndex >= 0 ? process.argv[cityIndex + 1] : undefined,
    });
    const { photoFiles, userIds, ...summary } = result;
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await db.close();
  }
}
if (require.main === module)
  main().catch((error) => {
    console.error('Demo seed failed:', error.message);
    process.exitCode = 1;
  });
module.exports = { seedDemoData, DEMO_PROFILES, stableId };
