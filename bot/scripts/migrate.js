// =========================================================================
// Marsexpress24 — migration runner
// File: bot/scripts/migrate.js
//
// Usage:
//   node scripts/migrate.js          # apply pending migrations
//   node scripts/migrate.js --reset  # DROP all tables, then re-apply
//
// Tracks applied files in a `_migrations` table so each runs at most once.
// Each .sql file is executed as a single statement block inside a
// transaction — files already use BEGIN/COMMIT, so re-running is safe.
// =========================================================================

'use strict';

require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');

const db = require('../db');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function ensureMigrationsTable() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS _migrations (
            filename   TEXT PRIMARY KEY,
            applied_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
    `);
}

async function listApplied() {
    const { rows } = await db.query('SELECT filename FROM _migrations');
    return new Set(rows.map((r) => r.filename));
}

function listMigrationFiles() {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
        throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
    }
    return fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith('.sql'))
        .sort();
}

async function applyMigration(filename) {
    const full = path.join(MIGRATIONS_DIR, filename);
    const sql = fs.readFileSync(full, 'utf8');

    const client = await db.getClient();
    try {
        // Migration files include their own BEGIN/COMMIT, so we run them
        // as-is rather than wrapping in an outer transaction.
        await client.query(sql);
        await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [filename]);
        console.log(`  ✓ ${filename}`);
    } finally {
        client.release();
    }
}

async function reset() {
    console.log('⚠️  Reset mode — dropping all tables');
    await db.query(`
        DROP TABLE IF EXISTS orders     CASCADE;
        DROP TABLE IF EXISTS products   CASCADE;
        DROP TABLE IF EXISTS categories CASCADE;
        DROP TABLE IF EXISTS _migrations CASCADE;
    `);
    console.log('   tables dropped');
}

async function main() {
    const args = new Set(process.argv.slice(2));

    if (args.has('--reset')) {
        await reset();
    }

    await ensureMigrationsTable();
    const applied = await listApplied();
    const files = listMigrationFiles();

    const pending = files.filter((f) => !applied.has(f));
    if (pending.length === 0) {
        console.log('Nothing to migrate — schema is up to date.');
        return;
    }

    console.log(`Applying ${pending.length} migration(s):`);
    for (const f of pending) {
        await applyMigration(f);
    }
    console.log('Done.');
}

main()
    .catch((err) => {
        console.error('Migration failed:', err.message);
        process.exitCode = 1;
    })
    .finally(() => db.close());
