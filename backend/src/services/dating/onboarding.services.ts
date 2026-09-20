import { randomUUID } from 'node:crypto';
import { Op, type Transaction } from 'sequelize';
import { sequelize } from '../../config/database';
import { datingProfileConfig } from '../../config/datingProfile';
import Errors from '../../errors';
import {
  UserConsentRepository,
  UserOnboardingProgressRepository,
  UserOnboardingStepProgressRepository,
} from '../../repositories';
import { OnboardingStepService } from './catalog.services';
import { UserMatchPreferenceService } from './preference.services';
import {
  UserInterestService,
  UserProfileOptionService,
  UserProfileService,
} from './profile.services';
import { UserPhotoService } from './photo.service';

const withTransaction = (
  transaction?: Transaction,
): { transaction?: Transaction } => (transaction ? { transaction } : {});

export class UserOnboardingProgressService {
  constructor(
    private readonly repository = new UserOnboardingProgressRepository(),
  ) {}

  async start(
    userId: string,
    version: number,
    currentStepId: string | null,
    transaction?: Transaction,
  ): Promise<void> {
    const existing = await this.repository.findOne({
      where: { userId },
      ...withTransaction(transaction),
    });
    const values = {
      onboardingVersion: version,
      status: 'IN_PROGRESS',
      currentStepId,
      startedAt: existing?.startedAt ?? new Date(),
      completedAt: null,
    };
    if (existing)
      await this.repository.update(values, {
        where: { id: existing.id },
        ...withTransaction(transaction),
      });
    else
      await this.repository.create(
        { id: randomUUID(), userId, ...values },
        withTransaction(transaction),
      );
  }

  async setCurrent(
    userId: string,
    currentStepId: string | null,
    transaction?: Transaction,
  ): Promise<void> {
    const [updated] = await this.repository.update(
      { currentStepId },
      { where: { userId }, ...withTransaction(transaction) },
    );
    if (!updated)
      throw new Errors.BadRequestError('Onboarding has not been started');
  }

  async complete(userId: string, transaction?: Transaction): Promise<void> {
    const [updated] = await this.repository.update(
      { status: 'COMPLETED', currentStepId: null, completedAt: new Date() },
      {
        where: { userId, status: 'IN_PROGRESS' },
        ...withTransaction(transaction),
      },
    );
    if (!updated)
      throw new Errors.BadRequestError('Onboarding is not in progress');
  }

  async get(userId: string) {
    const progress = await this.repository.findOne({ where: { userId } });
    if (!progress) return null;
    return {
      onboardingVersion: progress.onboardingVersion,
      status: progress.status,
      currentStepId: progress.currentStepId,
      startedAt: progress.startedAt,
      completedAt: progress.completedAt,
    };
  }
}

export class UserOnboardingStepProgressService {
  constructor(
    private readonly repository = new UserOnboardingStepProgressRepository(),
  ) {}

  async setStatus(
    userId: string,
    onboardingStepId: string,
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED',
    transaction?: Transaction,
  ): Promise<void> {
    const existing = await this.repository.findOne({
      where: { userId, onboardingStepId },
      ...withTransaction(transaction),
    });
    const now = new Date();
    const times = {
      startedAt:
        status === 'IN_PROGRESS'
          ? (existing?.startedAt ?? now)
          : (existing?.startedAt ?? null),
      completedAt: status === 'COMPLETED' ? now : null,
      skippedAt: status === 'SKIPPED' ? now : null,
    };
    if (existing)
      await this.repository.update(
        { status, ...times },
        { where: { id: existing.id }, ...withTransaction(transaction) },
      );
    else
      await this.repository.create(
        { id: randomUUID(), userId, onboardingStepId, status, ...times },
        withTransaction(transaction),
      );
  }

  async completedStepIds(
    userId: string,
    stepIds: string[],
    transaction?: Transaction,
  ): Promise<Set<string>> {
    const records = await this.repository.findAll({
      where: {
        userId,
        onboardingStepId: { [Op.in]: stepIds },
        status: 'COMPLETED',
      },
      ...withTransaction(transaction),
    });
    return new Set(records.map((record) => record.onboardingStepId));
  }

  async list(userId: string) {
    const records = await this.repository.findAll({ where: { userId } });
    return records.map((record) => ({
      onboardingStepId: record.onboardingStepId,
      status: record.status,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      skippedAt: record.skippedAt,
    }));
  }
}

