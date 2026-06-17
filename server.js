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
        max_tokens: 800,
        messages: [{
          role:    'user',
          content: `یک متن مدیتیشن راهنما به زبان فارسی ایرانی (دری تهرانی) بنویس. قوانین مهم:\n1. از کلمات و لحن فارسی ایرانی استفاده کن، نه افغانی یا تاجیکی\n2. هیچ اصطلاح دینی یا مذهبی استفاده نکن\n3. متن کاملاً سکولار و روان‌شناختی باشد\n4. جملات کامل و روان بنویس - سه نقطه "..." فقط در پایان جمله بیاید، نه بین کلمات\n5. لحن گرم، صمیمی و با احساس باشد - مثل یک دوست مهربان که با آرامش صحبت می‌کند\n6. از فعل‌های امری ملایم استفاده کن مثل "ببند"، "بکش"، "حس کن"\n7. متن را تکرار نکن\n8. در پایان یک جمله آرامش‌بخش بگو\nموضوع: ${keyword}\nمدت: ${duration} دقیقه\nفقط متن مدیتیشن بنویس، بدون توضیح اضافه.`,
        }],
      }),
    });
    const data = await response.json();
    const text = data.content?.[0]?.text || 'چشمانت را ببند... نفس عمیقی بکش... آرام باش...';
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
