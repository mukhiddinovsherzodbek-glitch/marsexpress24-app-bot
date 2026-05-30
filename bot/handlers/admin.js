// =========================================================================
// Marsexpress24 — admin panel
// File: bot/handlers/admin.js
//
// /admin (ADMIN_ID only) opens an inline-keyboard control panel:
//   🍔 Mahsulotlar — toggle availability, edit price
//   📊 Statistika   — today / week / month totals + top 5 products
//
// Navigation edits the same message (editMessageText). All DB access is
// parameterised. Wire it up from index.js:  require('./handlers/admin').register(bot)
// =========================================================================

'use strict';

const { Markup } = require('telegraf');
const { message } = require('telegraf/filters');
const db = require('../db');

const PAGE = 6;                 // products per page
const TZ = 'Asia/Tashkent';

// Pending "enter new price" state, keyed by admin telegram id.
//   adminId -> { productId, page, chatId, messageId }
const priceEdit = new Map();

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------
function isAdmin(ctx) {
    return !!process.env.ADMIN_ID && String(ctx.from && ctx.from.id) === String(process.env.ADMIN_ID);
}

function formatPrice(n) {
    return Number(n || 0).toLocaleString('en-US').replace(/,/g, ' ');
}

// Tashkent-local expression for the stored UTC timestamp.
const C_TASH = "(created_at AT TIME ZONE 'UTC' AT TIME ZONE '" + TZ + "')";

// -------------------------------------------------------------------------
// Main menu
// -------------------------------------------------------------------------
const MENU_TEXT = '🎛 Admin Panel\nMarsexpress24';
function menuMarkup() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('🍔 Mahsulotlar', 'adm:products:0')],
        [Markup.button.callback('📊 Statistika', 'adm:stats')],
    ]);
}

// -------------------------------------------------------------------------
// 🍔 Products — all, paginated
// -------------------------------------------------------------------------
async function productsView(page) {
    const { rows } = await db.query(
        `SELECT id, name, price, is_available
           FROM products
          ORDER BY category_id, price, id`
    );

    const pages = Math.ceil(rows.length / PAGE);
    const p = Math.max(0, Math.min(page, pages - 1));
    const slice = rows.slice(p * PAGE, p * PAGE + PAGE);

    const text = `🍔 Mahsulotlar (${rows.length} ta) — sahifa ${p + 1}/${pages}\n\n` +
        'Holatni o\'zgartirish uchun mahsulot tugmasini,\nnarx uchun ✏️ tugmasini bosing.';

    const buttons = [];
    slice.forEach((pr) => {
        const mark = pr.is_available ? '✅' : '❌';
        buttons.push([
            Markup.button.callback(`${mark} ${pr.name} — ${formatPrice(pr.price)}`, `adm:pt:${pr.id}:${p}`),
            Markup.button.callback('✏️', `adm:pp:${pr.id}:${p}`),
        ]);
    });

    const nav = [];
    if (p > 0) nav.push(Markup.button.callback('⬅️', `adm:products:${p - 1}`));
    nav.push(Markup.button.callback(`${p + 1}/${pages}`, 'adm:noop'));
    if (p < pages - 1) nav.push(Markup.button.callback('➡️', `adm:products:${p + 1}`));
    buttons.push(nav);
    buttons.push([Markup.button.callback('⬅️ Orqaga', 'adm:menu')]);

    return { text, markup: Markup.inlineKeyboard(buttons) };
}

// -------------------------------------------------------------------------
// 📊 Statistics
// -------------------------------------------------------------------------
async function statsView() {
    const period = async (cond) => {
        const { rows } = await db.query(
            `SELECT COUNT(*)::int AS n, COALESCE(SUM(total_amount),0)::bigint AS sum
               FROM orders WHERE ${cond}`
        );
        return rows[0];
    };

    const today = await period(`${C_TASH}::date = (now() AT TIME ZONE '${TZ}')::date`);
    const week  = await period(`${C_TASH} >= date_trunc('week',  (now() AT TIME ZONE '${TZ}'))`);
    const month = await period(`${C_TASH} >= date_trunc('month', (now() AT TIME ZONE '${TZ}'))`);

    const { rows: top } = await db.query(
        `SELECT it->>'name' AS name, SUM((it->>'quantity')::int) AS qty
           FROM orders, jsonb_array_elements(items) AS it
          GROUP BY it->>'name'
          ORDER BY qty DESC
          LIMIT 5`
    );

    const lines = [
        '📊 Statistika',
        '',
        `📅 Bugun: ${today.n} ta — ${formatPrice(today.sum)} so'm`,
        `🗓 Bu hafta: ${week.n} ta — ${formatPrice(week.sum)} so'm`,
        `📆 Bu oy: ${month.n} ta — ${formatPrice(month.sum)} so'm`,
        '',
        '🏆 Top 5 mahsulot:',
    ];
    if (top.length === 0) {
        lines.push('  (hali ma\'lumot yo\'q)');
    } else {
        top.forEach((t, i) => lines.push(`  ${i + 1}. ${t.name} — ${t.qty} ta`));
    }

    return {
        text: lines.join('\n'),
        markup: Markup.inlineKeyboard([[Markup.button.callback('⬅️ Orqaga', 'adm:menu')]]),
    };
}

