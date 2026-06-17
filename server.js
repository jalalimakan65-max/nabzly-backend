const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/', (req, res) => res.json({ status: 'ok', app: 'nabzly backend' }));

app.post('/api/generate-text', async (req, res) => {
  try {
    const { keyword, duration, voice } = req.body;
    const dur = parseInt(duration) || 5;
    let maxTokens = 200;
    if (dur >= 5)  maxTokens = 450;
    if (dur >= 10) maxTokens = 1300;
    if (dur >= 15) maxTokens = 2000;

    const durLabel = dur === 2 ? '۱ دقیقه و ۱۵ ثانیه'
                   : dur === 5 ? '۲ دقیقه و ۴۰ ثانیه'
                   : dur === 10 ? '۸ دقیقه' : '۱۲ دقیقه';

    const prompt = `یک متن مدیتیشن کامل به فارسی معیار ایرانی بنویس برای ${dur} دقیقه.

قوانین دستور زبانی - بسیار مهم:
- جملات باید از زبان خود شخص و در قالب اول شخص باشد
- مثال درست: "هوای پاک رو درون ریه‌هایم می‌فرستم" / "چشمانم رو می‌بندم" / "نفس عمیقی می‌کشم" / "بدنم رو رها می‌کنم"
- مثال غلط: "هوای پاکی رو درون ریه‌هات بفرستی" / "چشمانت رو ببند"
- فعل همیشه آخر جمله باشد
- ساختار: فاعل + مفعول + فعل

قوانین محتوا:
- فارسی ایرانی، بدون اصطلاح دینی یا مذهبی
- لحن آرام، گرم و درونی - انگار شخص با خودش صحبت می‌کند
- بعد از هر جمله "......" بگذار برای مکث طولانی
- جملات کوتاه و ساده - هر جمله یک احساس یا تجربه
- موضوع را از کلی به جزئی گسترش بده
- اول: "آرام هستم......"
- آخر دقیقاً این جمله را بنویس: "این مدیتیشن با یک زنگ ملایم به پایان می‌رسد...... اما می‌توانم به تمرکزم ادامه دهم...... تا موزیک به آرامی تمام شود......"
- تکرار نکن

موضوع: ${keyword}
مدت گفتار: ${durLabel}

فقط متن مدیتیشن، بدون توضیح اضافه.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5',
        max_tokens: maxTokens,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || 'آرام هستم...... چشمانم رو می‌بندم...... نفس عمیقی می‌کشم...... بدنم رو رها می‌کنم......';
    res.json({ text });

  } catch (err) {
    console.error('Text error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/generate-audio', async (req, res) => {
  try {
    const { text, voiceId } = req.body;
    console.log('Generating audio for voiceId:', voiceId);

    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key':   process.env.ELEVENLABS_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_v3',
          voice_settings: {
            stability:         0.95,
            similarity_boost:  0.75,
            style:             0.05,
            use_speaker_boost: false,
            speed:             0.75,
          },
        }),
      }
    );

    console.log('ElevenLabs status:', ttsResponse.status);

    if (!ttsResponse.ok) {
      const errText = await ttsResponse.text();
      console.error('ElevenLabs error:', errText);
      return res.status(500).json({ error: `ElevenLabs: ${errText}` });
    }

    const arrayBuffer = await ttsResponse.arrayBuffer();
    const base64      = Buffer.from(arrayBuffer).toString('base64');
    const audioUrl    = `data:audio/mpeg;base64,${base64}`;

    console.log('Audio generated successfully, size:', base64.length);
    res.json({ audioUrl });

  } catch (err) {
    console.error('Audio error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`nabzly backend running on port ${PORT}`);
});
