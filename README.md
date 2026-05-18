# Personal Telegram Assistant

A personal AI assistant powered by `@anthropic-ai/claude-agent-sdk`, reachable over Telegram. External app actions (Gmail, Calendar, web search, etc.) go through a single [Zapier MCP](https://mcp.zapier.com/) server. The agent also has read/write access to your local filesystem.

## Prerequisites

- Node.js 20+
- `claude` CLI installed and authenticated (`claude --version` should work)
- A Telegram account
- A Zapier account with MCP enabled on your plan

## Setup

### 1. Install dependencies

```bash
yarn install
```

### 2. Create a Telegram bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the prompts
3. Copy the bot token

### 3. Set up Zapier MCP

1. Go to [mcp.zapier.com](https://mcp.zapier.com/) and create a server (choose **Other** as the client if your setup is not listed).
2. In the **Tools** tab, add the actions you need (e.g. Gmail, Google Calendar, web search). Connect each app account in the Zapier console.
3. Open the **Connect** tab and copy your server URL. Treat it like a password — it grants access to run your configured actions.

See [Manage tools for your Zapier MCP server](https://help.zapier.com/hc/en-us/articles/36265551472781) for details on tools and connections.

**Notes:**

- Each successful tool call uses **2 tasks** from your Zapier plan.
- Only **one client** can run tool calls through the same server URL at a time. Avoid using the same URL from Cursor and this bot simultaneously.
- If the URL is exposed, use **Rotate token** on the Connect tab.

### 4. Configure environment

One env file per bot instance. Copy the template for each instance:

```bash
cp .env.example .env.user-a
cp .env.example .env.user-b
```

Fill in each file (`TELEGRAM_BOT_TOKEN`, `ZAPIER_MCP_URL`, `BOT_NAME`).

For a single local instance, `.env` alone is enough:

```bash
cp .env.example .env
```

### 5. Run

```bash
yarn start                      # loads .env
yarn start -- .env.user-a       # loads .env.user-a
yarn start -- .env.user-b       # loads .env.user-b
```

The `--` separator is required so Yarn forwards arguments to the Node process.

Each profile gets its own Claude session file under `~/.config/telegram-assistant/` (e.g. `session-user-a.json`).

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
| `/reset` or `/clear` | Clear conversation history and start fresh |

Any other message is sent directly to the assistant.
