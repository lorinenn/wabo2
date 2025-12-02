// index.js

const express = require("express");
const app = express();
app.use(express.json());

// نقرأ بيانات واتساب من الـ Environment Variables (ستضعها في Render)
const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

// للتأكد في الـ Console
console.log("PHONE_NUMBER_ID:", PHONE_NUMBER_ID);
console.log("VERIFY_TOKEN loaded:", !!VERIFY_TOKEN);

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
        "Authorization": `Bearer ${TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        text: { body }
      })
    });

    const data = await response.json();
    console.log("WhatsApp API response:", data);
  } catch (err) {
    console.error("Error sending message:", err);
  }
}

// Webhook التحقق من فيسبوك (GET) — يستخدم عند ضغط Verify and save
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

    const from = message.from;                // رقم العميل
    const text = message.text.body.trim().toLowerCase(); // نص الرسالة

    console.log("Message from:", from, "text:", text);

    let reply;

    if (text.includes("سعر")) {
      reply =
        "📌 قائمة الأسعار:\n" +
        "منتج A = 100 ريال\n" +
        "منتج B = 150 ريال\n" +
        "للطلب اكتب: طلب";
    } else if (text.includes("توصيل")) {
      reply =
        "🚚 التوصيل متوفر لجميع مدن المملكة خلال 2-5 أيام عمل.\n" +
        "رسوم التوصيل بين 20 و 30 ريال حسب المدينة.";
    } else if (text.includes("طلب")) {
      reply =
        "لطلب جديد ارسل المعلومات التالية:\n" +
        "اسم المنتج + الكمية + المدينة ✅\n" +
        "مثال: منتج A، عدد 2، الرياض";
    } else if (text.includes("دعم")) {
      reply = "👨‍💻 تم تحويل طلبك إلى الدعم الفني، وسنخدمك في أقرب وقت ممكن.";
    } else {
      reply =
        "مرحباً 👋 شكرًا لتواصلك مع متجرنا.\n" +
        "اكتب إحدى الكلمات التالية:\n" +
        "1️⃣ سعر – لعرض قائمة الأسعار\n" +
        "2️⃣ توصيل – لمعلومات الشحن\n" +
        "3️⃣ طلب – لبدء طلب جديد\n" +
        "4️⃣ دعم – للتواصل مع الدعم الفني";
    }

    await sendMessage(from, reply);
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
