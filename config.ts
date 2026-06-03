import sql from "mssql";
import { load } from "@std/dotenv";
import { join } from "@std/path";
import { baseDir } from "./paths.ts";
import { logger } from "./logger.ts";

/**
 * Loads environment variables from the `.env` file sitting next to the program
 * (the executable in production, this source tree in dev). Falls back to the
 * existing process environment if no `.env` is present, so the app still works
 * on servers that inject real environment variables.
 */
export async function loadEnv(): Promise<void> {
  const envPath = join(baseDir(), ".env");
  try {
    await Deno.stat(envPath);
  } catch {
    logger.warn(`No .env found at ${envPath}; relying on process environment.`);
    return;
  }
  await load({ envPath, export: true });
  logger.info(`Loaded environment from ${envPath}`);
}

export function requireEnv(key: string): string {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function buildConfig(): sql.config {
  return {
    server: requireEnv("DB_HOST"),
    port: Number(requireEnv("DB_PORT")),
    user: requireEnv("DB_USER"),
    password: requireEnv("DB_PASSWORD"),
    database: requireEnv("DB_NAME"),
    options: {
      encrypt: Deno.env.get("DB_ENCRYPT") === "true",
      trustServerCertificate: true,
    },
    connectionTimeout: 10_000,
  };
}
