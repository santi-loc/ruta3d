import { desc } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { isPlainRecord, sanitizeSearchQuery } from "../../../../../lib/security";
import { notes } from "../../../db/schema";

const maxContentLength = 2_000;

function toRouteErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const detail =
    error instanceof Error && error.cause instanceof Error ? error.cause.message : "";
  const combined = `${message}\n${detail}`;

  if (combined.includes("no such table") || combined.includes('from "notes"')) {
    return "The notes table is unavailable. Generate the migration locally with `npm run db:generate`, then deploy so the platform can apply the generated SQL to the real D1 database.";
  }

  return message;
}

export async function GET() {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(notes)
      .orderBy(desc(notes.createdAt), desc(notes.id))
      .limit(20);

    return Response.json({ notes: rows });
  } catch (error) {
    return Response.json(
      { error: toRouteErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      return Response.json({ error: "application/json is required" }, { status: 415 });
    }

    const payload = await request.json();
    if (!isPlainRecord(payload)) {
      return Response.json({ error: "invalid payload" }, { status: 400 });
    }

    const title = sanitizeSearchQuery(payload.title, 120);
    const content = typeof payload.content === "string"
      ? payload.content
        .normalize("NFKC")
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
        .trim()
        .slice(0, maxContentLength)
      : "";

    if (!title) {
      return Response.json({ error: "title is required" }, { status: 400 });
    }

    const db = getDb();
    const [note] = await db.insert(notes).values({ title, content }).returning();
    return Response.json({ note }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: toRouteErrorMessage(error) },
      { status: 500 }
    );
  }
}
