import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Load from root .env.local
dotenv.config({ path: path.resolve(__dirname, "../../../.env.local") });
// Also load from backend/.env for overrides
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { pool } from "./client";

async function migrate() {
    const migrationsDir = path.join(__dirname, "migrations");
    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith(".sql"))
        .sort();

    console.log(`Found ${files.length} migration(s)`);

    const client = await pool.connect();

    try {
        for (const file of files) {
            console.log(`Running migration: ${file}`);
            const content = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
            try {
                await client.query(content);
                console.log(`✓ ${file} applied successfully`);
            } catch (error) {
                console.error(`✗ ${file} failed:`, error);
                throw error;
            }
        }
        console.log("All migrations complete.");
    } finally {
        client.release();
        await pool.end();
    }

    process.exit(0);
}

migrate().catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
});
