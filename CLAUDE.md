# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Next.js admin tool for a counseling clinic (加惠心理諮商) that replaces manual copy-paste letter drafting. Single Next.js project (App Router) serving both UI and API routes, backed by a single-file SQLite database via Prisma. Deployment target is one local Windows machine (see `docs/WINDOWS_SETUP.md`), not a server — this shapes several deliberate architectural choices below.

## Commands

```bash
npm run dev              # dev server
npm run build && npm start
npm test                 # vitest run (all tests)
npx vitest run src/lib/letters/render.test.ts   # single test file
npx vitest run src/lib/letters/render.test.ts -t "test name"  # single test case

npx prisma migrate dev --name <name>   # create+apply a migration (dev)
npx prisma migrate deploy              # apply migrations (prod-style, no prompts)
npx prisma db seed                     # run prisma/seed.ts (synthetic data, idempotent upserts)
npx prisma studio                      # browser-based DB viewer/editor, used for local data setup
```

## Architecture

### No password, ever — by design

Operators are identified by picking their name from a fixed list (`/select`), not logging in. `User` has no password field. `src/middleware.ts` redirects any session-less request to `/select`, but selecting an identity performs no verification — this is a conscious tradeoff for a ≤5-person, single-machine, no-network-exposure deployment, not an oversight. Do not add credential checks back in. Session state (`userId`, `name`, `signature`) lives in an iron-session cookie set up in `src/lib/auth/session.ts`.

### Privacy-by-minimization in the data model

- `letters_log` (audit log) records only who/when/which template — never the case reference, recipient email, or rendered letter body.
- Recipient/BCC emails are entered per-generation in the UI and are **never persisted** — they exist only long enough to build a Gmail compose URL / clipboard payload.
- Case references stored anywhere in the app are short pseudonymous codes (e.g. `A001`), never full case names.
- Never write real case data into this repo or into any AI prompt — all seed/test data must be synthetic.

### Letter template rendering pipeline (`src/lib/letters/`)

Each `Template` row is keyed by `category` alone (not by category+variant) — variant differences live *inside* one shared `body`/`subject` string using two independent bracket-syntax mini-languages, resolved before Handlebars compiles the remaining `{{field}}` placeholders:

- `variantBlocks.ts` — `[只有 A、B]...[/只有]` (shown only for those variants) / `[除外 A、B]...[/除外]` (shown for all others). Selected variant is passed in at render time from `Template.variants` (JSON-encoded array).
- `slotBlocks.ts` — `[單一時段]...[/單一時段]` / `[多個時段]...[/多個時段]`, chosen by how many candidate time slots the operator entered (`slotCount`), for letters that offer one vs. several proposed appointment times.
- `highlightMarkup.ts` — `**text**` always means bold + light-yellow background as one combined style (there is no bold-only or highlight-only). Produces both an HTML string (for clipboard copy into Gmail) and a plain-text fallback.
- `dateFormat.ts` — formats a date+time range into `M/D (星期) HH:MM-HH:MM` with the weekday auto-computed from the date (never hand-typed) and **no year** in the output — this is intentional, not a gap.
- `signature.ts` — the closing signature block is a fixed constant (not stored per-template) appended at render time, with the operator's `session.signature` code substituted in; an official LINE contact line is optionally appended per-send via a checkbox.
- `render.ts` orchestrates: required-field check → `resolveVariantBlocks` → `resolveSlotBlocks` → Handlebars compile. `requiredFields` and `variants` are both JSON-encoded string arrays in SQLite (no native array column type) — always go through `encodeRequiredFields`/`decodeRequiredFields` (`requiredFields.ts`) at the DB boundary; never read/write the raw JSON string elsewhere.
- `templateFields.ts` — flags `{{field}}` references in a template body that aren't in its declared `requiredFields` (non-blocking warning on save, not a hard error).
- `gmailUrl.ts` — builds a `mail.google.com/mail/?view=cm&...` compose URL. This URL's `body` param is **plain-text only** — it cannot carry bold/highlight formatting, which is why the generate page copies the HTML-formatted letter to the clipboard separately and leaves the operator to paste it into the opened draft rather than relying on the URL to fill the body.

### Docs as source of truth for intent

`docs/superpowers/specs/*.md` and `docs/superpowers/plans/*.md` record the *why* behind non-obvious decisions (schema tradeoffs, rejected alternatives like Gmail API/OAuth or IMAP+App-Password auto-drafting, scale assumptions). When a design decision seems surprising, check there before assuming it's unintentional — most of the "missing" features (delete buttons, HTTPS, auto-send) are deliberately deferred, not overlooked.
