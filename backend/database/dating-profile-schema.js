'use strict';

const { addComments, dropEnums } = require('./migration-utils');

const createdAt = (DataTypes) => ({
  type: DataTypes.DATE,
  allowNull: false,
  comment: 'Time at which this record was created.',
});

const updatedAt = (DataTypes) => ({
  type: DataTypes.DATE,
  allowNull: false,
  comment: 'Time at which this record was last changed.',
});

const deletedAt = (DataTypes) => ({
  type: DataTypes.DATE,
  allowNull: true,
  comment: 'Soft-deletion timestamp; null while the record is active.',
});

const timestamps = (DataTypes, paranoid = false) => ({
  created_at: createdAt(DataTypes),
  updated_at: updatedAt(DataTypes),
  ...(paranoid ? { deleted_at: deletedAt(DataTypes) } : {}),
});

const id = (DataTypes, comment) => ({
  type: DataTypes.UUID,
  allowNull: false,
  primaryKey: true,
  comment,
});

const userId = (DataTypes, comment = 'Dating user that owns this record.') => ({
  type: DataTypes.UUID,
  allowNull: false,
  references: { model: 'users', key: 'id' },
  onUpdate: 'CASCADE',
  onDelete: 'CASCADE',
  comment,
});

const catalogId = (DataTypes, model, comment, allowNull = false) => ({
  type: DataTypes.UUID,
  allowNull,
  references: { model, key: 'id' },
  onUpdate: 'CASCADE',
  onDelete: 'RESTRICT',
  comment,
});

