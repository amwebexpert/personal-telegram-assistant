import { query } from '@anthropic-ai/claude-agent-sdk';
import { getErrorMessage } from '@lichens-innovation/ts-common';
import { logger } from '@lichens-innovation/ts-common/logger';
import TelegramBot from 'node-telegram-bot-api';
import os from 'os';
import path from 'path';
import { z } from 'zod';
import { loadEnv } from './load-env';
import {
  clearSession,
  escapeMarkdownV2,
  loadSessionId,
  saveSessionId,
  splitMessage,
  toTelegramMarkdownV2,
  trunc,
} from './telegram-bot.utils';

const { envFile, profile } = loadEnv();

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  ZAPIER_MCP_URL: z.string().url().startsWith('https://mcp.zapier.com/'),
  BOT_NAME: z.string().min(1),
});

const env = envSchema.parse(process.env);

const sessionFileName =
  profile === 'default' ? 'session.json' : `session-${profile}.json`;
const SESSION_FILE = path.join(
  os.homedir(),
  '.config',
  'telegram-assistant',
  sessionFileName,
);

const buildMcpServers = () => ({
  zapier: {
    type: 'http' as const,
    url: env.ZAPIER_MCP_URL,
  },
});

const buildSystemPrompt = (): string =>
  `You are ${env.BOT_NAME}, a personal assistant. Be concise and direct. Use the most appropriate emoji. Use Zapier MCP tools for external apps (Gmail, Calendar, web search, etc.). Use local filesystem tools for files on disk.`;

const askClaudeAgent = async (prompt: string): Promise<string> => {
  const sessionId = await loadSessionId(SESSION_FILE);

  const agentQuery = query({
    prompt,
    options: {
      model: 'claude-sonnet-4-6',
      resume: sessionId,
      permissionMode: 'bypassPermissions',
      cwd: os.homedir(),
      allowedTools: ['mcp__zapier__*'],
      systemPrompt: buildSystemPrompt(),
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
  const thinkingMsg = await bot.sendMessage(chatId, 'Let me think about it…');

  try {
    const response = await askClaudeAgent(msg.text);
    logger.info(trunc(`← ${response}`));
    const chunks = splitMessage(toTelegramMarkdownV2(response));

    await bot.editMessageText(chunks[0], {
      chat_id: chatId,
      message_id: thinkingMsg.message_id,
      parse_mode: 'MarkdownV2',
    });

    for (const chunk of chunks.slice(1)) {
      await bot.sendMessage(chatId, chunk, { parse_mode: 'MarkdownV2' });
    }
  } catch (e: unknown) {
    const error = getErrorMessage(e);
    logger.error('Agent error', { error });

    const errText = escapeMarkdownV2(error);
    await bot.editMessageText(`Error: ${errText}`, {
      chat_id: chatId,
      message_id: thinkingMsg.message_id,
      parse_mode: 'MarkdownV2',
    });
  }
};

const main = (): void => {
  logger.info('Env loaded', { envFile, profile, botName: env.BOT_NAME });

  const bot = new TelegramBot(env.TELEGRAM_BOT_TOKEN, { polling: true });
  logger.info('Bot started.');

  const onReset: BotCallback = (msg: TelegramBot.Message) => {
    void (async () => {
      await clearSession(SESSION_FILE);
      await bot.sendMessage(msg.chat.id, 'Session cleared.');
    })();
  };

  bot.onText(/\/clear/, onReset);
  bot.onText(/\/reset/, onReset);

  bot.onText(/\/start/, (msg: TelegramBot.Message) => {
    void bot.sendMessage(msg.chat.id, `Hi, I'm ${env.BOT_NAME}.`);
  });

  bot.on('message', (msg) => {
    void handleMessage({ bot, msg });
  });

  bot.on('polling_error', (error: Error) =>
    logger.error('Polling error', { error: getErrorMessage(error) }),
  );
};

try {
  main();
} catch (e: unknown) {
  const error = getErrorMessage(e);
  logger.fatal('Fatal error', { error });
}
