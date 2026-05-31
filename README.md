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

Use `pm2` with `ecosystem.config.cjs`. Each instance sets `ENV_FILE`; the app loads secrets via dotenv. `filter_env` keeps `TELEGRAM_BOT_TOKEN` and `ZAPIER_MCP_URL` out of `~/.pm2/dump.pm2`:

```bash
npm install -g pm2
chmod 600 ~/.yarnrc   # if you previously used yarn start under PM2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup  # follow the printed command to auto-start on login

# tokens should not appear in the PM2 dump
grep -i "TELEGRAM\|ZAPIER" ~/.pm2/dump.pm2 && echo "still present" || echo "ok"
```

Edit `ecosystem.config.cjs` to match your env file names and app names. Each app sets `ENV_FILE` and uses `tsx` as the PM2 interpreter (PM2 does not apply string `interpreter_args` to the Node process). Secrets are loaded via dotenv inside the app; `filter_env` keeps them out of `dump.pm2`.

Background process logs:

```bash
pm2 list
pm2 logs telegram-assistant-andre
```

## Telegram commands

| Command | Description |
|---------|-------------|
| `/start` | Say hello |
| `/reset` or `/clear` | Clear conversation history and start fresh |

Any other message is sent directly to the assistant.
