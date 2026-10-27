/**
 * Outbound links the popup and options can open. These are user-initiated
 * navigations in a new tab, never fetches, so the zero-request policy stands.
 *
 * `PLAYGROUND_URL` is set per build (`WXT_PLAYGROUND_URL=https://... pnpm
 * build`) because the static site has no hosted address yet. When it is unset
 * the popup does not pretend there is a playground: it offers Gmail instead.
 */
const configured = (import.meta.env.WXT_PLAYGROUND_URL as string | undefined)?.trim();

export const PLAYGROUND_URL: string | undefined = configured ? configured : undefined;
export const GMAIL_URL = 'https://mail.google.com/';
