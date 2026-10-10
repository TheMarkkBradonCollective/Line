# How LINE works

Plain-language rules. The app enforces exactly these on the server; `npm run test:core-rule` checks each one.

## No share, no see

- You only see a post if you made it, someone shared it with you, or its author sent it to their Followers and you follow them.
- There is no algorithm and no public feed. Search finds people, never posts.
- The rule is checked on the server for every page, link, photo, video, comment, reaction, notification and count. A direct link to a post you weren’t sent shows “not found”.

## Profiles

- Every profile (name, photo, cover, bio, friends, follower counts) is open to signed-in people, unless that person blocked you.
- On someone else’s profile you only see the posts that reached you. LINE never shows how many posts you can’t see.
- Profile and cover photos are public. Photos and videos in posts are private and only load for people allowed to see the post.

## Friends vs followers

- Friends need a request and an accept. Friends can share posts directly with each other.
- Anyone can follow anyone they haven’t blocked (and who hasn’t blocked them). No approval needed, but following never lets you share or message someone directly.
- Followers only see posts the author sends to the Followers audience, and only while they follow. Unfollowing removes them.

## Home vs Discover

- Home shows posts shared with you (directly, through a group or list, or passed along a share chain), plus your own posts.
- Discover shows only posts that people you follow sent to Followers, newest first. Never strangers, never friends-only posts.
- A Followers post appears in Discover, not Home. If a follower reshares it to you, it lands in your Home like any share, showing who passed it along.

## Who can share what with whom

- Direct shares (people, groups, lists, the Message button) only reach your friends, and only if their own share settings allow you. Everyone else is refused by the server.
- Only a post’s author can send it to Followers. A resharer can never send someone else’s post to their own followers.
- If a post reached you (by share or as a follower), you can pass it on to your friends and groups, unless the author turned resharing off. Each person can pass it on to their friends, and so on.
- Shares you already received stay with you, even if the sender later unfriends you.

## Groups and lists

- Groups and lists are yours and private. Sharing to one sends a copy to each member who is your friend at that moment.
- People added to a group later don’t get posts shared to it before they joined. People removed keep what they already got.

## Likes, dislikes and hiding

- You can react to and comment on any post you can see. Counts only include people you haven’t blocked, and shares to yourself aren’t counted.
- Dislike hides a post from your Home and Discover. It’s private: no counts, and the author is never told.
- After a dislike you can hide all posts from that person. This isn’t a block: you stay friends or keep following. Undo it any time in Settings → Hidden.

## Blocking

- Blocking someone ends friendships and follows both ways, stops all sharing between you, and hides each other’s posts, comments, reactions and notifications.
- A blocked person can’t open your profile.

## Deleting

- You can delete your own posts. A deleted post disappears for everyone, along with its shares, comments, reactions, notifications and its photos or video.
- You can delete your account in Settings. That removes your profile, posts, files, friendships and follows. Staff audit history is kept.

## Reports and staff

- You can report a post you can see, or a profile. Reports go to the moderator queue and can be escalated.
- Staff ranks, lowest to highest: User Support, Moderator, Senior Moderator, Manager, Director, Administrator, Founder. What each person can do comes from individual permissions, not the title. The Administrator doesn’t own the platform; only the Founder does.
- Staff never get a feed. A staff member with a moderation permission can open a post only as a case file, and only after it has been reported. Every staff action is written to an audit log that can’t be edited or deleted.
