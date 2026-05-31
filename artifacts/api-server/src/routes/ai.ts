import { Router, type IRouter } from "express";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { db, habitsTable, habitLogsTable, identitiesTable, journalEntriesTable, aiMemoriesTable, aiConversationsTable, aiMessagesTable } from "@workspace/db";
import {
  AiChatBody,
  ConfirmAiActionBody,
  CreateAiMemoryBody,
  CreateAiConversationBody,
  ListAiMemoriesQueryParams,
  ListAiMessagesParams,
  DeleteAiMemoryParams,
} from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { ollamaClient } from "../lib/ollama";

const router: IRouter = Router();

const SYSTEM_PROMPT = `You are an AI coach for Atomic Identity Habits. You help users build habits using identity-based behavior change principles from Atomic Habits.

Your coaching style:
- Practical and concise. No motivational fluff.
- Focus on identity evidence: "completing this habit is evidence that you are the kind of person who..."
- Recommend tiny versions of habits when users struggle.
- Encourage "never miss twice" — one miss is an accident, two is the start of a new habit.
- Reference the user's actual habit data when available.
- Use sober, grounded, encouraging language.
- Ask for confirmation before creating or editing data.
- Avoid fake certainty. Say what you observe, not what you predict.
- Never give medical, legal, or financial advice.

If the user asks you to create or change data (habits, identities, memories), respond with a JSON block at the end of your message in this format:
<action>{"type":"CREATE_HABIT","payload":{"name":"...","habitType":"BOOLEAN","frequency":"DAILY","minimumVersion":"...","idealVersion":"...","cueDescription":"...","identityName":"..."}}</action>
or
<action>{"type":"CREATE_IDENTITY","payload":{"name":"...","description":"..."}}</action>
or
<action>{"type":"CREATE_MEMORY","payload":{"content":"...","tags":["..."]}}</action>

Only include the <action> block when you are proposing something for the user to confirm. Do not execute anything without explicit user confirmation.`;

async function buildContext(userId: number): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);

  const [habits, identities, recentLogs, recentJournal, memories] = await Promise.all([
    db.select().from(habitsTable).where(and(eq(habitsTable.userId, userId), eq(habitsTable.isActive, true))).limit(20),
    db.select().from(identitiesTable).where(eq(identitiesTable.userId, userId)).limit(10),
    db.select({ date: habitLogsTable.date, habitId: habitLogsTable.habitId, completed: habitLogsTable.completed })
      .from(habitLogsTable)
      .where(and(eq(habitLogsTable.userId, userId), gte(habitLogsTable.date, fourteenDaysAgo)))
      .orderBy(desc(habitLogsTable.date))
      .limit(100),
    db.select().from(journalEntriesTable)
      .where(eq(journalEntriesTable.userId, userId))
      .orderBy(desc(journalEntriesTable.date))
      .limit(5),
    db.select().from(aiMemoriesTable)
      .where(eq(aiMemoriesTable.userId, userId))
      .orderBy(desc(aiMemoriesTable.importance), desc(aiMemoriesTable.createdAt))
      .limit(10),
  ]);

  const habitMap = new Map(habits.map((h) => [h.id, h]));
  const byDate = new Map<string, { done: number; total: number }>();
  for (const log of recentLogs) {
    if (!byDate.has(log.date)) byDate.set(log.date, { done: 0, total: 0 });
    byDate.get(log.date)!.total++;
    if (log.completed) byDate.get(log.date)!.done++;
  }

  const habitSummary = habits.map((h) => {
    const logs14 = recentLogs.filter((l) => l.habitId === h.id);
    const done = logs14.filter((l) => l.completed).length;
    return `- ${h.name} (${h.frequency}, type: ${h.habitType}): ${done}/${logs14.length} days completed in last 14 days. Min: "${h.minimumVersion ?? "none"}". Cue: "${h.cueDescription ?? "none"}"`;
  }).join("\n");

  const identitySummary = identities.map((i) => `- ${i.name}: ${i.description ?? ""}`).join("\n");

  const journalSummary = recentJournal.map((j) => `[${j.date}] Mood: ${j.mood ?? "not set"}. Tags: ${(j.tags ?? []).join(", ")}. Entry: ${j.content.slice(0, 200)}...`).join("\n");

  const memorySummary = memories.map((m) => `- [${m.sourceType}] ${m.content}`).join("\n");

  const dateSummary = Array.from(byDate.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 14)
    .map(([d, s]) => `${d}: ${s.done}/${s.total} habits`)
    .join(", ");

  return `Today: ${today}
Active habits (${habits.length}):
${habitSummary || "No habits yet."}

Identities:
${identitySummary || "No identities defined."}

Last 14 days completion: ${dateSummary || "No data."}

Recent journal entries:
${journalSummary || "No journal entries."}

Personal memories/notes:
${memorySummary || "No memories stored."}`;
}

