# LINE

LINE looks and works like an ordinary social network (news feed, photos, videos, Reels, reactions, comments, friends, profiles) with one rule: **no share, no see.** You see a post only if you made it, or someone shared it with you, directly, through a group or list, or down a reshare chain. Profiles are open to everyone signed in, but the posts on them are not: on someone else’s profile you only see what reached you. There is no public shelf, no content search, and no recommended feed.

Wired like Facebook, styled like Vine, run share-first.

Flow: **Create → Share → Receive → Reshare → Continue.**

## Run the website

```bash
npm install
npm run dev
```

Open [http://localhost:43921](http://localhost:43921).

The first request creates `data/line.sqlite` and seeds the demo world. There are no passwords. On the home page, pick a person.

Reset the database:

```bash
npm run db:reset
```

The next request seeds it again.

Production-style start after a build:

```bash
npm run build
npm start
```

`npm start` also listens on port 43921.

## Design

LINE keeps Vine’s green (`#00BF8F`) and bold wordmark, on a token-based design system in `app/globals.css` and `tailwind.config.ts`:

- Color tokens (green with deep, strong, soft, and tint shades, plus neutral surfaces and ink) as CSS variables. Dark mode follows `prefers-color-scheme`.
- Bricolage Grotesque for headings and the wordmark, Inter for UI text. Icons are `lucide-react`.
- Phone: green glass header (people search, notifications bell, menu), news-feed cards separated by thin gaps, and a frosted tab bar **Home · Reels · [Create] · Friends · Profile** with the raised Create button at the exact center (two tabs on each side, equal flex).
- Desktop (1280px and up): left nav, centered feed, and a right rail with friend requests, your own friends to share with, and people you may know (by mutual friends only). It is not a discover feed. From 768px to 1279px the right rail is hidden.
- Feed cards read like a familiar news feed: author row with time and audience (“Shared with you”, “Shared with Saturday kitchen”), a “passed this to you” line and chain chips when it came through other people, the sender’s note, text or coloured status card, photo grid (1–4+), inline video, or a 4:5 reel poster, then a reaction summary and a **Like · Comment · Share** bar.
- Reactions: Like, Love, Haha, Wow, Sad. Tap to like, hold (or right-click, or press ↑ on the button) for the picker. One reaction per person per post.
- Share opens a bottom sheet (a dialog on desktop): search friends, pick groups and lists, multi-select, add a note, and see a “Sent” confirmation. `/share/[id]` renders the same picker as a full page.
- Reels: a full-height vertical swipe player (scroll-snap) with an action column and caption. It only ever contains reels shared with you, plus your own.
- Motion: card rise-in, reaction pop, a slow pan on playing video and reels, share press, sheet slide-up, and skeleton loaders. All of it is turned off under `prefers-reduced-motion`.

## What you can see

| Where | What shows |
| --- | --- |
| Home | Every post shared with you (once per post, newest share wins) and everything you made. |
| Reels | Reels shared with you and your own. `/reels/[id]` is a 404 unless it was shared with you. |
| Your profile | All of your own posts, photos, videos, and reels. |
| Someone else’s profile | Cover, avatar, name, bio, About, friend count and list, mutual friends, Add friend, Message. Posts / Photos / Videos / Reels show only their items that reached you, under the note “You’ll only see what’s been shared with you.” |
| Post page | The post, reactions, and comments, if you can see it. Comments and reactions are visible only to people who can see the post. The author sees who has it; everyone else sees only the path that reached them. |
| Media | `/media/[postId]/[index]` serves each frame with `Cache-Control: private, no-store`, after the same access check. |
| Friends | Requests, people you may know (mutual friends only), your friends, groups and lists, privacy and blocking. |
| Find people | Search people by name. People only, never posts. |

Blocking still closes everything: a person you block can’t open your profile, can’t share with you, and neither of you sees the other’s posts, comments, or reactions. “Not accepting shares” (who can share with you → Nobody) still works. The old per-profile privacy that hid profiles is gone.

“Message” opens Create with that friend pre-picked: on LINE, a message is a post shared with just them.

## One access check

`lib/access.ts` holds the rule. `postAccess(db, viewer, post)` returns `author`, `shared`, `staff`, or nothing; `canViewPost` wraps it and only counts `author` and `shared` unless a caller passes `{ allowStaff: true }`. Blocks in either direction deny access, and hidden posts are open only to their author and moderators.

Everything goes through it, on the server: the home feed (`getHomeFeed`), profile sections (`profilePosts`), Reels (`listReels`, `getReel`), the post page, comments (`listComments`, `addComment`), reactions (`setReaction`, `postEngagement`), and the media route. The UI never decides visibility on its own. Staff with moderation grants can open a post as a case file (post page and media only); that never adds anything to their feed, Reels, or profile views.

## Core rule check

```bash
npm run test:core-rule
```

The script builds a throwaway SQLite database and asserts:

- Marcus’s river note, shared only with Jordan, is on Jordan’s timeline and not on Alex’s, Sam’s, or Marcus’s.
- Riley’s market photo is shared with Marcus only. The hall reel is shared with Noah only.
- After Marcus passes the market photo to Alex, it appears on Alex’s timeline. Sam, Jordan, and Riley still do not have it.
- Mina’s rooftop photo reaches Marcus through Alex and Jordan, and the timeline item reports that chain in order. Sam and Mina do not get it.
- Every timeline row is a share addressed to that person.
- On Jordan’s profile, Marcus sees only the sauce video, pancake reel, and knife note Jordan sent him, never the Saturday kitchen peaches or timer reel. Jordan sees all of his own posts. The Reels and Photos tabs follow the same rule.
- Noah (not Marcus’s friend) has a viewable profile that shows Marcus no posts. Mina’s profile shows Marcus only the rooftop that reached him through the chain.
- Riley’s hall reel can’t be opened by Marcus by id, by media access, or through Reels. Noah can open it.
- Alex can’t read, add, or count comments or reactions on the river note. Sam can’t read the rooftop comments.
- The reshare chain gives Marcus the rooftop in his home feed. Sam doesn’t get it.
- The home feed holds own posts, shows each post once, and every item passes the access check, for every seeded person.
- A manager’s home feed is empty: case access is not a feed.
- People search finds people by name; suggestions are friends of friends only.
- A block closes the blocker’s profile and posts; unblocking restores what was shared.
- Staff grants are explicit. Removing Moderator’s `review_reports` grant closes that queue even though the role title stays. Administrator does not have platform ownership. Founder does.
- Audit rows cannot be updated or deleted.

## Demo logins

People:

| Username | You’ll see |
| --- | --- |
| `jordan` | On his own profile, every post including the Saturday kitchen peaches (two photos) and timer reel. In his feed: the river note Marcus sent only to Jordan, Sam’s loaf note after Marcus passed it on, Mina’s rooftop photo after Alex passed it on, Marcus’s bridge photo and gate toast, a creek video from Theo, and a skate loop from Noah. Not the peaches. |
| `alex` | The peaches Jordan sent to the Saturday kitchen group, Priya’s buns, Mina’s dusk loop and rooftop photo, and Marcus’s market coffee. Not the river note. Not Riley’s market photo until someone shares it. |
| `sam` | The peaches, Priya’s buns, and Marcus’s porch-rain reel. Not the river note. Not the loaf note (Sam sent that to Marcus). |
| `marcus` | Best account for screenshots. Home: Mina’s rooftop photo at the end of a three-person chain (Mina → Alex → Jordan → Marcus) with comments and replies, Priya’s three-photo buns passed on by Sam, Jordan’s sauce video, pancake reel, and knife note, Theo’s rapids reel and camp photos, Sam’s loaf note and crackle video, Riley’s market photo, and his own posts (bridge photos, coffee, porch reel, ride video, river note, gate note). `/u/jordan` shows a partial set; `/u/mina` (not a friend) shows only the rooftop; `/u/noah` (not a friend) shows none. |
| `riley` | Only Riley’s own market photo and hall reel. Nobody has shared anything with Riley, who isn’t accepting shares. |
| `noah` | Riley’s hall reel, plus Noah’s own bowl reel. |
| `mina` | Only her own posts (dusk reel, lanterns, rooftop) until someone shares with her. Open `/u/marcus` to see an empty-but-public profile. |
| `theo` | Marcus’s bridge photos and ride video, plus his own creek video, rapids reel, and camp photos. |
| `priya` | Only her own bun photos until someone shares with her. |

Staff, one account per role. The desk opens from permission grants, not from the title.

| Username | Role | What opens |
| --- | --- | --- |
| `casey` | User Support | Accounts, reported-content lookup, tickets. No report queue, no suspend. |
| `quinn` | Moderator | Report queue, hide/restore. Cannot restrict or suspend. |
| `avery` | Senior Moderator | Moderator tools plus restrict. Cannot suspend. |
| `morgan` | Manager | Above, plus suspend, tickets, and the audit log. The seeded spam case sits in this queue. |
| `blake` | Director | Above, plus the staff directory and platform settings. Cannot create accounts or edit grants. |
| `rowan` | Administrator | Privileged staff: create accounts, edit role labels and grants, security, financial note, emergency pause. **No ownership panel.** |
| `sage` | Founder | Every grant, including platform ownership. |

Escalation is Moderator → Senior Moderator → Manager → Director → Administrator or Founder. A director case can be sent to Administrator (platform) or Founder (ownership).

Seeded story, if you want to click it:

1. Sign in as Jordan. The river card says Marcus shared it. Riley’s market photo is not there.
2. Sign out. Sign in as Alex. The river note is absent. The market photo is absent too.
3. Sign in as Marcus. Open the market photo, choose Share, and send it only to Alex. Alex has it. Sam and Jordan still do not.
4. Sign in as `casey`, then `rowan`, then `sage`, and compare which Staff panels exist.

## Build the Android debug APK

The `android/` project is a Capacitor shell around this website. The database stays on the Next.js server. The APK is not committed.

Requirements:

- `ANDROID_HOME` or `ANDROID_SDK_ROOT` pointing at the Android SDK
- A JDK on `PATH` (JDK 17 is a safe match for current Android Gradle)

```bash
npm run build:apk
```

That command writes `android/local.properties` from `ANDROID_HOME`, runs `npx cap sync android`, then:

```bash
cd android && ./gradlew assembleDebug
```

The debug APK is:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Point the WebView at a running LINE server before the Gradle build:

```bash
CAPACITOR_SERVER_URL=http://10.0.2.2:43921 npm run build:apk
```

`10.0.2.2` is the emulator’s address for the computer running `npm run dev`. A physical device needs your computer’s LAN address instead, and the dev server must be reachable from that device.

Without `CAPACITOR_SERVER_URL`, the APK opens `www/index.html`, where you can type the server address. Cleartext HTTP is allowed so a local dev server works.

If `ANDROID_HOME` is missing, `npm run build:apk` exits with instructions and does not invent a binary.

## What works

- Demo sign-in as a seeded person
- Home feed of posts shared with you plus your own, with a composer and a Reels strip
- Reels viewer (vertical swipe), only reels shared with you
- Reactions (Like, Love, Haha, Wow, Sad) and comments with replies, gated by the same rule
- Public profiles with cover, About, friends, mutual friends, Add friend, Message, and Posts / Photos / Videos / Reels filtered to what reached you
- Each feed item names who shared it and the chain it came down
- Create text, photo (several frames), video, and reels, then choose friends, groups, custom lists, or just yourself
- Share and reshare into people’s feeds (not into a message inbox)
- Friends: requests, accept, decline, remove, block, groups, lists, people you may know (mutual friends), people search by name
- Who can share with you, who can add you, who can reshare
- My Posts: recipients, reshares, whether it is in your own feed
- Notifications for a share to you, a post shared onward, a reshared video, a comment on your post, and a reply to your comment
- Reports on posts, videos, and profiles
- Staff desk gated by explicit permission rows
- Audit log (staff member, role, action, affected user or content, time, reason, previous state, new state, case id) that the database refuses to update or delete
- Report queues and escalation
- SQLite persistence

## What is stubbed

- Real photo and video upload, and all transcoding. Media is a chosen placeholder frame.
- Push notifications. Alerts exist only inside the site.
- Payments. The financial panel stores a note and does not charge anyone.
- A full support CRM. Tickets are a short list with open, pending, and closed.
- Email, SMS, and password sign-in. The home page is a person picker.
- Direct messages. “Message” on a profile opens Create with that friend picked; the result is a post shared with just them.
- Profile photos. The avatar is a color and initials.

## Product rule in the data model

`getTimeline` reads the `shares` table where `to_user_id` is the signed-in person. A post reaches someone only after `sharePost` writes a row addressed to that person. `getHomeFeed` is that timeline (one card per post) plus the viewer’s own posts, filtered again through `canViewPost`. New tables and columns: `comments` (with `parent_id` for replies), `posts.photos` (JSON frames for multi-photo posts), and `users.location` / `work` / `education` for About. Older databases pick these up on open.
