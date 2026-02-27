import { pgTable, uuid, varchar, boolean, timestamp, text, decimal, integer, pgEnum, jsonb, check } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const userRoleEnum = pgEnum("user_role", ["human", "agent", "admin"]);
export const transactionTypeEnum = pgEnum("transaction_type", [
  "top_up",
  "escrow_lock",
  "escrow_release",
  "refund",
  "withdrawal",
  "platform_fee",
]);
export const pricingModelEnum = pgEnum("pricing_model", ["fixed", "hourly"]);
export const agentStatusEnum = pgEnum("agent_status", ["active", "inactive", "suspended"]);
export const taskStatusEnum = pgEnum("task_status", [
  "open",
  "matching",
  "assigned",
  "in_progress",
  "completed",
  "approved",
  "disputed",
  "refunded",
  "cancelled",
]);
export const taskUrgencyEnum = pgEnum("task_urgency", ["normal", "urgent"]);
export const assignmentStatusEnum = pgEnum("assignment_status", [
  "assigned",
  "accepted",
  "in_progress",
  "completed",
  "approved",
  "disputed",
]);
export const disputeResolutionEnum = pgEnum("dispute_resolution", [
  "full_refund",
  "partial_refund",
  "release",
]);
export const applicationStatusEnum = pgEnum("application_status", [
  "pending",
  "accepted",
  "rejected",
]);

// Users table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull(),
  emailVerified: boolean("email_verified").default(false),
  webhookUrl: text("webhook_url"),
  webhookEvents: text("webhook_events").array().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastLogin: timestamp("last_login"),
});

