import { randomUUID } from 'node:crypto';
import type { Transaction } from 'sequelize';
import { sequelize } from '../../config/database';
import { datingProfileConfig } from '../../config/datingProfile';
import Errors from '../../errors';
import type { UserProfile } from '../../models';
import {
  UserInterestRepository,
  UserLanguageRepository,
  UserPartnerValuePreferenceRepository,
  UserProfileOptionRepository,
  UserProfileRepository,
  UserProfileVisibilityRepository,
  UserValueRepository,
} from '../../repositories';
import {
  CityService,
  InterestService,
  LanguageService,
  ProfileOptionCategoryService,
  ProfileOptionService,
  ValueService,
} from './catalog.services';

export interface UpsertUserProfileInput {
  displayName: string;
  dateOfBirth: string;
  bio?: string | null | undefined;
  heightCm?: number | null | undefined;
  jobTitle?: string | null | undefined;
  companyName?: string | null | undefined;
  schoolName?: string | null | undefined;
  currentCityId?: string | null | undefined;
  hometownCityId?: string | null | undefined;
}

export interface PublicDatingProfileDto {
  id: string;
  displayName: string;
  age: number;
  bio: string | null;
  profileStatus: 'DRAFT' | 'ACTIVE' | 'PAUSED';
  heightCm?: number | null;
  jobTitle?: string | null;
  companyName?: string | null;
  schoolName?: string | null;
  currentCity?: {
    id: string;
    name: string;
    stateName: string | null;
    countryCode: string;
  } | null;
  hometown?: {
    id: string;
    name: string;
    stateName: string | null;
    countryCode: string;
  } | null;
}

const optionalFields = <T extends object>(source: T): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined),
  );
const withTransaction = (
  transaction?: Transaction,
): { transaction?: Transaction } => (transaction ? { transaction } : {});

export class UserProfileVisibilityService {
  private static readonly forbiddenCodes = new Set([
    'DATE_OF_BIRTH',
    'DOB',
    'EXACT_LOCATION',
    'CONSENT_HISTORY',
  ]);
  constructor(
    private readonly repository = new UserProfileVisibilityRepository(),
  ) {}

  async set(
    userId: string,
    fieldCode: string,
    visibility: 'PROFILE' | 'MATCHING_ONLY' | 'PRIVATE',
    transaction?: Transaction,
  ): Promise<void> {
    const normalizedCode = fieldCode.trim().toUpperCase();
    if (
      !normalizedCode ||
      UserProfileVisibilityService.forbiddenCodes.has(normalizedCode)
    ) {
      throw new Errors.BadRequestError(
        'This field cannot be configured for public visibility',
      );
    }
    const existing = await this.repository.findOne({
      where: { userId, fieldCode: normalizedCode },
      ...withTransaction(transaction),
    });
    if (existing) {
      await this.repository.update(
        { visibility },
        { where: { id: existing.id }, ...withTransaction(transaction) },
      );
      return;
    }
    await this.repository.create(
      { id: randomUUID(), userId, fieldCode: normalizedCode, visibility },
      withTransaction(transaction),
    );
  }

  async profileVisibleFields(
    userId: string,
    transaction?: Transaction,
  ): Promise<Set<string>> {
    const records = await this.repository.findAll({
      where: { userId, visibility: 'PROFILE' },
      ...withTransaction(transaction),
    });
    return new Set(records.map((record) => record.fieldCode));
  }

  async list(userId: string) {
    const records = await this.repository.findAll({
      where: { userId },
      order: [['fieldCode', 'ASC']],
    });
    return records.map((record) => ({
      fieldCode: record.fieldCode,
      visibility: record.visibility,
    }));
  }
}

export class UserProfileService {
  constructor(
    private readonly repository = new UserProfileRepository(),
    private readonly cityService = new CityService(),
    private readonly visibilityService = new UserProfileVisibilityService(),
  ) {}