router.get("/ai/status", requireAuth, async (_req, res): Promise<void> => {
  const available = await ollamaClient.healthCheck();
  res.json({
    available,
    model: ollamaClient.getModel(),
    message: available
      ? `Connected to Ollama (model: ${ollamaClient.getModel()})`
      : "Ollama is not reachable. Check OLLAMA_BASE_URL and confirm the model is installed.",
  });
});

router.post("/ai/chat", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = AiChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.userId!;
  const { message, conversationId } = parsed.data;

  // Get or create conversation
  let convId = conversationId ?? null;
  if (!convId) {
    const title = message.slice(0, 60);
    const [conv] = await db.insert(aiConversationsTable).values({ userId, title }).returning();
    convId = conv.id;
  }

  // Save user message
  await db.insert(aiMessagesTable).values({ conversationId: convId, role: "user", content: message });

  // Get conversation history
  const history = await db.select().from(aiMessagesTable)
    .where(eq(aiMessagesTable.conversationId, convId))
    .orderBy(aiMessagesTable.createdAt)
    .limit(20);

  // Build context
  let contextStr = "";
  try {
    contextStr = await buildContext(userId);
  } catch {
    contextStr = "Unable to load context.";
  }

  const messages = [
    { role: "system" as const, content: `${SYSTEM_PROMPT}\n\nUser context:\n${contextStr}` },
    ...history.slice(0, -1).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content: message },
  ];

  let aiMessage = "I'm not able to connect to Ollama right now. Check that Ollama is running and the OLLAMA_BASE_URL is correct.";
  let proposedAction: { type: string; payload: Record<string, unknown> } | null = null;

  try {
    aiMessage = await ollamaClient.chat(messages);

    // Parse proposed action from response
    const actionMatch = aiMessage.match(/<action>([\s\S]*?)<\/action>/);
    if (actionMatch) {
      try {
        proposedAction = JSON.parse(actionMatch[1]);
        aiMessage = aiMessage.replace(/<action>[\s\S]*?<\/action>/, "").trim();
      } catch {
        // ignore parse error
      }
    }
  } catch {
    // Ollama unavailable — return helpful message
  }

  // Save assistant message
  await db.insert(aiMessagesTable).values({ conversationId: convId, role: "assistant", content: aiMessage });

  res.json({ message: aiMessage, conversationId: convId, proposedAction });
});

