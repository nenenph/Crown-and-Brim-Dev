// app/db.server.js
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./db/schema";

let pool;

if (!global.__db_pool__) {
  global.__db_pool__ = mysql.createPool({
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
}

pool = global.__db_pool__;

// Export the Drizzle client with the schema loaded for relational queries
const db = drizzle(pool, { schema, mode: "default" });

export default db;