  async upsert(
    userId: string,
    input: UpsertUserProfileInput,
    transaction?: Transaction,
  ): Promise<UserProfile> {
    this.assertAdult(input.dateOfBirth);
    const operation = async (
      activeTransaction: Transaction,
    ): Promise<UserProfile> => {
      if (input.currentCityId)
        await this.cityService.assertActive(
          input.currentCityId,
          activeTransaction,
        );
      if (input.hometownCityId)
        await this.cityService.assertActive(
          input.hometownCityId,
          activeTransaction,
        );
      const values = optionalFields({
        displayName: input.displayName.trim(),
        dateOfBirth: input.dateOfBirth,
        bio: input.bio,
        heightCm: input.heightCm,
        jobTitle: input.jobTitle,
        companyName: input.companyName,
        schoolName: input.schoolName,
        currentCityId: input.currentCityId,
        hometownCityId: input.hometownCityId,
        bioModerationStatus:
          input.bio === undefined ? undefined : 'NOT_REVIEWED',
      });
      if (!values.displayName)
        throw new Errors.BadRequestError('Display name is required');
      const existing = await this.repository.findOne({
        where: { userId },
        transaction: activeTransaction,
      });
      if (existing) {
        await this.repository.update(values, {
          where: { id: existing.id },
          transaction: activeTransaction,
        });
      } else {
        await this.repository.create(
          { id: randomUUID(), userId, profileStatus: 'DRAFT', ...values },
          { transaction: activeTransaction },
        );
      }
      const saved = await this.repository.findOne({
        where: { userId },
        transaction: activeTransaction,
      });
      if (!saved) throw new Errors.SystemError('Profile persistence failed');
      return saved;
    };
    return transaction
      ? operation(transaction)
      : sequelize.transaction(operation);
  }

  async getPublic(
    userId: string,
    transaction?: Transaction,
  ): Promise<PublicDatingProfileDto> {
    const profile = await this.repository.findOne({
      where: { userId },
      ...withTransaction(transaction),
    });
    if (!profile) throw new Errors.NotFoundError('Dating profile not found');
    const visible = await this.visibilityService.profileVisibleFields(
      userId,
      transaction,
    );
    const dto: PublicDatingProfileDto = {
      id: profile.id,
      displayName: profile.displayName,
      age: this.calculateAge(profile.dateOfBirth),
      bio: profile.bio,
      profileStatus: profile.profileStatus,
    };
    if (visible.has('HEIGHT')) dto.heightCm = profile.heightCm;
    if (visible.has('JOB')) dto.jobTitle = profile.jobTitle;
    if (visible.has('COMPANY')) dto.companyName = profile.companyName;
    if (visible.has('SCHOOL')) dto.schoolName = profile.schoolName;
    if (profile.currentCityId)
      dto.currentCity = await this.cityService.getPublic(
        profile.currentCityId,
        transaction,
      );
    if (visible.has('HOMETOWN') && profile.hometownCityId)
      dto.hometown = await this.cityService.getPublic(
        profile.hometownCityId,
        transaction,
      );
    return dto;
  }

  async getPrivate(userId: string) {
    const profile = await this.repository.findOne({ where: { userId } });
    if (!profile) return null;
    return {
      id: profile.id,
      displayName: profile.displayName,
      dateOfBirth: profile.dateOfBirth,
      bio: profile.bio,
      heightCm: profile.heightCm,
      jobTitle: profile.jobTitle,
      companyName: profile.companyName,
      schoolName: profile.schoolName,
      currentCityId: profile.currentCityId,
      hometownCityId: profile.hometownCityId,
      bioModerationStatus: profile.bioModerationStatus,
      profileStatus: profile.profileStatus,
    };
  }

  async assertExists(userId: string, transaction?: Transaction): Promise<void> {
    const count = await this.repository.count({
      where: { userId },
      ...withTransaction(transaction),
    });
    if (!count)
      throw new Errors.BadRequestError('Basic profile must be completed first');
  }

