import { mysqlTable, varchar, int, timestamp, serial, text } from "drizzle-orm/mysql-core";

// 1. Connected Shopify Shops
export const shops = mysqlTable("shops", {
  id: serial("id").primaryKey(),
  shopifyDomain: varchar("shopify_domain", { length: 255 }).notNull().unique(),
  accessToken: varchar("access_token", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

// 2. Vault Tier Rules (Customer Tier Scoring & Gated Drop Access)
export const vaultRules = mysqlTable("vault_rules", {
  id: serial("id").primaryKey(),
  shopId: int("shop_id").notNull(),
  tierName: varchar("tier_name", { length: 50 }).notNull(), // e.g., "Gold", "VIP"
  minScore: int("min_score").notNull().default(0), // Required score threshold
  gatedTag: varchar("gated_tag", { length: 100 }), // Shopify customer tag to apply
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 3. Customer Activity & Tier Access Logs
export const activityLogs = mysqlTable("activity_logs", {
  id: serial("id").primaryKey(),
  shopId: int("shop_id").notNull(),
  customerId: varchar("customer_id", { length: 100 }).notNull(),
  customerEmail: varchar("customer_email", { length: 255 }),
  calculatedScore: int("calculated_score").notNull().default(0),
  actionTaken: varchar("action_taken", { length: 100 }).notNull(), // e.g., "ACCESS_GRANTED", "TIER_UPGRADED"
  details: text("details"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});
