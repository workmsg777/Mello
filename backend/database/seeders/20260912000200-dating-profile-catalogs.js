'use strict';

const { createHash } = require('node:crypto');
const { Op } = require('sequelize');

function stableUuid(namespace, code) {
  const hex = createHash('sha256')
    .update(`mello:${namespace}:${code}`)
    .digest('hex')
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}

const categoryDefinitions = [
  [
    'GENDER_IDENTITY',
    'Gender identity',
    'MULTIPLE',
    1,
    null,
    true,
    true,
    true,
    false,
    true,
    10,
  ],
  [
    'PRONOUN',
    'Pronouns',
    'MULTIPLE',
    0,
    null,
    false,
    true,
    false,
    false,
    false,
    20,
  ],
  [
    'SEXUAL_ORIENTATION',
    'Sexual orientation',
    'MULTIPLE',
    0,
    null,
    true,
    true,
    false,
    false,
    false,
    30,
  ],
  [
    'DATING_INTENTION',
    'Dating intentions',
    'MULTIPLE',
    1,
    2,
    false,
    true,
    true,
    false,
    true,
    40,
  ],
  [
    'RELATIONSHIP_STYLE',
    'Relationship style',
    'SINGLE',
    0,
    1,
    false,
    true,
    true,
    true,
    false,
    50,
  ],
  ['RELIGION', 'Religion', 'SINGLE', 0, 1, true, true, true, true, false, 60],
  [
    'EDUCATION_LEVEL',
    'Education level',
    'SINGLE',
    0,
    1,
    false,
    true,
    true,
    false,
    false,
    70,
  ],
  [
    'CHILDREN_STATUS',
    'Children status',
    'SINGLE',
    0,
    1,
    true,
    true,
    true,
    true,
    false,
    80,
  ],
  [
    'FAMILY_PLAN',
    'Family plans',
    'SINGLE',
    0,
    1,
    true,
    true,
    true,
    true,
    false,
    90,
  ],
  ['DRINKING', 'Drinking', 'SINGLE', 0, 1, false, true, true, true, false, 100],
  ['SMOKING', 'Smoking', 'SINGLE', 0, 1, false, true, true, true, false, 110],
  [
    'EXERCISE',
    'Exercise',
    'SINGLE',
    0,
    1,
    false,
    true,
    true,
    false,
    false,
    120,
  ],
  ['DIET', 'Diet', 'MULTIPLE', 0, null, false, true, true, false, false, 130],
  ['PETS', 'Pets', 'MULTIPLE', 0, null, false, true, true, false, false, 140],
];

