import process from "node:process";
import { db } from "./index.js";
import { shops, serialArtifacts, vaultRules, activityLogs } from "./schema.js";

async function seed() {
  console.log("🌱 Seeding MySQL database with mock Crown Matrix data...");

  // 1. Clear existing test data (logs & artifacts first to respect relationships)
  await db.delete(activityLogs);
  await db.delete(vaultRules);
  await db.delete(serialArtifacts);
  await db.delete(shops);

  // 2. Insert Dummy Connected Shop
  const [shopResult] = await db
    .insert(shops)
    .values({
      shopifyDomain: "crown-and-brim.myshopify.com",
      accessToken: "shpat_test_token_12345",
    })
    .$returningId();

  const shopId = shopResult?.id || 1;

  // 3. Insert Mock Serial Artifacts
  await db.insert(serialArtifacts).values([
    {
      shopId,
      serialCode: "CB-2026-FOUNDER-001",
      productName: "Crown & Brim Gold Edition Snapback",
      collectorTier: "Founder",
      status: "active",
    },
    {
      shopId,
      serialCode: "CB-2026-VIP-002",
      productName: "Crown & Brim Wool Fedoras",
      collectorTier: "VIP",
      status: "active",
    },
    {
      shopId,
      serialCode: "CB-2026-STD-003",
      productName: "Classic Strapback - Obsidian",
      collectorTier: "Standard",
      status: "revoked",
    },
  ]);

  // 4. Insert Mock Vault Tier Rules
  await db.insert(vaultRules).values([
    {
      shopId,
      tierName: "Founder",
      minScore: 500,
      gatedTag: "vip-gold-collector",
    },
    {
      shopId,
      tierName: "VIP",
      minScore: 200,
      gatedTag: "vip-silver-collector",
    },
  ]);

  // 5. Insert Mock Telemetry / Audit Activity Logs
  await db.insert(activityLogs).values([
    {
      shopId,
      customerId: "Terminal_Manila_01",
      customerEmail: "collector1@example.com",
      calculatedScore: 550,
      actionTaken: "ACCESS_GRANTED",
      details: "Serial CB-2026-FOUNDER-001 verified authentic via NFC scan.",
    },
    {
      shopId,
      customerId: "Terminal_Quezon_04",
      customerEmail: "collector2@example.com",
      calculatedScore: 0,
      actionTaken: "FLAGGED_REVOKED",
      details: "Attempted verification on revoked serial CB-2026-STD-003.",
    },
    {
      shopId,
      customerId: "Unknown_IP_192.168.1.45",
      customerEmail: null,
      calculatedScore: 0,
      actionTaken: "RATE_LIMITED_WARNING",
      details: "12 rapid verification attempts within 30 seconds.",
    },
  ]);

  console.log("🚀 Database seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});