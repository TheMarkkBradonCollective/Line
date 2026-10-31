# LINE

LINE looks and works like an ordinary social network (news feed, photos, videos, Loops, reactions, comments, friends, profiles) with one rule: **no share, no see.** You see a post only if you made it, or someone shared it with you, directly, through a group or list, or down a reshare chain. Profiles are open to everyone signed in, but the posts on them are not: on someone else’s profile you only see what reached you. There is no public shelf, no content search, and no recommended feed.

Wired like Facebook, styled like Vine, run share-first.

Flow: **Create → Share → Receive → Reshare → Continue.**

**The full rules in plain language: [docs/RULES.md](docs/RULES.md)** (also in the app under Menu → How LINE works).

## Stack

- **Next.js 15** on **Cloudflare Workers** via [@opennextjs/cloudflare](https://opennext.js.org/cloudflare)
- **Neon Postgres** (`@neondatabase/serverless`, env `DATABASE_URL`)
- **R2** private media bucket (`MEDIA` binding, bucket `line-media`)
- **Self-hosted auth**: bcrypt passwords in `auth.users`, session cookie JWT (`AUTH_SECRET`)

Copy `.env.example` to `.env.local` for local dev. Never commit secrets.

## Run locally

```bash
npm install
cp .env.example .env.local
# Set DATABASE_URL (Neon pooled or local Postgres), AUTH_SECRET (32+ chars)
npm run db:migrate
npm run dev
```

Open [http://localhost:43921](http://localhost:43921). Sign up or sign in with email and password.

`next dev` loads Cloudflare bindings from `wrangler.jsonc` (R2 `MEDIA` when configured).

Reset all data (destructive):

```bash
npm run db:reset -- --yes
```

## Database

One idempotent schema file: `db/line_schema.sql` (merged from the former Supabase migrations).

```bash
npm run db:migrate
```

Uses `DIRECT_DATABASE_URL` when set (Neon **direct** URI), otherwise `DATABASE_URL`.

## Deploy to Cloudflare

1. Create a Neon project and run `npm run db:migrate` against it once.
2. Create R2 bucket `line-media` and enable R2 on the account.
3. Build: `npm run cf:build`
4. Set secrets (never in `wrangler.jsonc`):

```bash
npx wrangler secret put DATABASE_URL
npx wrangler secret put AUTH_SECRET
```

5. Deploy: `npx wrangler deploy` (or `npm run deploy:preview` for the `preview` env on workers.dev)

Optional public URL for password-reset links and Capacitor:

```bash
npx wrangler secret put NEXT_PUBLIC_SITE_URL   # or set in dashboard / .dev.vars locally
```

### Bindings and env (production)

| Name | Kind | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | secret | Neon pooled Postgres connection string |
| `AUTH_SECRET` | secret | HS256 key for session cookie and upload tickets (32+ chars) |
| `MEDIA` | R2 binding | Private bucket `line-media` (`wrangler.jsonc`) |
| `ASSETS` | static assets | OpenNext asset binding (automatic) |
| `NEXT_PUBLIC_SITE_URL` | optional var | Canonical site URL for emails and deep links |

Preview env (`wrangler deploy --env preview`) uses workers.dev; R2 may be omitted until R2 is enabled—media then falls back to `media_objects` in Postgres.

## Import from Supabase

Dry-run by default. Postgres copy:

```bash
SOURCE_DATABASE_URL='postgresql://…' DIRECT_DATABASE_URL='postgresql://…' npm run db:import
SOURCE_DATABASE_URL='…' DIRECT_DATABASE_URL='…' SUPABASE_URL='…' SUPABASE_SERVICE_ROLE_KEY='…' npm run db:import -- --storage --write
```

JSON export fallback: `npm run db:import -- dump.json [--media-dir files/] [--write]`

## Tests and lint

```bash
npm run test:core-rule   # throwaway Postgres schema (embedded DB if TEST_DATABASE_URL unset)
npm run lint
npm run build
npm run cf:build
```

## Design

LINE keeps Vine’s green (`#00BF8F`) and bold wordmark, on a token-based design system in `app/globals.css` and `tailwind.config.ts`:

- Color tokens (green with deep, strong, soft, and tint shades, plus neutral surfaces and ink) as CSS variables. Dark mode follows `prefers-color-scheme`.
- Bricolage Grotesque for headings and the wordmark, Inter for UI text. Icons are `lucide-react`.
- Phone: green glass header (people search, notifications bell, menu), news-feed cards separated by thin gaps, and a frosted tab bar **Home · Loops · [Create] · Discover · Profile** (customizable in Settings → Tab bar) with the raised Create button at the exact center (two tabs on each side, equal flex).
- Desktop (1280px and up): left nav, centered feed, and a right rail with friend requests, your own friends to share with, and people you may know (by mutual friends only). It is not a discover feed. From 768px to 1279px the right rail is hidden.
- Feed cards read like a familiar news feed: author row with time and audience (“Shared with you”, “Shared with Saturday kitchen”), a “passed this to you” line and chain chips when it came through other people, the sender’s note, text or coloured status card, photo grid (1–4+), inline video, or a 4:5 Loop poster, then a reaction summary and a **Like · Comment · Share** bar.
- Reactions: Like, Love, Haha, Wow, Sad. Tap to like, hold (or right-click, or press ↑ on the button) for the picker. One reaction per person per post.
- Share opens a bottom sheet (a dialog on desktop): search friends, pick groups and lists, multi-select, add a note, and see a “Sent” confirmation. `/share/[id]` renders the same picker as a full page.
- Loops: a full-height vertical swipe player (scroll-snap) with an action column and caption. It only ever contains Loops shared with you, plus your own.
- Motion: card rise-in, reaction pop, a slow pan on playing video and Loops, share press, sheet slide-up, and skeleton loaders. All of it is turned off under `prefers-reduced-motion`.

## What you can see

| Where | What shows |
| --- | --- |
| Home | Every post shared with you (once per post, newest share wins) and everything you made. |
| Loops | Loops shared with you and your own. `/loops/[id]` is a 404 unless it was shared with you. |
| Your profile | All of your own posts, photos, videos, and Loops. |
| Someone else’s profile | Cover, avatar, name, bio, About, friend count and list, mutual friends, Add friend, Message. Posts / Photos / Videos / Loops show only their items that reached you, under the note “You’ll only see what’s been shared with you.” |
| Post page | The post, reactions, and comments, if you can see it. Comments and reactions are visible only to people who can see the post. The author sees who has it; everyone else sees only the path that reached them. |
| Media | `/media/[postId]/[index]` serves each frame with `Cache-Control: private, no-store`, after the same access check. |
| Friends | Requests, people you may know (mutual friends only), your friends, groups and lists, privacy and blocking. |
| Find people | Search people by name. People only, never posts. |

Blocking still closes everything: a person you block can’t open your profile, can’t share with you, and neither of you sees the other’s posts, comments, or reactions. “Not accepting shares” (who can share with you → Nobody) still works. The old per-profile privacy that hid profiles is gone.

“Message” opens Create with that friend pre-picked: on LINE, a message is a post shared with just them.

## One access check

`lib/access.ts` holds the rule. `postAccess(db, viewer, post)` returns `author`, `shared`, `staff`, or nothing; `canViewPost` wraps it and only counts `author` and `shared` unless a caller passes `{ allowStaff: true }`. Blocks in either direction deny access, and hidden posts are open only to their author and moderators.

Everything goes through it, on the server: the home feed (`getHomeFeed`), profile sections (`profilePosts`), Loops (`listReels`, `getReel`), the post page, comments (`listComments`, `addComment`), reactions (`setReaction`, `postEngagement`), and the media route. The UI never decides visibility on its own. Staff with moderation grants can open a post as a case file (post page and media only); that never adds anything to their feed, Loops, or profile views.

## Core rule check

```bash
npm run test:core-rule
```

The script builds a throwaway Postgres schema and asserts share-first visibility, blocks, staff grants, groups, uploads, and audit immutability (see script output for the full list).

## Test data

Production starts empty: real sign-ups only. Sample people and posts in `scripts/fixtures.ts` load only into the throwaway DB used by `npm run test:core-rule`.

## Build the Android debug APK

The `android/` project is a Capacitor shell around this website. The database stays on the server. The APK is not committed.

Requirements:

- `ANDROID_HOME` or `ANDROID_SDK_ROOT` pointing at the Android SDK
- A JDK on `PATH` (JDK 17 is a safe match for current Android Gradle)

```bash
npm run build:apk
```

Point the WebView at your deployed LINE URL:

```bash
CAPACITOR_SERVER_URL=https://line.your-domain.example npm run build:apk
```

Without `CAPACITOR_SERVER_URL`, the APK opens `www/index.html`, where you can type the server address.

## Auth and media

- **Sign up / sign in / sign out** on the home page; sessions are httpOnly JWT cookies.
- **Password reset**: forgot-password issues a one-hour signed link (`/reset-password?token=…`). Email sending is stubbed (TODO in `forgotPasswordAction`).
- **Post media** lives in R2 (`u/…` paths). It is served only from `/media/[postId]/[index]` after `lib/access.ts` passes.
- **Profile photos** use `p/…` paths and `/pm/…` (public profile assets).

## What is stubbed

- Outbound email (password reset logs the link in dev).
- Push notifications.
- Payments and full support CRM.
- Direct messages (Message → Create with one friend).
- Video transcoding beyond stored uploads.
