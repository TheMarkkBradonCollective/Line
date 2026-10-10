/**
 * The rules of LINE in plain language. Single source for docs/RULES.md (npm run docs:rules)
 * and the in-app "How LINE works" page. Every rule here is enforced on the server and covered
 * by `npm run test:core-rule`.
 */
export type RuleSection = { title: string; points: string[] };

export const RULES: RuleSection[] = [
  {
    title: "No share, no see",
    points: [
      "You only see a post if you made it, someone shared it with you, it was shared into a group you were already in, or its author sent it to their Followers and you follow them.",
      "There is no algorithm and no public feed. Search finds people, never posts.",
      "Loops (short vertical videos) follow the same rule. The Loops tab only plays Loops that reached you, plus your own.",
      "The rule is checked on the server for every page, link, photo, video, comment, reaction, notification and count. A direct link to a post you weren’t sent shows “not found”.",
    ],
  },
  {
    title: "Profiles",
    points: [
      "Every profile (name, photo, cover, bio, friends, follower counts) is open to signed-in people, unless that person blocked you.",
      "On someone else’s profile you only see the posts that reached you. LINE never shows how many posts you can’t see.",
      "Profile and cover photos are public. Photos and videos in posts are private and only load for people allowed to see the post.",
    ],
  },
  {
    title: "Friends vs followers",
    points: [
      "Friends need a request and an accept. Friends can share posts directly with each other.",
      "Anyone can follow anyone they haven’t blocked (and who hasn’t blocked them). No approval needed, but following never lets you share or message someone directly.",
      "Followers only see posts the author sends to the Followers audience, and only while they follow. Unfollowing removes them.",
    ],
  },
  {
    title: "Home vs Discover",
    points: [
      "Home shows posts shared with you (directly, through a group or list, or passed along a share chain), plus your own posts.",
      "Discover shows only posts that people you follow sent to Followers, newest first. Never strangers, never friends-only posts.",
      "A Followers post appears in Discover, not Home. If a follower reshares it to you, it lands in your Home like any share, showing who passed it along.",
    ],
  },
  {
    title: "Who can share what with whom",
    points: [
      "Direct shares (people, groups, lists, the Message button) only reach your friends, and only if their own share settings allow you. Everyone else is refused by the server.",
      "Only a post’s author can send it to Followers. A resharer can never send someone else’s post to their own followers.",
      "If a post reached you (by share or as a follower), you can pass it on to your friends and groups, unless the author turned resharing off. Each person can pass it on to their friends, and so on.",
      "Shares you already received stay with you, even if the sender later unfriends you.",
    ],
  },
  {
    title: "Groups",
    points: [
      "A group is a set of people with its own feed. Only members see the group, its members and its feed.",
      "The person who starts a group is its owner. Owners and admins can add people, but only from their own friends. They can also remove members, rename the group and set its photo. The owner can make admins and delete the group. Anyone can leave.",
      "Members can post straight into the group from Create, or share a post they can see into it. Anyone except the author needs the author’s resharing permission to do that.",
      "A post shared into a group is visible to the people who were members at that moment, for as long as they stay. Someone who joins later only sees posts shared after they joined. Someone who leaves or is removed loses what they could see through the group.",
      "Comments made in a group form a group thread. Only current members who can see the post read and write it. It is separate from the post’s other comments, and people who only see the post through the group don’t see those other comments.",
      "A member can pass a group post on to their own friends if the author allows resharing. That lands in the friend’s Home as a normal share, and never carries the group thread.",
      "You can mute a group to stop alerts for new posts. Deleting a group removes its feed and threads. The posts stay with their authors and anyone they were shared with directly.",
    ],
  },
  {
    title: "Share circles and lists",
    points: [
      "Share circles and lists are your own private shortcuts for sharing. Sharing to one sends a copy to each member who is your friend at that moment.",
      "People added to a circle later don’t get posts shared to it before they joined. People removed keep what they already got.",
    ],
  },
  {
    title: "Likes, dislikes and hiding",
    points: [
      "You can react to and comment on any post you can see. Counts only include people you haven’t blocked, and shares to yourself aren’t counted.",
      "Dislike hides a post from your Home and Discover. It’s private: no counts, and the author is never told.",
      "After a dislike you can hide all posts from that person. This isn’t a block: you stay friends or keep following. Undo it any time in Settings → Hidden.",
    ],
  },
  {
    title: "Blocking",
    points: [
      "Blocking someone ends friendships and follows both ways, stops all sharing between you, and hides each other’s posts, comments, reactions and notifications.",
      "A blocked person can’t open your profile.",
    ],
  },
  {
    title: "Deleting",
    points: [
      "You can delete your own posts. A deleted post disappears for everyone, along with its shares, comments, reactions, notifications and its photos or video.",
      "You can delete your account in Settings. That removes your profile, posts, files, friendships and follows. Staff audit history is kept.",
    ],
  },
  {
    title: "Reports and staff",
    points: [
      "You can report a post you can see, or a profile. Reports go to the moderator queue and can be escalated.",
      "Staff ranks, lowest to highest: User Support, Moderator, Senior Moderator, Manager, Director, Administrator, Founder. What each person can do comes from individual permissions, not the title. The Administrator doesn’t own the platform; only the Founder does.",
      "Staff never get a feed. A staff member with a moderation permission can open a post only as a case file, and only after it has been reported. Every staff action is written to an audit log that can’t be edited or deleted.",
    ],
  },
];

export function rulesMarkdown() {
  const lines = ["# How LINE works", "", "Plain-language rules. The app enforces exactly these on the server; `npm run test:core-rule` checks each one.", ""];
  for (const section of RULES) {
    lines.push(`## ${section.title}`, "");
    for (const point of section.points) lines.push(`- ${point}`);
    lines.push("");
  }
  return lines.join("\n");
}
