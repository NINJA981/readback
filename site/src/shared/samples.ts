/**
 * The six synthetic sample threads (SPEC F9). People, companies, addresses,
 * order numbers and amounts are invented. Every one is shown labelled
 * "Sample thread". Dates sit in November 2026: Nov 1 is a Sunday, so
 * Thursday is the 12th and the 10th is a Tuesday.
 *
 * Each sample's `draft` is a reply with real slips plus one deliberate case
 * Readback must stay quiet on. `tests/samples.test.ts` runs the real engine
 * over all of them, so the copy here cannot drift from what the guards do.
 */
import type { ContextInput, Person } from '@/core/index';

export interface Sample {
  id: string;
  title: string;
  /** One line under the title in the picker. */
  blurb: string;
  /** Which guards the draft exercises, in the reader's terms. */
  catches: string;
  /** What the draft says that Readback deliberately leaves alone. */
  quiet: string;
  sentAt: string;
  message: string;
  sender: Person;
  recipients: Person[];
  /** A reply with slips in it. */
  draft: string;
}

const person = (name: string, emailLocal: string, role: Person['role']): Person => ({
  name,
  emailLocal,
  role,
});

export const SAMPLES: readonly Sample[] = [
  {
    id: 'deposit',
    title: 'Landlord deposit',
    blurb: 'A flat, a deposit and a key handover.',
    catches: 'A name and an amount',
    quiet: 'Thursday the 12th is right, so the date is left alone.',
    sentAt: '2026-11-02',
    message: `Hi Sam,

Great news, the flat at 14 Larchmont Road is yours from the 1st. Before I hand over the keys, can you confirm the $1,250 deposit, drop off the keys on Thursday the 12th, and send the signed lease back?

Let me know if you have any questions!

Thanks,
Kathryn

On Fri, Oct 30, 2026 at 6:02 PM Sam Ortiz <sam.ortiz@example.com> wrote:
> Hi Catherine, is the flat still available? Could you send the lease?
`,
    sender: person('Kathryn Moss', 'kathryn.moss', 'sender'),
    recipients: [person('Sam Ortiz', 'sam.ortiz', 'to')],
    draft:
      "Hi Catherine,\n\nThe $1,520 deposit is confirmed, and I'll drop the keys off Thursday the 12th and send the lease tonight.\n\nSam",
  },
  {
    id: 'invoice',
    title: 'Client invoice',
    blurb: 'An invoice number, a total and a payment date.',
    catches: 'A name and an invoice number',
    quiet: 'Offering $4,200 instead of $4,800 is a negotiation, not a typo.',
    sentAt: '2026-11-03',
    message: `Hi Dana,

Thanks for the draft designs. Here is the invoice for the brand refresh: INV-20931, total $4,800, due Friday the 20th.

Can you confirm the PO number on your side and send the remittance details?

Best,
Steven Albrecht
Albrecht & Daughters Studio
`,
    sender: person('Steven Albrecht', 'steven', 'sender'),
    recipients: [person('Dana Whitfield', 'dana.whitfield', 'to')],
    draft:
      'Hi Stephen,\n\nGot INV-20913, thank you. I will pay it by Friday the 20th. If the budget slips, could we do $4,200 instead?\n\nDana',
  },
  {
    id: 'school',
    title: 'School trip',
    blurb: 'A permission slip, a fee and a coach time.',
    catches: 'A name and a weekday that does not match',
    quiet: 'The fee, £35, is repeated exactly as written.',
    sentAt: '2026-11-04',
    message: `Dear parents,

Year 5 visit the Science Museum on Wednesday the 18th. The coach leaves at 8:15 and returns by 3:30. Please send the £35 fee and the signed permission slip by Friday.

Could you also tell me about any allergies?

Kind regards,
Mrs Okafor
`,
    sender: person('Ngozi Okafor', 'n.okafor', 'sender'),
    recipients: [person('Jon Hale', 'jon.hale', 'to')],
    draft:
      'Dear Mrs Okafor,\n\nJohn will be there on Tuesday the 18th with the £35. He has a peanut allergy.\n\nJon Hale',
  },
  {
    id: 'order',
    title: 'Order support',
    blurb: 'A missing parcel and a refund.',
    catches: 'An order number and a total',
    quiet: 'A different order number, 77102, is mentioned and not flagged.',
    sentAt: '2026-11-05',
    message: `Hello Maya,

I'm sorry your parcel is late. Order #48213 (total $89.50) left our warehouse on Monday. Can you confirm the delivery address, and tell me whether you'd prefer a refund or a replacement?

Regards,
Priya Raman
Customer care
`,
    sender: person('Priya Raman', 'priya.raman', 'sender'),
    recipients: [person('Maya Lindqvist', 'maya.lindqvist', 'to')],
    draft:
      'Hi Priya,\n\nOrder #48231 still has not arrived, and I was charged $89.05. The address is right. A refund is fine. My older order 77102 was fine.\n\nMaya',
  },
  {
    id: 'recruiter',
    title: 'Recruiter scheduling',
    blurb: 'A call time and a name that has two spellings.',
    catches: 'A name and a date',
    quiet: 'Asking for Monday the 23rd instead is a new proposal, so it is left alone.',
    sentAt: '2026-11-09',
    message: `Hi Alex,

Thanks for applying. Could we do a call on Tuesday the 17th at 2pm? It runs about 30 minutes. Please let me know if that works and send an updated CV.

Best,
Geoff Whitlock
Talent partner
`,
    sender: person('Geoff Whitlock', 'geoff.whitlock', 'sender'),
    recipients: [person('Alex Moreno', 'alex.moreno', 'to')],
    draft:
      'Hi Jeff,\n\nThursday the 17th at 2pm works for me. If it does not, Monday the 23rd is free. CV attached.\n\nAlex',
  },
  {
    id: 'quote',
    title: 'Contractor quote',
    blurb: 'A quote reference, a price and a start date.',
    catches: 'A name and a price',
    quiet: 'Saying $11,000 would be a counter-offer, not a slip, so it is not flagged.',
    sentAt: '2026-11-12',
    message: `Hi Ruth,

Here is the quote for the kitchen: Q-7731, $12,400 including materials. We can start Monday the 23rd. Can you confirm the quote number, approve the $12,400, and send over the access code?

Cheers,
Shaun Pereira
Pereira Building
`,
    sender: person('Shaun Pereira', 'shaun', 'sender'),
    recipients: [person('Ruth Adeyemi', 'ruth.adeyemi', 'to')],
    draft:
      'Hi Sean,\n\nQuote Q-7731 is approved at $12,040. Monday the 23rd is fine. Would $11,000 be possible if we supply the tiles?\n\nRuth',
  },
] as const;

export const DEFAULT_SAMPLE_ID = 'deposit';

export function sampleById(id: string | null | undefined): Sample | undefined {
  return SAMPLES.find((s) => s.id === id);
}

/** The engine input for a sample (the same shape the extension builds from Gmail). */
export function sampleInput(sample: Sample): ContextInput {
  return {
    source: 'playground',
    threadId: `sample:${sample.id}`,
    sentAt: sample.sentAt,
    message: sample.message,
    sender: sample.sender,
    recipients: sample.recipients,
  };
}
