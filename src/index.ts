import TelegramBot from 'node-telegram-bot-api';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import 'dotenv/config';

const SESSION_FILE = path.join(os.homedir(), '.config', 'telegram-assistant', 'session.json');
const MAX_LEN = 4096;

async function loadSessionId(): Promise<string | undefined> {
  try {
    return JSON.parse(await fs.readFile(SESSION_FILE, 'utf-8')).sessionId;
  } catch {
    return undefined;
  }
}

async function saveSessionId(sessionId: string): Promise<void> {
  await fs.mkdir(path.dirname(SESSION_FILE), { recursive: true });
  await fs.writeFile(SESSION_FILE, JSON.stringify({ sessionId }));
}

async function clearSession(): Promise<void> {
  await fs.rm(SESSION_FILE, { force: true });
}

function splitMessage(text: string): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > MAX_LEN) {
    let split = remaining.lastIndexOf('\n', MAX_LEN);
    if (split <= 0) split = MAX_LEN;
    chunks.push(remaining.slice(0, split));
    remaining = remaining.slice(split).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

function buildMcpServers() {
  const googleCreds = process.env.GOOGLE_OAUTH_CREDENTIALS_PATH!;
  return {
    tavily: {
      type: 'stdio' as const,
      command: 'npx',
      args: ['-y', 'tavily-mcp@latest'],
      env: { TAVILY_API_KEY: process.env.TAVILY_API_KEY! },
    },
    googleCalendar: {
      type: 'stdio' as const,
      command: 'npx',
      args: ['-y', '@cocal/google-calendar-mcp'],
      env: { GOOGLE_OAUTH_CREDENTIALS: googleCreds },
    },
    gmail: {
      type: 'stdio' as const,
      command: 'npx',
      args: ['-y', '@gongrzhe/server-gmail-autoauth-mcp'],
      env: { GMAIL_OAUTH_PATH: googleCreds },
    },
  };
}

async function runAgent(prompt: string): Promise<string> {
  const sessionId = await loadSessionId();

  const agentQuery = query({
    prompt,
    options: {
      model: 'claude-sonnet-4-6',
      resume: sessionId,
      permissionMode: 'bypassPermissions',
      cwd: os.homedir(),
      systemPrompt: "You are André's personal assistant. Be concise and direct. Skip pleasantries.",
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
}

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is required');

  const bot = new TelegramBot(token, { polling: true });
  console.log('Bot started.');

  bot.onText(/\/start/, async (msg) => {
    await bot.sendMessage(msg.chat.id, "Hi André, I'm your assistant. Send me a message.");
  });

  bot.onText(/\/reset/, async (msg) => {
    await clearSession();
    await bot.sendMessage(msg.chat.id, 'Session cleared.');
  });

  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    const chatId = msg.chat.id;

    const thinkingMsg = await bot.sendMessage(chatId, 'thinking...');

    try {
      const response = await runAgent(msg.text);
      const chunks = splitMessage(response);

      await bot.editMessageText(chunks[0], {
        chat_id: chatId,
        message_id: thinkingMsg.message_id,
      });

      for (const chunk of chunks.slice(1)) {
        await bot.sendMessage(chatId, chunk);
      }
    } catch (error) {
      console.error('Agent error:', error);
      await bot.editMessageText(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
        { chat_id: chatId, message_id: thinkingMsg.message_id },
      );
    }
  });

  bot.on('polling_error', (error) => console.error('Polling error:', error));
}

main().catch(console.error);
