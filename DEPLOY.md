# Marsexpress24 — bepul 24/7 deploy yo'riqnomasi

Ushbu hujjat botni **Render.com** ning bepul tarifiga joylash bo'yicha
bosqichma-bosqich qo'llanma. Yakuniy holatda:

- Bot va Mini App bitta `https://*.onrender.com` URL'da
- Telegram webhook rejimida ishlaydi (polling emas)
- PostgreSQL — Neon (bepul)
- Auto-deploy: GitHub'ga push qilsangiz, Render avtomatik yangilaydi
- HTTPS — avtomatik (Telegram talabi)

## Nima uchun Render?

| Platforma | Bepul 24/7 | HTTPS | GitHub auto-deploy | Kredit karta kerak |
|---|---|---|---|---|
| **Render** | ✅ (750 soat/oy) | ✅ | ✅ | ❌ |
| Fly.io | ✅ | ✅ | ✅ | ✅ (verifikatsiya) |
| Railway | $5 kredit (uzilib qoladi) | ✅ | ✅ | ✅ |
| Heroku | ❌ tugagan | — | — | — |
| Vercel | ❌ (faqat static) | — | — | — |

**Eslatma:** Render bepul tarifi 15 daqiqa faolligisiz "uxlab qoladi".
Telegram webhook'da bu muammo emas — Telegram so'rovni qaytaradi va
server uyg'onadi. Birinchi so'rov ~30 soniya, qolganlari tez. Doimo
uyg'oq bo'lishi uchun [UptimeRobot](https://uptimerobot.com) (bepul)
har 5 daqiqada `/healthz` ga ping qilib qo'yishi mumkin.

---

## Tayyorgarlik (5 daqiqa)

Sizda quyidagilar bo'lishi kerak:

- [ ] GitHub hisobi
- [ ] [Render.com](https://render.com) hisobi (GitHub orqali ro'yxatdan o'tsangiz oson)
- [ ] Telegram bot tokeni (`@BotFather` dan)
- [ ] Telegram admin user ID (`@userinfobot` dan)
- [ ] Neon PostgreSQL ulanish stringi (`postgresql://...`)

---

## 1-qadam: Kodni GitHub'ga joylash

Loyiha papkasida (`C:\marsexpress24 mini bot`):

```bash
git init
git add .
git commit -m "Initial commit: Marsexpress24 bot + Mini App"
```

GitHub'da yangi **private** repo yarating (masalan `marsexpress24-bot`).
Keyin:

```bash
git remote add origin https://github.com/SIZNING_USERNAME/marsexpress24-bot.git
git branch -M main
git push -u origin main
```

> ⚠️ **`.env` faylingiz `.gitignore`'da** — bot tokeningiz va Neon parolingiz
> GitHub'ga ketmaydi. Buni tekshirib oling: `git status` da `.env` ko'rinmasligi kerak.

---

## 2-qadam: Render'da Blueprint deploy

1. https://render.com/ ga kiring → GitHub bilan login
2. Yuqori o'ng burchakda **"New +"** → **"Blueprint"**
3. GitHub repo'ngizni tanlang (`marsexpress24-bot`)
4. Render `render.yaml` ni topib o'qiydi va xizmatni yaratadi
5. **Environment Variables** bo'limida 3 ta sirni to'ldiring:

   | Nom | Qiymat |
   |---|---|
   | `BOT_TOKEN` | `@BotFather` dan tokeningiz |
   | `ADMIN_ID` | Telegram numeric user ID |
   | `DATABASE_URL` | Neon ulanish stringi (`postgresql://neondb_owner:...`) |

6. **"Apply"** bosing
7. Render build va deploy boshlaydi (~3-5 daqiqa)

Loglarda quyidagilarni ko'rishingiz kerak:
```
Build successful 🎉
==> Running 'npm run migrate && npm start'
Nothing to migrate — schema is up to date.
[server] listening on :10000  (NODE_ENV=production)
[bot] webhook set: https://marsexpress24-bot.onrender.com/telegraf/<secret>
```

URL'ni eslab qoling — masalan `https://marsexpress24-bot.onrender.com`.

---

## 3-qadam: BotFather'da domenni yangilash

> ⚠️ ngrok URL'i endi kerak emas. Render URL'iga o'tamiz.

Telegram'da:

```
@BotFather → /setdomain
botingizni tanlang → @mars_express_24_bot
```

Yuboring (faqat domen, `https://` siz):

```
marsexpress24-bot.onrender.com
```

(O'zingizning Render URL'ingizdan).

---

## 4-qadam: Tekshirish

1. Botga `/start` yuboring
   - Salomlashuv + "🛍️ Buyurtma berish" tugmasi keladi
2. Tugmani bosing
   - Mini App ochiladi
   - Kategoriyalar yuklanadi
   - Endi `initData` real qiymat keladi (Render URL/setdomain to'g'ri sozlanganligi uchun)
3. To'liq oqim — kategoriya → mahsulot → savat → checkout → buyurtma

---

## 5-qadam (ixtiyoriy): UptimeRobot bilan doimo uyg'oq tutish

Render bepul tarifda 15 daqiqa faolligisiz uxlab qoladi. Buni oldini olish uchun:

1. https://uptimerobot.com/signUp → bepul ro'yxatdan o'ting
2. **"Add New Monitor"**
3. Monitor Type: **HTTP(s)**
4. Friendly Name: `Marsexpress24 bot`
5. URL: `https://marsexpress24-bot.onrender.com/healthz`
6. Monitoring Interval: **5 minutes**
7. Save

UptimeRobot har 5 daqiqada `/healthz` ga GET so'rov yuboradi → Render xizmati doimo uyg'oq qoladi.

---

## Production'da yangi muammolar bo'lsa

**Log'larni ko'rish:**
Render Dashboard → service'ingizni tanlang → **"Logs"** tabi → real vaqtda.

**Env vars'ni o'zgartirish:**
Render Dashboard → service → **"Environment"** tabi → o'zgartiring → **"Save Changes"** → service avto qayta yuklanadi.

**Manual deploy:**
Render Dashboard → service → yuqori o'ngdagi **"Manual Deploy"** → **"Deploy latest commit"**.

**Database konsoli:**
Neon dashboard → SQL Editor → so'rovlar bering.

**Webhook holatini ko'rish:**
```
https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo
```

**Webhook'ni qo'lda tozalash (kerak bo'lsa):**
```
https://api.telegram.org/bot<BOT_TOKEN>/deleteWebhook
```

---

## Bu deploy'dan keyin nimalar o'zgaradi

| Joriy (lokal) | Yangi (Render) |
|---|---|
| Bot lokal kompyuterda | Bot Render'da 24/7 |
| ngrok tunnel kerak | Doimiy `*.onrender.com` HTTPS |
| Polling rejim | Webhook rejim (samaraliroq) |
| NODE_ENV=development | NODE_ENV=production |
| Dev bypass faol | **Dev bypass o'chiq** — real HMAC tekshiruvi |
| Kompyuter o'chsa, bot o'chadi | Doim ishlaydi |

---

## Kelajakda kod o'zgartirsangiz

1. Lokalda kod yozasiz
2. Git'ga commit qilasiz: `git commit -am "fix: ..."`
3. Push qilasiz: `git push`
4. Render avtomatik yangi build va deploy qiladi (1-2 daqiqa)
5. Yangi versiya ishga tushadi

Bu — siz uchun "set and forget" deploy.

---

## Yordam kerak bo'lsa

Bu yo'riqnoma bo'yicha biror bosqichda muammo bo'lsa — qaysi qadamda, qanday xato chiqayotganini ayting. Birga hal qilamiz.
