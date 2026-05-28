# Marsexpress24 — Telegram Mini App + Bot

Fast-food restoran uchun Telegram Mini App va Node.js bot.
Mijoz Mini App orqali buyurtma beradi, bot uni bazaga saqlaydi va adminga chek yuboradi.

---

## Tarkib

- [Texnologiyalar](#texnologiyalar)
- [Loyiha tuzilmasi](#loyiha-tuzilmasi)
- [Tez ishga tushirish](#tez-ishga-tushirish)
- [Telegram BotFather sozlamalari](#telegram-botfather-sozlamalari)
- [📸 Rasm fayllarini joylash (MAJBURIY)](#-rasm-fayllarini-joylash-majburiy)
- [Production deploy (webhook)](#production-deploy-webhook)
- [API endpointlar](#api-endpointlar)
- [Xavfsizlik](#xavfsizlik)
- [Muammolarni hal qilish](#muammolarni-hal-qilish)

---

## Texnologiyalar

**Bot (backend):** Node.js ≥18, Telegraf 4.x, Express, PostgreSQL (`pg`), Helmet, CORS, rate-limit, dotenv.
**Mini App (frontend):** sof HTML5 + CSS3 + Vanilla JS, Telegram Web App SDK, Google Fonts (Inter).

---

## Loyiha tuzilmasi

```
marsexpress24/
├── README.md                            ← ushbu fayl
│
├── bot/                                 ← Node.js backend
│   ├── index.js                         ← asosiy fayl (Express + Telegraf)
│   ├── db.js                            ← PostgreSQL pool wrapper
│   ├── package.json
│   ├── .env.example
│   ├── .gitignore
│   ├── middleware/
│   │   └── auth.js                      ← Telegram initData HMAC tekshiruvi
│   ├── routes/
│   │   └── api.js                       ← /api/categories, /products, /orders
│   ├── scripts/
│   │   └── migrate.js                   ← SQL migration runner
│   ├── migrations/
│   │   ├── 001_init.sql                 ← jadvallar + 5 kategoriya
│   │   └── 002_seed.sql                 ← 63 ta mahsulot
│   └── assets/
│       └── welcome_start.png            ← /start xush kelibsiz rasmi
│
└── miniapp/                             ← Mini App frontend
    ├── index.html
    ├── css/
    │   └── style.css
    ├── js/
    │   ├── api.js                       ← fetch wrapper
    │   ├── cart.js                      ← savat + CloudStorage
    │   └── app.js                       ← asosiy kontroller
    └── assets/
        ├── categories/                  ← 5 ta kategoriya rasmi
        └── products/
            ├── burgers/                 ← 8 ta burger rasmi
            ├── lavash/                  ← 6 ta lavash rasmi
            ├── tako/                    ← 6 ta tako rasmi
            ├── combo/                   ← 38 ta combo rasmi
            └── snack/                   ← 5 ta snack rasmi
```

---

## Tez ishga tushirish

### 1. PostgreSQL bazasini yaratish

Lokal Postgres ishga tushgan deb hisoblaymiz.

```bash
createdb marsexpress24
```

### 2. Bot konfiguratsiyasi

```bash
cd bot
cp .env.example .env
```

`.env` faylini ochib quyidagilarni to'ldiring:

| O'zgaruvchi | Tavsifi | Qayerdan olinadi |
|---|---|---|
| `BOT_TOKEN` | Bot tokeni | [@BotFather](https://t.me/BotFather) → `/newbot` |
| `ADMIN_ID` | Adminning Telegram ID raqami | [@userinfobot](https://t.me/userinfobot) |
| `WEBAPP_URL` | Mini App HTTPS URL'i | Hosting URL'ingiz (HTTPS shart!) |
| `DATABASE_URL` | PostgreSQL ulanish stringi | masalan `postgresql://postgres:postgres@localhost:5432/marsexpress24` |
| `PORT` | Server port | `3000` (default) |
| `NODE_ENV` | `development` yoki `production` | dev rejimda — `development` |

### 3. Bog'liqliklarni o'rnatish

```bash
cd bot
npm install
```

### 4. Migration ishga tushirish

```bash
npm run migrate
```

Chiqishi:
```
Applying 2 migration(s):
  ✓ 001_init.sql
  ✓ 002_seed.sql
Done.
```

Tekshirish:
```sql
SELECT category_id, COUNT(*) FROM products GROUP BY 1 ORDER BY 1;
-- 1 → 8, 2 → 6, 3 → 6, 4 → 38, 5 → 5  (jami 63)
```

### 5. Bot va serverni ishga tushirish

```bash
npm run dev      # auto-reload (--watch)
# yoki
npm start
```

Chiqish:
```
[server] listening on :3000  (NODE_ENV=development)
[bot] polling started
```

### 6. Mini App'ni serve qilish

`/miniapp` faqat statik HTML/CSS/JS. Lokal test uchun har qanday statik server yaramaydi:

```bash
cd miniapp
npx serve -p 8080          # yoki: python -m http.server 8080
```

Production'da `nginx`, `caddy`, yoki bot serveriga `express.static`'ni qo'shing.

> ⚠️ **Telegram talabi:** `WEBAPP_URL` **HTTPS** bo'lishi shart. Lokal HTTP URL'da Mini App tugmasi ochilmaydi.
> Lokal sinov uchun [ngrok](https://ngrok.com/) yoki [cloudflared tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) ishlatish tavsiya etiladi.

### 7. Sinov

1. Telegram'da botingizga `/start` yuboring
2. "Marsexpress24 ga xush kelibsiz" rasmi va matn keladi
3. "🛍️ Buyurtma berish" tugmasini bosing — Mini App ochiladi
4. Kategoriya tanlang, mahsulot qo'shing, savat → checkout → tasdiqlash
5. Adminga chek keladi, sizga tasdiq xabari keladi

---

## Telegram BotFather sozlamalari

`@BotFather`da quyidagilarni qiling:

1. **`/newbot`** — bot nomi va `@username` belgilang. Tokenni `.env` ga ko'chiring.
2. **`/setdescription`** — qisqa tavsif (ixtiyoriy).
3. **`/setuserpic`** — bot rasmi.
4. **`/setdomain`** — Mini App URL'ining HTTPS domeni (masalan `yourdomain.com`).
5. Mini App tugmasi avtomatik — `WEBAPP_URL` orqali Telegraf reply keyboard'da ochadi. `Menu Button` (bot pastida) sozlash shart emas, lekin xohlasangiz BotFather'da `/setmenubutton` orqali qo'sha olasiz.

---

## 📸 Rasm fayllarini joylash (MAJBURIY)

Loyiha kod tomondan to'liq tayyor, lekin **rasm fayllari hali joylashtirilmagan**. Quyida har bir rasm uchun aniq yo'l.

### Umumiy talablar

| Parametr | Qiymat |
|---|---|
| Format | `.png` |
| O'lcham | `600 × 600 px` |
| Fon | Qora (mahsulot markazda) |
| Hajmi | Imkon qadar ≤ 200 KB (TinyPNG, Squoosh) |

---

### 1) Bot uchun — `bot/assets/welcome_start.png`

```
bot/assets/welcome_start.png    ← /start komandasida birinchi yuboriladigan rasm
```

Bu rasm Telegram chat'ida `/start` bosilganda yuboriladi. Brendingiz rasmi, salomlashuv banneri yoki menyu kollaji bo'lishi mumkin. Tavsiya: **1280 × 720 px** (landscape).

---

### 2) Mini App kategoriyalari — `miniapp/assets/categories/`

5 ta fayl. Nomlari **aniq** quyidagicha bo'lishi shart (kichik harf, `_card.png`):

```
miniapp/assets/categories/burger_card.png
miniapp/assets/categories/lavash_card.png
miniapp/assets/categories/tako_card.png
miniapp/assets/categories/combo_card.png
miniapp/assets/categories/snack_card.png
```

---

### 3) Mini App mahsulotlari — `miniapp/assets/products/`

#### 🍔 Burger (`miniapp/assets/products/burgers/`) — 8 ta

```
01_burger_chicken.png            — Burger Chicken         — 30,000 so'm
02_burger_bbq.png                — Burger BBQ             — 35,000 so'm
03_burger_chees.png              — Burger Chees           — 35,000 so'm
04_burger_spice.png              — Burger Spice           — 35,000 so'm
05_burger_mars.png               — Burger Mars            — 35,000 so'm
06_burger_gosht.png              — Burger Go'sht          — 40,000 so'm
07_burger_spice_double.png       — Burger Spice Double    — 45,000 so'm
08_big_burger_gosht.png          — Big Burger Go'sht      — 50,000 so'm
```

#### 🫓 Lavash (`miniapp/assets/products/lavash/`) — 6 ta

```
01_lavash_chicken.png            — Lavash Chicken         — 30,000 so'm
02_lavash_mars.png               — Lavash Mars            — 35,000 so'm
03_lavash_spice.png              — Lavash Spice           — 35,000 so'm
04_lavash_bbq.png                — Lavash BBQ             — 35,000 so'm
05_lavash_chees.png              — Lavash Chees           — 35,000 so'm
06_lavash_beef.png               — Lavash Beef            — 40,000 so'm
```

#### 🌮 Tako (`miniapp/assets/products/tako/`) — 6 ta

```
01_tako_chicken.png              — Tako Chicken           — 40,000 so'm
02_tako_bbq_kolbaski.png         — Tako BBQ Kolbaski      — 40,000 so'm
03_tako_gosht_mol.png            — Tako Go'sht Mol        — 45,000 so'm
04_tako_mix.png                  — Tako Mix               — 45,000 so'm
05_tako_gril.png                 — Tako Gril              — 50,000 so'm
06_tako_spice.png                — Tako Spice             — 50,000 so'm
```

#### 🎁 Combo Set (`miniapp/assets/products/combo/`) — 38 ta

```
01_roll_lunch.png                — 45,000 so'm
02_burger_lunch.png              — 45,000 so'm
03_combo_6.png                   — 70,000 so'm
04_combo_5.png                   — 70,000 so'm
05_king_mars.png                 — 70,000 so'm
06_mix_lanch.png                 — 85,000 so'm
07_combo_4.png                   — 95,000 so'm
08_zero_burger_4.png             — 99,000 so'm
09_zero_lavash_4.png             — 99,000 so'm
10_peperoni_combo.png            — 99,000 so'm
11_combo_1.png                   — 99,000 so'm
12_combo_2.png                   — 99,000 so'm
13_samarqand_combo.png           — 110,000 so'm
14_friends_burger.png            — 115,000 so'm
15_friends_lavash.png            — 115,000 so'm
16_big_duet.png                  — 125,000 so'm
17_tantana_combo.png             — 130,000 so'm
18_student_combo.png             — 130,000 so'm
19_aristokrat_combo.png          — 130,000 so'm
20_spice_combo.png               — 145,000 so'm
21_star_combo.png                — 145,000 so'm
22_dostar_combo.png              — 150,000 so'm
23_mars_love_burger_1.png        — 155,000 so'm
24_mars_love_burger_2.png        — 155,000 so'm
25_by_raximov_combo.png          — 160,000 so'm
26_oila_burger.png               — 165,000 so'm
27_oila_lavash.png               — 165,000 so'm
28_sherif.png                    — 165,000 so'm
29_big_family.png                — 165,000 so'm
30_ramazan_combo_1.png           — 165,000 so'm
31_ramazan_combo_2.png           — 165,000 so'm
32_ramazan_mix_combo.png         — 165,000 so'm
33_lux_burger.png                — 220,000 so'm
34_lux_lavash.png                — 220,000 so'm
35_legenda_combo.png             — 220,000 so'm
36_iftar_combo.png               — 225,000 so'm
37_barakali_combo.png            — 225,000 so'm
38_amore_combo.png               — 230,000 so'm
```

#### 🍟 Snack (`miniapp/assets/products/snack/`) — 5 ta

```
01_souslar.png                   — Souslar                — 5,000 so'm
02_piyozli_halqalar.png          — Piyozli Halqalar       — 15,000 so'm
03_shariki.png                   — Shariki                — 15,000 so'm
04_derevenskiy.png               — Derevenskiy            — 15,000 so'm
05_fri.png                       — Fri                    — 15,000 so'm
```

### Diqqat!

- Fayl nomlari **aynan** SQL `image_url` qiymatlariga mos kelishi shart.
- Boshqa nom yoki katta harf bilan yuklasangiz — `<img>` 404 oladi va qora joy ko'rinadi.
- Rasm yo'q bo'lsa ham Mini App yiqilmaydi — qora placeholder ko'rinadi (border-radius bilan).

---

## Production deploy (webhook)

1. Server (VPS/Render/Railway) `BOT_TOKEN`, `ADMIN_ID`, `WEBAPP_URL`, `DATABASE_URL` ni env'da sozlang.
2. `WEBHOOK_DOMAIN`'ga shu server'ning HTTPS URL'ini qo'ying (masalan `https://bot.yourdomain.com`).
3. `NODE_ENV=production` qiling.
4. `npm install && npm run migrate && npm start` ishga tushiring.

Bot avtomatik webhook'ni o'rnatadi:
```
[bot] webhook set: https://bot.yourdomain.com/telegraf/<secret>
```

Polling rejimga qaytarish uchun `WEBHOOK_DOMAIN`'ni bo'shating yoki `NODE_ENV=development` qiling. Bot keyingi ishga tushganda eski webhook'ni o'zi tozalaydi.

---

## API endpointlar

Barchasi `X-Telegram-Init-Data` header'i (HMAC tekshiruvi bilan) va `30 req/min/IP` rate-limit talab qiladi.

| Method | Path | Tavsif |
|---|---|---|
| `GET` | `/api/categories` | 5 ta kategoriya ro'yxati |
| `GET` | `/api/products?category_id=N` | Kategoriya mahsulotlari, `price ASC` |
| `GET` | `/api/products/:id` | Bitta mahsulot |
| `GET` | `/api/orders` | Autentifikatsiyalangan mijozning oxirgi 50 ta buyurtmasi |
| `GET` | `/healthz` | Uptime ping (auth talab qilmaydi) |

---

## Xavfsizlik

- ✅ `BOT_TOKEN` faqat `.env`'da, kodda yo'q
- ✅ `.env` `.gitignore`'da
- ✅ Telegram `initData` HMAC-SHA256 tekshiruvi (rasmiy algoritm)
- ✅ Constant-time hash taqqoslash (timing attack'dan himoya)
- ✅ 24 soatlik freshness check (replay attack'dan himoya)
- ✅ SQL prepared statements (`$1, $2`)
- ✅ Helmet HTTP security headers
- ✅ Rate-limit 30 req/min
- ✅ CORS faqat Telegram domenlaridan
- ✅ `/api/orders` autentifikatsiyalangan foydalanuvchi ID'sidan foydalanadi (`?user_id=` ishonib bo'lmaydi)

---

## Muammolarni hal qilish

**Bot polling'da xato beradi: `409 Conflict`**
Boshqa bot instance yoki webhook ishlamoqda. Eski webhook'ni tozalang:
```js
node -e "require('dotenv').config(); require('telegraf').Telegram.prototype.deleteWebhook.call({token: process.env.BOT_TOKEN})"
```
Yoki `npm start` qaytadan — boot vaqtida `deleteWebhook` chaqiriladi.

**Mini App ochilmaydi (button bosilsa hech narsa bo'lmaydi)**
`WEBAPP_URL` HTTPS bo'lishi shart. BotFather'da `/setdomain` bilan domen ham qo'shing.

**API 401 qaytaradi: `signature mismatch`**
Mini App va bot bir xil `BOT_TOKEN`'dan foydalanishi shart. `.env` qaytadan tekshiring.

**API 401: `initData expired`**
24 soatdan oshib ketgan eski sessiya. Mini App'ni yoping va qaytadan oching.

**CloudStorage ishlamayapti**
Bot API 6.9+ talab qilinadi (Telegram Desktop yoki mobil yangilanishi). Eski versiyada fallback `localStorage` ishlatiladi.

**`web_app_data` event kelmayapti**
Mini App tugmasi *reply keyboard*'dan ochilishi shart. Inline tugmadan ochilsa `sendData` ishlamaydi — bot kodida shu sababli reply keyboard ishlatilgan.

**`/start`'da rasm yuborilmadi**
`bot/assets/welcome_start.png` mavjudligini tekshiring. Yo'q bo'lsa bot warning yozadi va faqat matn yuboradi.

---

🧡 **Marsexpress24**
