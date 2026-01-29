# Moltbot Personal Deployment Design

**Date:** 2026-01-29
**Status:** In Progress
**Goal:** Deploy Moltbot for personal use with Telegram on Railway

---

## Summary

Deploy Moltbot on Railway using Docker, connecting to Telegram with GPT-4o-mini as the AI backend. Includes tool capabilities (code execution, web access). File access via Telegram uploads (with option to add cloud storage later).

---

## Architecture

```
┌─────────────────┐         ┌─────────────────┐
│   Your Phone    │◄───────►│    Telegram     │
│  (Telegram app) │         │    Servers      │
└─────────────────┘         └────────┬────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │     Railway     │
                            │  ┌───────────┐  │
                            │  │  Moltbot  │  │
                            │  │ (Docker)  │  │
                            │  └─────┬─────┘  │
                            └────────┼────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
             ┌──────────┐    ┌──────────┐    ┌──────────┐
             │ OpenAI   │    │ Cloud    │    │  Web     │
             │ API      │    │ Storage  │    │  APIs    │
             │(GPT-4o-  │    │(Optional)│    │          │
             │  mini)   │    │          │    │          │
             └──────────┘    └──────────┘    └──────────┘
```

**Flow:**
1. You message via Telegram on your phone
2. Telegram forwards to Moltbot running on Railway
3. Moltbot calls GPT-4o-mini for AI responses
4. Tools can execute code, fetch web content, process files sent via Telegram
5. Response comes back through Telegram

---

## Estimated Monthly Cost

| Service | Cost |
|---------|------|
| Railway | ~$5-10 |
| OpenAI API (GPT-4o-mini) | ~$1-5 |
| **Total** | **~$6-15/month** |

---

## Requirements

### Accounts & Keys

| Item | Where to get it | Cost |
|------|-----------------|------|
| Railway account | railway.app | Free tier, then ~$5-10/month |
| Telegram Bot Token | @BotFather on Telegram | Free |
| OpenAI API Key | platform.openai.com | Pay-per-use |

### Telegram Bot Setup

1. Message @BotFather on Telegram
2. Send `/newbot`, follow prompts
3. Get your bot token (looks like `123456:ABC-DEF...`)
4. Set bot privacy: `/setprivacy` → Disable (if you want group message access)

### Environment Variables

```bash
# Required
TELEGRAM_BOT_TOKEN=your_bot_token
OPENAI_API_KEY=your_openai_key

# AI Configuration
AI_MODEL=gpt-4o-mini

# Additional Moltbot config (TBD during implementation)
# NODE_ENV=production
# LOG_LEVEL=info
```

---

## File Access Strategy

**Initial approach:** Send files directly through Telegram when needed. No persistent cloud access required.

**Future option (if needed):** Add scoped OneDrive/Dropbox access using rclone:
- Create dedicated folder (e.g., `MoltbotFiles`)
- Configure rclone with restricted base path
- Bot can only access that specific folder

---

## Security Considerations

- Docker container provides sandboxed execution for tools
- API keys stored as Railway environment variables (encrypted)
- No direct access to personal cloud storage by default
- Telegram bot token kept private

---

## Next Steps

1. [ ] Create Telegram bot via @BotFather
2. [ ] Get OpenAI API key from platform.openai.com
3. [ ] Create Railway account and project
4. [ ] Deploy Moltbot Docker image to Railway
5. [ ] Configure environment variables
6. [ ] Test basic chat functionality
7. [ ] Test tool execution
8. [ ] (Optional) Add cloud storage integration

---

## Open Questions

- Specific Moltbot configuration options to review during deployment
- Whether to enable specific tools/plugins
- Memory/conversation persistence settings

---

## References

- Moltbot docs: docs.molt.bot
- Railway docs: docs.railway.app
- Telegram Bot API: core.telegram.org/bots
