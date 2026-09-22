import process from "node:process";
import "dotenv/config";
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema.js";

// Explicitly locate .env file
dotenv.config();

// Fall back to vault_engine instead of crown_matrix
const connectionString =
  process.env.DATABASE_URL || "mysql://root:password@localhost:3306/vault_engine";

const poolConnection = mysql.createPool(connectionString);

export const db = drizzle(poolConnection, { schema, mode: "default" });