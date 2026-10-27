/**
 * App-level persistence and sharing. Nothing here touches the network.
 *
 *  - Text boxes live in memory and in `sessionStorage` (so a reload or a crash
 *    does not lose them); they never go in the URL.
 *  - Share link: only on an explicit click, compressed into the hash fragment
 *    (never sent to a server). On load the fragment is read once and removed.
 *  - Query string: sample id and guard toggles (`?sample=deposit&off=date`).
 */

export const MAX_THREAD_CHARS = 50_000;

export interface Draft {
  thread: string;
  reply: string;
  sender: string;
  sentOn: string;
  sampleId: string | null;
}

export const EMPTY_DRAFT: Draft = { thread: '', reply: '', sender: '', sentOn: '', sampleId: null };

const KEY = 'readback:draft';

export function loadDraft(): Draft {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return EMPTY_DRAFT;
    const r = JSON.parse(raw) as Record<string, unknown>;
    const str = (v: unknown): string => (typeof v === 'string' ? v : '');
    return {
      thread: str(r.thread).slice(0, MAX_THREAD_CHARS + 1),
      reply: str(r.reply).slice(0, MAX_THREAD_CHARS),
      sender: str(r.sender).slice(0, 120),
      sentOn: /^\d{4}-\d{2}-\d{2}$/.test(str(r.sentOn)) ? str(r.sentOn) : '',
      sampleId: typeof r.sampleId === 'string' ? r.sampleId : null,
    };
  } catch {
    return EMPTY_DRAFT;
  }
}

export function saveDraft(d: Draft): void {
  try {
    if (!d.thread && !d.reply) sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // Storage blocked or full: the boxes still work for this visit.
  }
}

export function clearDraftStorage(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

// ---- share link ----------------------------------------------------------------

const b64 = {
  enc(bytes: Uint8Array): string {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  },
  dec(text: string): Uint8Array {
    const s = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  },
};

async function pipe(
  data: Uint8Array,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  // A corrupt payload rejects the read side below, which the caller handles; the write side
  // rejects too, and must not surface as an unhandled rejection in the console.
  const ignore = (): void => undefined;
  writer.write(data as unknown as BufferSource).catch(ignore);
  writer.close().catch(ignore);
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

export const canShareLink = (): boolean =>
  typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

export async function encodeShare(d: Draft): Promise<string> {
  const json = JSON.stringify({ t: d.thread, r: d.reply, s: d.sender, d: d.sentOn });
  const packed = await pipe(new TextEncoder().encode(json), new CompressionStream('deflate-raw'));
  return `${location.origin}${location.pathname}#t=${b64.enc(packed)}`;
}

export async function decodeShare(hash: string): Promise<Draft | null> {
  const m = /^#t=([A-Za-z0-9_-]+)$/.exec(hash);
  if (!m?.[1] || !canShareLink()) return null;
  try {
    const bytes = await pipe(b64.dec(m[1]), new DecompressionStream('deflate-raw'));
    const r = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    const str = (v: unknown): string => (typeof v === 'string' ? v : '');
    return {
      thread: str(r.t).slice(0, MAX_THREAD_CHARS + 1),
      reply: str(r.r).slice(0, MAX_THREAD_CHARS),
      sender: str(r.s).slice(0, 120),
      sentOn: /^\d{4}-\d{2}-\d{2}$/.test(str(r.d)) ? str(r.d) : '',
      sampleId: null,
    };
  } catch {
    return null;
  }
}

// ---- query string ---------------------------------------------------------------

export function readQuery(): { sample: string | null; off: string[] } {
  const q = new URLSearchParams(location.search);
  return {
    sample: q.get('sample'),
    off: (q.get('off') ?? '').split(',').filter(Boolean),
  };
}

export function writeQuery(sample: string | null, off: readonly string[]): void {
  try {
    const q = new URLSearchParams();
    if (sample) q.set('sample', sample);
    if (off.length > 0) q.set('off', off.join(','));
    const qs = q.toString();
    history.replaceState(null, '', `${location.pathname}${qs ? `?${qs}` : ''}`);
  } catch {
    // Not critical.
  }
}