const schemaFactories = {
  cities: (DataTypes) => ({
    tableComment:
      'City-level location catalog used by public dating profiles without storing live GPS coordinates.',
    columns: {
      id: id(DataTypes, 'Application-generated UUID identifying the city.'),
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
        comment: 'Display name of the city.',
      },
      state_name: {
        type: DataTypes.STRING(150),
        allowNull: true,
        comment: 'Optional state, province, or region name.',
      },
      state_code: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: 'Optional stable state, province, or region code.',
      },
      country_code: {
        type: DataTypes.CHAR(2),
        allowNull: false,
        comment: 'ISO 3166-1 alpha-2 country code.',
      },
      latitude: {
        type: DataTypes.DECIMAL(9, 6),
        allowNull: true,
        comment: 'Catalog centroid latitude, not a user live location.',
      },
      longitude: {
        type: DataTypes.DECIMAL(9, 6),
        allowNull: true,
        comment: 'Catalog centroid longitude, not a user live location.',
      },
      city_tier: {
        type: DataTypes.ENUM('TIER_1', 'TIER_2', 'TIER_3', 'OTHER'),
        allowNull: true,
        comment: 'Optional market-specific city tier classification.',
      },
      timezone: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'IANA timezone identifier for the city.',
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether the city may be selected in current product flows.',
      },
      ...timestamps(DataTypes),
    },
    indexes: [
      { fields: ['country_code'], name: 'cities_country_code_idx' },
      { fields: ['state_code'], name: 'cities_state_code_idx' },
      { fields: ['name'], name: 'cities_name_idx' },
      { fields: ['is_active'], name: 'cities_is_active_idx' },
    ],
    enums: ['enum_cities_city_tier'],
  }),

  user_profiles: (DataTypes) => ({
    tableComment:
      'Scalar public-profile foundation for a dating user; private discovery preferences live in separate tables.',
    columns: {
      id: id(
        DataTypes,
        'Application-generated UUID identifying the dating profile.',
      ),
      user_id: userId(DataTypes, 'Unique dating user that owns this profile.'),
      display_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Public display name shown on the dating profile.',
      },
      date_of_birth: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment:
          'Private date of birth used for age eligibility and age calculation; never expose it directly on a public profile.',
      },
      bio: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment:
          'Optional user-authored profile biography subject to moderation.',
      },
      height_cm: {
        type: DataTypes.SMALLINT,
        allowNull: true,
        comment: 'Optional self-reported height in whole centimetres.',
      },
      job_title: {
        type: DataTypes.STRING(150),
        allowNull: true,
        comment:
          'Optional job title, displayed only according to profile visibility.',
      },
      company_name: {
        type: DataTypes.STRING(150),
        allowNull: true,
        comment:
          'Optional company name, displayed only according to profile visibility.',
      },
      school_name: {
        type: DataTypes.STRING(200),
        allowNull: true,
        comment:
          'Optional school name, displayed only according to profile visibility.',
      },
      current_city_id: catalogId(
        DataTypes,
        'cities',
        'Optional current city at city-level precision.',
        true,
      ),
      hometown_city_id: catalogId(
        DataTypes,
        'cities',
        'Optional hometown city at city-level precision.',
        true,
      ),
      bio_moderation_status: {
        type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED', 'NOT_REVIEWED'),
        allowNull: false,
        defaultValue: 'NOT_REVIEWED',
        comment: 'Moderation state of the user-authored biography.',
      },
      profile_status: {
        type: DataTypes.ENUM('DRAFT', 'ACTIVE', 'PAUSED'),
        allowNull: false,
        defaultValue: 'DRAFT',
        comment: 'Lifecycle state of the dating profile.',
      },
      ...timestamps(DataTypes, true),
    },
    constraints: [
      {
        fields: ['user_id'],
        type: 'unique',
        name: 'user_profiles_user_id_key',
      },
    ],
    indexes: [
      {
        fields: ['current_city_id'],
        name: 'user_profiles_current_city_id_idx',
      },
      {
        fields: ['hometown_city_id'],
        name: 'user_profiles_hometown_city_id_idx',
      },
    ],
    enums: [
      'enum_user_profiles_bio_moderation_status',
      'enum_user_profiles_profile_status',
    ],
  }),

  profile_option_categories: (DataTypes) => ({
    tableComment:
      'Controlled categories for extensible structured dating-profile and preference questions.',
    columns: {
      id: id(
        DataTypes,
        'Application-generated UUID identifying the option category.',
      ),
      code: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        comment:
          'Stable machine-readable category code used by application logic.',
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
        comment: 'Administrative fallback name for the category.',
      },
      label_key: {
        type: DataTypes.STRING(200),
        allowNull: true,
        comment: 'Optional localization key for the category label.',
      },
      selection_mode: {
        type: DataTypes.ENUM('SINGLE', 'MULTIPLE'),
        allowNull: false,
        comment:
          'Whether users may select one or multiple options in this category.',
      },
      min_selections: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 0,
        comment: 'Minimum selections expected by service-level validation.',
      },
      max_selections: {
        type: DataTypes.SMALLINT,
        allowNull: true,
        comment: 'Optional maximum selections enforced by services.',
      },
      is_sensitive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Marks categories requiring sensitive-data handling.',
      },
      allow_profile_visibility: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether selections may be displayed on a public profile.',
      },
      allow_match_preference: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether options may be used as explicit partner preferences.',
      },
      allow_dealbreaker: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether preferences in this category may exclude candidates.',
      },
      is_required_for_onboarding: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment:
          'Whether the current product configuration requires this category during onboarding.',
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether the category is available for current use.',
      },
      display_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Product-controlled catalog display order.',
      },
      ...timestamps(DataTypes),
    },
    rawChecks: [
      [
        'profile_option_categories_selection_bounds',
        '"min_selections" >= 0 AND ("max_selections" IS NULL OR "max_selections" >= "min_selections")',
      ],
      [
        'profile_option_categories_single_max',
        '"selection_mode" <> \'SINGLE\' OR "max_selections" IS NULL OR "max_selections" <= 1',
      ],
    ],
    enums: ['enum_profile_option_categories_selection_mode'],
  }),

  profile_options: (DataTypes) => ({
    tableComment:
      'Stable selectable values belonging to controlled dating-profile option categories.',
    columns: {
      id: id(
        DataTypes,
        'Application-generated UUID identifying the profile option.',
      ),
      category_id: catalogId(
        DataTypes,
        'profile_option_categories',
        'Category that owns this option.',
      ),
      code: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Stable machine-readable option code within its category.',
      },
      label: {
        type: DataTypes.STRING(150),
        allowNull: false,
        comment: 'Administrative fallback label for the option.',
      },
      label_key: {
        type: DataTypes.STRING(200),
        allowNull: true,
        comment: 'Optional localization key for the user-facing option label.',
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Optional product description of the option.',
      },
      display_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Product-controlled display order within the category.',
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether the option is available for new selections.',
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment:
          'Extensible non-relational presentation or configuration metadata.',
      },
      ...timestamps(DataTypes),
    },
    constraints: [
      {
        fields: ['category_id', 'code'],
        type: 'unique',
        name: 'profile_options_category_id_code_key',
      },
      {
        fields: ['category_id', 'id'],
        type: 'unique',
        name: 'profile_options_category_id_id_key',
      },
    ],
  }),

  user_profile_options: (DataTypes) => ({
    tableComment:
      'Structured option selections describing who a dating user is, separate from whom they want to meet.',
    columns: {
      id: id(
        DataTypes,
        'Application-generated UUID identifying the user option selection.',
      ),
      user_id: userId(DataTypes),
      category_id: catalogId(
        DataTypes,
        'profile_option_categories',
        'Declared category for the selected option.',
      ),
      option_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment:
          'Selected profile option; composite integrity guarantees it belongs to category_id.',
      },
      is_primary: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment:
          'Marks the primary selection when a category permits multiple values.',
      },
      display_order: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Optional user-specific ordering among selections.',
      },
      ...timestamps(DataTypes),
    },
    constraints: [
      {
        fields: ['user_id', 'option_id'],
        type: 'unique',
        name: 'user_profile_options_user_id_option_id_key',
      },
    ],
    foreignKeys: [
      {
        fields: ['category_id', 'option_id'],
        references: { table: 'profile_options', fields: ['category_id', 'id'] },
        name: 'user_profile_options_category_option_fk',
      },
    ],
    indexes: [
      { fields: ['option_id'], name: 'user_profile_options_option_id_idx' },
      {
        fields: ['category_id', 'option_id'],
        name: 'user_profile_options_category_id_option_id_idx',
      },
    ],
  }),

  user_profile_visibility: (DataTypes) => ({
    tableComment:
      'Per-field controls separating public profile display, matching-only use, and private data.',
    columns: {
      id: id(
        DataTypes,
        'Application-generated UUID identifying the visibility rule.',
      ),
      user_id: userId(DataTypes),
      field_code: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment:
          'Stable code of the scalar field or structured category governed by this rule.',
      },
      visibility: {
        type: DataTypes.ENUM('PROFILE', 'MATCHING_ONLY', 'PRIVATE'),
        allowNull: false,
        comment: 'Permitted product use of the governed field.',
      },
      ...timestamps(DataTypes),
    },
    constraints: [
      {
        fields: ['user_id', 'field_code'],
        type: 'unique',
        name: 'user_profile_visibility_user_id_field_code_key',
      },
    ],
    enums: ['enum_user_profile_visibility_visibility'],
  }),

  languages: (DataTypes) => ({
    tableComment:
      'Global language catalog used for profile expression and private language preferences.',
    columns: {
      id: id(DataTypes, 'Application-generated UUID identifying the language.'),
      iso_code: {
        type: DataTypes.STRING(10),
        allowNull: false,
        unique: true,
        comment: 'Stable ISO or BCP-47 compatible language code.',
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'English administrative name of the language.',
      },
      native_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Optional name of the language in its own script.',
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether the language is available in current product flows.',
      },
      ...timestamps(DataTypes),
    },
    indexes: [{ fields: ['is_active'], name: 'languages_is_active_idx' }],
  }),

  user_languages: (DataTypes) => ({
    tableComment:
      'Languages a dating user reports speaking for profile and compatibility use.',
    columns: {
      id: id(
        DataTypes,
        'Application-generated UUID identifying the user-language mapping.',
      ),
      user_id: userId(DataTypes),
      language_id: catalogId(
        DataTypes,
        'languages',
        'Language reported by the user.',
      ),
      proficiency: {
        type: DataTypes.ENUM('NATIVE', 'FLUENT', 'CONVERSATIONAL', 'BASIC'),
        allowNull: true,
        comment: 'Optional self-reported proficiency level.',
      },
      is_primary: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether this is the user primary language.',
      },
      display_order: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Optional profile display order.',
      },
      ...timestamps(DataTypes),
    },
    constraints: [
      {
        fields: ['user_id', 'language_id'],
        type: 'unique',
        name: 'user_languages_user_id_language_id_key',
      },
    ],
    indexes: [
      { fields: ['language_id'], name: 'user_languages_language_id_idx' },
    ],
    enums: ['enum_user_languages_proficiency'],
  }),

  interest_categories: (DataTypes) => ({
    tableComment: 'Mello-owned grouping taxonomy for profile interests.',
    columns: {
      id: id(
        DataTypes,
        'Application-generated UUID identifying the interest category.',
      ),
      code: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        comment: 'Stable machine-readable category code.',
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
        comment: 'Administrative fallback category name.',
      },
      label_key: {
        type: DataTypes.STRING(200),
        allowNull: true,
        comment: 'Optional localization key for the category label.',
      },
      display_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Product-controlled category display order.',
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether the category is currently available.',
      },
      ...timestamps(DataTypes),
    },
  }),

  interests: (DataTypes) => ({
    tableComment:
      'Normalized interest catalog used for self-expression, discovery signals, and conversation hooks.',
    columns: {
      id: id(DataTypes, 'Application-generated UUID identifying the interest.'),
      category_id: catalogId(
        DataTypes,
        'interest_categories',
        'Mello taxonomy category containing the interest.',
      ),
      code: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        comment: 'Stable machine-readable interest code.',
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
        comment: 'Administrative fallback interest name.',
      },
      label_key: {
        type: DataTypes.STRING(200),
        allowNull: true,
        comment: 'Optional localization key for the interest label.',
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Optional product description of the interest.',
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether the interest may be newly selected.',
      },
      display_order: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Optional display order within its category.',
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Extensible non-relational interest presentation metadata.',
      },
      ...timestamps(DataTypes),
    },
    indexes: [{ fields: ['category_id'], name: 'interests_category_id_idx' }],
  }),

  user_interests: (DataTypes) => ({
    tableComment:
      'Maps dating users to interests explicitly selected or otherwise sourced for their profile.',
    columns: {
      id: id(
        DataTypes,
        'Application-generated UUID identifying the user-interest mapping.',
      ),
      user_id: userId(DataTypes),
      interest_id: catalogId(
        DataTypes,
        'interests',
        'Interest attached to the user profile.',
      ),
      is_favorite: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether the user highlights this interest as a favorite.',
      },
      display_order: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Optional ordering on the user profile.',
      },
      source: {
        type: DataTypes.ENUM('SELF_SELECTED', 'SUGGESTED', 'INFERRED'),
        allowNull: false,
        defaultValue: 'SELF_SELECTED',
        comment:
          'Origin of the user-interest association; inferred is reserved for future use.',
      },
      ...timestamps(DataTypes),
    },
    constraints: [
      {
        fields: ['user_id', 'interest_id'],
        type: 'unique',
        name: 'user_interests_user_id_interest_id_key',
      },
    ],
    indexes: [
      { fields: ['interest_id'], name: 'user_interests_interest_id_idx' },
    ],
    enums: ['enum_user_interests_source'],
  }),

  prompt_categories: (DataTypes) => ({
    tableComment: 'Mello-owned categories grouping original profile prompts.',
    columns: {
      id: id(
        DataTypes,
        'Application-generated UUID identifying the prompt category.',
      ),
      code: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        comment: 'Stable machine-readable prompt category code.',
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
        comment: 'Administrative fallback category name.',
      },
      label_key: {
        type: DataTypes.STRING(200),
        allowNull: true,
        comment: 'Optional localization key for the category label.',
      },
      display_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Product-controlled category display order.',
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether the prompt category is currently available.',
      },
      ...timestamps(DataTypes),
    },
  }),

  prompts: (DataTypes) => ({
    tableComment:
      'Backend-managed catalog of original Mello profile prompts and supported response media.',
    columns: {
      id: id(DataTypes, 'Application-generated UUID identifying the prompt.'),
      category_id: catalogId(
        DataTypes,
        'prompt_categories',
        'Category grouping this prompt.',
      ),
      code: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        comment: 'Stable machine-readable prompt code.',
      },
      prompt_text: {
        type: DataTypes.STRING(500),
        allowNull: false,
        comment: 'Administrative fallback prompt wording authored for Mello.',
      },
      label_key: {
        type: DataTypes.STRING(200),
        allowNull: true,
        comment: 'Optional localization key for prompt wording.',
      },
      response_type: {
        type: DataTypes.ENUM('TEXT', 'MEDIA', 'TEXT_OR_MEDIA'),
        allowNull: false,
        comment: 'Allowed answer content shape.',
      },
      max_answer_length: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Optional service-enforced maximum text answer length.',
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether the prompt is available for new answers.',
      },
      display_order: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Optional product display order within the category.',
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Extensible presentation or response configuration metadata.',
      },
      ...timestamps(DataTypes),
    },
    indexes: [{ fields: ['category_id'], name: 'prompts_category_id_idx' }],
    rawChecks: [
      [
        'prompts_max_answer_length_positive',
        '"max_answer_length" IS NULL OR "max_answer_length" > 0',
      ],
    ],
    enums: ['enum_prompts_response_type'],
  }),

  user_prompt_answers: (DataTypes) => ({
    tableComment:
      'User-authored answers to backend-managed prompts, supporting text and reusable media assets.',
    columns: {
      id: id(
        DataTypes,
        'Application-generated UUID identifying the prompt answer.',
      ),
      user_id: userId(DataTypes),
      prompt_id: catalogId(
        DataTypes,
        'prompts',
        'Catalog prompt answered by the user.',
      ),
      answer_text: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment:
          'Optional text answer, validated against the prompt response configuration.',
      },
      media_id: catalogId(
        DataTypes,
        'media',
        'Optional reusable photo, video, or voice answer asset.',
        true,
      ),
      display_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Ordering among the active prompt answers on the profile.',
      },
      moderation_status: {
        type: DataTypes.ENUM('NOT_REVIEWED', 'PENDING', 'APPROVED', 'REJECTED'),
        allowNull: false,
        defaultValue: 'NOT_REVIEWED',
        comment: 'Safety moderation state of the user-authored answer.',
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment:
          'Whether the answer should be considered active for the profile.',
      },
      ...timestamps(DataTypes, true),
    },
    constraints: [
      {
        fields: ['user_id', 'prompt_id'],
        type: 'unique',
        name: 'user_prompt_answers_user_id_prompt_id_key',
      },
    ],
    indexes: [
      { fields: ['prompt_id'], name: 'user_prompt_answers_prompt_id_idx' },
      { fields: ['media_id'], name: 'user_prompt_answers_media_id_idx' },
    ],
    rawChecks: [
      [
        'user_prompt_answers_content_present',
        '"answer_text" IS NOT NULL OR "media_id" IS NOT NULL',
      ],
      ['user_prompt_answers_display_order_nonnegative', '"display_order" >= 0'],
    ],
    enums: ['enum_user_prompt_answers_moderation_status'],
  }),

  values: (DataTypes) => ({
    tableComment:
      'Catalog of personal values kept distinct from interests and personality frameworks.',
    columns: {
      id: id(DataTypes, 'Application-generated UUID identifying the value.'),
      code: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        comment: 'Stable machine-readable value code.',
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
        comment: 'Administrative fallback name of the value.',
      },
      label_key: {
        type: DataTypes.STRING(200),
        allowNull: true,
        comment: 'Optional localization key for the value label.',
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Optional product description of the value.',
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether the value is available for new selections.',
      },
      display_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Product-controlled catalog display order.',
      },
      ...timestamps(DataTypes),
    },
  }),

  user_values: (DataTypes) => ({
    tableComment:
      'Personal values a user says matter to them, distinct from desired partner values.',
    columns: {
      id: id(
        DataTypes,
        'Application-generated UUID identifying the user-value mapping.',
      ),
      user_id: userId(DataTypes),
      value_id: catalogId(
        DataTypes,
        'values',
        'Personal value selected by the user.',
      ),
      importance: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 3,
        comment: 'User-reported importance from 1 to 5.',
      },
      display_order: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Optional profile display order.',
      },
      ...timestamps(DataTypes),
    },
    constraints: [
      {
        fields: ['user_id', 'value_id'],
        type: 'unique',
        name: 'user_values_user_id_value_id_key',
      },
    ],
    indexes: [{ fields: ['value_id'], name: 'user_values_value_id_idx' }],
    rawChecks: [
      ['user_values_importance_range', '"importance" BETWEEN 1 AND 5'],
    ],
  }),

  user_partner_value_preferences: (DataTypes) => ({
    tableComment:
      'Private matchmaking preferences describing values desired in a partner.',
    columns: {
      id: id(
        DataTypes,
        'Application-generated UUID identifying the partner-value preference.',
      ),
      user_id: userId(DataTypes),
      value_id: catalogId(
        DataTypes,
        'values',
        'Value preferred in potential partners.',
      ),
      importance: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 3,
        comment: 'Private preference priority from 1 to 5.',
      },
      is_dealbreaker: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment:
          'Whether candidates lacking this value should be excluded instead of deprioritized.',
      },
      ...timestamps(DataTypes),
    },
    constraints: [
      {
        fields: ['user_id', 'value_id'],
        type: 'unique',
        name: 'user_partner_value_preferences_user_id_value_id_key',
      },
    ],
    indexes: [
      {
        fields: ['value_id'],
        name: 'user_partner_value_preferences_value_id_idx',
      },
    ],
    rawChecks: [
      [
        'user_partner_value_preferences_importance_range',
        '"importance" BETWEEN 1 AND 5',
      ],
    ],
  }),

  personality_frameworks: (DataTypes) => ({
    tableComment:
      'Optional personality frameworks supported as self-expression and compatibility inputs without claiming scientific authority.',
    columns: {
      id: id(
        DataTypes,
        'Application-generated UUID identifying the personality framework.',
      ),
      code: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        comment: 'Stable machine-readable framework code.',
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
        comment: 'Administrative display name of the framework.',
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Optional neutral product description of the framework.',
      },
      result_mode: {
        type: DataTypes.ENUM('CATEGORICAL', 'DIMENSIONAL', 'HYBRID'),
        allowNull: false,
        comment: 'Shape of results supported by the framework.',
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether this optional framework is currently offered.',
      },
      ...timestamps(DataTypes),
    },
    enums: ['enum_personality_frameworks_result_mode'],
  }),

  personality_types: (DataTypes) => ({
    tableComment:
      'Catalog of categorical results for personality frameworks that define named types.',
    columns: {
      id: id(
        DataTypes,
        'Application-generated UUID identifying the personality type.',
      ),
      framework_id: catalogId(
        DataTypes,
        'personality_frameworks',
        'Framework defining this categorical type.',
      ),
      code: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Stable type code within the framework.',
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
        comment: 'Administrative fallback name of the personality type.',
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Optional neutral description of the type.',
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Extensible non-relational framework-specific metadata.',
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether this type is currently selectable.',
      },
      ...timestamps(DataTypes),
    },
    constraints: [
      {
        fields: ['framework_id', 'code'],
        type: 'unique',
        name: 'personality_types_framework_id_code_key',
      },
      {
        fields: ['framework_id', 'id'],
        type: 'unique',
        name: 'personality_types_framework_id_id_key',
      },
    ],
  }),

  user_personality_results: (DataTypes) => ({
    tableComment:
      'Optional user personality results supporting categorical and validated dimensional representations.',
    columns: {
      id: id(
        DataTypes,
        'Application-generated UUID identifying the personality result.',
      ),
      user_id: userId(DataTypes),
      framework_id: catalogId(
        DataTypes,
        'personality_frameworks',
        'Framework under which the result was produced.',
      ),
      personality_type_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment:
          'Optional categorical type; composite integrity guarantees it belongs to framework_id.',
      },
      scores: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment:
          'Optional validated dimensional scores whose shape is controlled by the framework service.',
      },
      source: {
        type: DataTypes.ENUM(
          'SELF_DECLARED',
          'IN_APP_TEST',
          'IMPORTED',
          'INFERRED',
        ),
        allowNull: false,
        comment:
          'Origin of the result; inferred is reserved for future explicitly governed use.',
      },
      confidence: {
        type: DataTypes.DECIMAL(5, 4),
        allowNull: true,
        comment:
          'Optional internal confidence from 0 to 1; never expose it on public profiles.',
      },
      is_used_for_matching: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment:
          'Whether explicit consent and product policy allow this result in matching.',
      },
      ...timestamps(DataTypes, true),
    },
    foreignKeys: [
      {
        fields: ['framework_id', 'personality_type_id'],
        references: {
          table: 'personality_types',
          fields: ['framework_id', 'id'],
        },
        name: 'user_personality_results_framework_type_fk',
      },
    ],
    indexes: [
      {
        fields: ['user_id', 'framework_id'],
        name: 'user_personality_results_one_live_framework',
        unique: true,
        where: { deleted_at: null },
      },
      {
        fields: ['framework_id'],
        name: 'user_personality_results_framework_id_idx',
      },
      {
        fields: ['personality_type_id'],
        name: 'user_personality_results_personality_type_id_idx',
      },
    ],
    rawChecks: [
      [
        'user_personality_results_confidence_range',
        '"confidence" IS NULL OR "confidence" BETWEEN 0 AND 1',
      ],
      [
        'user_personality_results_result_present',
        '"personality_type_id" IS NOT NULL OR "scores" IS NOT NULL',
      ],
    ],
    enums: ['enum_user_personality_results_source'],
  }),

  user_match_preferences: (DataTypes) => ({
    tableComment:
      'Private scalar discovery preferences, deliberately separate from public profile identity.',
    columns: {
      id: id(
        DataTypes,
        'Application-generated UUID identifying the match-preference record.',
      ),
      user_id: userId(
        DataTypes,
        'Unique dating user owning these private discovery preferences.',
      ),
      min_age: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        comment:
          'Minimum acceptable candidate age; must be at least the adult minimum.',
      },
      max_age: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        comment: 'Maximum acceptable candidate age and not less than min_age.',
      },
      max_distance_km: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Positive maximum discovery distance in kilometres.',
      },
      age_is_dealbreaker: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether candidates outside the age range must be excluded.',
      },
      distance_is_dealbreaker: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment:
          'Whether candidates outside the distance range must be excluded.',
      },
      verified_profiles_only: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether discovery should include only verified profiles.',
      },
      prefer_same_city: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether same-city candidates should be preferred.',
      },
      ...timestamps(DataTypes),
    },
    constraints: [
      {
        fields: ['user_id'],
        type: 'unique',
        name: 'user_match_preferences_user_id_key',
      },
    ],
    rawChecks: [
      ['user_match_preferences_min_age_adult', '"min_age" >= 18'],
      ['user_match_preferences_age_order', '"max_age" >= "min_age"'],
      ['user_match_preferences_distance_positive', '"max_distance_km" > 0'],
    ],
  }),

  user_profile_option_preferences: (DataTypes) => ({
    tableComment:
      'Private structured partner preferences kept separate from a user own profile selections.',
    columns: {
      id: id(
        DataTypes,
        'Application-generated UUID identifying the option preference.',
      ),
      user_id: userId(DataTypes),
      category_id: catalogId(
        DataTypes,
        'profile_option_categories',
        'Preference category whose policy permits matching use.',
      ),
      option_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment:
          'Preferred option; composite integrity guarantees it belongs to category_id.',
      },
      is_dealbreaker: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment:
          'Indicates candidates not matching this option should be excluded rather than merely deprioritized.',
      },
      priority: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 3,
        comment: 'Private preference priority from 1 to 5.',
      },
      ...timestamps(DataTypes),
    },
    constraints: [
      {
        fields: ['user_id', 'category_id', 'option_id'],
        type: 'unique',
        name: 'user_profile_option_preferences_user_category_option_key',
      },
    ],
    foreignKeys: [
      {
        fields: ['category_id', 'option_id'],
        references: { table: 'profile_options', fields: ['category_id', 'id'] },
        name: 'user_profile_option_preferences_category_option_fk',
      },
    ],
    indexes: [
      {
        fields: ['option_id'],
        name: 'user_profile_option_preferences_option_id_idx',
      },
      {
        fields: ['category_id', 'option_id'],
        name: 'user_profile_option_preferences_category_option_idx',
      },
    ],
    rawChecks: [
      [
        'user_profile_option_preferences_priority_range',
        '"priority" BETWEEN 1 AND 5',
      ],
    ],
  }),

  user_language_preferences: (DataTypes) => ({
    tableComment:
      'Private language preferences for matchmaking in multilingual markets.',
    columns: {
      id: id(
        DataTypes,
        'Application-generated UUID identifying the language preference.',
      ),
      user_id: userId(DataTypes),
      language_id: catalogId(
        DataTypes,
        'languages',
        'Language preferred in potential partners.',
      ),
      is_dealbreaker: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether candidates without this language should be excluded.',
      },
      priority: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 3,
        comment: 'Private preference priority from 1 to 5.',
      },
      ...timestamps(DataTypes),
    },
    constraints: [
      {
        fields: ['user_id', 'language_id'],
        type: 'unique',
        name: 'user_language_preferences_user_id_language_id_key',
      },
    ],
    indexes: [
      {
        fields: ['language_id'],
        name: 'user_language_preferences_language_id_idx',
      },
    ],
    rawChecks: [
      [
        'user_language_preferences_priority_range',
        '"priority" BETWEEN 1 AND 5',
      ],
    ],
  }),

  onboarding_steps: (DataTypes) => ({
    tableComment:
      'Versioned catalog of resumable Mello onboarding steps and product configuration.',
    columns: {
      id: id(
        DataTypes,
        'Application-generated UUID identifying the onboarding step.',
      ),
      onboarding_version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Version of the onboarding flow containing this step.',
      },
      code: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment:
          'Stable machine-readable step code within its onboarding version.',
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
        comment: 'Administrative fallback step name.',
      },
      sequence: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Ordered position of the step within its version.',
      },
      is_required: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment:
          'Whether completion is required before onboarding can complete.',
      },
      is_skippable: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether a user may explicitly skip this step.',
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether the step remains active for its onboarding version.',
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Extensible UI or validation configuration for the step.',
      },
      ...timestamps(DataTypes),
    },
    constraints: [
      {
        fields: ['onboarding_version', 'code'],
        type: 'unique',
        name: 'onboarding_steps_version_code_key',
      },
      {
        fields: ['onboarding_version', 'sequence'],
        type: 'unique',
        name: 'onboarding_steps_version_sequence_key',
      },
    ],
    rawChecks: [
      ['onboarding_steps_version_positive', '"onboarding_version" > 0'],
      ['onboarding_steps_sequence_positive', '"sequence" > 0'],
      [
        'onboarding_steps_required_not_skippable',
        'NOT "is_required" OR NOT "is_skippable"',
      ],
    ],
  }),

  user_onboarding_progress: (DataTypes) => ({
    tableComment: 'One resumable onboarding summary record per dating user.',
    columns: {
      id: id(
        DataTypes,
        'Application-generated UUID identifying the onboarding progress record.',
      ),
      user_id: userId(
        DataTypes,
        'Unique dating user whose onboarding is tracked.',
      ),
      onboarding_version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Version of the onboarding flow being completed.',
      },
      status: {
        type: DataTypes.ENUM('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'),
        allowNull: false,
        comment: 'Overall resumable onboarding state.',
      },
      current_step_id: catalogId(
        DataTypes,
        'onboarding_steps',
        'Optional current step used to resume the flow.',
        true,
      ),
      started_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment:
          'Time at which the user first started this onboarding version.',
      },
      completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Time at which all required steps were completed.',
      },
      ...timestamps(DataTypes),
    },
    constraints: [
      {
        fields: ['user_id'],
        type: 'unique',
        name: 'user_onboarding_progress_user_id_key',
      },
    ],
    indexes: [
      {
        fields: ['current_step_id'],
        name: 'user_onboarding_progress_current_step_id_idx',
      },
    ],
    rawChecks: [
      ['user_onboarding_progress_version_positive', '"onboarding_version" > 0'],
    ],
    enums: ['enum_user_onboarding_progress_status'],
  }),

  user_onboarding_step_progress: (DataTypes) => ({
    tableComment:
      'Per-user onboarding step status retained for resume behavior and drop-off analytics.',
    columns: {
      id: id(
        DataTypes,
        'Application-generated UUID identifying the step progress record.',
      ),
      user_id: userId(DataTypes),
      onboarding_step_id: catalogId(
        DataTypes,
        'onboarding_steps',
        'Versioned onboarding step being tracked.',
      ),
      status: {
        type: DataTypes.ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'),
        allowNull: false,
        comment: 'Current state of this user step.',
      },
      started_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Time at which work on this step began.',
      },
      completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Time at which the step was completed.',
      },
      skipped_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Time at which a skippable step was explicitly skipped.',
      },
      ...timestamps(DataTypes),
    },
    constraints: [
      {
        fields: ['user_id', 'onboarding_step_id'],
        type: 'unique',
        name: 'user_onboarding_step_progress_user_step_key',
      },
    ],
    indexes: [
      {
        fields: ['onboarding_step_id'],
        name: 'user_onboarding_step_progress_step_id_idx',
      },
    ],
    enums: ['enum_user_onboarding_step_progress_status'],
  }),

  user_consents: (DataTypes) => ({
    tableComment:
      'Versioned audit history of explicit user consent grants and revocations for defined product purposes.',
    columns: {
      id: id(
        DataTypes,
        'Application-generated UUID identifying the consent event.',
      ),
      user_id: userId(DataTypes),
      consent_code: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Stable purpose code such as TERMS or PERSONALIZED_MATCHING.',
      },
      policy_version: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'Version of the policy or terms to which this event applies.',
      },
      status: {
        type: DataTypes.ENUM('GRANTED', 'REVOKED'),
        allowNull: false,
        comment: 'Whether this audit event grants or revokes the consent.',
      },
      granted_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment:
          'Time at which consent was explicitly granted, when applicable.',
      },
      revoked_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment:
          'Time at which consent was explicitly revoked, when applicable.',
      },
      ip_address: {
        type: DataTypes.INET,
        allowNull: true,
        comment:
          'Optional request IP retained only under the applicable privacy and retention policy.',
      },
      user_agent: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Optional user agent retained for consent audit purposes.',
      },
      ...timestamps(DataTypes),
    },
    indexes: [
      { fields: ['user_id'], name: 'user_consents_user_id_idx' },
      {
        fields: ['user_id', 'consent_code', 'policy_version', 'created_at'],
        name: 'user_consents_lookup_idx',
      },
    ],
  }),
};