const profileOptionDefinitions = [
  ['GENDER_IDENTITY', 'MAN', 'Man'],
  ['GENDER_IDENTITY', 'WOMAN', 'Woman'],
  ['GENDER_IDENTITY', 'NON_BINARY', 'Non-binary'],
  ['PRONOUN', 'HE_HIM', 'He/him'],
  ['PRONOUN', 'SHE_HER', 'She/her'],
  ['PRONOUN', 'THEY_THEM', 'They/them'],
  ['SEXUAL_ORIENTATION', 'STRAIGHT', 'Straight'],
  ['SEXUAL_ORIENTATION', 'GAY', 'Gay'],
  ['SEXUAL_ORIENTATION', 'LESBIAN', 'Lesbian'],
  ['SEXUAL_ORIENTATION', 'BISEXUAL', 'Bisexual'],
  ['DATING_INTENTION', 'LIFE_PARTNER', 'Life partner'],
  ['DATING_INTENTION', 'LONG_TERM_RELATIONSHIP', 'Long-term relationship'],
  ['DATING_INTENTION', 'SERIOUS_DATING', 'Serious dating'],
  ['DATING_INTENTION', 'CASUAL_DATING', 'Casual dating'],
  ['DATING_INTENTION', 'FRIENDSHIP', 'Friendship'],
  ['DATING_INTENTION', 'FIGURING_IT_OUT', 'Figuring it out'],
  ['RELATIONSHIP_STYLE', 'MONOGAMOUS', 'Monogamous'],
  ['RELATIONSHIP_STYLE', 'NON_MONOGAMOUS', 'Non-monogamous'],
  ['RELIGION', 'HINDU', 'Hindu'],
  ['RELIGION', 'MUSLIM', 'Muslim'],
  ['RELIGION', 'CHRISTIAN', 'Christian'],
  ['RELIGION', 'SIKH', 'Sikh'],
  ['RELIGION', 'BUDDHIST', 'Buddhist'],
  ['RELIGION', 'JAIN', 'Jain'],
  ['RELIGION', 'SPIRITUAL', 'Spiritual'],
  ['RELIGION', 'ATHEIST', 'Atheist'],
  ['RELIGION', 'OTHER', 'Other'],
  ['EDUCATION_LEVEL', 'HIGH_SCHOOL', 'High school'],
  ['EDUCATION_LEVEL', 'BACHELORS', "Bachelor's"],
  ['EDUCATION_LEVEL', 'MASTERS', "Master's"],
  ['EDUCATION_LEVEL', 'DOCTORATE', 'Doctorate'],
  ['CHILDREN_STATUS', 'NO_CHILDREN', 'No children'],
  ['CHILDREN_STATUS', 'HAS_CHILDREN', 'Has children'],
  ['FAMILY_PLAN', 'WANTS_CHILDREN', 'Wants children'],
  ['FAMILY_PLAN', 'DOES_NOT_WANT_CHILDREN', 'Does not want children'],
  ['FAMILY_PLAN', 'OPEN_TO_CHILDREN', 'Open to children'],
  ['DRINKING', 'NEVER', 'Never'],
  ['DRINKING', 'SOCIALLY', 'Socially'],
  ['DRINKING', 'REGULARLY', 'Regularly'],
  ['SMOKING', 'NEVER', 'Never'],
  ['SMOKING', 'OCCASIONALLY', 'Occasionally'],
  ['SMOKING', 'REGULARLY', 'Regularly'],
  ['EXERCISE', 'OFTEN', 'Often'],
  ['EXERCISE', 'SOMETIMES', 'Sometimes'],
  ['EXERCISE', 'RARELY', 'Rarely'],
  ['DIET', 'VEGETARIAN', 'Vegetarian'],
  ['DIET', 'VEGAN', 'Vegan'],
  ['DIET', 'NON_VEGETARIAN', 'Non-vegetarian'],
  ['PETS', 'DOGS', 'Dogs'],
  ['PETS', 'CATS', 'Cats'],
  ['PETS', 'NO_PETS', 'No pets'],
];

const languages = [
  ['en', 'English', 'English'],
  ['hi', 'Hindi', 'हिन्दी'],
  ['pa', 'Punjabi', 'ਪੰਜਾਬੀ'],
  ['ta', 'Tamil', 'தமிழ்'],
  ['te', 'Telugu', 'తెలుగు'],
  ['ml', 'Malayalam', 'മലയാളം'],
  ['kn', 'Kannada', 'ಕನ್ನಡ'],
  ['mr', 'Marathi', 'मराठी'],
  ['bn', 'Bengali', 'বাংলা'],
  ['gu', 'Gujarati', 'ગુજરાતી'],
];

const cities = [
  ['Chandigarh', 'Chandigarh', 'CH', 'TIER_2', 'Asia/Kolkata'],
  ['Delhi', 'Delhi', 'DL', 'TIER_1', 'Asia/Kolkata'],
  ['Mumbai', 'Maharashtra', 'MH', 'TIER_1', 'Asia/Kolkata'],
  ['Bengaluru', 'Karnataka', 'KA', 'TIER_1', 'Asia/Kolkata'],
  ['Hyderabad', 'Telangana', 'TS', 'TIER_1', 'Asia/Kolkata'],
  ['Chennai', 'Tamil Nadu', 'TN', 'TIER_1', 'Asia/Kolkata'],
  ['Kolkata', 'West Bengal', 'WB', 'TIER_1', 'Asia/Kolkata'],
  ['Pune', 'Maharashtra', 'MH', 'TIER_1', 'Asia/Kolkata'],
  ['Jaipur', 'Rajasthan', 'RJ', 'TIER_2', 'Asia/Kolkata'],
  ['Lucknow', 'Uttar Pradesh', 'UP', 'TIER_2', 'Asia/Kolkata'],
  ['Indore', 'Madhya Pradesh', 'MP', 'TIER_2', 'Asia/Kolkata'],
  ['Kochi', 'Kerala', 'KL', 'TIER_2', 'Asia/Kolkata'],
  ['Ludhiana', 'Punjab', 'PB', 'TIER_2', 'Asia/Kolkata'],
  ['Dehradun', 'Uttarakhand', 'UK', 'TIER_2', 'Asia/Kolkata'],
  ['Mysuru', 'Karnataka', 'KA', 'TIER_2', 'Asia/Kolkata'],
];

