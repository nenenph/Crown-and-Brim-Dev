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
    // 1. Drizzle Query: Use the callback syntax for rel-queries/db.query
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

    // 2. Drizzle Insert: Log the verification scan to the database
    await db.insert(verificationLogs).values({
      serialId: record.id,
      ipAddress: clientIp,
      statusReturned: "VERIFIED",
    });

    return new Response(
      JSON.stringify({
        valid: true,
        status: "[ VERIFIED AUTHENTIC ]",
        model: record.product?.title || "Unknown Model",
        batch: record.batchRelease,
        hash: record.encryptionHash,
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