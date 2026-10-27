/**
 * Boilerplate that looks like a question or request but asks for nothing the
 * reply has to cover (SPEC F6 stop-list). Matched against the folded sentence
 * with punctuation removed.
 */
export const BOILERPLATE: readonly RegExp[] = [
  /^(?:please )?let me know if you have any (?:other |further |more |additional )?(?:questions|concerns|issues|problems)\b/,
  /^(?:please )?let me know if (?:you need|there'?s|there is) anything(?: else)?\b/,
  /^(?:please )?let me know if i can (?:help|be of (?:any )?help|do anything)\b/,
  /^(?:please )?let me know if you need (?:any|anything|more|help|further)\b/,
  /^(?:please )?(?:feel free|don'?t hesitate|do not hesitate) to\b/,
  /^(?:please )?reach out if\b/,
  /^any (?:other |further |more )?questions\b/,
  /^(?:any )?thoughts\b/,
  /^how are (?:you|things)\b/,
  /^how(?:'s| is) (?:it going|everything|life|your (?:week|day|weekend))\b/,
  /^how was (?:your|the) (?:weekend|week|trip|holiday|holidays|break|day|vacation|summer|flight)\b/,
  /^how have you been\b/,
  /^(?:i )?hope (?:you(?:'re| are)|this (?:email |message |note )?finds you|all is|everything is|you had|you have|you all)\b/,
  /^(?:does|did) (?:that|this|it) (?:make sense|help)\b/,
  /^make sense\b/,
  /^(?:sound|sounds) good\b$/,
  /^(?:you )?know what i mean\b/,
  /^can you believe\b/,
  /^(?:who|what) (?:knew|a (?:day|week|year))\b/,
  /^right$/,
  /^isn'?t (?:it|that)\b/,
  /^(?:wouldn'?t|won'?t) you (?:agree|say)\b/,
  /^(?:guess|what do you know|go figure)\b/,
  /^(?:want|would you like) (?:fewer|more|less) (?:emails|messages|updates|newsletters)\b/,
  /^(?:want|wish|would you like) to (?:unsubscribe|opt out|stop receiving)\b/,
  /^(?:thank you|thanks)(?: (?:so|very) much)?(?: again)?$/,
  /^(?:please )?(?:find|see) (?:attached|enclosed|below|above)\b/,
  /^(?:please )?note that\b/,
  /^(?:please )?keep in mind\b/,
  /^(?:please )?(?:have a|enjoy (?:your|the)) (?:great|good|nice|lovely|wonderful)?\s?(?:day|weekend|week|evening|holiday|holidays|trip)\b/,
  /^(?:can|could) you imagine\b/,
  /^(?:why|how) not\b/,
  /^what(?:'s| is) (?:new|up)\b/,
  /^(?:are you )?(?:ready|excited) for the (?:weekend|holidays?)\b/,
  /^(?:shall|should) we\b.*\bsoon\b/,
  /^would you believe\b/,
  /^(?:sorry|apologies),? (?:for|about)\b/,
  /^let me know your thoughts$/,
  /^(?:speak|talk) (?:soon|later)\b/,
  /^(?:looking|look) forward to\b/,
  /^(?:just )?(?:checking|wanted to check) in\b(?!.*\b(?:whether|if|can you|could you)\b)/,
  /^(?:you )?(?:there|around)\b$/,
];

export function isBoilerplate(foldedSentence: string): boolean {
  const s = foldedSentence
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return BOILERPLATE.some((re) => re.test(s));
}
