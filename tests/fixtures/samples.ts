/**
 * The hero sample thread (SPEC §11, F9 "landlord deposit"). Synthetic: the
 * people, address and amounts are invented. Shown on the site labelled
 * "Sample thread". Dates use November 2026, where Thursday the 12th is real
 * and the 10th is a Tuesday.
 */
import type { ContextInput } from '../../src/engine/index';

export const DEPOSIT_MESSAGE = `Hi Sam,

Great news, the flat at 14 Larchmont Road is yours from the 1st. Before I hand over the keys, can you confirm the $1,250 deposit, drop off the keys on Thursday the 12th, and send the signed lease back?

Let me know if you have any questions!

Thanks,
Kathryn

On Fri, Oct 30, 2026 at 6:02 PM Sam Ortiz <sam.ortiz@example.com> wrote:
> Hi Catherine, is the flat still available? Could you send the lease?
`;

export const DEPOSIT_INPUT: ContextInput = {
  source: 'playground',
  threadId: 'sample:deposit',
  sentAt: '2026-11-02',
  message: DEPOSIT_MESSAGE,
  sender: { name: 'Kathryn Moss', emailLocal: 'kathryn.moss', role: 'sender' },
  recipients: [{ name: 'Sam Ortiz', emailLocal: 'sam.ortiz', role: 'to' }],
};

/** The scripted draft from the 10 s demo, before any fix. */
export const DEPOSIT_DRAFT_SLIPS =
  "Hi Catherine,\n\nThe $1,520 deposit is confirmed, and I'll drop the keys off Thursday the 12th and send the lease tonight.\n\nSam";

/** The same draft after both fixes. */
export const DEPOSIT_DRAFT_CLEAN =
  "Hi Kathryn,\n\nThe $1,250 deposit is confirmed, and I'll drop the keys off Thursday the 12th and send the lease tonight.\n\nSam";
