# LINE build prompt

LINE is not a feed where content finds people. A post, photo, video, Reel, Short, or other content appears on someone’s personal timeline only when a person intentionally shares it with them (or they publish to their own timeline). Nothing appears because an algorithm decided they should see it.

Discover is a separate area and never auto-fills the personal timeline.

Flow: Create → Share → Receive → Reshare → Continue.

## Main navigation

Timeline, Create, Discover, Friends, Profile. Also: My Posts, meaningful notifications (not a second timeline). Staff accounts get an internal Staff area gated by explicit permissions, not job title alone.

## Timeline

Stream of content intentionally shared with the user, plus content they chose to publish to their own timeline. Each item shows who shared it. Prominent Share action on every item. Sharing history stays attached.

## Create

Text posts, photos, videos, short-form video, longer video, reels. Real upload may be stubbed with placeholder media. After creating, the user chooses recipients: individual friends, multiple friends, friend groups, custom friend lists. Sharing puts content on their timeline, not a DM inbox.

## Friends

Add, accept requests, remove, create groups, use groups when sharing, control who can share with you.

## My Posts

Content the user created, who it was shared with, reshares, sharing activity.

## Notifications

Someone shared something with you, someone shared your post onward, someone reshared your video.

## Discover

Public posts and videos, popular or trending or recommended public content, creators. Separate from the timeline. Keeping something means sharing it with someone.

## Profile

Avatar, name, username, bio, friends, their posts, public content, shared activity where appropriate. Public versus privately shared content is a user choice.

## Privacy

Who can share with you, who can view posts, who can reshare, who can add you as a friend, public or private content, blocking, reporting. Users are not forced to receive unwanted content because someone found their profile.

## Staff

Roles: User, User Support, Moderator, Senior Moderator, Manager, Director, Administrator, Founder.

Hierarchy: Founder > Director > Manager > Senior Moderator > Moderator > User Support > User.

Administrator is a privileged platform admin and does not grant ownership. Founder is the ownership seat, not a normal staff account.

Permissions are explicit grants: view user account, view reported content, review reports, moderate content, restrict accounts, suspend accounts, manage support tickets, manage staff, create staff accounts, modify roles, modify permissions, access audit logs, manage platform settings, manage security settings, manage financial settings, access emergency controls, plus platform ownership for the founder.

Audit log: staff member, role, action, user or content affected, date and time, reason, previous state, new state, case or report id. Staff cannot erase their own audit history.

Reports: posts, videos, profiles, messages, accounts, harassment, spam, abuse, other. Escalation: Moderator → Senior Moderator → Manager → Director → Administrator or Founder.

## Stack

Next.js App Router, TypeScript, Tailwind, shadcn-style UI, SQLite via better-sqlite3. Demo login by picking a seeded user. Capacitor Android project with `npm run build:apk`. `ANDROID_HOME` is required to produce an APK. The binary is not committed.

Seed: friends, a Marcus → Jordan-only share that Alex and Sam do not receive, one public Discover item on nobody’s timeline until it is shared, and one staff account per role with limited permissions.

`npm run test:core-rule` asserts the share-only rule.
