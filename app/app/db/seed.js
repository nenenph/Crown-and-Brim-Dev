// app/db/seed.js
import "dotenv/config";
import process from "node:process"; // Explicit import resolves 'process is not defined'
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "./schema.js";

const databaseUrl = process.env.DATABASE_URL || "mysql://root:password@127.0.0.1:3306/vault_engine";

const pool = mysql.createPool({
  uri: databaseUrl,
});

const db = drizzle(pool, { schema, mode: "default" });

async function seed() {
  console.log("🌱 Seeding MySQL database with Crown & Brim Vault data...");

  // Clear existing test data respecting FK constraints
  await db.delete(schema.verificationLogs);
  await db.delete(schema.serials);
  await db.delete(schema.products);

  // 1. Insert Products
  const prodFounder = "p-fedora-gold";
  const prodSnapback = "p-snapback-vip";
  const prodStrapback = "p-strapback-obsidian";

  await db.insert(schema.products).values([
    { id: prodFounder, title: "Crown & Brim Gold Edition Fedora", sku: "CB-FED-GOLD" },
    { id: prodSnapback, title: "Crown & Brim VIP Wool Snapback", sku: "CB-SNAP-VIP" },
    { id: prodStrapback, title: "Classic Strapback - Obsidian", sku: "CB-STRAP-OBS" },
  ]);

  // 2. Insert Serials
  const serial1Id = "s-001";
  const serial2Id = "s-002";
  const serial3Id = "s-003";

  await db.insert(schema.serials).values([
    {
      id: serial1Id,
      productId: prodFounder,
      serialNumber: "CB-2026-FOUNDER-001",
      batchRelease: "Founder Edition Drop",
      encryptionHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      status: "ACTIVE",
    },
    {
      id: serial2Id,
      productId: prodSnapback,
      serialNumber: "CB-2026-VIP-002",
      batchRelease: "VIP Release",
      encryptionHash: "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
      status: "ACTIVE",
    },
    {
      id: serial3Id,
      productId: prodStrapback,
      serialNumber: "CB-2026-STD-003",
      batchRelease: "Standard Release",
      encryptionHash: "3f82084c7182285e683411b7d51b3f9d51f28b493774dd139a0665f8832a829f",
      status: "REVOKED",
    },
  ]);

  // 3. Insert Verification Logs
  await db.insert(schema.verificationLogs).values([
    {
      serialId: serial1Id,
      ipAddress: "192.168.1.1",
      statusReturned: "VERIFIED",
    },
    {
      serialId: serial3Id,
      ipAddress: "203.0.113.195",
      statusReturned: "FLAGGED_REVOKED",
    },
  ]);

  console.log("🚀 Database seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});