import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { db } from "../db/index.js";
import { serialArtifacts, activityLogs } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";

// ==========================================
// GET LOADER: Handles inventory and logs
// ==========================================
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const shopId = url.searchParams.get("shopId");

  if (!shopId) {
    return json({ error: "Missing shopId parameter" }, { status: 400 });
  }

  try {
    if (action === "serials") {
      const items = await db.select()
        .from(serialArtifacts)
        .where(eq(serialArtifacts.shopId, Number(shopId)));
      return json(items);
    }

    if (action === "logs") {
      const logs = await db.select()
        .from(activityLogs)
        .where(eq(serialArtifacts.shopId, Number(shopId))) // or activityLogs.shopId
        .orderBy(desc(activityLogs.timestamp))
        .limit(50);
      return json(logs);
    }

    return json({ error: "Invalid loader action requested" }, { status: 400 });
  } catch (error) {
    console.error("Vault Loader Error:", error);
    return json({ error: "Database retrieval failed" }, { status: 500 });
  }
}

// ==========================================
// ACTION: Handles Minting, Updates, & Verification
// ==========================================
export async function action({ request }: ActionFunctionArgs) {
  const body = await request.json().catch(() => ({}));
  const { intent, shopId, serialCode, productName, collectorTier, status, customerId, customerEmail, id } = body;

  try {
    // 1. MINT NEW SERIAL (Admin Action)
    if (intent === "mint_serial") {
      if (!shopId || !serialCode || !productName) {
        return json({ error: "Missing required fields: shopId, serialCode, productName" }, { status: 400 });
      }

      await db.insert(serialArtifacts).values({
        shopId: Number(shopId),
        serialCode,
        productName,
        collectorTier: collectorTier || "Standard",
        status: "active",
      });

      return json({ success: true, message: "Vault serial artifact minted successfully." });
    }

    // 2. UPDATE SERIAL STATUS / TIER (Admin Action)
    if (intent === "update_serial") {
      if (!id) return json({ error: "Missing serial record ID" }, { status: 400 });

      await db.update(serialArtifacts)
        .set({
          ...(status && { status }),
          ...(collectorTier && { collectorTier }),
          ...(productName && { productName }),
        })
        .where(eq(serialArtifacts.id, Number(id)));

      return json({ success: true, message: "Serial artifact updated successfully." });
    }

    // 3. STOREFRONT VERIFICATION & RISK-SCORING ENGINE
    if (intent === "verify_serial") {
      if (!shopId || !serialCode) {
        return json({ error: "Missing shopId or serialCode parameters" }, { status: 400 });
      }

      const [artifact] = await db.select()
        .from(serialArtifacts)
        .where(and(
          eq(serialArtifacts.shopId, Number(shopId)),
          eq(serialArtifacts.serialCode, serialCode)
        ))
        .limit(1);

      let actionTaken = "ACCESS_GRANTED";
      let calculatedScore = 25; // Base reward points for verifying authentic item
      let details = "Authentic vault artifact verified successfully.";

      if (!artifact) {
        actionTaken = "INVALID_SCAN";
        calculatedScore = 0;
        details = "Warning: Serial code does not exist in Crown & Brim registry.";
      } else if (artifact.status === "revoked") {
        actionTaken = "FLAGGED_REVOKED";
        calculatedScore = -50; // Penalty for compromised codes
        details = "Critical Security Alert: Attempted lookup on a revoked/compromised artifact.";
      } else {
        // Logic Engine: Check verification frequency for bot/brute-force detection
        const recentLogs = await db.select()
          .from(activityLogs)
          .where(and(
            eq(activityLogs.shopId, Number(shopId)),
            eq(activityLogs.customerId, customerId || "anonymous")
          ));

        if (recentLogs.length >= 5) {
          actionTaken = "RATE_LIMITED_WARNING";
          calculatedScore = 5;
          details = "Elevated verification frequency detected. Security throttling applied.";
        }
      }

      // Record interaction telemetry into audit logs
      await db.insert(activityLogs).values({
        shopId: Number(shopId),
        customerId: customerId || "guest_terminal",
        customerEmail: customerEmail || null,
        calculatedScore,
        actionTaken,
        details,
      });

      return json({
        success: true,
        actionTaken,
        calculatedScore,
        productName: artifact ? artifact.productName : null,
        collectorTier: artifact ? artifact.collectorTier : null,
        message: details,
      });
    }

    return json({ error: "Invalid action intent provided" }, { status: 400 });
  } catch (error) {
    console.error("Vault Action Error:", error);
    return json({ error: "Internal server execution error" }, { status: 500 });
  }
}