async function createTableByName(queryInterface, DataTypes, tableName) {
  const factory = schemaFactories[tableName];
  if (!factory) throw new Error(`Unknown dating-profile table: ${tableName}`);
  const schema = factory(DataTypes);
  await queryInterface.sequelize.transaction(async (transaction) => {
    const columns = Object.fromEntries(
      Object.entries(schema.columns).map(([name, definition]) => {
        const { comment, ...columnDefinition } = definition;
        return [name, columnDefinition];
      }),
    );
    await queryInterface.createTable(tableName, columns, { transaction });
    for (const constraint of schema.constraints || []) {
      await queryInterface.addConstraint(tableName, {
        ...constraint,
        transaction,
      });
    }
    for (const [name, expression] of schema.rawChecks || []) {
      await queryInterface.sequelize.query(
        `ALTER TABLE "${tableName}" ADD CONSTRAINT "${name}" CHECK (${expression})`,
        { transaction },
      );
    }
    for (const foreignKey of schema.foreignKeys || []) {
      await queryInterface.addConstraint(tableName, {
        fields: foreignKey.fields,
        type: 'foreign key',
        name: foreignKey.name,
        references: foreignKey.references,
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
        transaction,
      });
    }
    for (const index of schema.indexes || []) {
      const { fields, ...options } = index;
      await queryInterface.addIndex(tableName, fields, {
        ...options,
        transaction,
      });
    }
    await addComments(
      queryInterface,
      tableName,
      schema.tableComment,
      Object.fromEntries(
        Object.entries(schema.columns).map(([name, definition]) => [
          name,
          definition.comment,
        ]),
      ),
      transaction,
    );
  });
}

async function dropTableByName(queryInterface, DataTypes, tableName) {
  const factory = schemaFactories[tableName];
  if (!factory) throw new Error(`Unknown dating-profile table: ${tableName}`);
  const schema = factory(DataTypes);
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.dropTable(tableName, { transaction });
    await dropEnums(queryInterface, schema.enums || [], transaction);
  });
}

module.exports = { createTableByName, dropTableByName };
