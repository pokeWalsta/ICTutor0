import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: text("id").primaryKey(), // Firebase UID
  username: text("username").notNull().unique(),
  email: text("email").notNull(),
});

export const categoryEnum = z.enum(["hardware", "software"]);
export type Category = z.infer<typeof categoryEnum>;

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull(),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  upvotes: integer("upvotes").default(0).notNull(),
  downvotes: integer("downvotes").default(0).notNull(),
  solutionId: integer("solution_id"),
});

export const replies = pgTable("replies", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  postId: serial("post_id")
    .notNull()
    .references(() => posts.id),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  parentReplyId: integer("parent_reply_id"),
  upvotes: integer("upvotes").default(0).notNull(),
  downvotes: integer("downvotes").default(0).notNull(),
  isSolution: boolean("is_solution").default(false),
});

export const votes = pgTable("votes", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  postId: integer("post_id"),
  replyId: integer("reply_id"),
  voteType: text("vote_type").notNull(), // "upvote" or "downvote"
});

export const insertUserSchema = createInsertSchema(users);
export const insertPostSchema = createInsertSchema(posts).pick({
  title: true,
  content: true,
  category: true,
});
export const insertReplySchema = createInsertSchema(replies).pick({
  content: true,
  postId: true,
  parentReplyId: true,
});
export const insertVoteSchema = createInsertSchema(votes).pick({
  userId: true,
  postId: true,
  replyId: true,
  voteType: true,
});

export type User = typeof users.$inferSelect;
export type Post = typeof posts.$inferSelect & { replyCount?: number };
export type Reply = typeof replies.$inferSelect;
export type Vote = typeof votes.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertPost = z.infer<typeof insertPostSchema>;
export type InsertReply = z.infer<typeof insertReplySchema>;
export type InsertVote = z.infer<typeof insertVoteSchema>;