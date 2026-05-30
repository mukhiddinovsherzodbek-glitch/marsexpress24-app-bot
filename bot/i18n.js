// =========================================================================
// Marsexpress24 — bot-side translations (uz / ru)
// File: bot/i18n.js
//
// Used by /start, /til (язык) and the customer order-confirmation message.
// Admin-facing messages (the order receipt) stay Uzbek regardless of the
// customer's language.
// =========================================================================

'use strict';

module.exports = {
    uz: {
        welcome: "Buyurtma berish uchun quyidagi tugmani bosing:",
        orderBtn: "🛍️ Buyurtma berish",
        orderSuccess: "✅ Buyurtmangiz muvaffaqiyatli qabul qilindi!\n🍔 Tez orada kuryer siz bilan bog'lanadi.\nRahmat! Marsexpress24 🧡",
        orderError: "❌ Xatolik yuz berdi. Iltimos qayta urinib ko'ring.",
        closedMsg: "Uzr, hozir ishlamayapmiz.\nIsh vaqtimiz: 10:00 - 03:00 (Toshkent vaqti)\nTez orada xizmatda bo'lamiz!",
        langChanged: "✅ Til o'zgartirildi: O'zbekcha 🇺🇿",
    },
    ru: {
        welcome: "Нажмите кнопку ниже, чтобы сделать заказ:",
        orderBtn: "🛍️ Сделать заказ",
        orderSuccess: "✅ Ваш заказ успешно принят!\n🍔 Курьер скоро с вами свяжется.\nСпасибо! Marsexpress24 🧡",
        orderError: "❌ Произошла ошибка. Пожалуйста, попробуйте снова.",
        closedMsg: "Извините, сейчас не работаем.\nЧасы работы: 10:00 - 03:00 (Ташкентское время)\nСкоро будем в вашем распоряжении!",
        langChanged: "✅ Язык изменён: Русский 🇷🇺",
    },
};
