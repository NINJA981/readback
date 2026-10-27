/**
 * Word lists shared by the guards and the ask extractor. Data only.
 */

const list = (s: string): Set<string> => new Set(s.trim().split(/\s+/));

/** Function words ignored when extracting an ask's key terms. */
export const STOP_WORDS = list(`
a about above after again against all am an and any are aren't as at be because been before being
below between both but by can can't cannot could couldn't did didn't do does doesn't doing don't down
during each few for from further had hadn't has hasn't have haven't having he he'd he'll he's her here
here's hers herself him himself his how how's i i'd i'll i'm i've if in into is isn't it it's its itself
let's me more most mustn't my myself no nor not of off on once only or other ought our ours ourselves
out over own same shan't she she'd she'll she's should shouldn't so some such than that that's the
their theirs them themselves then there there's these they they'd they'll they're they've this those
through to too under until up very was wasn't we we'd we'll we're we've were weren't what what's when
when's where where's which while who who's whom why why's with won't would wouldn't you you'd you'll
you're you've your yours yourself yourselves also just still yet really please thanks thank kindly
maybe perhaps quick quickly soon today tomorrow tonight let know get got make sure able like need want
okay ok hi hey hello dear back again anything something everything everyone anyone someone
`);

/** Request verbs that start a coordinated ask segment ("…, drop off the keys, and send…"). */
export const REQUEST_VERBS = list(`
add advise answer approve arrange ask attach book bring call cancel change check clarify come complete
confirm connect cover deliver double-check drop email fill find finalise finalize fix follow forward
give grab handle help hold include introduce invite invoice leave let look loop mail make move note order pass
organise organize pack pay pick post prepare print provide remind put reach read reply reschedule reserve return review run schedule
send set share ship sign sort start submit swap take tell text transfer update upload verify wire
`);

/**
 * Common English words that are often capitalised (sentence starts, titles)
 * and must never be read as names by the name guard.
 */
export const COMMON_WORDS = list(`
the and for are but not you all any can had her was one our out day get has him his how man new now old
see two way who boy did its let put say she too use dad mom mum able about above after again also always
another answer anyway around because been before being below best better between both bring call came
come could dear does done down each even every first from good great happy have hello here hope however
into just keep know last later least less like little look made make many maybe more most much must need
never next nice note once only other over please quick quite rather really right said same should since
some soon sorry still such sure take tell than thank thanks that their them then there these they thing
think this those though thought through time today together tomorrow tonight under until very want well
were what when where which while will with would yeah year your yours also anyway sounds sound perfect
great awesome lovely brilliant cool fine okay agreed absolutely definitely certainly regards cheers
best warmly sincerely kind kindly hi hey dear morning afternoon evening night week weekend month
monday tuesday wednesday thursday friday saturday sunday mon tue tues wed thu thur thurs fri sat sun
january february march april may june july august september october november december jan feb mar apr
jun jul aug sep sept oct nov dec spring summer autumn fall winter christmas easter
yes yep nope no not none nothing something everything anything someone everyone anyone nobody
just one two three four five six seven eight nine ten first second third last next previous
attached attachment invoice order booking deposit lease keys contract quote estimate receipt payment
meeting call calendar schedule update team office school class trip project report draft file link
also following regarding re fwd fw subject sent from to cc bcc date mail email gmail inbox
dad mum mom sir madam team all folks guys everybody friends hello greetings welcome congrats
congratulations happy merry dear apologies sorry unfortunately fortunately hopefully actually
basically honestly frankly luckily sadly otherwise meanwhile besides instead still though although
since because unless whether either neither both each every few several many most some such
mr mrs ms dr prof sir ok ps pps fyi asap eod eta tbd tba btw imo
i i'm i'll i've i'd we we're we'll it it's that's there's here's let's what's who's
`);

/** Weekday names and abbreviations → 0 (Sunday) … 6 (Saturday). */
export const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;
