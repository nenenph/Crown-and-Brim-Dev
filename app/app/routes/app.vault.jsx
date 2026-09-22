import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server.js";
import { db } from "../db/index";
import { serialArtifacts, activityLogs } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";

// ==========================================
// LOADER
// ==========================================
export async function loader({ request }) {
  const { session } = await authenticate.admin(request);

  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const shopIdParam = url.searchParams.get("shopId");
  const shopId = shopIdParam ? Number(shopIdParam) : 1;

  try {
    if (action === "serials") {
      const items = await db
        .select()
        .from(serialArtifacts)
        .where(eq(serialArtifacts.shopId, shopId));
      return Response.json({ shopId, serials: items, logs: [] });
    }

    if (action === "logs") {
      const logs = await db
        .select()
        .from(activityLogs)
        .where(eq(activityLogs.shopId, shopId))
        .orderBy(desc(activityLogs.timestamp))
        .limit(50);
      return Response.json({ shopId, serials: [], logs });
    }

    const [items, logs] = await Promise.all([
      db
        .select()
        .from(serialArtifacts)
        .where(eq(serialArtifacts.shopId, shopId))
        .catch(() => []),
      db
        .select()
        .from(activityLogs)
        .where(eq(activityLogs.shopId, shopId))
        .orderBy(desc(activityLogs.timestamp))
        .limit(50)
        .catch(() => []),
    ]);

    return Response.json({
      shopId,
      shopDomain: session.shop,
      serials: items || [],
      logs: logs || [],
    });
  } catch (error) {
    console.error("Vault Loader Error:", error);
    return Response.json({
      shopId,
      shopDomain: session.shop,
      serials: [],
      logs: [],
    });
  }
}

// ==========================================
// ACTION
// ==========================================
export async function action({ request }) {
  const body = await request.json().catch(() => ({}));
  const {
    intent,
    shopId,
    serialCode,
    productName,
    collectorTier,
    status,
    customerId,
    customerEmail,
    id,
  } = body;

  if (intent === "mint_serial" || intent === "update_serial") {
    await authenticate.admin(request);
  }

  try {
    if (intent === "mint_serial") {
      if (!shopId || !serialCode || !productName) {
        return Response.json(
          { error: "Missing required fields: shopId, serialCode, productName" },
          { status: 400 }
        );
      }

      await db.insert(serialArtifacts).values({
        shopId: Number(shopId),
        serialCode,
        productName,
        collectorTier: collectorTier || "Standard",
        status: "active",
      });

      return Response.json({
        success: true,
        message: "Vault serial artifact minted successfully.",
      });
    }

    if (intent === "update_serial") {
      if (!id) {
        return Response.json({ error: "Missing serial record ID" }, { status: 400 });
      }

      await db
        .update(serialArtifacts)
        .set({
          ...(status && { status }),
          ...(collectorTier && { collectorTier }),
          ...(productName && { productName }),
        })
        .where(eq(serialArtifacts.id, Number(id)));

      return Response.json({
        success: true,
        message: "Serial artifact updated successfully.",
      });
    }

    if (intent === "verify_serial") {
      if (!shopId || !serialCode) {
        return Response.json(
          { error: "Missing shopId or serialCode parameters" },
          { status: 400 }
        );
      }

      const [artifact] = await db
        .select()
        .from(serialArtifacts)
        .where(
          and(
            eq(serialArtifacts.shopId, Number(shopId)),
            eq(serialArtifacts.serialCode, serialCode)
          )
        )
        .limit(1);

      let actionTaken = "ACCESS_GRANTED";
      let calculatedScore = 25;
      let details = "Authentic vault artifact verified successfully.";

      if (!artifact) {
        actionTaken = "INVALID_SCAN";
        calculatedScore = 0;
        details = "Warning: Serial code does not exist in Crown & Brim registry.";
      } else if (artifact.status === "revoked") {
        actionTaken = "FLAGGED_REVOKED";
        calculatedScore = -50;
        details =
          "Critical Security Alert: Attempted lookup on a revoked/compromised artifact.";
      } else {
        const recentLogs = await db
          .select()
          .from(activityLogs)
          .where(
            and(
              eq(activityLogs.shopId, Number(shopId)),
              eq(activityLogs.customerId, customerId || "anonymous")
            )
          );

        if (recentLogs.length >= 5) {
          actionTaken = "RATE_LIMITED_WARNING";
          calculatedScore = 5;
          details =
            "Elevated verification frequency detected. Security throttling applied.";
        }
      }

      await db.insert(activityLogs).values({
        shopId: Number(shopId),
        customerId: customerId || "guest_terminal",
        customerEmail: customerEmail || null,
        calculatedScore,
        actionTaken,
        details,
      });

      return Response.json({
        success: true,
        actionTaken,
        calculatedScore,
        productName: artifact ? artifact.productName : null,
        collectorTier: artifact ? artifact.collectorTier : null,
        message: details,
      });
    }

    return Response.json({ error: "Invalid action intent provided" }, { status: 400 });
  } catch (error) {
    console.error("Vault Action Error:", error);
    return Response.json({ error: "Internal server execution error" }, { status: 500 });
  }
}

// ==========================================
// DEFAULT EXPORT UI
// ==========================================
export default function VaultPage() {
  const data = useLoaderData();
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state !== "idle";

  const handleMintSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    fetcher.submit(
      JSON.stringify({
        intent: "mint_serial",
        shopId: data?.shopId || 1,
        serialCode: formData.get("serialCode"),
        productName: formData.get("productName"),
        collectorTier: formData.get("collectorTier"),
      }),
      {
        method: "POST",
        encType: "application/json",
      }
    );
  };

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Vault Admin Dashboard</h1>
      <p>Connected Shop: <strong>{data?.shopDomain || "Admin Session"}</strong></p>

      <hr style={{ margin: "20px 0" }} />

      <h2>Mint New Serial Artifact</h2>
      <form onSubmit={handleMintSubmit} style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <input name="serialCode" placeholder="Serial Code (e.g. CB-001)" required />
        <input name="productName" placeholder="Product Name" required />
        <select name="collectorTier">
          <option value="Standard">Standard</option>
          <option value="Gold">Gold</option>
          <option value="Platinum">Platinum</option>
        </select>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Minting..." : "Mint Serial"}
        </button>
      </form>

      {fetcher.data?.message && (
        <p style={{ color: fetcher.data.success ? "green" : "red" }}>
          {fetcher.data.message}
        </p>
      )}

      <hr style={{ margin: "20px 0" }} />

      <h2>Serial Artifacts ({data?.serials?.length || 0})</h2>
      <table width="100%" border="1" cellPadding="8" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Serial Code</th>
            <th>Product Name</th>
            <th>Collector Tier</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {data?.serials?.length > 0 ? (
            data.serials.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{item.serialCode}</td>
                <td>{item.productName}</td>
                <td>{item.collectorTier}</td>
                <td>{item.status}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="5" align="center">No serial artifacts found.</td>
            </tr>
          )}
        </tbody>
      </table>

      <h2 style={{ marginTop: "30px" }}>Recent Activity Logs</h2>
      <ul>
        {data?.logs?.length > 0 ? (
          data.logs.map((log, index) => (
            <li key={index}>
              <strong>[{log.actionTaken}]</strong> - {log.details} (Score: {log.calculatedScore})
            </li>
          ))
        ) : (
          <li>No activity logs recorded.</li>
        )}
      </ul>
    </div>
  );
}