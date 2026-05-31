"use strict";

const CWD = __dirname;
const SENSITIVE = ["TELEGRAM_BOT_TOKEN", "ZAPIER_MCP_URL"];

module.exports = {
  apps: [
    {
      name: "telegram-assistant-andre",
      cwd: CWD,
      interpreter: "node",
      interpreter_args: "--env-file=.env.andre --import=tsx/esm",
      script: "src/telegram-bot.ts",
      env: { ENV_FILE: ".env.andre", NODE_ENV: "production" },
      filter_env: SENSITIVE,
      merge_logs: true,
      autorestart: true,
    },
    {
      name: "telegram-assistant-johanne",
      cwd: CWD,
      interpreter: "node",
      interpreter_args: "--env-file=.env.johanne --import=tsx/esm",
      script: "src/telegram-bot.ts",
      env: { ENV_FILE: ".env.johanne", NODE_ENV: "production" },
      filter_env: SENSITIVE,
      merge_logs: true,
      autorestart: true,
    },
  ],
};
