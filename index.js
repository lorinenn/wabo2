// index.js

const express = require("express");
const { google } = require("googleapis");

const app = express();
app.use(express.json());

// متغيرات واتساب من الـ Environment Variables في Render
const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

// Google Sheets
const GOOGLE_SERVICE_ACCOUNT = process.env.GOOGLE_SERVICE_ACCOUNT;
// IMPORTANT: استبدل هذا بالـ ID الحقيقي للشيت من الرابط
const SPREADSHEET_ID = "1fiDvnzQMLev9voqf894o7T2LTsEyAyctGY7LDAdojbk";

// Discord
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

console.log("PHONE_NUMBER_ID:", PHONE_NUMBER_ID);
console.log("VERIFY_TOKEN loaded:", !!VERIFY_TOKEN);
console.log("HAS GOOGLE_SERVICE_ACCOUNT:", !!GOOGLE_SERVICE_ACCOUNT);
console.log("HAS DISCORD_WEBHOOK_URL:", !!DISCORD_WEBHOOK_URL);

// صفحة بسيطة للتأكد أن السيرفر شغال
app.get("/", (req, res) => {
  res.send("WhatsApp Bot is running! Webhook endpoint: /webhook");
});

// دالة إرسال رسالة واتساب
async function sendMessage(to, body) {
  try {
    const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        text: { body },
      }),
    });

    const data = await response.json();
    console.log("WhatsApp API response:", data);
  } catch (err) {
    console.error("Error sending message:", err);
  }
}

// تسجيل المحادثة في Google Sheet
async function logToSheet({ phone, message, reply }) {
  try {
    if (!GOOGLE_SERVICE_ACCOUNT || !SPREADSHEET_ID) {
      console.log("Skipping sheet log: missing GOOGLE_SERVICE_ACCOUNT or SPREADSHEET_ID");
      return;
    }

    const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT);

    const client = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      ["https://www.googleapis.com/auth/spreadsheets"]
    );

    const sheets = google.sheets({ version: "v4", auth: client });

    const timestamp = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Riyadh",
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "bot!A:D", // تأكد أن اسم الورقة في الشيت هو bot
      valueInputOption: "USER_ENTERED",
      resource: {
        values: [[timestamp, phone, message, reply]],
      },
    });

    console.log("✔ تمت إضافة السطر في Google Sheet");
  } catch (err) {
    console.error("❌ خطأ أثناء الكتابة في Google Sheet:", err);
  }
}

// إرسال تنبيه إلى Discord إذا الكلمة "دعم" موجودة
async function sendToDiscord(content) {
  try {
    if (!DISCORD_WEBHOOK_URL) {
      console.log("DISCORD_WEBHOOK_URL not set, skipping Discord alert");
      return;
    }

    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    console.log("✔ تم إرسال تنبيه إلى Discord");
  } catch (err) {
    console.error("❌ خطأ أثناء الإرسال إلى Discord:", err);
  }
}

// Webhook التحقق من فيسبوك (GET)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified successfully");
    return res.status(200).send(challenge);
  }

  console.log("Webhook verification failed");
  return res.sendStatus(403);
});

