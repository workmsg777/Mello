import { z } from 'zod';
import { matchingConfig } from '../../config/matching';

const semanticResponse = z.object({
  modelVersion: z.string().min(1).max(200),
  scores: z
    .array(
      z.object({
        key: z.string().uuid(),
        similarity: z.number().finite().min(0).max(1),
      }),
    )
    .max(64),
});
const openerResponse = z.object({
  suggestions: z.array(z.string().min(1).max(300)).min(1).max(3),
});

/** Internal, bounded service call. Failures never interrupt discovery or text chat. */
export class MatchingAiClient {
  private async request(path: string, body: unknown): Promise<unknown> {
    if (!matchingConfig.aiUrl || matchingConfig.aiKey.length < 32) return null;
    try {
      const response = await fetch(`${matchingConfig.aiUrl}${path}`, {
        method: 'POST',
        redirect: 'error',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Key': matchingConfig.aiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(matchingConfig.aiTimeoutMs),
      });
      if (
        !response.ok ||
        Number(response.headers.get('content-length') ?? 0) > 32_768
      )
        return null;
      // Bound streamed bodies too; a missing Content-Length must not bypass the limit.
      const reader = response.body?.getReader();
      if (!reader) return null;
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 32_768) {
          await reader.cancel();
          return null;
        }
        chunks.push(value);
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    } catch {
      return null;
    }
  }
  async semantic(
    viewerText: string,
    candidates: { key: string; text: string }[],
  ) {
    if (!viewerText.trim() || !candidates.length) return null;
    const parsed = semanticResponse.safeParse(
      await this.request('/v1/matching/semantic', {
        viewerText: viewerText.slice(0, 4000),
        candidates: candidates
          .slice(0, matchingConfig.aiBatchSize)
          .map((c) => ({ key: c.key, text: c.text.slice(0, 4000) })),
      }),
    );
    if (!parsed.success) return null;
    const expected = new Set(candidates.map((c) => c.key));
    if (
      new Set(parsed.data.scores.map((s) => s.key)).size !==
        parsed.data.scores.length ||
      parsed.data.scores.some((s) => !expected.has(s.key))
    )
      return null;
    return {
      version: parsed.data.modelVersion,
      scores: new Map(parsed.data.scores.map((s) => [s.key, s.similarity])),
    };
  }
  async icebreakers(sharedInterests: string[]) {
    const parsed = openerResponse.safeParse(
      await this.request('/v1/assist/icebreakers', {
        sharedInterests: sharedInterests.slice(0, 3),
      }),
    );
    return parsed.success ? parsed.data.suggestions : null;
  }
}
