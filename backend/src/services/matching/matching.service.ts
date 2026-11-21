import { matchingConfig } from '../../config/matching';
import { matchingProfiles } from '../../repositories/matching.repository';
import { MatchingAiClient } from './ai-client';
import { RANKING_VERSION, scorePair } from './scoring';
import type { PairRanking } from '../../types/matching';

export class MatchingService {
  constructor(
    private readonly ai = new MatchingAiClient(),
    private readonly loadProfiles = matchingProfiles,
  ) {}
  async rank(
    userId: string,
    candidateIds: string[],
    semantic: boolean | ReadonlySet<string> = true,
  ) {
    const mode = matchingConfig.modeFor(userId);
    if (mode === 'BASELINE') {
      return {
        ids: [...candidateIds],
        rankings: new Map<string, PairRanking>(
          candidateIds.map((id) => [
            id,
            {
              score: null,
              scoreUnavailable: 'UNAVAILABLE',
              coverage: 0,
              mode: 'BASELINE',
              version: RANKING_VERSION,
              effectiveScore: 50,
              reasons: [],
            },
          ]),
        ),
      };
    }
    const profiles = await this.loadProfiles(
      [...new Set([userId, ...candidateIds])],
      mode === 'HYBRID' && semantic !== false,
    );
    const viewer = profiles.get(userId);
    const rankings = new Map<string, PairRanking>();
    for (const id of candidateIds) {
      const candidate = profiles.get(id);
      rankings.set(
        id,
        viewer && candidate
          ? scorePair(viewer, candidate)
          : {
              score: null,
              scoreUnavailable: 'UNAVAILABLE',
              coverage: 0,
              mode: 'BASELINE',
              version: RANKING_VERSION,
              effectiveScore: 50,
              reasons: [],
            },
      );
    }
    const order = new Map(candidateIds.map((id, index) => [id, index]));
    const byScore = (a: string, b: string) =>
      rankings.get(b)!.effectiveScore - rankings.get(a)!.effectiveScore ||
      order.get(a)! - order.get(b)!;
    const ids = [...candidateIds].sort(byScore);
    // Only the best rule candidates receive the bounded, optional semantic rerank.
    // Personalization consent is checked on every request, never cached in snapshots.
    if (
      semantic &&
      mode === 'HYBRID' &&
      viewer?.personalized &&
      viewer.semanticText.trim()
    ) {
      const shortlist = ids.slice(0, matchingConfig.aiBatchSize);
      const selected = shortlist.filter(
        (id) =>
          (semantic === true || semantic.has(id)) &&
          rankings.get(id)!.score !== null &&
          profiles.get(id)?.semanticText.trim(),
      );
      const result = selected.length
        ? await this.ai.semantic(
            viewer.semanticText,
            selected.map((key) => ({
              key,
              text: profiles.get(key)!.semanticText,
            })),
          )
        : null;
      if (result) {
        const reranked = new Set<string>();
        for (const id of selected) {
          const score = result.scores.get(id);
          if (score !== undefined) {
            const ranking = scorePair(viewer, profiles.get(id)!, score);
            if (ranking.mode !== 'HYBRID') continue;
            ranking.version = `${RANKING_VERSION}:${result.version}`.slice(
              0,
              200,
            );
            rankings.set(id, ranking);
            reranked.add(id);
          }
        }
        // Compare like with like. Unscored and fallback candidates keep their rule positions.
        const ordered = shortlist
          .filter((id) => reranked.has(id))
          .sort(byScore);
        let index = 0;
        for (let slot = 0; slot < shortlist.length; slot++) {
          if (reranked.has(ids[slot]!)) ids[slot] = ordered[index++]!;
        }
      }
    }
    return { rankings, ids };
  }
}
