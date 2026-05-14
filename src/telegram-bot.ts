import { query } from '@anthropic-ai/claude-agent-sdk';
import { logger } from '@lichens-innovation/ts-common/logger';
import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import os from 'os';
import path from 'path';
import { z } from 'zod';
import {
  clearSession,
  escapeHtml,
  loadSessionId,
  saveSessionId,
  splitMessage,
  toTelegramHtml,
  trunc,
} from './telegram-bot.utils';

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TAVILY_API_KEY: z.string().min(1),
  GOOGLE_OAUTH_CREDENTIALS_PATH: z.string().min(1),
});

const env = envSchema.parse(process.env);

const SESSION_FILE = path.join(
  os.homedir(),
  '.config',
  'telegram-assistant',
  'session.json',
);

interface McpServerEntry {
  type: 'stdio';
  command: string;
  args: string[];
  env: Record<string, string>;
}

type McpServersConfig = Record<string, McpServerEntry>;

const buildMcpServers = (): McpServersConfig => ({
  tavily: {
    type: 'stdio' as const,
    command: 'npx',
    args: ['-y', 'tavily-mcp@latest'],
    env: { TAVILY_API_KEY: env.TAVILY_API_KEY },
  },
  googleCalendar: {
    type: 'stdio' as const,
    command: 'npx',
    // @cocal/google-calendar-mcp depends on ajv-formats without declaring ajv; plain `npx -y` crashes.
    // prettier-ignore
    args: ['-y', '-p', 'ajv@8', '-p', '@cocal/google-calendar-mcp', 'google-calendar-mcp'],
    env: { GOOGLE_OAUTH_CREDENTIALS: env.GOOGLE_OAUTH_CREDENTIALS_PATH },
  },
  gmail: {
    type: 'stdio' as const,
    command: 'npx',
    args: ['-y', '@gongrzhe/server-gmail-autoauth-mcp'],
    env: { GMAIL_OAUTH_PATH: env.GOOGLE_OAUTH_CREDENTIALS_PATH },
  },
});

const runAgent = async (prompt: string): Promise<string> => {
  const sessionId = await loadSessionId(SESSION_FILE);

  const agentQuery = query({
    prompt,
    options: {
      model: 'claude-sonnet-4-6',
      resume: sessionId,
      permissionMode: 'bypassPermissions',
      cwd: os.homedir(),
      systemPrompt:
        "You are André's personal assistant. Be concise and direct. Skip pleasantries.",
      mcpServers: buildMcpServers(),
    },
  });

  let response = '';
  let newSessionId: string | undefined;

  for await (const message of agentQuery) {
    if (message.type === 'result' && message.subtype === 'success') {
      response = message.result;
      newSessionId = message.session_id;
    }
  }

  if (newSessionId)
    await saveSessionId({ fullPath: SESSION_FILE, sessionId: newSessionId });
  return response || '(no response)';
};

type BotCallback = (
  msg: TelegramBot.Message,
  match: RegExpExecArray | null,
) => void;

interface HandleMessageArgs {
  bot: TelegramBot;
  msg: TelegramBot.Message;
}

const handleMessage = async ({
  bot,
  msg,
}: HandleMessageArgs): Promise<void> => {
  if (!msg.text || msg.text.startsWith('/')) return;
  const chatId = msg.chat.id;

  logger.info(trunc(`→ ${msg.text}`));
  const thinkingMsg = await bot.sendMessage(chatId, 'thinking...');

  try {
    const response = await runAgent(msg.text);
    logger.info(trunc(`← ${response}`));
    const chunks = splitMessage(toTelegramHtml(response));

    await bot.editMessageText(chunks[0], {
      chat_id: chatId,
      message_id: thinkingMsg.message_id,
      parse_mode: 'HTML',
    });

    for (const chunk of chunks.slice(1)) {
      await bot.sendMessage(chatId, chunk, { parse_mode: 'HTML' });
    }
  } catch (error) {
    logger.error('Agent error', { error: String(error) });
    const errText = escapeHtml(
      error instanceof Error ? error.message : String(error),
    );
    await bot.editMessageText(`Error: ${errText}`, {
      chat_id: chatId,
      message_id: thinkingMsg.message_id,
      parse_mode: 'HTML',
    });
  }
};

const main = (): void => {
  const bot = new TelegramBot(env.TELEGRAM_BOT_TOKEN, { polling: true });
  logger.info('Bot started.');

  const onStart: BotCallback = (msg) => {
    void bot.sendMessage(
      msg.chat.id,
      "Hi André, I'm your assistant. Send me a message.",
    );
  };

  const onReset: BotCallback = (msg) => {
    void (async () => {
      await clearSession(SESSION_FILE);
      await bot.sendMessage(msg.chat.id, 'Session cleared.');
    })();
  };

  bot.onText(/\/start/, onStart);
  bot.onText(/\/reset/, onReset);

  bot.on('message', (msg) => {
    void handleMessage({ bot, msg });
  });

  bot.on('polling_error', (error) =>
    logger.error('Polling error', { error: String(error) }),
  );
};

try {
  main();
} catch (error) {
  logger.fatal('Fatal error', { error: String(error) });
}