/** Coordinates onboarding services and never queries another domain model or repository directly. */
export class OnboardingService {
  constructor(
    private readonly stepCatalogService = new OnboardingStepService(),
    private readonly progressService = new UserOnboardingProgressService(),
    private readonly stepProgressService = new UserOnboardingStepProgressService(),
    private readonly userProfileService = new UserProfileService(),
    private readonly profileOptionService = new UserProfileOptionService(),
    private readonly userInterestService = new UserInterestService(),
    private readonly userPhotoService = new UserPhotoService(),
    private readonly matchPreferenceService = new UserMatchPreferenceService(),
    private readonly consentService = new UserConsentService(),
  ) {}

  async start(
    userId: string,
    version: number,
    firstStepId: string,
  ): Promise<void> {
    await sequelize.transaction(async (transaction) => {
      await this.stepCatalogService.getActive(
        firstStepId,
        version,
        transaction,
      );
      await this.progressService.start(
        userId,
        version,
        firstStepId,
        transaction,
      );
      await this.stepProgressService.setStatus(
        userId,
        firstStepId,
        'IN_PROGRESS',
        transaction,
      );
    });
  }

  async finishStep(
    userId: string,
    version: number,
    stepId: string,
    skip = false,
  ): Promise<void> {
    await sequelize.transaction(async (transaction) => {
      const step = await this.stepCatalogService.getActive(
        stepId,
        version,
        transaction,
      );
      if (skip && (!step.isSkippable || step.isRequired))
        throw new Errors.BadRequestError(
          'This onboarding step cannot be skipped',
        );
      await this.stepProgressService.setStatus(
        userId,
        step.id,
        skip ? 'SKIPPED' : 'COMPLETED',
        transaction,
      );
      const next = await this.stepCatalogService.getNext(
        version,
        step.sequence,
        transaction,
      );
      await this.progressService.setCurrent(
        userId,
        next?.id ?? null,
        transaction,
      );
      if (next)
        await this.stepProgressService.setStatus(
          userId,
          next.id,
          'IN_PROGRESS',
          transaction,
        );
    });
  }

  async complete(userId: string, version: number): Promise<void> {
    await sequelize.transaction(async (transaction) => {
      await this.userProfileService.assertOnboardingReady(userId, transaction);
      await this.profileOptionService.assertOnboardingReady(
        userId,
        transaction,
      );
      await this.userInterestService.assertOnboardingReady(userId, transaction);
      await this.userPhotoService.assertOnboardingReady(userId, transaction);
      await this.matchPreferenceService.assertOnboardingReady(
        userId,
        transaction,
      );
      await this.consentService.assertRequired(userId, transaction);
      const requiredSteps = await this.stepCatalogService.getRequired(
        version,
        transaction,
      );
      const completed = await this.stepProgressService.completedStepIds(
        userId,
        requiredSteps.map(({ id }) => id),
        transaction,
      );
      const missing = requiredSteps.filter(({ id }) => !completed.has(id));
      if (missing.length)
        throw new Errors.BadRequestError(
          `Required onboarding steps remain incomplete: ${missing.map(({ code }) => code).join(', ')}`,
        );
      await this.userProfileService.activate(userId, transaction);
      await this.progressService.complete(userId, transaction);
    });
  }
}

export interface ConsentEventInput {
  consentCode: string;
  policyVersion: string;
  status: 'GRANTED' | 'REVOKED';
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class UserConsentService {
  constructor(private readonly repository = new UserConsentRepository()) {}
  async record(
    userId: string,
    input: ConsentEventInput,
    transaction?: Transaction,
  ): Promise<void> {
    const now = new Date();
    await this.repository.create(
      {
        id: randomUUID(),
        userId,
        consentCode: input.consentCode.trim().toUpperCase(),
        policyVersion: input.policyVersion.trim(),
        status: input.status,
        grantedAt: input.status === 'GRANTED' ? now : null,
        revokedAt: input.status === 'REVOKED' ? now : null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
      withTransaction(transaction),
    );
  }

  async list(userId: string) {
    const records = await this.repository.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
    });
    return records.map((record) => ({
      consentCode: record.consentCode,
      policyVersion: record.policyVersion,
      status: record.status,
      grantedAt: record.grantedAt,
      revokedAt: record.revokedAt,
    }));
  }

  async assertRequired(
    userId: string,
    transaction?: Transaction,
  ): Promise<void> {
    const records = await this.repository.findAll({
      where: {
        userId,
        consentCode: {
          [Op.in]: [...datingProfileConfig.requiredConsentCodes],
        },
      },
      order: [['createdAt', 'DESC']],
      ...withTransaction(transaction),
    });
    for (const code of datingProfileConfig.requiredConsentCodes) {
      const latest = records.find((record) => record.consentCode === code);
      if (
        !latest ||
        latest.status !== 'GRANTED' ||
        latest.policyVersion !== datingProfileConfig.consentPolicyVersion
      ) {
        throw new Errors.BadRequestError(
          `Required consent is missing or outdated: ${code}`,
        );
      }
    }
  }
}
