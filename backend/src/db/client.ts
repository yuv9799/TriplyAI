import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
import path from "path";
import { Pool } from "pg";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../../../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
}

// Serverless client (for Inngest functions / edge)
export const sql = neon(connectionString);

// Connection pool (for Express routes)
export const pool = new Pool({ connectionString });

// Helper to test connection
export async function testConnection(): Promise<boolean> {
    try {
        const result = await sql`SELECT NOW()`;
        console.log("Database connected:", result[0].now);
        return true;
    } catch (error) {
        console.error("Database connection failed:", error);
        return false;
    }
}