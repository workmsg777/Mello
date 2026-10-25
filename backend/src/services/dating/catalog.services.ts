import { Op, type Transaction } from 'sequelize';
import Errors from '../../errors';
import type {
  Interest,
  InterestCategory,
  Language,
  OnboardingStep,
  PersonalityFramework,
  PersonalityType,
  ProfileOption,
  ProfileOptionCategory,
  Prompt,
  PromptCategory,
  Value,
} from '../../models';
import {
  CityRepository,
  InterestRepository,
  InterestCategoryRepository,
  LanguageRepository,
  OnboardingStepRepository,
  PersonalityFrameworkRepository,
  PersonalityTypeRepository,
  ProfileOptionCategoryRepository,
  ProfileOptionRepository,
  PromptRepository,
  PromptCategoryRepository,
  ValueRepository,
} from '../../repositories';

const withTransaction = (
  transaction?: Transaction,
): { transaction?: Transaction } => (transaction ? { transaction } : {});

export class CityService {
  constructor(private readonly repository = new CityRepository()) {}
  async getPublic(
    id: string,
    transaction?: Transaction,
  ): Promise<{
    id: string;
    name: string;
    stateName: string | null;
    countryCode: string;
  }> {
    const city = await this.repository.findOne({
      where: { id, isActive: true },
      ...withTransaction(transaction),
    });
    if (!city) throw new Errors.BadRequestError('Selected city is unavailable');
    return {
      id: city.id,
      name: city.name,
      stateName: city.stateName,
      countryCode: city.countryCode,
    };
  }
  async assertActive(id: string, transaction?: Transaction): Promise<void> {
    await this.getPublic(id, transaction);
  }

  async search(
    search = '',
    limit = 30,
  ): Promise<
    Array<{
      id: string;
      name: string;
      stateName: string | null;
      stateCode: string | null;
      countryCode: string;
      cityTier: 'TIER_1' | 'TIER_2' | 'TIER_3' | 'OTHER' | null;
    }>
  > {
    const where = search
      ? {
          isActive: true,
          [Op.or]: [
            { name: { [Op.iLike]: `%${search}%` } },
            { stateName: { [Op.iLike]: `%${search}%` } },
          ],
        }
      : { isActive: true };
    const cities = await this.repository.findAll({
      where,
      order: [
        ['countryCode', 'ASC'],
        ['name', 'ASC'],
      ],
      limit,
    });
    return cities.map((city) => ({
      id: city.id,
      name: city.name,
      stateName: city.stateName,
      stateCode: city.stateCode,
      countryCode: city.countryCode,
      cityTier: city.cityTier,
    }));
  }
}

export class ProfileOptionCategoryService {
  constructor(
    private readonly repository = new ProfileOptionCategoryRepository(),
  ) {}
  async getActive(
    id: string,
    transaction?: Transaction,
  ): Promise<ProfileOptionCategory> {
    const category = await this.repository.findOne({
      where: { id, isActive: true },
      ...withTransaction(transaction),
    });
    if (!category)
      throw new Errors.BadRequestError(
        'Profile option category is unavailable',
      );
    return category;
  }

  getOnboardingRequired(
    transaction?: Transaction,
  ): Promise<ProfileOptionCategory[]> {
    return this.repository.findAll({
      where: { isActive: true, isRequiredForOnboarding: true },
      order: [['displayOrder', 'ASC']],
      ...withTransaction(transaction),
    });
  }

  listActive(): Promise<ProfileOptionCategory[]> {
    return this.repository.findAll({
      where: { isActive: true },
      order: [['displayOrder', 'ASC']],
    });
  }
}

export class ProfileOptionService {
  constructor(private readonly repository = new ProfileOptionRepository()) {}
  async getActiveForCategory(
    categoryId: string,
    optionIds: string[],
    transaction?: Transaction,
  ): Promise<ProfileOption[]> {
    const uniqueIds = [...new Set(optionIds)];
    const options = await this.repository.findAll({
      where: { id: { [Op.in]: uniqueIds }, categoryId, isActive: true },
      ...withTransaction(transaction),
    });
    if (options.length !== uniqueIds.length)
      throw new Errors.BadRequestError(
        'One or more profile options are invalid for this category',
      );
    return options;
  }

  listActive(): Promise<ProfileOption[]> {
    return this.repository.findAll({
      where: { isActive: true },
      order: [
        ['categoryId', 'ASC'],
        ['displayOrder', 'ASC'],
      ],
    });
  }
}

export class InterestCategoryService {
  constructor(private readonly repository = new InterestCategoryRepository()) {}
  listActive(): Promise<InterestCategory[]> {
    return this.repository.findAll({
      where: { isActive: true },
      order: [['displayOrder', 'ASC']],
    });
  }
}

export class InterestService {
  constructor(private readonly repository = new InterestRepository()) {}
  async assertActiveIds(
    ids: string[],
    transaction?: Transaction,
  ): Promise<void> {
    const uniqueIds = [...new Set(ids)];
    const count = await this.repository.count({
      where: { id: { [Op.in]: uniqueIds }, isActive: true },
      ...withTransaction(transaction),
    });
    if (count !== uniqueIds.length)
      throw new Errors.BadRequestError('One or more interests are unavailable');
  }

