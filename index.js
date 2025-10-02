// index.js (ฉบับอัปเกรด Gemini และแก้ไขการเว้นบรรทัด)
require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const { createClient } = require("@supabase/supabase-js");
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

// --- การตั้งค่าทั้งหมด ---

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// LINE
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
  channelSecret: process.env.LINE_CHANNEL_SECRET || ""
};
const client = new line.Client(config);

// Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// --- Middleware และ Routes ---
app.use('/webhook', line.middleware(config));

app.post('/webhook', (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then(result => res.json(result))
    .catch(err => {
      console.error(err);
      res.status(500).end();
    });
});

// --- ฟังก์ชันจัดการรูปภาพ (ฉบับแก้ไข) ---
async function handleImageMessage(event) {
  const messageId = event.message.id;

  try {
    // 1. ดึงไฟล์จาก LINE และแปลงเป็น buffer (เหมือนเดิม)
    const stream = await client.getMessageContent(messageId);
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // 2. อัพโหลดเข้า Supabase Storage (เหมือนเดิม)
    const fileName = `line_images/${messageId}.jpg`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("uploads")
      .upload(fileName, buffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("❌ Supabase upload error:", uploadError);
      return client.replyMessage(event.replyToken, {
        type: "text",
        text: "อัปโหลดรูปไป Supabase ไม่สำเร็จ",
      });
    }
    console.log("✅ Uploaded to Supabase:", uploadData.path);

    // --- 3. (ส่วนที่เพิ่ม) เตรียมข้อมูลรูปภาพและส่งให้ Gemini วิเคราะห์ ---
    console.log("🤖 Sending image to Gemini for analysis...");

    // แปลง Buffer เป็น Base64 string ที่ Gemini ต้องการ
    const base64Image = buffer.toString('base64');
    
    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: "image/jpeg",
      },
    };
    
    // --- จุดที่แก้ไข Prompt ---
    const prompt = "ภาพนี้คืออะไร";

    // ส่งทั้ง Prompt และ รูปภาพ ไปให้ Gemini
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const geminiReply = response.text().trim();

    // 4. ตอบกลับ User ด้วยคำอธิบายจาก Gemini
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: geminiReply, // ส่งคำตอบที่ได้จาก Gemini
    });

  } catch (err) {
    console.error("❌ Error in handleImageMessage:", err);
    return client.replyMessage(event.replyToken, {
        type: "text",
        text: "ขออภัยค่ะ เกิดข้อผิดพลาดในการวิเคราะห์รูปภาพ",
      });
  }
}

// --- ฟังก์ชันหลักในการจัดการ Event ---
async function handleEvent(event) {
  // --- ส่วนที่แก้ไข: เพิ่มการตรวจสอบ event รูปภาพ ---
  if (event.type === "message" && event.message.type === "image") {
    return handleImageMessage(event);
  }

  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const userMessage = event.message.text;

  try {
    const prompt = `คุณคือ AI ผู้ช่วยที่เป็นมิตรและมีไหวพริบ จงตอบกลับข้อความนี้ตรงๆ: "${userMessage}"`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const geminiReply = response.text().trim(); 

    const { error } = await supabase
      .from("messages")
      .insert({
        user_id: event.source.userId,
        message_id: event.message.id,
        type: event.message.type,
        content: userMessage,
        reply_token: event.replyToken,
        reply_content: geminiReply,
      });

    if (error) {
      console.error("Error inserting message to Supabase:", error);
    }

    return client.replyMessage(event.replyToken, {
      type: "text",
      text: geminiReply,
    });

  } catch (err) {
    console.error("Error communicating with Gemini or LINE:", err);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: 'ขออภัย, ตอนนี้ AI กำลังประมวลผลผิดพลาดเล็กน้อย ลองอีกครั้งนะ',
    });
  }
}

app.get('/', (req, res) => {
  res.send('hello world, lnwdang');
});

const PORT = process.env.PORT || 3019;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});