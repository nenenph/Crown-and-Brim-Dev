// app/db/schema.js
import { mysqlTable, varchar, timestamp, int } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

// 1. Products Table
export const products = mysqlTable("products", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID
  title: varchar("title", { length: 255 }).notNull(),
  sku: varchar("sku", { length: 100 }).unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

// 2. Serials Table
export const serials = mysqlTable("serials", {
  id: varchar("id", { length: 36 }).primaryKey(),
  productId: varchar("product_id", { length: 36 }).references(() => products.id),
  serialNumber: varchar("serial_number", { length: 100 }).unique().notNull(),
  batchRelease: varchar("batch_release", { length: 100 }),
  encryptionHash: varchar("encryption_hash", { length: 255 }),
  status: varchar("status", { length: 50 }).default("ACTIVE"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 3. Verification Logs Table (History/Log feature)
export const verificationLogs = mysqlTable("verification_logs", {
  id: int("id").primaryKey().autoincrement(),
  serialId: varchar("serial_id", { length: 36 }).references(() => serials.id),
  ipAddress: varchar("ip_address", { length: 45 }),
  statusReturned: varchar("status_returned", { length: 50 }),
  scannedAt: timestamp("scanned_at").defaultNow(),
});

// Define Relations for Drizzle Relational Queries
export const productsRelations = relations(products, ({ many }) => ({
  serials: many(serials),
}));

export const serialsRelations = relations(serials, ({ one, many }) => ({
  product: one(products, {
    fields: [serials.productId],
    references: [products.id],
  }),
  logs: many(verificationLogs),
}));