const interestCategories = [
  'MUSIC',
  'MOVIES_TV',
  'SPORTS_FITNESS',
  'FOOD_DRINK',
  'TRAVEL',
  'BOOKS_READING',
  'GAMING',
  'OUTDOORS',
  'ART_CREATIVITY',
  'SOCIAL_LIFE',
  'PETS_ANIMALS',
  'WELLNESS',
  'TECHNOLOGY',
  'LOCAL_CULTURE',
  'OTHER',
];

const interests = [
  ['SPORTS_FITNESS', 'GYM', 'Gym'],
  ['SPORTS_FITNESS', 'CRICKET', 'Cricket'],
  ['FOOD_DRINK', 'COOKING', 'Cooking'],
  ['FOOD_DRINK', 'CAFE_HOPPING', 'Cafe hopping'],
  ['MOVIES_TV', 'BOLLYWOOD', 'Bollywood'],
  ['MOVIES_TV', 'ANIME', 'Anime'],
  ['ART_CREATIVITY', 'PHOTOGRAPHY', 'Photography'],
  ['OUTDOORS', 'TREKKING', 'Trekking'],
  ['TRAVEL', 'ROAD_TRIPS', 'Road trips'],
  ['MUSIC', 'LIVE_MUSIC', 'Live music'],
  ['BOOKS_READING', 'READING', 'Reading'],
  ['GAMING', 'GAMING', 'Gaming'],
  ['LOCAL_CULTURE', 'LOCAL_FESTIVALS', 'Local festivals'],
];

const promptCategories = [
  'PERSONALITY',
  'VALUES',
  'FUN',
  'LIFESTYLE',
  'DATING',
  'CONVERSATION',
  'LOCAL_CULTURE',
  'FIRST_DATE',
];
const prompts = [
  [
    'CONVERSATION',
    'STORY_I_LOVE_TELLING',
    'A story I never get tired of telling is…',
  ],
  [
    'LOCAL_CULTURE',
    'MY_CITY_SPOT',
    'A place in my city I would happily show you is…',
  ],
  [
    'FIRST_DATE',
    'EASY_FIRST_DATE',
    'My idea of an easy, no-pressure first date is…',
  ],
  [
    'VALUES',
    'SMALL_ACT_OF_KINDNESS',
    'A small act of kindness that stayed with me was…',
  ],
  [
    'FUN',
    'INSTANT_GOOD_MOOD',
    'Something that puts me in a good mood instantly is…',
  ],
  [
    'PERSONALITY',
    'FRIENDS_COUNT_ON_ME',
    'My friends know they can count on me for…',
  ],
];

