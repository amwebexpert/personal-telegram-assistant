import TelegramBot from 'node-telegram-bot-api';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { z } from 'zod';
import 'dotenv/config';
import { escapeHtml, toTelegramHtml, splitMessage } from './telegram-bot.utils';

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

const loadSessionId = async (): Promise<string | undefined> => {
  try {
    const raw: unknown = JSON.parse(await fs.readFile(SESSION_FILE, 'utf-8'));
    if (raw && typeof raw === 'object' && 'sessionId' in raw) {
      const sid = Reflect.get(raw, 'sessionId');
      if (typeof sid === 'string') return sid;
    }
    return undefined;
  } catch {
    return undefined;
  }
};

const saveSessionId = async (sessionId: string): Promise<void> => {
  await fs.mkdir(path.dirname(SESSION_FILE), { recursive: true });
  await fs.writeFile(SESSION_FILE, JSON.stringify({ sessionId }));
};

const clearSession = async (): Promise<void> => {
  await fs.rm(SESSION_FILE, { force: true });
};

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
  const sessionId = await loadSessionId();

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

  if (newSessionId) await saveSessionId(newSessionId);
  return response || '(no response)';
};

const runAsyncHandler =
  (
    fn: (msg: TelegramBot.Message) => Promise<void>,
  ): ((msg: TelegramBot.Message) => void) =>
  (msg: TelegramBot.Message): void => {
    void fn(msg);
  };

const main = (): void => {
  const bot = new TelegramBot(env.TELEGRAM_BOT_TOKEN, { polling: true });
  console.info('Bot started.');

  bot.onText(
    /\/start/,
    runAsyncHandler(async (msg) => {
      await bot.sendMessage(
        msg.chat.id,
        "Hi André, I'm your assistant. Send me a message.",
      );
    }),
  );

  bot.onText(
    /\/reset/,
    runAsyncHandler(async (msg) => {
      await clearSession();
      await bot.sendMessage(msg.chat.id, 'Session cleared.');
    }),
  );

  bot.on(
    'message',
    runAsyncHandler(async (msg) => {
      if (!msg.text || msg.text.startsWith('/')) return;
      const chatId = msg.chat.id;

      const thinkingMsg = await bot.sendMessage(chatId, 'thinking...');

      try {
        const response = await runAgent(msg.text);
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
        console.error('Agent error:', error);
        const errText = escapeHtml(
          error instanceof Error ? error.message : String(error),
        );
        await bot.editMessageText(`Error: ${errText}`, {
          chat_id: chatId,
          message_id: thinkingMsg.message_id,
          parse_mode: 'HTML',
        });
      }
    }),
  );

  bot.on('polling_error', (error) => console.error('Polling error:', error));
};

try {
  main();
} catch (error) {
  console.error(error);
}
