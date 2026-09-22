// app/routes/api.verify.jsx
import { json } from "react-router";
import db from "../db.server";
import { eq } from "drizzle-orm";
import { serials, verificationLogs } from "../db/schema"; 

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
    return json(
      { valid: false, message: "SERIAL NUMBER REQUIRED" },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    // 1. Drizzle Query: Find the serial and include related product
    const record = await db.query.serials.findFirst({
      where: eq(serials.serialNumber, serial),
      with: {
        product: true, 
      },
    });

    if (!record) {
      return json(
        {
          valid: false,
          status: "[ INVALID / UNREGISTERED ]",
          message: "NO RECORD FOUND IN VAULT REGISTRY.",
        },
        { headers: corsHeaders }
      );
    }

    // 2. Drizzle Insert: Log the verification scan to the database
    await db.insert(verificationLogs).values({
      serialId: record.id,
      ipAddress: clientIp,
      statusReturned: "VERIFIED",
    });

    return json(
      {
        valid: true,
        status: "[ VERIFIED AUTHENTIC ]",
        model: record.product?.title || "Unknown Model",
        batch: record.batchRelease,
        hash: record.encryptionHash,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error verifying serial:", error);
    return json(
      { valid: false, message: "SERVER ERROR QUERYING REGISTRY" },
      { status: 500, headers: corsHeaders }
    );
  }
};