const values = [
  'FAMILY',
  'AMBITION',
  'KINDNESS',
  'FITNESS',
  'ADVENTURE',
  'STABILITY',
  'CREATIVITY',
  'CAREER',
  'PERSONAL_GROWTH',
  'COMMUNICATION',
  'TRAVEL',
  'COMMUNITY',
];
const frameworks = [
  ['MBTI', 'MBTI', 'CATEGORICAL'],
  ['ENNEAGRAM', 'Enneagram', 'CATEGORICAL'],
  ['BIG_FIVE', 'Big Five', 'DIMENSIONAL'],
  ['SOCIONICS', 'Socionics', 'CATEGORICAL'],
  ['ATTITUDINAL_PSYCHE', 'Attitudinal Psyche', 'CATEGORICAL'],
];
const personalityTypes = [
  'INTJ',
  'INTP',
  'ENTJ',
  'ENTP',
  'INFJ',
  'INFP',
  'ENFJ',
  'ENFP',
  'ISTJ',
  'ISFJ',
  'ESTJ',
  'ESFJ',
  'ISTP',
  'ISFP',
  'ESTP',
  'ESFP',
];
const onboardingSteps = [
  ['BASIC_PROFILE', 'Basic profile', true],
  ['IDENTITY', 'Identity', true],
  ['DISCOVERY_PREFERENCES', 'Discovery preferences', true],
  ['LOCATION', 'Location', true],
  ['PHOTOS', 'Photos', true],
  ['DATING_INTENTIONS', 'Dating intentions', true],
  ['INTERESTS', 'Interests', true],
  ['PROMPTS', 'Profile prompts', false],
  ['LIFESTYLE', 'Lifestyle', false],
  ['LANGUAGES', 'Languages', false],
  ['VALUES', 'Values', false],
  ['PERSONALITY', 'Personality', false],
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert(
      'cities',
      cities.map(([name, stateName, stateCode, cityTier, timezone]) => ({
        id: stableUuid('city', `IN:${stateCode}:${name}`),
        name,
        state_name: stateName,
        state_code: stateCode,
        country_code: 'IN',
        latitude: null,
        longitude: null,
        city_tier: cityTier,
        timezone,
        is_active: true,
        created_at: now,
        updated_at: now,
      })),
      { ignoreDuplicates: true },
    );
    const categoryRows = categoryDefinitions.map(
      ([
        code,
        name,
        selectionMode,
        minSelections,
        maxSelections,
        isSensitive,
        allowProfileVisibility,
        allowMatchPreference,
        allowDealbreaker,
        required,
        displayOrder,
      ]) => ({
        id: stableUuid('profile-option-category', code),
        code,
        name,
        label_key: `profile.category.${code.toLowerCase()}`,
        selection_mode: selectionMode,
        min_selections: minSelections,
        max_selections: maxSelections,
        is_sensitive: isSensitive,
        allow_profile_visibility: allowProfileVisibility,
        allow_match_preference: allowMatchPreference,
        allow_dealbreaker: allowDealbreaker,
        is_required_for_onboarding: required,
        is_active: true,
        display_order: displayOrder,
        created_at: now,
        updated_at: now,
      }),
    );
    await queryInterface.bulkInsert('profile_option_categories', categoryRows, {
      ignoreDuplicates: true,
    });
    await queryInterface.bulkInsert(
      'profile_options',
      profileOptionDefinitions.map(([category, code, label], index) => ({
        id: stableUuid('profile-option', `${category}:${code}`),
        category_id: stableUuid('profile-option-category', category),
        code,
        label,
        label_key: `profile.option.${category.toLowerCase()}.${code.toLowerCase()}`,
        description: null,
        display_order: (index + 1) * 10,
        is_active: true,
        metadata: null,
        created_at: now,
        updated_at: now,
      })),
      { ignoreDuplicates: true },
    );
    await queryInterface.bulkInsert(
      'languages',
      languages.map(([isoCode, name, nativeName]) => ({
        id: stableUuid('language', isoCode),
        iso_code: isoCode,
        name,
        native_name: nativeName,
        is_active: true,
        created_at: now,
        updated_at: now,
      })),
      { ignoreDuplicates: true },
    );
    await queryInterface.bulkInsert(
      'interest_categories',
      interestCategories.map((code, index) => ({
        id: stableUuid('interest-category', code),
        code,
        name: code
          .split('_')
          .map((part) => part[0] + part.slice(1).toLowerCase())
          .join(' '),
        label_key: `interest.category.${code.toLowerCase()}`,
        display_order: (index + 1) * 10,
        is_active: true,
        created_at: now,
        updated_at: now,
      })),
      { ignoreDuplicates: true },
    );
    await queryInterface.bulkInsert(
      'interests',
      interests.map(([category, code, name], index) => ({
        id: stableUuid('interest', code),
        category_id: stableUuid('interest-category', category),
        code,
        name,
        label_key: `interest.${code.toLowerCase()}`,
        description: null,
        is_active: true,
        display_order: (index + 1) * 10,
        metadata: null,
        created_at: now,
        updated_at: now,
      })),
      { ignoreDuplicates: true },
    );
    await queryInterface.bulkInsert(
      'prompt_categories',
      promptCategories.map((code, index) => ({
        id: stableUuid('prompt-category', code),
        code,
        name: code
          .split('_')
          .map((part) => part[0] + part.slice(1).toLowerCase())
          .join(' '),
        label_key: `prompt.category.${code.toLowerCase()}`,
        display_order: (index + 1) * 10,
        is_active: true,
        created_at: now,
        updated_at: now,
      })),
      { ignoreDuplicates: true },
    );
    await queryInterface.bulkInsert(
      'prompts',
      prompts.map(([category, code, promptText], index) => ({
        id: stableUuid('prompt', code),
        category_id: stableUuid('prompt-category', category),
        code,
        prompt_text: promptText,
        label_key: `prompt.${code.toLowerCase()}`,
        response_type: 'TEXT_OR_MEDIA',
        max_answer_length: 500,
        is_active: true,
        display_order: (index + 1) * 10,
        metadata: null,
        created_at: now,
        updated_at: now,
      })),
      { ignoreDuplicates: true },
    );
    await queryInterface.bulkInsert(
      'values',
      values.map((code, index) => ({
        id: stableUuid('value', code),
        code,
        name: code
          .split('_')
          .map((part) => part[0] + part.slice(1).toLowerCase())
          .join(' '),
        label_key: `value.${code.toLowerCase()}`,
        description: null,
        is_active: true,
        display_order: (index + 1) * 10,
        created_at: now,
        updated_at: now,
      })),
      { ignoreDuplicates: true },
    );
    await queryInterface.bulkInsert(
      'personality_frameworks',
      frameworks.map(([code, name, resultMode]) => ({
        id: stableUuid('personality-framework', code),
        code,
        name,
        description: null,
        result_mode: resultMode,
        is_active: true,
        created_at: now,
        updated_at: now,
      })),
      { ignoreDuplicates: true },
    );
    await queryInterface.bulkInsert(
      'personality_types',
      personalityTypes.map((code) => ({
        id: stableUuid('personality-type', `MBTI:${code}`),
        framework_id: stableUuid('personality-framework', 'MBTI'),
        code,
        name: code,
        description: null,
        metadata: null,
        is_active: true,
        created_at: now,
        updated_at: now,
      })),
      { ignoreDuplicates: true },
    );
    await queryInterface.bulkInsert(
      'onboarding_steps',
      onboardingSteps.map(([code, name, required], index) => ({
        id: stableUuid('onboarding-step-v1', code),
        onboarding_version: 1,
        code,
        name,
        sequence: index + 1,
        is_required: required,
        is_skippable: !required,
        is_active: true,
        metadata: null,
        created_at: now,
        updated_at: now,
      })),
      { ignoreDuplicates: true },
    );
  },

  async down(queryInterface) {
    const ids = (namespace, codes) => ({
      id: { [Op.in]: codes.map((code) => stableUuid(namespace, code)) },
    });
    await queryInterface.bulkDelete(
      'onboarding_steps',
      ids(
        'onboarding-step-v1',
        onboardingSteps.map(([code]) => code),
      ),
    );
    await queryInterface.bulkDelete(
      'personality_types',
      ids(
        'personality-type',
        personalityTypes.map((code) => `MBTI:${code}`),
      ),
    );
    await queryInterface.bulkDelete(
      'personality_frameworks',
      ids(
        'personality-framework',
        frameworks.map(([code]) => code),
      ),
    );
    await queryInterface.bulkDelete('values', ids('value', values));
    await queryInterface.bulkDelete(
      'prompts',
      ids(
        'prompt',
        prompts.map(([, code]) => code),
      ),
    );
    await queryInterface.bulkDelete(
      'prompt_categories',
      ids('prompt-category', promptCategories),
    );
    await queryInterface.bulkDelete(
      'interests',
      ids(
        'interest',
        interests.map(([, code]) => code),
      ),
    );
    await queryInterface.bulkDelete(
      'interest_categories',
      ids('interest-category', interestCategories),
    );
    await queryInterface.bulkDelete(
      'languages',
      ids(
        'language',
        languages.map(([code]) => code),
      ),
    );
    await queryInterface.bulkDelete(
      'profile_options',
      ids(
        'profile-option',
        profileOptionDefinitions.map(
          ([category, code]) => `${category}:${code}`,
        ),
      ),
    );
    await queryInterface.bulkDelete(
      'profile_option_categories',
      ids(
        'profile-option-category',
        categoryDefinitions.map(([code]) => code),
      ),
    );
    await queryInterface.bulkDelete(
      'cities',
      ids(
        'city',
        cities.map(
          ([name, , stateCode]) => `IN:${String(stateCode)}:${String(name)}`,
        ),
      ),
    );
  },
};
