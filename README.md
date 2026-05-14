# Personal Telegram Assistant

A personal AI assistant powered by `@anthropic-ai/claude-agent-sdk`, reachable over Telegram. Supports web search (Tavily), Google Calendar, Gmail, and read/write access to your local filesystem.

## Prerequisites

- Node.js 20+
- `claude` CLI installed and authenticated (`claude --version` should work)
- A Telegram account

## Setup

### 1. Install dependencies

```bash
yarn install
```

### 2. Create a Telegram bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the prompts
3. Copy the bot token

### 3. Get a Tavily API key

Sign up at [app.tavily.com](https://app.tavily.com) and copy your API key.

### 4. Set up Google OAuth credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable **Google Calendar API** and **Gmail API**
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
5. Application type: **Desktop app**
6. Download the JSON file and save it (e.g. `~/.config/telegram-assistant/gcp-oauth.keys.json`)

> On first run, both the Calendar and Gmail MCP servers will open a browser window for OAuth. Tokens are stored locally afterwards.

### 5. Configure environment

```bash
cp .env.example .env
```

Fill in `.env`:

```
TELEGRAM_BOT_TOKEN=your_token_here
TAVILY_API_KEY=your_key_here
GOOGLE_OAUTH_CREDENTIALS_PATH=/Users/you/.config/telegram-assistant/gcp-oauth.keys.json
```

### 6. Run

```bash
yarn start
```

To keep it running in the background:

```bash
npm install -g pm2
pm2 start "yarn start" --name telegram-assistant
pm2 save
pm2 startup  # follow the printed command to auto-start on login
```

## Telegram commands

| Command | Description |
|---------|-------------|
| `/start` | Say hello |
| `/reset` | Clear conversation history and start fresh |

Any other message is sent directly to the assistant.