// Webhook استقبال رسائل واتساب (POST)
app.post("/webhook", async (req, res) => {
  try {
    console.log("Incoming webhook body:", JSON.stringify(req.body, null, 2));

    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    // إذا ما فيه رسالة نصية، ننهي
    if (!message || message.type !== "text") {
      return res.sendStatus(200);
    }

    const from = message.from; // رقم العميل
    const textOriginal = message.text.body; // النص كما كتبه العميل
    const text = textOriginal.trim().toLowerCase(); // نسخة صغيرة للتحليل

    console.log("Message from:", from, "text:", text);

    // ==========================
    // 🔍 الكلمات المفتاحية
    // ==========================
    const keywords_products = ["منتج", "منتجات", "product", "prod"];
    const keywords_shipping = ["شحن", "توصيل", "ship", "delivery"];
    const keywords_orders = ["طلب", "طلبات", "حساب", "order", "account"];
    const keywords_return = ["ارجاع", "استرجاع", "استبدال", "رجع", "return"];
    const keywords_support = ["دعم", "مساعدة", "help", "support"];

    let reply = "";

    // ==========================
    // 🚨 تنبيه Discord إذا فيها كلمة "دعم"
    // ==========================
    if (text.includes("دعم")) {
      await sendToDiscord(
        `🚨 تنبيه دعم جديد:\nالرقم: ${from}\nالرسالة: ${textOriginal}`
      );
    }

    // ==========================
    // 📌 1 — المنتجات
    // ==========================
    if (keywords_products.some((word) => text.includes(word))) {
      reply =
`المنتجات 🛍️✨

في Glamberry نهتم بكل تفصيلة في منتجاتنا لنمنحك راحة وأناقة لا تُقارن.
اختيارنا للخامات، جودة التصنيع، وتصاميمنا العصرية مصممة لتناسب أسلوبك وتمنحك ثقة أكبر كل يوم 💗✨

اكتشفي تشكيلتنا الكاملة وتصفّحي أجمل المنتجات عبر متجرنا:
https://salla.sa/glamberry

استمتعي بتجربة تسوّق ولا أروع 🌸🔥`;
    }

    // ==========================
    // 📌 2 — الشحن والتوصيل
    // ==========================
    else if (keywords_shipping.some((word) => text.includes(word))) {
      reply =
`الشحن والتوصيل 🚚✨

يتم تجهيز طلباتكم من طرفنا بأسرع وقت ممكن، ونحرص إنها تُسلّم لشركات الشحن بسرعة خلال نفس اليوم أو اليوم التالي.
بعد الشحن، تعتمد مدة التوصيل على شركة الشحن والمدينة، وغالبًا تستغرق 2–5 أيام عمل.
سنزوّدك برقم التتبع فور شحن الطلب 💗.`;
    }

    // ==========================
    // 📌 3 — الطلبات والحساب
    // ==========================
    else if (keywords_orders.some((word) => text.includes(word))) {
      reply =
`الطلبات والحساب 🛍️✨

لمعرفة تفاصيل طلبك أو متابعة حالته، كل المعلومات موجودة داخل خانة الطلبات في حسابك على سلة.
كما تصلك أيضًا رسالة تأكيد وتحديثات الطلب عبر البريد الإلكتروني المسجّل لدينا.
لو احتجت أي مساعدة إضافية، نحن دائمًا بالخدمة 💗.`;
    }

    // ==========================
    // 📌 4 — الاسترجاع والاستبدال
    // ==========================
    else if (keywords_return.some((word) => text.includes(word))) {
      reply =
`سياسة الاسترجاع والاستبدال 💗

يسعدنا خدمتك!
الاسترجاع والاستبدال خلال 3 أيام من الاستلام، بشرط أن يكون المنتج غير مستخدم وبحالته الأصلية.
ولأسباب صحية، لا نقبل استرجاع حمالات الصدر أو أي منتج مفتوح.
إذا وصل طلبك بشكل خاطئ أو تالف، نبدّله لك مجاناً والشحن علينا.
إرجاع المبلغ يتم لنفس وسيلة الدفع خلال 2–7 أيام عمل.

لأي استفسار، نحن بالخدمة دائماً 💗.`;
    }

    // ==========================
    // 📌 5 — خدمة العملاء
    // ==========================
    else if (keywords_support.some((word) => text.includes(word))) {
      reply =
`خدمة العملاء 🤝✨

للحصول على مساعدة من أحد موظفينا، يرجى إرسال كلمة "دعم"، وسنتواصل معك في أقرب وقت ممكن وبكل سرور ❤️.`;
    }

    // ==========================
    // ✨ الرسالة الترحيبية الافتراضية
    // ==========================
    else {
      reply =
`أهلاً وسهلاً 🌸
شكراً لتواصلك مع Glamberry! 💗

لخدمتك بشكل أفضل، يرجى إرسال أحد الخيارات التالية:

1- المنتجات
2- الشحن والتوصيل
3- الطلبات والحساب
4- الإرجاع والاستبدال
5- خدمة العملاء`;
    }

    // نرسل الرد + نسجل في الشيت (لو متوفر)
    await Promise.all([
      sendMessage(from, reply),
      logToSheet({ phone: from, message: textOriginal, reply }),
    ]);

    res.sendStatus(200);
  } catch (err) {
    console.error("Error in webhook handler:", err);
    res.sendStatus(200);
  }
});

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Bot is running on port", PORT);
});
