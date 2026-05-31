import { Router, type IRouter } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, journalEntriesTable } from "@workspace/db";
import {
  CreateJournalEntryBody,
  UpdateJournalEntryBody,
  UpdateJournalEntryParams,
  DeleteJournalEntryParams,
  ListJournalEntriesQueryParams,
  SearchJournalEntriesQueryParams,
} from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router: IRouter = Router();

router.get("/journal/search", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = SearchJournalEntriesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const entries = await db.select().from(journalEntriesTable)
    .where(and(
      eq(journalEntriesTable.userId, req.userId!),
      sql`(${journalEntriesTable.content} ILIKE ${"%" + params.data.q + "%"} OR ${params.data.q} = ANY(${journalEntriesTable.tags}))`,
    ))
    .orderBy(desc(journalEntriesTable.date))
    .limit(50);

  res.json(entries);
});

router.get("/journal", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = ListJournalEntriesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  let conditions = [eq(journalEntriesTable.userId, req.userId!)];
  if (params.data.date) {
    conditions.push(eq(journalEntriesTable.date, params.data.date));
  }

  const limit = params.data.limit ?? 30;
  const entries = await db.select().from(journalEntriesTable)
    .where(and(...conditions))
    .orderBy(desc(journalEntriesTable.date))
    .limit(limit);

  res.json(entries);
});

router.post("/journal", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreateJournalEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Upsert by date
  const [existing] = await db.select().from(journalEntriesTable)
    .where(and(
      eq(journalEntriesTable.userId, req.userId!),
      eq(journalEntriesTable.date, parsed.data.date),
    ));

  if (existing) {
    const [updated] = await db.update(journalEntriesTable)
      .set({
        content: parsed.data.content,
        mood: parsed.data.mood ?? existing.mood,
        tags: parsed.data.tags ?? existing.tags,
      })
      .where(eq(journalEntriesTable.id, existing.id))
      .returning();
    res.status(201).json(updated);
    return;
  }

  const [entry] = await db.insert(journalEntriesTable).values({
    userId: req.userId!,
    date: parsed.data.date,
    content: parsed.data.content,
    mood: parsed.data.mood ?? null,
    tags: parsed.data.tags ?? [],
  }).returning();

  res.status(201).json(entry);
});

router.patch("/journal/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = UpdateJournalEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateJournalEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(journalEntriesTable)
    .where(and(eq(journalEntriesTable.id, params.data.id), eq(journalEntriesTable.userId, req.userId!)));
  if (!existing) {
    res.status(404).json({ error: "Journal entry not found" });
    return;
  }

  const updateData: Partial<typeof journalEntriesTable.$inferInsert> = {};
  if (parsed.data.content !== undefined) updateData.content = parsed.data.content;
  if (parsed.data.mood !== undefined) updateData.mood = parsed.data.mood;
  if (parsed.data.tags !== undefined) updateData.tags = parsed.data.tags;

  const [updated] = await db.update(journalEntriesTable).set(updateData)
    .where(eq(journalEntriesTable.id, params.data.id))
    .returning();

  res.json(updated);
});

router.delete("/journal/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = DeleteJournalEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(journalEntriesTable)
    .where(and(eq(journalEntriesTable.id, params.data.id), eq(journalEntriesTable.userId, req.userId!)));

  res.sendStatus(204);
});

export default router;
