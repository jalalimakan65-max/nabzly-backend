const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/', (req, res) => res.json({ status: 'ok', app: 'nabzly backend' }));

// تبدیل نقطه‌ها به مکث SSML
const addPauses = (text) => {
  return text
    .replace(/\u2026\u2026/g, ' <break time="2.5s"/> ')
    .replace(/\.\.\.\.\.\./g,  ' <break time="2.5s"/> ')
    .replace(/\.\.\./g,        ' <break time="1.5s"/> ')
    .replace(/\n/g,            ' <break time="1s"/> ');
};

app.post('/api/generate-text', async (req, res) => {
  try {
    const { keyword, duration, voice } = req.body;
    const dur = parseInt(duration) || 5;

    let maxTokens = 150;
    if (dur >= 5)  maxTokens = 250;
    if (dur >= 10) maxTokens = 450;
    if (dur >= 15) maxTokens = 650;

    const ending = 'این مدیتیشن با یک زنگ ملایم به پایان می‌رسد...... اما می‌توانید به تمرکزتان ادامه دهید...... تا موزیک به آرامی تمام شود......';

    const prompt = [
      'یک متن مدیتیشن به فارسی معیار ایرانی بنویس.',
      '',
      'قوانین دستور زبانی:',
      '- دوم شخص مودبانه (شما): "نفس‌تان را حس کنید" / "چشمانتان را ببندید" / "بدنتان را رها کنید"',
      '- فعل آخر جمله',
      '',
      'قوانین محتوا:',
      '- فارسی ایرانی، بدون اصطلاح دینی',
      '- لحن گرم و آرام مثل مربی مدیتیشن',
      '- بعد از هر جمله ...... برای مکث طولانی',
      '- جملات کوتاه و ساده',
      '- اول: "آرام باشید......"',
      '- آخر حتما: ' + ending,
      '- تکرار نکن',
      '',
      'موضوع: ' + keyword,
      'مدت: ' + dur + ' دقیقه',
      '',
      'فقط متن، بدون توضیح.'
    ].join('\n');

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
    let text = data.content?.[0]?.text || 'آرام باشید...... چشمانتان را ببندید...... نفس عمیقی بکشید......';

    if (!text.includes('زنگ ملایم')) {
      text = text.trimEnd() + '\n' + ending;
    }

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

    const ssmlText = '<speak>' + addPauses(text) + '</speak>';

    const ttsResponse = await fetch(
      'https://api.elevenlabs.io/v1/text-to-speech/' + voiceId,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key':   process.env.ELEVENLABS_KEY,
        },
        body: JSON.stringify({
          text: ssmlText,
          model_id: 'eleven_v3',
          voice_settings: {
            stability:         0.95,
            similarity_boost:  0.75,
            style:             0.05,
            use_speaker_boost: false,
            speed:             0.6,
          },
        }),
      }
    );

    console.log('ElevenLabs status:', ttsResponse.status);

    if (!ttsResponse.ok) {
      const errText = await ttsResponse.text();
      console.error('ElevenLabs error:', errText);
      return res.status(500).json({ error: 'ElevenLabs: ' + errText });
    }

    const arrayBuffer = await ttsResponse.arrayBuffer();
    const base64      = Buffer.from(arrayBuffer).toString('base64');
    const audioUrl    = 'data:audio/mpeg;base64,' + base64;

    console.log('Audio generated successfully, size:', base64.length);
    res.json({ audioUrl });

  } catch (err) {
    console.error('Audio error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('nabzly backend running on port ' + PORT);
});
