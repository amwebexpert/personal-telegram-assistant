"use strict";

const path = require("node:path");

const CWD = __dirname;
const TSX = path.join(CWD, "node_modules/.bin/tsx");
const SENSITIVE = ["TELEGRAM_BOT_TOKEN", "ZAPIER_MCP_URL"];

module.exports = {
  apps: [
    {
      name: "telegram-assistant-andre",
      cwd: CWD,
      script: "src/telegram-bot.ts",
      interpreter: TSX,
      env: { ENV_FILE: ".env.andre", NODE_ENV: "production" },
      filter_env: SENSITIVE,
      merge_logs: true,
      autorestart: true,
    },
    {
      name: "telegram-assistant-johanne",
      cwd: CWD,
      script: "src/telegram-bot.ts",
      interpreter: TSX,
      env: { ENV_FILE: ".env.johanne", NODE_ENV: "production" },
      filter_env: SENSITIVE,
      merge_logs: true,
      autorestart: true,
    },
  ],
};
