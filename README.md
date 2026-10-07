# LINE

LINE is a share-first social app. A post reaches a personal timeline only when a person shares it with that person, or when the author publishes it to their own timeline. There is no public shelf and no recommended feed.

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

## Core rule check

```bash
npm run test:core-rule
```

The script builds a throwaway SQLite database and asserts:

- Marcus’s river note, shared only with Jordan, is on Jordan’s timeline and not on Alex’s, Sam’s, or Marcus’s.
- Riley’s market photo is shared with Marcus only. The hall reel is shared with Noah only.
- After Marcus passes the market photo to Alex, it appears on Alex’s timeline. Sam, Jordan, and Riley still do not have it.
- Every timeline row is a share addressed to that person.
- Staff grants are explicit. Removing Moderator’s `review_reports` grant closes that queue even though the role title stays. Administrator does not have platform ownership. Founder does.
- Audit rows cannot be updated or deleted.

## Demo logins

People:

| Username | You’ll see |
| --- | --- |
| `jordan` | The river note Marcus sent only to Jordan, Sam’s loaf note after Marcus passed it on, plus a creek video from Theo and a skate loop from Noah. Not the peaches. |
| `alex` | The peaches Jordan sent to the Saturday kitchen group, Priya’s buns, and Mina’s dusk loop. Not the river note. Not Riley’s market photo until someone shares it. |
| `sam` | The peaches and Priya’s buns. Not the river note. Not the loaf note (Sam sent that to Marcus). |
| `marcus` | Sam’s loaf note, Riley’s market photo, and a gate note Marcus published to himself. The river note is in My Posts, not on Marcus’s timeline. |
| `riley` | An empty timeline. Riley sent the market photo to Marcus and the hall reel to Noah, and does not accept shares. |
| `noah` | Riley’s hall reel. |
| `mina` | An empty timeline until someone shares with her. Her dusk loop is on Alex’s timeline. |
| `theo` | An empty timeline until someone shares with him. His creek video is on Jordan’s timeline. |
| `priya` | An empty timeline until someone shares with her. Her bun photo is on Sam’s and Alex’s timelines. |

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
- Timeline of shares addressed to you, plus posts you published to yourself
- Each timeline item names who shared it and keeps the sharing history
- Create notes, photos, video, shorts, longer video, and reels, then choose friends, groups, custom lists, or your own timeline
- Share and reshare onto timelines (not into a message inbox)
- Friends: requests, accept, decline, remove, block, groups, lists
- Who can share with you, who can add you, who can reshare
- My Posts: recipients, reshares, whether it is on your own timeline
- Alerts for a share to you, a post shared onward, and a reshared video
- Profiles, public versus private posts, reports
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
- Direct messages. Sharing always goes to a timeline. “Message” exists only as a report type.
- Profile photos. The avatar is a color and initials.

## Product rule in the data model

`getTimeline` reads the `shares` table where `to_user_id` is the signed-in person. A post is on a timeline only after `sharePost` writes a row addressed to that person.
