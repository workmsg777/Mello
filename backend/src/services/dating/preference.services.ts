import { randomUUID } from 'node:crypto';
import type { Transaction } from 'sequelize';
import { sequelize } from '../../config/database';
import Errors from '../../errors';
import {
  UserLanguagePreferenceRepository,
  UserMatchPreferenceRepository,
  UserProfileOptionPreferenceRepository,
} from '../../repositories';
import {
  LanguageService,
  ProfileOptionCategoryService,
  ProfileOptionService,
} from './catalog.services';

const withTransaction = (
  transaction?: Transaction,
): { transaction?: Transaction } => (transaction ? { transaction } : {});

export interface MatchPreferenceInput {
  minAge: number;
  maxAge: number;
  maxDistanceKm: number;
  ageIsDealbreaker?: boolean | undefined;
  distanceIsDealbreaker?: boolean | undefined;
  verifiedProfilesOnly?: boolean | undefined;
  preferSameCity?: boolean | undefined;
}

export class UserMatchPreferenceService {
  constructor(
    private readonly repository = new UserMatchPreferenceRepository(),
  ) {}
  async upsert(
    userId: string,
    input: MatchPreferenceInput,
    transaction?: Transaction,
  ): Promise<void> {
    if (
      input.minAge < 18 ||
      input.maxAge < input.minAge ||
      input.maxDistanceKm <= 0
    ) {
      throw new Errors.BadRequestError(
        'Age and distance preferences are invalid',
      );
    }
    const values = {
      minAge: input.minAge,
      maxAge: input.maxAge,
      maxDistanceKm: input.maxDistanceKm,
      ageIsDealbreaker: input.ageIsDealbreaker ?? true,
      distanceIsDealbreaker: input.distanceIsDealbreaker ?? false,
      verifiedProfilesOnly: input.verifiedProfilesOnly ?? false,
      preferSameCity: input.preferSameCity ?? false,
    };
    const existing = await this.repository.findOne({
      where: { userId },
      ...withTransaction(transaction),
    });
    if (existing) {
      await this.repository.update(values, {
        where: { id: existing.id },
        ...withTransaction(transaction),
      });
    } else {
      await this.repository.create(
        { id: randomUUID(), userId, ...values },
        withTransaction(transaction),
      );
    }
  }

  async assertOnboardingReady(
    userId: string,
    transaction?: Transaction,
  ): Promise<void> {
    const count = await this.repository.count({
      where: { userId },
      ...withTransaction(transaction),
    });
    if (!count)
      throw new Errors.BadRequestError(
        'Discovery preferences must be completed',
      );
  }

  async get(userId: string) {
    const preference = await this.repository.findOne({ where: { userId } });
    if (!preference) return null;
    return {
      minAge: preference.minAge,
      maxAge: preference.maxAge,
      maxDistanceKm: preference.maxDistanceKm,
      ageIsDealbreaker: preference.ageIsDealbreaker,
      distanceIsDealbreaker: preference.distanceIsDealbreaker,
      verifiedProfilesOnly: preference.verifiedProfilesOnly,
      preferSameCity: preference.preferSameCity,
    };
  }
}

export interface ProfileOptionPreferenceInput {
  optionId: string;
  isDealbreaker?: boolean | undefined;
  priority?: number | undefined;
}
export class UserProfileOptionPreferenceService {
  constructor(
    private readonly repository = new UserProfileOptionPreferenceRepository(),
    private readonly categoryService = new ProfileOptionCategoryService(),
    private readonly optionService = new ProfileOptionService(),
  ) {}
  async replaceCategory(
    userId: string,
    categoryId: string,
    preferences: ProfileOptionPreferenceInput[],
  ): Promise<void> {
    const optionIds = preferences.map(({ optionId }) => optionId);
    if (new Set(optionIds).size !== optionIds.length)
      throw new Errors.BadRequestError(
        'Duplicate option preferences are not allowed',
      );
    await sequelize.transaction(async (transaction) => {
      const category = await this.categoryService.getActive(
        categoryId,
        transaction,
      );
      if (!category.allowMatchPreference)
        throw new Errors.BadRequestError(
          'This category cannot be used for match preferences',
        );
      if (
        !category.allowDealbreaker &&
        preferences.some(({ isDealbreaker }) => isDealbreaker)
      ) {
        throw new Errors.BadRequestError(
          'This category does not support dealbreakers',
        );
      }
      await this.optionService.getActiveForCategory(
        categoryId,
        optionIds,
        transaction,
      );
      await this.repository.destroy({
        where: { userId, categoryId },
        transaction,
      });
      await this.repository.bulkCreate(
        preferences.map((preference) => ({
          id: randomUUID(),
          userId,
          categoryId,
          optionId: preference.optionId,
          isDealbreaker: preference.isDealbreaker ?? false,
          priority: preference.priority ?? 3,
        })),
        { transaction },
      );
    });
  }

  async list(userId: string) {
    const preferences = await this.repository.findAll({
      where: { userId },
      order: [
        ['categoryId', 'ASC'],
        ['priority', 'DESC'],
      ],
    });
    return preferences.map((preference) => ({
      categoryId: preference.categoryId,
      optionId: preference.optionId,
      isDealbreaker: preference.isDealbreaker,
      priority: preference.priority,
    }));
  }
}

export interface LanguagePreferenceInput {
  languageId: string;
  isDealbreaker?: boolean | undefined;
  priority?: number | undefined;
}
export class UserLanguagePreferenceService {
  constructor(
    private readonly repository = new UserLanguagePreferenceRepository(),
    private readonly languageService = new LanguageService(),
  ) {}
  async replace(
    userId: string,
    preferences: LanguagePreferenceInput[],
  ): Promise<void> {
    const languageIds = preferences.map(({ languageId }) => languageId);
    if (new Set(languageIds).size !== languageIds.length)
      throw new Errors.BadRequestError(
        'Duplicate language preferences are not allowed',
      );
    await sequelize.transaction(async (transaction) => {
      await this.languageService.getActiveIds(languageIds, transaction);
      await this.repository.destroy({ where: { userId }, transaction });
      await this.repository.bulkCreate(
        preferences.map((preference) => ({
          id: randomUUID(),
          userId,
          languageId: preference.languageId,
          isDealbreaker: preference.isDealbreaker ?? false,
          priority: preference.priority ?? 3,
        })),
        { transaction },
      );
    });
  }

  async list(userId: string) {
    const preferences = await this.repository.findAll({
      where: { userId },
      order: [['priority', 'DESC']],
    });
    return preferences.map((preference) => ({
      languageId: preference.languageId,
      isDealbreaker: preference.isDealbreaker,
      priority: preference.priority,
    }));
  }
}
