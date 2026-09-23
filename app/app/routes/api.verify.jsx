// app/routes/api.verify.jsx
import db from "../db.server.js";
import { verificationLogs } from "../db/schema.js"; 

export const options = () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
};

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const serial = url.searchParams.get("serial")?.trim().toUpperCase();
  const clientIp = request.headers.get("x-forwarded-for") || "unknown";

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
  };

  if (!serial) {
    return new Response(
      JSON.stringify({ valid: false, message: "SERIAL NUMBER REQUIRED" }),
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    // 1. Query the serial and its linked product relationship
    const record = await db.query.serials.findFirst({
      where: (serialsTable, { eq }) => eq(serialsTable.serialNumber, serial),
      with: {
        product: true, 
      },
    });

    if (!record) {
      return new Response(
        JSON.stringify({
          valid: false,
          status: "[ INVALID / UNREGISTERED ]",
          message: "NO RECORD FOUND IN VAULT REGISTRY.",
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // 2. Check if serial has been revoked or flagged
    if (record.status === "REVOKED") {
      await db.insert(verificationLogs).values({
        serialId: record.id,
        ipAddress: clientIp,
        statusReturned: "REVOKED_ATTEMPT",
      });

      return new Response(
        JSON.stringify({
          valid: false,
          status: "[ WARNING: REVOKED / COMPROMISED ]",
          message: "THIS SERIAL HAS BEEN REVOKED BY THE REGISTRY.",
          model: record.product?.title || "Unassigned Model",
          batch: record.batchRelease || "N/A",
          hash: record.encryptionHash || "N/A",
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // 3. Log successful verification scan
    await db.insert(verificationLogs).values({
      serialId: record.id,
      ipAddress: clientIp,
      statusReturned: "VERIFIED",
    });

    // 4. Return valid authentic payload with actual database values
    return new Response(
      JSON.stringify({
        valid: true,
        status: "[ VERIFIED AUTHENTIC ]",
        model: record.product?.title || "Unassigned Model",
        batch: record.batchRelease || "N/A",
        hash: record.encryptionHash || "N/A",
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error verifying serial:", error);
    return new Response(
      JSON.stringify({ valid: false, message: "SERVER ERROR QUERYING REGISTRY" }),
      { status: 500, headers: corsHeaders }
    );
  }
};