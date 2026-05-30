// =========================================================================
// Marsexpress24 — Mini App translations (uz / ru)
// File: miniapp/js/i18n.js
//
// Loaded BEFORE app.js. app.js resolves the user's language on boot
// (GET /api/user-lang), sets window.lang, then renders. The t(key) helper
// in app.js reads from here and falls back to Uzbek for any missing key.
//
// The uz values mirror the strings the UI shipped with, so an Uzbek user
// sees no change; ru is the new translation.
// =========================================================================

window.i18n = {
    uz: {
        // Bottom nav + page titles
        home: "🍔 Bosh sahifa",
        orders: "📜 Mening buyurtmalarim",
        myOrders: "Mening buyurtmalarim",
        categories: "Kategoriyalar",
        productsTitle: "Mahsulotlar",
        brandHello: "Buyurtmangizni tanlang 🍔",

        // Products
        addToCart: "Savatga qo'shish",
        contents: "Tarkibi",
        noProductsTitle: "Hozircha mahsulotlar yo'q",
        noProductsHint: "Tez kunda yangilanadi 🍔",

        // Cart
        cart: "Savat",
        cartEmpty: "Savatingiz bo'sh",
        cartEmptyHint: "Bosh sahifaga qaytib mahsulot tanlang",
        checkout: "Buyurtmani rasmiylashtirish",

        // Checkout
        checkoutTitle: "Rasmiylashtirish",
        confirm: "✅ Buyurtmani tasdiqlash",
        sending: "⏳ Yuborilmoqda…",
        name: "Ismingiz",
        nameplaceholder: "Ismingizni kiriting",
        phone: "Telefon raqami",
        address: "Manzil",
        addressPlaceholder: "Masalan: Gagarin ko'chasi, 36-uy",
        autoLocation: "📍 Joylashuvni avtomatik yuborish",
        locationUpdate: "📍 Joylashuv yangilash",
        locationFound: "📍 Joylashuv aniqlandi ✅",
        locating: "⏳ Aniqlanmoqda…",
        comment: "💬 Izoh (ixtiyoriy)",
        commentPlaceholder: "Izoh",

        // Totals
        total: "Jami",
        totalLabel: "JAMI:",
        subtotalLabel: "Mahsulotlar:",
        deliveryLabel: "Dostavka:",
        delivery: "Dostavka",
        deliveryPhone: "Telefonda",
        free: "Bepul",
        sum: "so'm",
        km: "km",
        fromYou: "Sizdan",

        // Min-order
        minOrder: "Minimal buyurtma summasi: 70,000 so'm",
        minOrderPrefix: "Minimal buyurtma summasi:",
        now: "hozir",

        // Delivery state messages
        deliveryLoading: "⏳ Manzilni tekshirmoqdamiz…",
        deliveryUnknown: "📍 Manzilni xaritada topa olmadik — dostavka narxi telefonda aniqlanadi",

        // Location failures
        locFail: "Joylashuv aniqlanmadi. Manzilni qo'lda kiriting",
        locUnsupported: "Qurilma joylashuvni qo'llab-quvvatlamaydi. Manzilni qo'lda kiriting",
        locDenied: "Joylashuvga ruxsat berilmadi. Manzilni qo'lda kiriting",
        locDeniedSettings: "Joylashuvga ruxsat berilmadi. Sozlamalardan ruxsat bering yoki manzilni qo'lda kiriting",

        // Warnings
        phoneWarning: "⚠️ Telefon raqami to'liq emas",
        addressWarning: "⚠️ Iltimos, manzilni kiriting yoki joylashuvni yuboring",

        // Orders page
        noOrders: "Hali buyurtmalar yo'q",
        noOrdersHint: "Birinchi buyurtmangizni bering 🍔",
        reorder: "🔁 Yana shundan buyurtma qilish",
        orderNo: "Buyurtma",
        orderComment: "Izoh",
        unit: "ta",

        // Generic
        loading: "Yuklanmoqda…",
        errorLoad: "Yuklanishda xato",
        networkError: "Tarmoq xatosi. Qayta urinib ko'ring.",
        orderAccepted: "✅ Buyurtmangiz qabul qilindi! Rahmat 🧡",
        orderRejected: "Buyurtma rad etildi",
        submitError: "Buyurtmani yuborishda xato. Qayta urinib ko'ring.",
        closed: "Uzr, hozir qabul vaqtimiz tugagan.\nIsh vaqtimiz: 10:00 - 03:00",
        closedToast: "Uzr, hozir qabul vaqtimiz tugagan. Ish vaqtimiz: ",
        closedBanner: "Hozir ishlamayapmiz. Ish vaqtimiz:",
    },
    ru: {
        // Bottom nav + page titles
        home: "🍔 Главная",
        orders: "📜 Мои заказы",
        myOrders: "Мои заказы",
        categories: "Категории",
        productsTitle: "Продукты",
        brandHello: "Выберите свой заказ 🍔",

        // Products
        addToCart: "В корзину",
        contents: "Состав",
        noProductsTitle: "Пока нет товаров",
        noProductsHint: "Скоро обновится 🍔",

        // Cart
        cart: "Корзина",
        cartEmpty: "Ваша корзина пуста",
        cartEmptyHint: "Вернитесь на главную и выберите товар",
        checkout: "Оформить заказ",

        // Checkout
        checkoutTitle: "Оформление",
        confirm: "✅ Подтвердить заказ",
        sending: "⏳ Отправка…",
        name: "Ваше имя",
        nameplaceholder: "Введите ваше имя",
        phone: "Номер телефона",
        address: "Адрес",
        addressPlaceholder: "Например: ул. Гагарина, 36",
        autoLocation: "📍 Отправить местоположение",
        locationUpdate: "📍 Обновить местоположение",
        locationFound: "📍 Местоположение определено ✅",
        locating: "⏳ Определяем…",
        comment: "💬 Комментарий (необязательно)",
        commentPlaceholder: "Комментарий",

        // Totals
        total: "Итого",
        totalLabel: "ИТОГО:",
        subtotalLabel: "Продукты:",
        deliveryLabel: "Доставка:",
        delivery: "Доставка",
        deliveryPhone: "По телефону",
        free: "Бесплатно",
        sum: "сум",
        km: "км",
        fromYou: "От вас",

        // Min-order
        minOrder: "Минимальная сумма заказа: 70,000 сум",
        minOrderPrefix: "Минимальная сумма заказа:",
        now: "сейчас",

        // Delivery state messages
        deliveryLoading: "⏳ Проверяем адрес…",
        deliveryUnknown: "📍 Не нашли адрес на карте — стоимость доставки уточним по телефону",

        // Location failures
        locFail: "Не удалось определить местоположение. Введите адрес вручную",
        locUnsupported: "Устройство не поддерживает геолокацию. Введите адрес вручную",
        locDenied: "Доступ к местоположению запрещён. Введите адрес вручную",
        locDeniedSettings: "Доступ к местоположению запрещён. Разрешите в настройках или введите адрес вручную",

        // Warnings
        phoneWarning: "⚠️ Номер телефона неполный",
        addressWarning: "⚠️ Пожалуйста, введите адрес или отправьте местоположение",

        // Orders page
        noOrders: "Заказов пока нет",
        noOrdersHint: "Сделайте первый заказ 🍔",
        reorder: "🔁 Повторить заказ",
        orderNo: "Заказ",
        orderComment: "Комментарий",
        unit: "шт",

        // Generic
        loading: "Загрузка…",
        errorLoad: "Ошибка загрузки",
        networkError: "Ошибка сети. Попробуйте ещё раз.",
        orderAccepted: "✅ Ваш заказ принят! Спасибо 🧡",
        orderRejected: "Заказ отклонён",
        submitError: "Ошибка при отправке заказа. Попробуйте ещё раз.",
        closed: "Извините, сейчас мы не принимаем заказы.\nЧасы работы: 10:00 - 03:00",
        closedToast: "Извините, сейчас мы не принимаем заказы. Часы работы: ",
        closedBanner: "Сейчас не работаем. Часы работы:",
    },
};
