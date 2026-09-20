import { randomUUID } from 'node:crypto';
import type { Transaction } from 'sequelize';
import { sequelize } from '../../config/database';
import { datingProfileConfig } from '../../config/datingProfile';
import Errors from '../../errors';
import {
  UserPersonalityResultRepository,
  UserPromptAnswerRepository,
} from '../../repositories';
import {
  PersonalityFrameworkService,
  PersonalityTypeService,
  PromptService,
} from './catalog.services';

const withTransaction = (
  transaction?: Transaction,
): { transaction?: Transaction } => (transaction ? { transaction } : {});

export interface PromptAnswerInput {
  promptId: string;
  answerText?: string | null | undefined;
  mediaId?: string | null | undefined;
  displayOrder: number;
}

export class UserPromptAnswerService {
  constructor(
    private readonly repository = new UserPromptAnswerRepository(),
    private readonly promptService = new PromptService(),
  ) {}
  async save(userId: string, input: PromptAnswerInput): Promise<void> {
    await sequelize.transaction(async (transaction) => {
      const prompt = await this.promptService.getActive(
        input.promptId,
        transaction,
      );
      const text = input.answerText?.trim() || null;
      const mediaId = input.mediaId ?? null;
      if (!text && !mediaId)
        throw new Errors.BadRequestError(
          'A prompt answer requires text or media',
        );
      if (prompt.responseType === 'TEXT' && mediaId)
        throw new Errors.BadRequestError('This prompt accepts text only');
      if (prompt.responseType === 'MEDIA' && text)
        throw new Errors.BadRequestError('This prompt accepts media only');
      if (
        text &&
        prompt.maxAnswerLength !== null &&
        text.length > prompt.maxAnswerLength
      )
        throw new Errors.BadRequestError('Prompt answer is too long');
      const existing = await this.repository.findOne({
        where: { userId, promptId: input.promptId },
        paranoid: false,
        transaction,
      });
      if (!existing) {
        const activeCount = await this.repository.count({
          where: { userId, isActive: true },
          transaction,
        });
        if (activeCount >= datingProfileConfig.maximumPromptAnswers)
          throw new Errors.BadRequestError(
            `A profile may have at most ${datingProfileConfig.maximumPromptAnswers} active prompt answers`,
          );
        await this.repository.create(
          {
            id: randomUUID(),
            userId,
            promptId: input.promptId,
            answerText: text,
            mediaId,
            displayOrder: input.displayOrder,
            moderationStatus: 'NOT_REVIEWED',
            isActive: true,
          },
          { transaction },
        );
      } else {
        await this.repository.update(
          {
            answerText: text,
            mediaId,
            displayOrder: input.displayOrder,
            moderationStatus: 'NOT_REVIEWED',
            isActive: true,
            deletedAt: null,
          },
          { where: { id: existing.id }, paranoid: false, transaction },
        );
      }
    });
  }

  async list(userId: string) {
    const answers = await this.repository.findAll({
      where: { userId, isActive: true },
      order: [['displayOrder', 'ASC']],
    });
    return answers.map((answer) => ({
      id: answer.id,
      promptId: answer.promptId,
      answerText: answer.answerText,
      mediaId: answer.mediaId,
      displayOrder: answer.displayOrder,
      moderationStatus: answer.moderationStatus,
    }));
  }

  async remove(userId: string, promptId: string): Promise<void> {
    const removed = await this.repository.destroy({
      where: { userId, promptId },
    });
    if (!removed) throw new Errors.NotFoundError('Prompt answer not found');
  }
}

export interface PersonalityResultInput {
  frameworkId: string;
  personalityTypeId?: string | null | undefined;
  scores?: Record<string, number> | null | undefined;
  source: 'SELF_DECLARED' | 'IN_APP_TEST' | 'IMPORTED';
  confidence?: number | null | undefined;
  isUsedForMatching?: boolean | undefined;
}

export class UserPersonalityResultService {
  constructor(
    private readonly repository = new UserPersonalityResultRepository(),
    private readonly frameworkService = new PersonalityFrameworkService(),
    private readonly typeService = new PersonalityTypeService(),
  ) {}
  async save(userId: string, input: PersonalityResultInput): Promise<void> {
    await sequelize.transaction(async (transaction) => {
      const framework = await this.frameworkService.getActive(
        input.frameworkId,
        transaction,
      );
      const typeId = input.personalityTypeId ?? null;
      const scores = input.scores ?? null;
      if (
        (framework.resultMode === 'CATEGORICAL' ||
          framework.resultMode === 'HYBRID') &&
        typeId
      ) {
        await this.typeService.getActiveForFramework(
          typeId,
          framework.id,
          transaction,
        );
      }
      if (framework.resultMode === 'CATEGORICAL' && !typeId)
        throw new Errors.BadRequestError(
          'This framework requires a categorical personality type',
        );
      if (framework.resultMode === 'DIMENSIONAL' && !scores)
        throw new Errors.BadRequestError(
          'This framework requires dimensional scores',
        );
      if (!typeId && !scores)
        throw new Errors.BadRequestError('A personality result is required');
      if (scores) this.validateScores(framework.code, scores);
      if (
        input.confidence !== undefined &&
        input.confidence !== null &&
        (input.confidence < 0 || input.confidence > 1)
      )
        throw new Errors.BadRequestError('Confidence must be between 0 and 1');
      const existing = await this.repository.findOne({
        where: { userId, frameworkId: input.frameworkId },
        paranoid: false,
        transaction,
      });
      const values = {
        personalityTypeId: typeId,
        scores,
        source: input.source,
        confidence: input.confidence ?? null,
        isUsedForMatching: input.isUsedForMatching ?? true,
        deletedAt: null,
      };
      if (existing)
        await this.repository.update(values, {
          where: { id: existing.id },
          paranoid: false,
          transaction,
        });
      else
        await this.repository.create(
          {
            id: randomUUID(),
            userId,
            frameworkId: input.frameworkId,
            ...values,
          },
          { transaction },
        );
    });
  }

  async list(userId: string) {
    const results = await this.repository.findAll({ where: { userId } });
    return results.map((result) => ({
      frameworkId: result.frameworkId,
      personalityTypeId: result.personalityTypeId,
      scores: result.scores,
      source: result.source,
      isUsedForMatching: result.isUsedForMatching,
    }));
  }

  async remove(userId: string, frameworkId: string): Promise<void> {
    const removed = await this.repository.destroy({
      where: { userId, frameworkId },
    });
    if (!removed)
      throw new Errors.NotFoundError('Personality result not found');
  }

  private validateScores(
    frameworkCode: string,
    scores: Record<string, number>,
  ): void {
    const entries = Object.entries(scores);
    if (
      !entries.length ||
      entries.some(
        ([, value]) => !Number.isFinite(value) || value < 0 || value > 1,
      )
    ) {
      throw new Errors.BadRequestError(
        'Personality scores must contain numeric values from 0 to 1',
      );
    }
    if (frameworkCode === 'BIG_FIVE') {
      const expected = [
        'agreeableness',
        'conscientiousness',
        'extraversion',
        'neuroticism',
        'openness',
      ];
      if (
        entries
          .map(([key]) => key)
          .sort()
          .join(',') !== expected.join(',')
      )
        throw new Errors.BadRequestError(
          'Big Five scores must contain exactly the five supported dimensions',
        );
    }
  }
}
