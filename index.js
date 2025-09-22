// index.js
require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');

const app = express();

// ตั้งค่าจาก LINE Developers Console
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '2Ajc5xp2oL2e6jECy4l308g12d3cJapSWeiNv5u/TAi9by0fuN4NLRBv/tbpUTf+sLFU7c7GrPxVGQ1oEY+o2s5ln4LojEws8CW22moUq0r3gOs9UGiD3bWrX+76mM5c2mmiPGaaWY7oJSjUxyzo7wdB04t89/1O/w1cDnyilFU=',
  channelSecret: process.env.LINE_CHANNEL_SECRET || '45f2c810fbfdc453368bcfce96049811'
};

app.use('/webhook', line.middleware(config));

// รับ webhook
app.post('/webhook', (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then(result => res.json(result));
});

// ตอบกลับข้อความ
function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: `คุณพิมพ์ว่า: ${event.message.text}`
  });
}

const client = new line.Client(config);

app.get('/', (req, res) => {
  res.send('hello world, LnwDangza');
});

const PORT = process.env.PORT || 3019;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
