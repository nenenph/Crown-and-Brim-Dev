// app/routes/api.verify.jsx
import { json } from "react-router";
import db from "../db.server";

// Handle preflight CORS requests
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
    // Query Prisma DB (adjust model & field names to match your schema)
    const record = await db.serial.findUnique({
      where: { serialNumber: serial },
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

    return json(
      {
        valid: true,
        status: "[ VERIFIED AUTHENTIC ]",
        model: record.modelSpec || record.model,
        batch: record.batchRelease || record.batch,
        hash: record.encryptionHash || record.hash,
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