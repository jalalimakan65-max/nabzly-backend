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
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5',
        max_tokens: 120,
        messages: [{
          role:    'user',
          content: `یک متن مدیتیشن به فارسی معیار ایرانی بنویس.

قوانین دستور زبانی:
- فعل همیشه آخر جمله باشد: "نفست رو حس کن" نه "حس کن نفست رو"
- از ساختار صحیح فارسی استفاده کن: فاعل + مفعول + فعل
- مثال درست: "چشمانت رو ببند" / "نفس عمیقی بکش" / "بدنت رو رها کن"
- مثال غلط: "ببند چشمانت رو" / "بکش نفس عمیقی"

قوانین محتوا:
- دقیقاً ۵ جمله کوتاه و ساده
- بعد از هر جمله "......" بگذار برای مکث طولانی
- بدون اصطلاح دینی یا مذهبی
- لحن آرام، گرم و صمیمی
- اول: "آرام باش......"
- آخر: "همینجا بمان......"
- موضوع: ${keyword}

فقط متن مدیتیشن، بدون توضیح.`,
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
            speed:             0.65,
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
