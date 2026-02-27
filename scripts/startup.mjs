/**
 * SaaS Startup Script
 * Runs on every container boot:
 * 1. Applies schema changes (prisma db push)
 * 2. Auto-seeds default data if DB is empty (idempotent)
 * 3. Starts the Next.js server
 */
import { execSync } from "child_process";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const DATABASE_URL = process.env.DATABASE_URL;

// ── 1. Apply schema changes ──
console.log("[Startup] Applying schema changes...");
try {
    execSync("node ./node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss", {
        stdio: "inherit",
        env: { ...process.env },
    });
    console.log("[Startup] Schema sync complete.");
} catch (err) {
    console.warn("[Startup] Schema push failed (may already be up to date):", err.message);
}

// ── 2. Auto-seed if empty ──
async function autoSeed() {
    if (!DATABASE_URL) {
        console.warn("[Startup] No DATABASE_URL, skipping auto-seed.");
        return;
    }

    const pool = new Pool({ connectionString: DATABASE_URL });

    try {
        // Check if pipeline stages exist (indicator of seeded DB)
        const { rows: stageRows } = await pool.query('SELECT COUNT(*) as count FROM "PipelineStage"');
        const stageCount = parseInt(stageRows[0].count, 10);

        if (stageCount > 0) {
            console.log("[Startup] DB already seeded (" + stageCount + " pipeline stages). Skipping.");
            await pool.end();
            return;
        }

        console.log("[Startup] Empty DB detected. Auto-seeding...");

        // ── System Settings ──
        const settingsId = "default";
        await pool.query(`
            INSERT INTO "SystemSettings" (id, "ycloudApiKey", "ycloudPhoneId", "isBotEnabled", "updatedAt")
            VALUES ($1, '', '', false, NOW())
            ON CONFLICT (id) DO NOTHING
        `, [settingsId]);
        console.log("[Startup] ✓ System settings created");

        // ── Admin User ──
        const adminPassword = await bcrypt.hash("admin123", 12);
        const adminId = crypto.randomUUID().replace(/-/g, "").slice(0, 25);
        await pool.query(`
            INSERT INTO "User" (id, email, name, password, role, "createdAt", "updatedAt")
            VALUES ($1, 'admin@zencrm.com', 'Administrador', $2, 'ADMIN', NOW(), NOW())
            ON CONFLICT (email) DO NOTHING
        `, [adminId, adminPassword]);
        console.log("[Startup] ✓ Admin user created (admin@zencrm.com / admin123)");

        // ── Kommo-style Pipeline Stages ──
        const stages = [
            { name: "Nuevo Lead", color: "#3B82F6", order: 0, isIncoming: true, isClosedWon: false, isClosedLost: false },
            { name: "Calificado", color: "#8B5CF6", order: 1, isIncoming: false, isClosedWon: false, isClosedLost: false },
            { name: "Propuesta", color: "#F59E0B", order: 2, isIncoming: false, isClosedWon: false, isClosedLost: false },
            { name: "Negociación", color: "#F97316", order: 3, isIncoming: false, isClosedWon: false, isClosedLost: false },
            { name: "Cerrado Ganado", color: "#22C55E", order: 4, isIncoming: false, isClosedWon: true, isClosedLost: false },
            { name: "Cerrado Perdido", color: "#EF4444", order: 5, isIncoming: false, isClosedWon: false, isClosedLost: true },
        ];

        for (const s of stages) {
            const id = crypto.randomUUID().replace(/-/g, "").slice(0, 25);
            await pool.query(`
                INSERT INTO "PipelineStage" (id, name, color, "order", "isIncoming", "isClosedWon", "isClosedLost", "createdAt", "updatedAt")
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            `, [id, s.name, s.color, s.order, s.isIncoming, s.isClosedWon, s.isClosedLost]);
        }
        console.log("[Startup] ✓ " + stages.length + " Kommo-style pipeline stages created");

        console.log("[Startup] ✅ Auto-seed complete!");
    } catch (err) {
        console.error("[Startup] Auto-seed error:", err.message);
    } finally {
        await pool.end();
    }
}

await autoSeed();

// ── 3. Start the server ──
console.log("[Startup] Starting Next.js server...");
import("./server.js");