router.post("/ai/confirm-action", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = ConfirmAiActionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.userId!;
  const { proposedActionType, payload, confirmed } = parsed.data;

  if (!confirmed) {
    res.json({ success: true, message: "Action rejected.", data: null });
    return;
  }

  try {
    let data: unknown = null;

    if (proposedActionType === "CREATE_HABIT") {
      const p = payload as { name?: string; habitType?: string; frequency?: string; minimumVersion?: string; idealVersion?: string; cueDescription?: string; identityName?: string };
      let identityId: number | null = null;
      if (p.identityName) {
        const [identity] = await db.select().from(identitiesTable)
          .where(and(eq(identitiesTable.userId, userId), sql`LOWER(${identitiesTable.name}) = LOWER(${p.identityName})`));
        identityId = identity?.id ?? null;
      }

      const [habit] = await db.insert(habitsTable).values({
        userId,
        name: p.name ?? "New Habit",
        habitType: (p.habitType ?? "BOOLEAN") as "BOOLEAN" | "QUANTITY" | "DURATION",
        frequency: (p.frequency ?? "DAILY") as "DAILY" | "WEEKLY" | "CUSTOM",
        minimumVersion: p.minimumVersion ?? null,
        idealVersion: p.idealVersion ?? null,
        cueDescription: p.cueDescription ?? null,
        identityId,
      }).returning();
      data = habit;
    } else if (proposedActionType === "CREATE_IDENTITY") {
      const p = payload as { name?: string; description?: string };
      const [identity] = await db.insert(identitiesTable).values({
        userId,
        name: p.name ?? "New Identity",
        description: p.description ?? null,
      }).returning();
      data = identity;
    } else if (proposedActionType === "CREATE_MEMORY") {
      const p = payload as { content?: string; tags?: string[] };
      const [memory] = await db.insert(aiMemoriesTable).values({
        userId,
        content: p.content ?? "",
        sourceType: "AI_SUMMARY",
        tags: p.tags ?? [],
        importance: 1,
      }).returning();
      data = memory;
    }

    res.json({ success: true, message: `${proposedActionType} executed successfully.`, data });
  } catch (err) {
    req.log.error({ err }, "Failed to execute AI action");
    res.status(500).json({ success: false, message: "Failed to execute action." });
  }
});

router.get("/ai/memories", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = ListAiMemoriesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  let conditions = [eq(aiMemoriesTable.userId, req.userId!)];
  if (params.data.q) {
    conditions.push(sql`${aiMemoriesTable.content} ILIKE ${"%" + params.data.q + "%"}`);
  }

  const memories = await db.select().from(aiMemoriesTable)
    .where(and(...conditions))
    .orderBy(desc(aiMemoriesTable.importance), desc(aiMemoriesTable.createdAt))
    .limit(50);

  res.json(memories);
});

router.post("/ai/memories", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreateAiMemoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [memory] = await db.insert(aiMemoriesTable).values({
    userId: req.userId!,
    content: parsed.data.content,
    sourceType: parsed.data.sourceType ?? "USER_NOTE",
    tags: parsed.data.tags ?? [],
    importance: parsed.data.importance ?? 1,
    memoryDate: parsed.data.memoryDate ?? null,
  }).returning();

  res.status(201).json(memory);
});

router.delete("/ai/memories/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = DeleteAiMemoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(aiMemoriesTable)
    .where(and(eq(aiMemoriesTable.id, params.data.id), eq(aiMemoriesTable.userId, req.userId!)));

  res.sendStatus(204);
});

router.get("/ai/conversations", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const conversations = await db.select().from(aiConversationsTable)
    .where(eq(aiConversationsTable.userId, req.userId!))
    .orderBy(desc(aiConversationsTable.updatedAt))
    .limit(50);
  res.json(conversations);
});

router.post("/ai/conversations", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreateAiConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [conv] = await db.insert(aiConversationsTable).values({
    userId: req.userId!,
    title: parsed.data.title,
  }).returning();

  res.status(201).json(conv);
});

router.get("/ai/conversations/:id/messages", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = ListAiMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [conv] = await db.select().from(aiConversationsTable)
    .where(and(eq(aiConversationsTable.id, params.data.id), eq(aiConversationsTable.userId, req.userId!)));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const messages = await db.select().from(aiMessagesTable)
    .where(eq(aiMessagesTable.conversationId, params.data.id))
    .orderBy(aiMessagesTable.createdAt);

  res.json(messages);
});

export default router;
