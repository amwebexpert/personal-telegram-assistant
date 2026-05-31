import dotenv from "dotenv";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";

const DEFAULT_ENV_FILE = ".env";

export const ENV_SCHEMA = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  ZAPIER_MCP_URL: z.url().startsWith("https://mcp.zapier.com/"),
  BOT_NAME: z.string().min(1),
});

export type EnvSchema = z.infer<typeof ENV_SCHEMA>;

export const buildSessionFilename = (profile: string) => {
  const isDefault = profile === "default";
  const sessionFileName = isDefault
    ? "session.json"
    : `session-${profile}.json`;
  return path.join(
    os.homedir(),
    ".config",
    "telegram-assistant",
    sessionFileName,
  );
};

export const resolveEnvFile = (): string => {
  const fromArgv = process.argv[2]?.trim();
  if (fromArgv) return fromArgv;

  const fromEnv = process.env.ENV_FILE?.trim();
  if (fromEnv) return fromEnv;

  return DEFAULT_ENV_FILE;
};

export const resolveProfileFromEnvFile = (envFile: string): string => {
  if (envFile === DEFAULT_ENV_FILE) return "default";
  const match = /^\.env\.(.+)$/.exec(envFile);
  return match?.[1] ?? "default";
};

export interface LoadEnvResult {
  envFile: string;
  profile: string;
}

export const loadEnv = (): LoadEnvResult => {
  const envFile = resolveEnvFile();
  const absolutePath = path.resolve(process.cwd(), envFile);

  if (!fs.existsSync(absolutePath)) {
    const message = `Missing env file "${envFile}". Copy .env.example, then set ENV_FILE=${envFile}`;

    throw new Error(message);
  }

  // override: false — keep vars already loaded by node --env-file (PM2)
  const result = dotenv.config({ path: absolutePath });
  if (result.error) {
    const message = `Error loading env file "${envFile}": ${result.error.message}`;

    throw new Error(message);
  }

  return { envFile, profile: resolveProfileFromEnvFile(envFile) };
};
