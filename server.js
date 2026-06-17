const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/', (req, res) => res.json({ status: 'ok', app: 'nabzly backend' }));

// تولید متن با Claude
app.post('/api/generate-text', async (req, res) => {
  try {
    const { keyword, duration, voice } = req.body;

    // توکن متناسب با مدت زمان گفتار
    const dur = parseInt(duration) || 5;
    let maxTokens = 200;   // 2 دقیقه  → 1:15 گفتار
    if (dur >= 5)  maxTokens = 450;   // 5 دقیقه  → 2:40 گفتار
    if (dur >= 10) maxTokens = 1300;  // 10 دقیقه → 8:00 گفتار
    if (dur >= 15) maxTokens = 2000;  // 15 دقیقه → 12:00 گفتار

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
        messages: [{
          role:    'user',
          content: `یک متن مدیتیشن کامل به فارسی معیار ایرانی بنویس برای ${dur} دقیقه.

قوانین دستور زبانی:
- فعل همیشه آخر جمله: "نفست رو حس کن" نه "حس کن نفست رو"
- ساختار: فاعل + مفعول + فعل
- مثال درست: "چشمانت رو ببند" / "نفس عمیقی بکش" / "بدنت رو رها کن" / "اجازه بده تنشت آروم بگیره"

قوانین محتوا:
- فارسی ایرانی، بدون اصطلاح دینی یا مذهبی
- لحن گرم، آرام و صمیمی مثل یک دوست مهربان
- بعد از هر جمله "......" بگذار (۶ نقطه) برای مکث طولانی
- جملات کوتاه و ساده — هر جمله یک دستور یا احساس
- موضوع را در طول متن گسترش بده، از کلی به جزئی
- اول: "آرام باش......"
- آخر: "همینجا بمان...... آروم و آسوده......"
- تکرار نکن

موضوع: ${keyword}
مدت گفتار: ${dur === 2 ? '۱ دقیقه و ۱۵ ثانیه' : dur === 5 ? '۲ دقیقه و ۴۰ ثانیه' : dur === 10 ? '۸ دقیقه' : '۱۲ دقیقه'}

فقط متن مدیتیشن، بدون توضیح اضافه.`,
        }],
      }),
    });
    const data = await response.json();
    const text = data.content?.[0]?.text || 'آرام باش...... چشمانت رو ببند...... نفس عمیقی بکش...... بدنت رو رها کن...... همینجا بمان......';
    res.json({ text });
  } catch (err) {
    console.error('Text error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// تولید صدا با ElevenLabs
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