  listActive(): Promise<Interest[]> {
    return this.repository.findAll({
      where: { isActive: true },
      order: [
        ['categoryId', 'ASC'],
        ['displayOrder', 'ASC'],
        ['name', 'ASC'],
      ],
    });
  }
}

export class LanguageService {
  constructor(private readonly repository = new LanguageRepository()) {}
  async getActiveIds(
    ids: string[],
    transaction?: Transaction,
  ): Promise<Language[]> {
    const uniqueIds = [...new Set(ids)];
    const languages = await this.repository.findAll({
      where: { id: { [Op.in]: uniqueIds }, isActive: true },
      ...withTransaction(transaction),
    });
    if (languages.length !== uniqueIds.length)
      throw new Errors.BadRequestError('One or more languages are unavailable');
    return languages;
  }

  listActive(): Promise<Language[]> {
    return this.repository.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']],
    });
  }
}

export class PromptCategoryService {
  constructor(private readonly repository = new PromptCategoryRepository()) {}
  listActive(): Promise<PromptCategory[]> {
    return this.repository.findAll({
      where: { isActive: true },
      order: [['displayOrder', 'ASC']],
    });
  }
}

export class PromptService {
  constructor(private readonly repository = new PromptRepository()) {}
  async getActive(id: string, transaction?: Transaction): Promise<Prompt> {
    const prompt = await this.repository.findOne({
      where: { id, isActive: true },
      ...withTransaction(transaction),
    });
    if (!prompt) throw new Errors.BadRequestError('Prompt is unavailable');
    return prompt;
  }

  listActive(): Promise<Prompt[]> {
    return this.repository.findAll({
      where: { isActive: true },
      order: [
        ['categoryId', 'ASC'],
        ['displayOrder', 'ASC'],
      ],
    });
  }
}

export class ValueService {
  constructor(private readonly repository = new ValueRepository()) {}
  async assertActiveIds(
    ids: string[],
    transaction?: Transaction,
  ): Promise<void> {
    const uniqueIds = [...new Set(ids)];
    const count = await this.repository.count({
      where: { id: { [Op.in]: uniqueIds }, isActive: true },
      ...withTransaction(transaction),
    });
    if (count !== uniqueIds.length)
      throw new Errors.BadRequestError('One or more values are unavailable');
  }

  listActive(): Promise<Value[]> {
    return this.repository.findAll({
      where: { isActive: true },
      order: [['displayOrder', 'ASC']],
    });
  }
}

export class PersonalityFrameworkService {
  constructor(
    private readonly repository = new PersonalityFrameworkRepository(),
  ) {}
  async getActive(
    id: string,
    transaction?: Transaction,
  ): Promise<PersonalityFramework> {
    const framework = await this.repository.findOne({
      where: { id, isActive: true },
      ...withTransaction(transaction),
    });
    if (!framework)
      throw new Errors.BadRequestError('Personality framework is unavailable');
    return framework;
  }

  listActive(): Promise<PersonalityFramework[]> {
    return this.repository.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']],
    });
  }
}

export class PersonalityTypeService {
  constructor(private readonly repository = new PersonalityTypeRepository()) {}
  async getActiveForFramework(
    id: string,
    frameworkId: string,
    transaction?: Transaction,
  ): Promise<PersonalityType> {
    const type = await this.repository.findOne({
      where: { id, frameworkId, isActive: true },
      ...withTransaction(transaction),
    });
    if (!type)
      throw new Errors.BadRequestError(
        'Personality type is invalid for this framework',
      );
    return type;
  }

  listActive(): Promise<PersonalityType[]> {
    return this.repository.findAll({
      where: { isActive: true },
      order: [
        ['frameworkId', 'ASC'],
        ['code', 'ASC'],
      ],
    });
  }
}

export class OnboardingStepService {
  constructor(private readonly repository = new OnboardingStepRepository()) {}
  async getActive(
    id: string,
    version: number,
    transaction?: Transaction,
  ): Promise<OnboardingStep> {
    const step = await this.repository.findOne({
      where: { id, onboardingVersion: version, isActive: true },
      ...withTransaction(transaction),
    });
    if (!step)
      throw new Errors.BadRequestError(
        'Onboarding step is unavailable for this version',
      );
    return step;
  }
  getRequired(
    version: number,
    transaction?: Transaction,
  ): Promise<OnboardingStep[]> {
    return this.repository.findAll({
      where: { onboardingVersion: version, isActive: true, isRequired: true },
      order: [['sequence', 'ASC']],
      ...withTransaction(transaction),
    });
  }
  getNext(
    version: number,
    sequence: number,
    transaction?: Transaction,
  ): Promise<OnboardingStep | null> {
    return this.repository.findOne({
      where: {
        onboardingVersion: version,
        isActive: true,
        sequence: { [Op.gt]: sequence },
      },
      order: [['sequence', 'ASC']],
      ...withTransaction(transaction),
    });
  }

  listActive(version: number): Promise<OnboardingStep[]> {
    return this.repository.findAll({
      where: { onboardingVersion: version, isActive: true },
      order: [['sequence', 'ASC']],
    });
  }
}
