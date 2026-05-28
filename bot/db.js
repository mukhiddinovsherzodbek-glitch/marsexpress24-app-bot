// =========================================================================
// Marsexpress24 — PostgreSQL connection pool
// File: bot/db.js
// All queries go through `query()` with parameterized values ($1, $2, ...)
// — never string-concatenate user input into SQL.
// =========================================================================

'use strict';

const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env and configure it.');
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    // Drop idle clients aggressively — Neon kills them server-side after a
    // short period anyway, so keeping them around just means dialling a
    // dead socket on the next checkout. 10s keeps the pool fresh.
    idleTimeoutMillis: 10_000,
    // First connection after a quiet period needs to:
    //   1) TCP-handshake,
    //   2) TLS-negotiate,
    //   3) wait for Neon to resume the branch,
    //   4) authenticate.
    // We've seen this take 25–35s on a fully cold branch. 45s gives
    // ample headroom; warm queries are unaffected (<100ms).
    connectionTimeoutMillis: 45_000,
    // Catch dead sockets sooner with TCP keepalive so the pool doesn't
    // hand out a half-open connection.
    keepAlive: true,
    keepAliveInitialDelayMillis: 5_000,
    // Enable SSL automatically for hosted Postgres providers (Render, Heroku, Supabase...)
    ssl: /sslmode=require/i.test(process.env.DATABASE_URL)
        ? { rejectUnauthorized: false }
        : false,
});

pool.on('error', (err) => {
    // Idle client crashed — log and let the pool recreate it.
    console.error('[db] idle client error:', err.message);
});

// Errors that mean "the pooled connection was closed under us" — Neon and
// other serverless Postgres providers suspend branches when idle, so the
// first query after a quiet period often hits a half-open socket. The
// fix is to retry once, which forces the pool to dial a fresh connection.
const RETRYABLE_PATTERNS = [
    /connection terminated/i,
    /connection unexpectedly closed/i,
    /econnreset/i,
    /connection timeout/i,
    /server closed the connection/i,
];

function isRetryable(err) {
    const msg = err && err.message ? err.message : '';
    return RETRYABLE_PATTERNS.some((re) => re.test(msg));
}

/**
 * Run a parameterized query. Automatically retries once on transient
 * connection-level failures (Neon branch resume etc).
 *
 * @param {string} text  SQL with $1, $2 placeholders
 * @param {any[]}  params
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params = []) {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        if (process.env.NODE_ENV !== 'production') {
            const ms = Date.now() - start;
            console.log(`[db] ${ms}ms  rows=${res.rowCount}  ${text.split('\n')[0].slice(0, 80)}`);
        }
        return res;
    } catch (err) {
        if (isRetryable(err)) {
            // Pause briefly so we don't immediately re-grab the same dead
            // client; the idle-timeout sweep gets a moment to evict it.
            await new Promise((r) => setTimeout(r, 500));
            console.warn(`[db] retry after transient error: ${err.message}`);
            try {
                const retryStart = Date.now();
                const res = await pool.query(text, params);
                console.log(`[db] retry ok ${Date.now() - retryStart}ms rows=${res.rowCount}`);
                return res;
            } catch (err2) {
                // Second retry — last chance. Useful on truly cold Neon
                // branches where even the second TCP+TLS+resume window
                // exceeded our timeout.
                if (isRetryable(err2)) {
                    await new Promise((r) => setTimeout(r, 1500));
                    console.warn(`[db] second retry after: ${err2.message}`);
                    try {
                        const r3Start = Date.now();
                        const res = await pool.query(text, params);
                        console.log(`[db] second retry ok ${Date.now() - r3Start}ms rows=${res.rowCount}`);
                        return res;
                    } catch (err3) {
                        console.error('[db] all retries failed:', err3.message, '\nSQL:', text);
                        throw err3;
                    }
                }
                console.error('[db] retry failed:', err2.message, '\nSQL:', text);
                throw err2;
            }
        }
        console.error('[db] query failed:', err.message, '\nSQL:', text);
        throw err;
    }
}

/**
 * Acquire a dedicated client for a transaction.
 * Caller MUST call `client.release()` in a finally block.
 */
async function getClient() {
    return pool.connect();
}

/** Close the pool — call once on graceful shutdown. */
async function close() {
    await pool.end();
}

module.exports = { pool, query, getClient, close };