  async assertOnboardingReady(
    userId: string,
    transaction?: Transaction,
  ): Promise<void> {
    const profile = await this.repository.findOne({
      where: { userId },
      ...withTransaction(transaction),
    });
    if (!profile)
      throw new Errors.BadRequestError('Basic profile must be completed first');
    if (!profile.currentCityId)
      throw new Errors.BadRequestError(
        'Current city is required for onboarding',
      );
    if (this.calculateAge(profile.dateOfBirth) < datingProfileConfig.minimumAge)
      throw new Errors.BadRequestError(
        'The profile no longer meets the minimum age',
      );
  }

  async activate(userId: string, transaction?: Transaction): Promise<void> {
    const [updated] = await this.repository.update(
      { profileStatus: 'ACTIVE' },
      { where: { userId }, ...withTransaction(transaction) },
    );
    if (!updated)
      throw new Errors.BadRequestError('Basic profile must be completed first');
  }

  calculateAge(dateOfBirth: string, today = new Date()): number {
    const [year, month, day] = dateOfBirth.split('-').map(Number);
    if (!year || !month || !day)
      throw new Errors.BadRequestError('Date of birth must use YYYY-MM-DD');
    let age = today.getUTCFullYear() - year;
    if (
      today.getUTCMonth() + 1 < month ||
      (today.getUTCMonth() + 1 === month && today.getUTCDate() < day)
    )
      age -= 1;
    return age;
  }

  private assertAdult(dateOfBirth: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth))
      throw new Errors.BadRequestError('Date of birth must use YYYY-MM-DD');
    const [year, month, day] = dateOfBirth.split('-').map(Number);
    const parsed = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() + 1 !== month ||
      parsed.getUTCDate() !== day ||
      parsed > new Date()
    ) {
      throw new Errors.BadRequestError('Date of birth is invalid');
    }
    if (this.calculateAge(dateOfBirth) < datingProfileConfig.minimumAge) {
      throw new Errors.BadRequestError(
        `Mello requires users to be at least ${datingProfileConfig.minimumAge}`,
      );
    }
  }
}

export interface ProfileOptionSelection {
  optionId: string;
  isPrimary?: boolean | undefined;
  displayOrder?: number | null | undefined;
}
export class UserProfileOptionService {
  constructor(
    private readonly repository = new UserProfileOptionRepository(),
    private readonly categoryService = new ProfileOptionCategoryService(),
    private readonly optionService = new ProfileOptionService(),
  ) {}

  async replaceCategory(
    userId: string,
    categoryId: string,
    selections: ProfileOptionSelection[],
  ): Promise<void> {
    await sequelize.transaction(async (transaction) => {
      const category = await this.categoryService.getActive(
        categoryId,
        transaction,
      );
      const uniqueIds = [
        ...new Set(selections.map(({ optionId }) => optionId)),
      ];
      if (uniqueIds.length !== selections.length)
        throw new Errors.BadRequestError(
          'Duplicate profile options are not allowed',
        );
      const max =
        category.selectionMode === 'SINGLE' ? 1 : category.maxSelections;
      if (
        selections.length < category.minSelections ||
        (max !== null && selections.length > max)
      ) {
        throw new Errors.BadRequestError(
          `Selection count must be between ${category.minSelections} and ${max ?? 'the configured maximum'}`,
        );
      }
      if (selections.filter(({ isPrimary }) => isPrimary).length > 1)
        throw new Errors.BadRequestError('Only one selection may be primary');
      await this.optionService.getActiveForCategory(
        categoryId,
        uniqueIds,
        transaction,
      );
      await this.repository.destroy({
        where: { userId, categoryId },
        transaction,
      });
      await this.repository.bulkCreate(
        selections.map((selection, index) => ({
          id: randomUUID(),
          userId,
          categoryId,
          optionId: selection.optionId,
          isPrimary: selection.isPrimary ?? false,
          displayOrder: selection.displayOrder ?? index,
        })),
        { transaction },
      );
    });
  }

