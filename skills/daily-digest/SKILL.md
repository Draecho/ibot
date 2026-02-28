---
name: daily-digest
description: Set up a daily briefing that runs automatically via cron. Summarises recent messages, pending tasks, and notable events across channels. Use when the user wants a morning summary, daily report, or scheduled briefing.
---

# Daily Digest

## Overview

Create an automated daily digest that runs as a cron job. The digest summarises
activity from the last 24 hours across all channels and delivers a concise
briefing at a user-chosen time.

## Setup Workflow

### 1. Gather preferences

Ask the user:

1. What time should the digest run? (default: 09:00)
2. What timezone? (try to detect from system first)
3. Which channel should the digest be delivered to? (default: the current channel)
4. What should the digest include? Offer these options (multiselect):
   - Unread message summary (default: on)
   - Pending tasks / action items (default: on)
   - Calendar events for today (default: off)
   - Memory / notes created yesterday (default: on)
   - Custom section (user-defined prompt)

### 2. Create the cron job

Use the cron tool to create a scheduled job:

```
openclaw cron add \
  --name "daily-digest" \
  --schedule "0 <HOUR> * * *" \
  --timezone "<USER_TZ>" \
  --payload '{
    "kind": "agentTurn",
    "message": "<DIGEST_PROMPT>",
    "deliver": true
  }' \
  --delivery '{ "mode": "announce", "channel": "<CHANNEL>" }' \
  --session "isolated"
```

The digest prompt should instruct the agent to:

1. Search memory for entries from the last 24 hours
2. Check for any pending tasks or reminders
3. Summarise unread messages by channel
4. Format as a concise briefing with sections
5. Keep the total output under 500 words

### 3. Example digest prompt

```
You are generating a daily digest briefing. Current time: {{now}}.

1. Search memory for all entries from the last 24 hours. Summarise key points.
2. List any pending tasks, reminders, or action items.
3. Summarise notable messages from each active channel (last 24h).
4. If calendar integration is available, list today's events.

Format the digest as:

## Daily Digest — {{date}}

### Key Updates
- bullet points of important items

### Pending Tasks
- [ ] task items

### Channel Activity
- **#channel**: brief summary

### Notes & Reminders
- anything from memory worth surfacing

Keep it concise (under 500 words). Skip empty sections.
```

### 4. Verify setup

After creating the cron job, confirm:

1. Run `openclaw cron list` to verify the job exists
2. Optionally run `openclaw cron run <id> --force` to test immediately
3. Tell the user the digest is set up and when the first one will run

### 5. Modifications

If the user wants to change the digest:

- **Time/timezone**: `openclaw cron edit <id> --schedule "0 <HOUR> * * *" --timezone "<TZ>"`
- **Content**: `openclaw cron edit <id> --payload '...'` with updated prompt
- **Disable**: `openclaw cron edit <id> --enabled false`
- **Remove**: `openclaw cron remove <id>`

## Notes

- The digest runs in an isolated session so it does not pollute ongoing conversations
- Delivery mode `announce` ensures the user sees it as a notification
- If no channel is specified, it defaults to the last active channel
- The cron service must be running (`openclaw cron status` to check)
