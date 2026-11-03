/**
 * Model-score adapter (SPEC F7, ADR-0001 §Model). The engine never imports the
 * model: the extension's model host computes embeddings and hands the
 * similarity matrix back here. Model evidence only ever produces the dotted
 * "looks answered" state, never "answered".
 */
import type { Ask } from '../types';

/** Default cosine threshold; to be calibrated on the corpus when the model ships. */
export const MODEL_THRESHOLD = 0.62;

/** Embeds texts; implemented by the model host, injected by the app. */
export type EmbedFn = (texts: string[]) => Promise<Float32Array[]>;

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export interface SentenceRef {
  start: number;
  end: number;
}

/**
 * Upgrades open asks to looks-answered when any draft sentence scores at or
 * above the threshold. `scores[i][j]` is ask i vs sentence j.
 */
export function applyModelScores(
  asks: Ask[],
  sentences: SentenceRef[],
  scores: number[][],
  threshold = MODEL_THRESHOLD,
): Ask[] {
  return asks.map((ask, i) => {
    if (ask.state !== 'open') return ask;
    const row = scores[i] ?? [];
    let bestJ = -1;
    let best = -Infinity;
    row.forEach((v, j) => {
      if (v > best) {
        best = v;
        bestJ = j;
      }
    });
    const sentence = sentences[bestJ];
    if (bestJ === -1 || best < threshold || !sentence) return ask;
    return {
      ...ask,
      state: 'looks-answered',
      evidence: { kind: 'model', draftSpan: { start: sentence.start, end: sentence.end }, score: best },
    };
  });
}

/** Ask × sentence cosine matrix from embeddings. */
export function similarityMatrix(askVectors: Float32Array[], sentenceVectors: Float32Array[]): number[][] {
  return askVectors.map((a) => sentenceVectors.map((s) => cosine(a, s)));
}
