import { datingProfileConfig } from './datingProfile';
import { createHash } from 'node:crypto';

export const matchingConfig = {
  get mode() {
    return process.env.MATCHING_MODE === 'BASELINE'
      ? 'BASELINE'
      : process.env.MATCHING_MODE === 'HYBRID'
        ? 'HYBRID'
        : 'RULES';
  },
  get aiUrl() {
    return process.env.MATCHING_AI_URL?.trim().replace(/\/$/, '') ?? '';
  },
  get aiKey() {
    return process.env.MATCHING_AI_KEY?.trim() ?? '';
  },
  modeFor(userId: string) {
    const configured = this.mode;
    const raw = Number(process.env.MATCHING_ROLLOUT_PERCENT ?? 100);
    const percent = Number.isFinite(raw) && raw >= 0 && raw <= 100 ? raw : 100;
    const bucket =
      createHash('sha256')
        .update(`reciprocal-v1:${userId}`)
        .digest()
        .readUInt32BE(0) % 100;
    return configured !== 'BASELINE' && bucket >= percent
      ? configured === 'HYBRID' &&
        process.env.MATCHING_ROLLOUT_CONTROL === 'RULES'
        ? 'RULES'
        : 'BASELINE'
      : configured;
  },
  get policyVersion() {
    return datingProfileConfig.consentPolicyVersion;
  },
  sessionMinutes: 15,
  get aiTimeoutMs() {
    const value = Number(process.env.MATCHING_AI_TIMEOUT_MS ?? 2000);
    return Number.isFinite(value) && value >= 100 && value <= 10000
      ? value
      : 2000;
  },
  aiBatchSize: 64,
} as const;