// User profiles table
export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  tags: text("tags").array().default([]),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0.00"),
  totalTasksCompleted: integer("total_tasks_completed").default(0),
  totalTasksPosted: integer("total_tasks_posted").default(0),
  totalEarned: decimal("total_earned", { precision: 10, scale: 2 }).default("0.00"),
  totalSpent: decimal("total_spent", { precision: 10, scale: 2 }).default("0.00"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Wallets table
export const wallets = pgTable("wallets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  balance: decimal("balance", { precision: 10, scale: 2 }).default("0.00").notNull(),
  escrowBalance: decimal("escrow_balance", { precision: 10, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Transactions table
export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletId: uuid("wallet_id").notNull().references(() => wallets.id, { onDelete: "cascade" }),
  type: transactionTypeEnum("type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  balanceBefore: decimal("balance_before", { precision: 10, scale: 2 }).notNull(),
  balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }).notNull(),
  referenceType: varchar("reference_type", { length: 20 }),
  referenceId: uuid("reference_id"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Agents table
export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  sellerId: uuid("seller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  tags: text("tags").array().default([]),
  pricingModel: pricingModelEnum("pricing_model").default("fixed"),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0.00"),
  totalTasksCompleted: integer("total_tasks_completed").default(0),
  status: agentStatusEnum("status").default("inactive"),
  mcpEndpoint: text("mcp_endpoint"),
  apiKeyHash: varchar("api_key_hash", { length: 255 }),
  webhookUrl: text("webhook_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tasks table
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  buyerId: uuid("buyer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  tags: text("tags").array().default([]),
  maxBudget: decimal("max_budget", { precision: 10, scale: 2 }).notNull(),
  urgency: taskUrgencyEnum("urgency").default("normal"),
  status: taskStatusEnum("status").default("open"),
  autoAssign: boolean("auto_assign").default(false),
  sandbox: boolean("sandbox").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  assignedAt: timestamp("assigned_at"),
  completedAt: timestamp("completed_at"),
  approvedAt: timestamp("approved_at"),
  autoApproveAt: timestamp("auto_approve_at"),
});

// Task applications table
export const taskApplications = pgTable("task_applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  bidAmount: decimal("bid_amount", { precision: 10, scale: 2 }).notNull(),
  message: text("message"),
  status: applicationStatusEnum("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Task assignments table
export const taskAssignments = pgTable("task_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }).unique(),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  agreedPrice: decimal("agreed_price", { precision: 10, scale: 2 }).notNull(),
  status: assignmentStatusEnum("status").default("assigned"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Task results table
export const taskResults = pgTable("task_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }).unique(),
  resultText: text("result_text"),
  resultFiles: jsonb("result_files").default([]),
  submittedAt: timestamp("submitted_at").defaultNow(),
});

// Task suggestions table
export const taskSuggestions = pgTable("task_suggestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  matchScore: decimal("match_score", { precision: 5, scale: 2 }).notNull(),
  priceEstimate: decimal("price_estimate", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Disputes table
export const disputes = pgTable("disputes", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }).unique(),
  buyerComment: text("buyer_comment").notNull(),
  buyerEvidence: jsonb("buyer_evidence").default([]),
  sellerComment: text("seller_comment"),
  sellerEvidence: jsonb("seller_evidence").default([]),
  adminComment: text("admin_comment"),
  resolution: disputeResolutionEnum("resolution"),
  refundPercentage: integer("refund_percentage"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Reviews table
export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  reviewerId: uuid("reviewer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  revieweeId: uuid("reviewee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Notifications table
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(),
  message: text("message").notNull(),
  read: boolean("read").default(false),
  referenceType: varchar("reference_type", { length: 20 }),
  referenceId: uuid("reference_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, {
    fields: [users.id],
    references: [userProfiles.userId],
  }),
  wallet: one(wallets, {
    fields: [users.id],
    references: [wallets.userId],
  }),
  agents: many(agents),
  tasks: many(tasks),
  notifications: many(notifications),
}));

export const walletsRelations = relations(wallets, ({ one, many }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id],
  }),
  transactions: many(transactions),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  seller: one(users, {
    fields: [agents.sellerId],
    references: [users.id],
  }),
  assignments: many(taskAssignments),
  applications: many(taskApplications),
  suggestions: many(taskSuggestions),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  buyer: one(users, {
    fields: [tasks.buyerId],
    references: [users.id],
  }),
  assignment: one(taskAssignments, {
    fields: [tasks.id],
    references: [taskAssignments.taskId],
  }),
  result: one(taskResults, {
    fields: [tasks.id],
    references: [taskResults.taskId],
  }),
  dispute: one(disputes, {
    fields: [tasks.id],
    references: [disputes.taskId],
  }),
  suggestions: many(taskSuggestions),
  applications: many(taskApplications),
  reviews: many(reviews),
}));

export const taskAssignmentsRelations = relations(taskAssignments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskAssignments.taskId],
    references: [tasks.id],
  }),
  agent: one(agents, {
    fields: [taskAssignments.agentId],
    references: [agents.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  task: one(tasks, {
    fields: [reviews.taskId],
    references: [tasks.id],
  }),
  reviewer: one(users, {
    fields: [reviews.reviewerId],
    references: [users.id],
  }),
  reviewee: one(users, {
    fields: [reviews.revieweeId],
    references: [users.id],
  }),
}));

export const disputesRelations = relations(disputes, ({ one }) => ({
  task: one(tasks, {
    fields: [disputes.taskId],
    references: [tasks.id],
  }),
}));

export const taskResultsRelations = relations(taskResults, ({ one }) => ({
  task: one(tasks, {
    fields: [taskResults.taskId],
    references: [tasks.id],
  }),
}));

export const taskSuggestionsRelations = relations(taskSuggestions, ({ one }) => ({
  task: one(tasks, {
    fields: [taskSuggestions.taskId],
    references: [tasks.id],
  }),
  agent: one(agents, {
    fields: [taskSuggestions.agentId],
    references: [agents.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  wallet: one(wallets, {
    fields: [transactions.walletId],
    references: [wallets.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userProfiles.userId],
    references: [users.id],
  }),
}));

export const taskApplicationsRelations = relations(taskApplications, ({ one }) => ({
  task: one(tasks, {
    fields: [taskApplications.taskId],
    references: [tasks.id],
  }),
  agent: one(agents, {
    fields: [taskApplications.agentId],
    references: [agents.id],
  }),
}));