  async assertOnboardingReady(
    userId: string,
    transaction?: Transaction,
  ): Promise<void> {
    const categories =
      await this.categoryService.getOnboardingRequired(transaction);
    const selections = await this.repository.findAll({
      where: { userId },
      ...withTransaction(transaction),
    });
    for (const category of categories) {
      const count = selections.filter(
        ({ categoryId }) => categoryId === category.id,
      ).length;
      if (
        count < category.minSelections ||
        (category.maxSelections !== null && count > category.maxSelections)
      ) {
        throw new Errors.BadRequestError(
          `Required profile category is incomplete: ${category.code}`,
        );
      }
    }
  }

  async list(userId: string) {
    const selections = await this.repository.findAll({
      where: { userId },
      order: [
        ['categoryId', 'ASC'],
        ['displayOrder', 'ASC'],
      ],
    });
    return selections.map((selection) => ({
      categoryId: selection.categoryId,
      optionId: selection.optionId,
      isPrimary: selection.isPrimary,
      displayOrder: selection.displayOrder,
    }));
  }
}

export interface UserInterestSelection {
  interestId: string;
  isFavorite?: boolean | undefined;
  displayOrder?: number | null | undefined;
}
export class UserInterestService {
  constructor(
    private readonly repository = new UserInterestRepository(),
    private readonly interestService = new InterestService(),
  ) {}
  async replace(
    userId: string,
    selections: UserInterestSelection[],
    enforceOnboardingMinimum = true,
  ): Promise<void> {
    const ids = selections.map(({ interestId }) => interestId);
    if (new Set(ids).size !== ids.length)
      throw new Errors.BadRequestError('Duplicate interests are not allowed');
    if (
      enforceOnboardingMinimum &&
      ids.length < datingProfileConfig.minimumInterests
    )
      throw new Errors.BadRequestError(
        `Select at least ${datingProfileConfig.minimumInterests} interests`,
      );
    if (ids.length > datingProfileConfig.maximumInterests)
      throw new Errors.BadRequestError(
        `Select no more than ${datingProfileConfig.maximumInterests} interests`,
      );
    await sequelize.transaction(async (transaction) => {
      await this.interestService.assertActiveIds(ids, transaction);
      await this.repository.destroy({ where: { userId }, transaction });
      await this.repository.bulkCreate(
        selections.map((selection, index) => ({
          id: randomUUID(),
          userId,
          interestId: selection.interestId,
          isFavorite: selection.isFavorite ?? false,
          displayOrder: selection.displayOrder ?? index,
          source: 'SELF_SELECTED',
        })),
        { transaction },
      );
    });
  }

  async assertOnboardingReady(
    userId: string,
    transaction?: Transaction,
  ): Promise<void> {
    const count = await this.repository.count({
      where: { userId },
      ...withTransaction(transaction),
    });
    if (count < datingProfileConfig.minimumInterests)
      throw new Errors.BadRequestError(
        `Select at least ${datingProfileConfig.minimumInterests} interests`,
      );
    if (count > datingProfileConfig.maximumInterests)
      throw new Errors.BadRequestError(
        `Select no more than ${datingProfileConfig.maximumInterests} interests`,
      );
  }

  async list(userId: string) {
    const selections = await this.repository.findAll({
      where: { userId },
      order: [['displayOrder', 'ASC']],
    });
    return selections.map((selection) => ({
      interestId: selection.interestId,
      isFavorite: selection.isFavorite,
      displayOrder: selection.displayOrder,
      source: selection.source,
    }));
  }
}

