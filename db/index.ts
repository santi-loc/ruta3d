import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

async function getCloudflareEnv() {
  const importModule = new Function("specifier", "return import(specifier)") as <T>(specifier: string) => Promise<T>;

  try {
    return await importModule<{ env: { DB?: D1Database } }>("cloudflare:workers");
  } catch {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable in this runtime. Configure a Vercel-compatible database for production click metrics, or deploy this feature on Cloudflare Sites with D1."
    );
  }
}

export async function getDb() {
  const { env } = await getCloudflareEnv();

  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}

export async function getD1() {
  const { env } = await getCloudflareEnv();

  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return env.DB;
}
