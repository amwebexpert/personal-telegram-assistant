import { query } from "@anthropic-ai/claude-agent-sdk";
import { getErrorMessage } from "@lichens-innovation/ts-common";
import { logger } from "@lichens-innovation/ts-common/logger";
import { Tokens } from "marked";
import TelegramBot from "node-telegram-bot-api";
import os from "node:os";

import { LONG_VERSION_DATE } from "./constants";
import {
  buildSessionFilename,
  ENV_SCHEMA,
  EnvSchema,
  loadEnv,
} from "./load-env";
import { tableToBuffer } from "./table-image.utils";
import {
  clearSession,
  escapeHtml,
  loadSessionId,
  parseAgentResponse,
  saveSessionId,
  truncLongText,
} from "./telegram-bot.utils";

interface ReportAgentErrorArgs {
  e: unknown;
  chatId: number;
  messageId: number;
}

export class TelegramBotApp {
  private readonly envFile: string;
  private readonly env: EnvSchema;
  private readonly sessionFile: string;

  private bot: TelegramBot | null = null;

  constructor() {
    const { envFile, profile } = loadEnv();
    this.envFile = envFile;
    this.env = ENV_SCHEMA.parse(process.env);
    this.sessionFile = buildSessionFilename(profile);
  }

  private get botWelcome(): string {
    return `Yo, ${this.env.BOT_NAME} ${LONG_VERSION_DATE} here! 🤙`;
  }

  start(): void {
    logger.info("Env loaded", { envFile: this.envFile });

    this.bot = new TelegramBot(this.env.TELEGRAM_BOT_TOKEN, { polling: true });
    this.bot.onText(
      /\/start/,
      (msg) => void this.bot?.sendMessage(msg.chat.id, this.botWelcome),
    );

    this.bot.onText(/\/clear/, (msg) => void this.onReset(msg));
    this.bot.onText(/\/reset/, (msg) => void this.onReset(msg));
    this.bot.on("message", (msg) => void this.handleMessage(msg));
    this.bot.on("polling_error", (err) => this.reportPollingError(err));

    logger.info("Bot started.");
  }

  private reportPollingError(rawError: Error): void {
    const error = getErrorMessage(rawError);
    logger.error("Polling error", { error });
  }

  private get mcpServers() {
    return {
      zapier: {
        type: "http" as const,
        url: this.env.ZAPIER_MCP_URL,
      },
    };
  }

  private get systemPrompt(): string {
    return `You are ${this.env.BOT_NAME}, a personal assistant. Be concise and direct. Use the most appropriate emoji. Use Zapier MCP tools for external apps (Gmail, Calendar, web search, etc.). Use local filesystem tools for files on disk.`;
  }

  private async askClaudeAgent(prompt: string): Promise<string> {
    const sessionId = await loadSessionId(this.sessionFile);

    const agentQuery = query({
      prompt,
      options: {
        model: "claude-sonnet-4-6",
        resume: sessionId,
        permissionMode: "bypassPermissions",
        cwd: os.homedir(),
        allowedTools: ["mcp__zapier__*"],
        systemPrompt: this.systemPrompt,
        mcpServers: this.mcpServers,
      },
    });

    let response = "";
    let newSessionId: string | undefined;

    for await (const message of agentQuery) {
      if (message.type === "result" && message.subtype === "success") {
        response = message.result;
        newSessionId = message.session_id;
      }
    }

    if (newSessionId)
      await saveSessionId({
        fullPath: this.sessionFile,
        sessionId: newSessionId,
      });

    return response || "(no response)";
  }

  private async reportAgentError({
    e,
    chatId,
    messageId,
  }: ReportAgentErrorArgs): Promise<void> {
    if (!this.bot) return;
    const error = getErrorMessage(e);
    logger.error("Agent error", { error });

    const errText = escapeHtml(error);
    await this.bot.editMessageText(`Error: ${errText}`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "HTML",
    });
  }

  private async sendTablePhotos(
    chatId: number,
    tables: Tokens.Table[],
  ): Promise<void> {
    if (!this.bot) return;

    const options = {};
    const fileOptions = { filename: "table.png", contentType: "image/png" };

    for (const table of tables) {
      const buffer = await tableToBuffer(table);
      await this.bot.sendPhoto(chatId, buffer, options, fileOptions);
    }
  }

  private async handleMessage(msg: TelegramBot.Message): Promise<void> {
    if (!this.bot) return;
    if (!msg.text || msg.text.startsWith("/")) return;
    const chatId = msg.chat.id;

    logger.info(truncLongText(`← ${msg.text}`));
    const thinkingMsg = await this.bot.sendMessage(chatId, "🤔…");

    try {
      const response = await this.askClaudeAgent(msg.text);
      logger.info(truncLongText(`→ ${response}`));

      const { html, tables } = parseAgentResponse(response);

      if (html) {
        await this.bot.editMessageText(html, {
          chat_id: chatId,
          message_id: thinkingMsg.message_id,
          parse_mode: "HTML",
        });
      } else if (tables.length > 0) {
        await this.bot.deleteMessage(chatId, thinkingMsg.message_id);
      } else {
        await this.bot.editMessageText("(no response)", {
          chat_id: chatId,
          message_id: thinkingMsg.message_id,
          parse_mode: "HTML",
        });
      }

      await this.sendTablePhotos(chatId, tables);
    } catch (e: unknown) {
      await this.reportAgentError({
        e,
        chatId,
        messageId: thinkingMsg.message_id,
      });
    }
  }

  private async onReset(msg: TelegramBot.Message): Promise<void> {
    if (!this.bot) return;
    await clearSession(this.sessionFile);
    await this.bot.sendMessage(msg.chat.id, "Session cleared.");
  }
}

try {
  new TelegramBotApp().start();
} catch (e: unknown) {
  const error = getErrorMessage(e);
  logger.fatal("Fatal error", { error });
}