export interface UserLanguageSelection {
  languageId: string;
  proficiency?:
    'NATIVE' | 'FLUENT' | 'CONVERSATIONAL' | 'BASIC' | null | undefined;
  isPrimary?: boolean | undefined;
  displayOrder?: number | null | undefined;
}
export class UserLanguageService {
  constructor(
    private readonly repository = new UserLanguageRepository(),
    private readonly languageService = new LanguageService(),
  ) {}
  async replace(
    userId: string,
    selections: UserLanguageSelection[],
  ): Promise<void> {
    const ids = selections.map(({ languageId }) => languageId);
    if (!ids.length)
      throw new Errors.BadRequestError('Select at least one language');
    if (new Set(ids).size !== ids.length)
      throw new Errors.BadRequestError('Duplicate languages are not allowed');
    if (selections.filter(({ isPrimary }) => isPrimary).length > 1)
      throw new Errors.BadRequestError('Only one language may be primary');
    await sequelize.transaction(async (transaction) => {
      await this.languageService.getActiveIds(ids, transaction);
      await this.repository.destroy({ where: { userId }, transaction });
      await this.repository.bulkCreate(
        selections.map((selection, index) => ({
          id: randomUUID(),
          userId,
          languageId: selection.languageId,
          proficiency: selection.proficiency ?? null,
          isPrimary: selection.isPrimary ?? false,
          displayOrder: selection.displayOrder ?? index,
        })),
        { transaction },
      );
    });
  }

  async list(userId: string) {
    const selections = await this.repository.findAll({
      where: { userId },
      order: [['displayOrder', 'ASC']],
    });
    return selections.map((selection) => ({
      languageId: selection.languageId,
      proficiency: selection.proficiency,
      isPrimary: selection.isPrimary,
      displayOrder: selection.displayOrder,
    }));
  }
}

export interface UserValueSelection {
  valueId: string;
  importance?: number | undefined;
  displayOrder?: number | null | undefined;
}
export class UserValueService {
  constructor(
    private readonly repository = new UserValueRepository(),
    private readonly valueService = new ValueService(),
  ) {}
  async replace(
    userId: string,
    selections: UserValueSelection[],
  ): Promise<void> {
    const ids = selections.map(({ valueId }) => valueId);
    if (new Set(ids).size !== ids.length)
      throw new Errors.BadRequestError('Duplicate values are not allowed');
    await sequelize.transaction(async (transaction) => {
      await this.valueService.assertActiveIds(ids, transaction);
      await this.repository.destroy({ where: { userId }, transaction });
      await this.repository.bulkCreate(
        selections.map((selection, index) => ({
          id: randomUUID(),
          userId,
          valueId: selection.valueId,
          importance: selection.importance ?? 3,
          displayOrder: selection.displayOrder ?? index,
        })),
        { transaction },
      );
    });
  }

  async list(userId: string) {
    const selections = await this.repository.findAll({
      where: { userId },
      order: [['displayOrder', 'ASC']],
    });
    return selections.map((selection) => ({
      valueId: selection.valueId,
      importance: selection.importance,
      displayOrder: selection.displayOrder,
    }));
  }
}

export interface PartnerValuePreference {
  valueId: string;
  importance?: number | undefined;
  isDealbreaker?: boolean | undefined;
}
export class UserPartnerValuePreferenceService {
  constructor(
    private readonly repository = new UserPartnerValuePreferenceRepository(),
    private readonly valueService = new ValueService(),
  ) {}
  async replace(
    userId: string,
    preferences: PartnerValuePreference[],
  ): Promise<void> {
    const ids = preferences.map(({ valueId }) => valueId);
    if (new Set(ids).size !== ids.length)
      throw new Errors.BadRequestError(
        'Duplicate partner value preferences are not allowed',
      );
    await sequelize.transaction(async (transaction) => {
      await this.valueService.assertActiveIds(ids, transaction);
      await this.repository.destroy({ where: { userId }, transaction });
      await this.repository.bulkCreate(
        preferences.map((preference) => ({
          id: randomUUID(),
          userId,
          valueId: preference.valueId,
          importance: preference.importance ?? 3,
          isDealbreaker: preference.isDealbreaker ?? false,
        })),
        { transaction },
      );
    });
  }

  async list(userId: string) {
    const preferences = await this.repository.findAll({ where: { userId } });
    return preferences.map((preference) => ({
      valueId: preference.valueId,
      importance: preference.importance,
      isDealbreaker: preference.isDealbreaker,
    }));
  }
}
