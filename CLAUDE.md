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

- There is no audit log of letter-generation activity. An earlier design kept one (`letters_log`: who/when/which template), but it was removed once the app's signature block started embedding the operator's code in every sent letter — Gmail's own sent-mail record plus that embedded signature already answers "who sent this," so a separate DB table was redundant. See `docs/superpowers/specs/2026-07-19-independent-template-variants-design.md` for the reasoning and the condition under which it would need reinstating (e.g. if operators ever stop sharing one Gmail account).
- Recipient/BCC emails are entered per-generation in the UI and are **never persisted** — they exist only long enough to build a Gmail compose URL / clipboard payload.
- Case references stored anywhere in the app are short pseudonymous codes (e.g. `A001`), never full case names.
- Never write real case data into this repo or into any AI prompt — all seed/test data must be synthetic.

### Letter template rendering pipeline (`src/lib/letters/`)

Each `Template` row is keyed by `category` **and** `variant` (`@@unique([category, variantLabel])`) — every variant of a letter (e.g. 媒合信's 一般/伴侶/青壯/重大災害/EAP/公益) is its own independent row with its own `subject`/`body`/`requiredFields`, edited separately in the templates UI. This replaced an earlier design where one row per category held all variants concatenated together behind bracket-syntax conditionals (`[只有]`/`[除外]`) — that mechanism (`variantBlocks.ts`) was deleted once every variant got its own row; see `docs/superpowers/specs/2026-07-19-independent-template-variants-design.md` for why.

- `slotBlocks.ts` — `[單一時段]...[/單一時段]` / `[多個時段]...[/多個時段]`, chosen by how many candidate time slots the operator entered (`slotCount`), for letters that offer one vs. several proposed appointment times. This is the one remaining bracket-syntax mini-language — it stays because it's driven by a runtime value (how many slots the operator typed), not by which variant row was selected.
- `highlightMarkup.ts` — `**text**` always means bold + light-yellow background as one combined style (there is no bold-only or highlight-only). Produces both an HTML string (for clipboard copy into Gmail) and a plain-text fallback.
- `dateFormat.ts` — formats a date+time range into `M/D (星期) HH:MM-HH:MM` with the weekday auto-computed from the date (never hand-typed) and **no year** in the output — this is intentional, not a gap.
- `signature.ts` — the closing signature block is a fixed constant (not stored per-template) appended at render time, with the operator's `session.signature` code substituted in; an official LINE contact line is optionally appended per-send via a checkbox.
- `render.ts` orchestrates: required-field check → `resolveSlotBlocks` → Handlebars compile. `requiredFields` is a JSON-encoded string array in SQLite (no native array column type) — always go through `encodeRequiredFields`/`decodeRequiredFields` (`requiredFields.ts`) at the DB boundary; never read/write the raw JSON string elsewhere.
- `templateFields.ts` — flags `{{field}}` references in a template body that aren't in its declared `requiredFields` (non-blocking warning on save, not a hard error).
- `gmailUrl.ts` — builds a `mail.google.com/mail/?view=cm&...` compose URL. This URL's `body` param is **plain-text only** — it cannot carry bold/highlight formatting, which is why the generate page copies the HTML-formatted letter to the clipboard separately and leaves the operator to paste it into the opened draft rather than relying on the URL to fill the body.

### Docs as source of truth for intent

`docs/superpowers/specs/*.md` and `docs/superpowers/plans/*.md` record the *why* behind non-obvious decisions (schema tradeoffs, rejected alternatives like Gmail API/OAuth or IMAP+App-Password auto-drafting, scale assumptions). When a design decision seems surprising, check there before assuming it's unintentional — most of the "missing" features (delete buttons, HTTPS, auto-send) are deliberately deferred, not overlooked.
