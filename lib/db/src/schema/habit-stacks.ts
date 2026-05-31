import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { habitsTable } from "./habits";

export const habitStacksTable = pgTable("habit_stacks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  anchorHabitId: integer("anchor_habit_id").references(() => habitsTable.id, { onDelete: "set null" }),
  anchorDescription: text("anchor_description").notNull(),
  newHabitId: integer("new_habit_id").notNull().references(() => habitsTable.id, { onDelete: "cascade" }),
  stackPhrase: text("stack_phrase").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertHabitStackSchema = createInsertSchema(habitStacksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHabitStack = z.infer<typeof insertHabitStackSchema>;
export type HabitStack = typeof habitStacksTable.$inferSelect;
