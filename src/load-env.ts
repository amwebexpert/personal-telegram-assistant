import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const DEFAULT_ENV_FILE = '.env';

export const resolveEnvFile = (): string => {
  const fromArgv = process.argv[2]?.trim();
  if (fromArgv) return fromArgv;

  const fromEnv = process.env.ENV_FILE?.trim();
  if (fromEnv) return fromEnv;

  return DEFAULT_ENV_FILE;
};

export const resolveProfileFromEnvFile = (envFile: string): string => {
  if (envFile === DEFAULT_ENV_FILE) return 'default';
  const match = /^\.env\.(.+)$/.exec(envFile);
  return match?.[1] ?? 'default';
};

export const loadEnv = (): { envFile: string; profile: string } => {
  const envFile = resolveEnvFile();
  const absolutePath = path.resolve(process.cwd(), envFile);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(
      `Missing env file "${envFile}". Copy .env.example, then: yarn start -- ${envFile}`,
    );
  }

  const result = dotenv.config({ path: absolutePath });
  if (result.error) throw result.error;

  return { envFile, profile: resolveProfileFromEnvFile(envFile) };
};
