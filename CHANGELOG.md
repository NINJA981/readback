# Changelog

All notable changes are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [0.1.0] - unreleased

First public version. Pre-release: not in any browser store yet.

### Added

- **Name guard.** Flags a name in your reply that is one or two edits from a name in the thread
  (sender, signature, To and Cc chips), or a known variant (`Catherine` and `Kathryn`,
  `Steven` and `Stephen`, `Jon` and `John`).
- **Number guard.** Flags an amount or ID with swapped or changed digits against one quoted in
  the thread (`$1,520` against `$1,250`, `#48231` against `#48213`). Counter-offers, different
  amounts and different kinds of number stay quiet.
- **Date guard.** Flags a weekday that does not match its date (`Thursday the 10th` when the 10th
  is a Tuesday) and a near-miss of a date the thread proposed.
- **Guard card.** Each squiggle cites the thread line it was checked against and fixes the slip in
  one click; Ctrl+Z undoes the fix in the editor's own history.
- **Ask pill and ledger.** Counts the direct questions and requests in the latest message that
  the reply has not covered, with dismiss, restore and answer-inline.
- **Adapters.** Gmail on the web (built against synthetic markup, see Limitations in the README)
  and any text box on any site through "Use as Readback context".
- **Popup and options.** Per-guard switches, per-site off switch, ignored words, theme, Clear all
  with Undo, and keyboard shortcuts (Alt+Shift+J next slip, Alt+Shift+L ledger).
- **Web app** (`site/`, route `/app`). The same engine in a static page: paste a thread and a
  reply, works offline as a PWA, makes no requests to other origins.
- Chrome MV3 and Firefox MV3 builds, CI workflow, contribution guide, issue templates.

### Known limitations

See the Limitations section of the README. In short: never run against live Gmail, the Firefox
build has never been run, and the optional "looks answered" model is not included.

[0.1.0]: https://github.com/NINJA981/readback/releases/tag/v0.1.0
