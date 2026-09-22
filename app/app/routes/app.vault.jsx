import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server.js";
import { db } from "../db/index";
import { products, serials, verificationLogs } from "../db/schema";
import { eq, desc } from "drizzle-orm";

// ==========================================
// LOADER
// ==========================================
export async function loader({ request }) {
  const { session } = await authenticate.admin(request);

  try {
    const [allSerials, logs] = await Promise.all([
      db
        .select({
          id: serials.id,
          serialNumber: serials.serialNumber,
          batchRelease: serials.batchRelease,
          status: serials.status,
          productTitle: products.title,
          sku: products.sku,
        })
        .from(serials)
        .leftJoin(products, eq(serials.productId, products.id))
        .catch(() => []),
      db
        .select()
        .from(verificationLogs)
        .orderBy(desc(verificationLogs.scannedAt))
        .limit(50)
        .catch(() => []),
    ]);

    return Response.json({
      shopDomain: session.shop,
      serials: allSerials || [],
      logs: logs || [],
    });
  } catch (error) {
    console.error("Vault Loader Error:", error);
    return Response.json({
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
    serialNumber,
    productTitle,
    sku,
    batchRelease,
    status,
    id,
    ipAddress,
  } = body;

  if (intent === "mint_serial" || intent === "update_serial") {
    await authenticate.admin(request);
  }

  try {
    if (intent === "mint_serial") {
      if (!serialNumber || !productTitle) {
        return Response.json(
          { error: "Missing required fields: serialNumber, productTitle" },
          { status: 400 }
        );
      }

      // 1. Create or ensure Product exists
      const productId = `p-${Date.now()}`;
      await db.insert(products).values({
        id: productId,
        title: productTitle,
        sku: sku || `SKU-${Date.now()}`,
      });

      // 2. Insert Serial linked to Product
      await db.insert(serials).values({
        id: `s-${Date.now()}`,
        productId,
        serialNumber,
        batchRelease: batchRelease || "Standard Drop",
        encryptionHash: crypto.randomUUID(),
        status: "ACTIVE",
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
        .update(serials)
        .set({
          ...(status && { status }),
          ...(batchRelease && { batchRelease }),
        })
        .where(eq(serials.id, id));

      return Response.json({
        success: true,
        message: "Serial artifact updated successfully.",
      });
    }

    if (intent === "verify_serial") {
      if (!serialNumber) {
        return Response.json(
          { error: "Missing serialNumber parameter" },
          { status: 400 }
        );
      }

      const [serialRecord] = await db
        .select({
          id: serials.id,
          serialNumber: serials.serialNumber,
          status: serials.status,
          productTitle: products.title,
        })
        .from(serials)
        .leftJoin(products, eq(serials.productId, products.id))
        .where(eq(serials.serialNumber, serialNumber))
        .limit(1);

      let statusReturned = "VERIFIED";
      let message = "Authentic vault artifact verified successfully.";

      if (!serialRecord) {
        statusReturned = "INVALID";
        message = "Warning: Serial code does not exist in registry.";
      } else if (serialRecord.status === "REVOKED") {
        statusReturned = "SUSPICIOUS";
        message = "Alert: Attempted verification on a revoked/compromised serial.";
      }

      if (serialRecord) {
        await db.insert(verificationLogs).values({
          serialId: serialRecord.id,
          ipAddress: ipAddress || "127.0.0.1",
          statusReturned,
        });
      }

      return Response.json({
        success: statusReturned === "VERIFIED",
        statusReturned,
        productName: serialRecord ? serialRecord.productTitle : null,
        message,
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
        serialNumber: formData.get("serialNumber"),
        productTitle: formData.get("productTitle"),
        sku: formData.get("sku"),
        batchRelease: formData.get("batchRelease"),
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
      <p>
        Connected Shop: <strong>{data?.shopDomain || "Admin Session"}</strong>
      </p>

      <hr style={{ margin: "20px 0" }} />

      <h2>Mint New Serial Artifact</h2>
      <form
        onSubmit={handleMintSubmit}
        style={{ display: "flex", gap: "10px", marginBottom: "20px" }}
      >
        <input
          name="serialNumber"
          placeholder="Serial Number (e.g. CB-VAULT-001)"
          required
        />
        <input name="productTitle" placeholder="Product Title" required />
        <input name="sku" placeholder="SKU (e.g. CB-FED-001)" />
        <input name="batchRelease" placeholder="Batch / Drop Name" />
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
      <table
        width="100%"
        border="1"
        cellPadding="8"
        style={{ borderCollapse: "collapse" }}
      >
        <thead>
          <tr>
            <th>ID</th>
            <th>Serial Number</th>
            <th>Product Title</th>
            <th>SKU</th>
            <th>Batch Release</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {data?.serials?.length > 0 ? (
            data.serials.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{item.serialNumber}</td>
                <td>{item.productTitle || "—"}</td>
                <td>{item.sku || "—"}</td>
                <td>{item.batchRelease || "—"}</td>
                <td>{item.status}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6" align="center">
                No serial artifacts found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h2 style={{ marginTop: "30px" }}>Recent Verification Scans</h2>
      <ul>
        {data?.logs?.length > 0 ? (
          data.logs.map((log) => (
            <li key={log.id}>
              <strong>[{log.statusReturned}]</strong> — Scanned from IP:{" "}
              {log.ipAddress} at {new Date(log.scannedAt).toLocaleString()}
            </li>
          ))
        ) : (
          <li>No verification scans recorded yet.</li>
        )}
      </ul>
    </div>
  );
}