// -------------------------------------------------------------------------
// Safe editMessageText (ignores "message is not modified")
// -------------------------------------------------------------------------
async function safeEdit(ctx, view) {
    try {
        await ctx.editMessageText(view.text, view.markup);
    } catch (err) {
        if (!/message is not modified/i.test(err.description || err.message || '')) {
            console.error('[admin] editMessageText:', err.message);
        }
    }
}

// -------------------------------------------------------------------------
// Registration
// -------------------------------------------------------------------------
function register(bot) {
    // /admin
    bot.command('admin', async (ctx) => {
        if (!isAdmin(ctx)) {
            await ctx.reply('Sizda ruxsat yo\'q');
            return;
        }
        await ctx.reply(MENU_TEXT, menuMarkup());
    });

    // Guard every admin callback.
    const guard = (handler) => async (ctx) => {
        if (!isAdmin(ctx)) {
            try { await ctx.answerCbQuery('Ruxsat yo\'q', { show_alert: true }); } catch {}
            return;
        }
        try {
            await handler(ctx);
        } catch (err) {
            console.error('[admin] callback error:', err);
            try { await ctx.answerCbQuery('Xato yuz berdi'); } catch {}
        }
    };

    bot.action('adm:noop', guard(async (ctx) => { await ctx.answerCbQuery(); }));

    bot.action('adm:menu', guard(async (ctx) => {
        priceEdit.delete(ctx.from.id);
        await safeEdit(ctx, { text: MENU_TEXT, markup: menuMarkup() });
        await ctx.answerCbQuery();
    }));

    bot.action(/^adm:products:(\d+)$/, guard(async (ctx) => {
        await safeEdit(ctx, await productsView(Number(ctx.match[1])));
        await ctx.answerCbQuery();
    }));

    // Toggle availability.
    bot.action(/^adm:pt:(\d+):(\d+)$/, guard(async (ctx) => {
        const id = Number(ctx.match[1]);
        const page = Number(ctx.match[2]);
        const { rows } = await db.query(
            'UPDATE products SET is_available = NOT is_available WHERE id = $1 RETURNING is_available',
            [id]
        );
        const nowAvail = rows[0] && rows[0].is_available;
        await ctx.answerCbQuery(nowAvail ? '✅ Mavjud' : '❌ Tugadi');
        await safeEdit(ctx, await productsView(page));
    }));

    // Ask for a new price → set pending state.
    bot.action(/^adm:pp:(\d+):(\d+)$/, guard(async (ctx) => {
        const id = Number(ctx.match[1]);
        const page = Number(ctx.match[2]);
        const { rows } = await db.query('SELECT name, price FROM products WHERE id = $1', [id]);
        if (rows.length === 0) {
            await ctx.answerCbQuery('Topilmadi');
            return;
        }
        priceEdit.set(ctx.from.id, { productId: id, page });
        await ctx.answerCbQuery();
        await ctx.reply(
            `✏️ "${rows[0].name}" (hozir ${formatPrice(rows[0].price)} so'm)\n` +
            'Yangi narxni kiriting (faqat raqam, so\'m):'
        );
    }));

    bot.action('adm:stats', guard(async (ctx) => {
        await safeEdit(ctx, await statsView());
        await ctx.answerCbQuery();
    }));

    // Price input — only acts when the admin has a pending price edit.
    bot.on(message('text'), async (ctx, next) => {
        if (!isAdmin(ctx)) return next();
        const st = priceEdit.get(ctx.from.id);
        if (!st) return next();

        const digits = String(ctx.message.text).replace(/[^\d]/g, '');
        const price = Number(digits);
        if (!digits || !Number.isFinite(price) || price <= 0) {
            await ctx.reply('⚠️ Noto\'g\'ri narx. Faqat raqam kiriting, masalan: 35000');
            return;
        }
        priceEdit.delete(ctx.from.id);
        const { rows } = await db.query(
            'UPDATE products SET price = $1 WHERE id = $2 RETURNING name',
            [price, st.productId]
        );
        const name = rows[0] ? rows[0].name : '';
        await ctx.reply(`✅ "${name}" narxi ${formatPrice(price)} so'm ga yangilandi.`);
        const view = await productsView(st.page);
        await ctx.reply(view.text, view.markup);
    });
}

module.exports = { register };
