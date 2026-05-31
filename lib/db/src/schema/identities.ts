import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const identitiesTable = pgTable("identities", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  colorKey: text("color_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertIdentitySchema = createInsertSchema(identitiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIdentity = z.infer<typeof insertIdentitySchema>;
export type Identity = typeof identitiesTable.$inferSelect;
