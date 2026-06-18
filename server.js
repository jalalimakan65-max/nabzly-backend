const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/', (req, res) => res.json({ status: 'ok', app: 'nabzly backend' }));

const numToWord = (text) => {
  const map = {
    '0':'صفر','1':'یک','2':'دو','3':'سه','4':'چهار',
    '5':'پنج','6':'شش','7':'هفت','8':'هشت','9':'نه',
    '۰':'صفر','۱':'یک','۲':'دو','۳':'سه','۴':'چهار',
    '۵':'پنج','۶':'شش','۷':'هفت','۸':'هشت','۹':'نه',
  };
  return text.replace(/[0-9۰-۹]/g, d => map[d] || d);
};

// مکث بیشتر بین جملات
const addPauses = (text) => {
  return text
    .replace(/\.\.\.\.\.\./g, ',,,,,')   // 6 نقطه = مکث خیلی طولانی
    .replace(/\.\.\./g, ',,,')           // 3 نقطه = مکث طولانی
    .replace(/\n/g, ',,');               // خط جدید = مکث متوسط
};

// قطع کردن جمله ناقص در انتها
const cutIncomplete = (text) => {
  const trimmed = text.trimEnd();
  // پیدا کردن آخرین جمله کامل
  const sentenceEnders = ['......', '...', '؟', '!', '?'];
  let lastComplete = -1;
  for (const ender of sentenceEnders) {
    const idx = trimmed.lastIndexOf(ender);
    if (idx > lastComplete) lastComplete = idx + ender.length;
  }
  if (lastComplete > trimmed.length * 0.5) {
    return trimmed.substring(0, lastComplete).trimEnd();
  }
  return trimmed;
};

app.post('/api/generate-text', async (req, res) => {
  try {
    const { keyword, duration, voice } = req.body;
    const dur = parseInt(duration) || 5;

    let maxTokens = 150;
    if (dur >= 5)  maxTokens = 250;
    if (dur >= 10) maxTokens = 450;
    if (dur >= 15) maxTokens = 650;

    const prompt = [
      'یک متن مدیتیشن راهنما به فارسی معیار ایرانی بنویس.',
      '',
      'قوانین دستور زبانی:',
      '- جملات دستوری و هدایتگر، نه توصیفی',
      '- غلط: "هوا از بینی‌تان درون می‌رود"',
      '- درست: "هوا را به آرامی از طریق بینی به داخل ریه‌هایتان بکشید"',
      '- دوم شخص مودبانه (شما)',
      '- فعل همیشه آخر جمله',
      '- هرگز از اعداد استفاده نکن',
      '- هر جمله را کامل بنویس',
      '',
      'قوانین محتوا:',
      '- فارسی ایرانی، بدون اصطلاح دینی',
      '- لحن گرم و آرام مثل مربی مدیتیشن',
      '- بعد از هر جمله ...... برای مکث طولانی',
      '- جملات کوتاه و قابل اجرا',
      '- اول: "آرام باشید......"',
      '- تکرار نکن',
      '',
      'موضوع: ' + keyword,
      'مدت: ' + dur + ' دقیقه',
      '',
      'فقط متن اصلی مدیتیشن، بدون جمله پایانی، بدون توضیح.'
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

    // اعداد به کلمه
    text = numToWord(text);

    // قطع جمله ناقص
    text = cutIncomplete(text);

    // جمله پایانی جداگانه — PlayerScreen بعد از موزیک پخش می‌کنه
    const ending = 'این مدیتیشن با یک زنگ ملایم به پایان می‌رسد...... اما می‌توانید به تمرکزتان ادامه دهید...... تا موزیک به آرامی تمام شود......';

    res.json({ text, ending });

  } catch (err) {
    console.error('Text error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/generate-audio', async (req, res) => {
  try {
    const { text, voiceId, speed } = req.body;
    console.log('Generating audio for voiceId:', voiceId);

    const processedText = addPauses(numToWord(text));
    const voiceSpeed = speed || 0.6;

    const ttsResponse = await fetch(
      'https://api.elevenlabs.io/v1/text-to-speech/' + voiceId,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key':   process.env.ELEVENLABS_KEY,
        },
        body: JSON.stringify({
          text: processedText,
          model_id: 'eleven_v3',
          voice_settings: {
            stability:         0.95,
            similarity_boost:  0.75,
            style:             0.05,
            use_speaker_boost: false,
            speed:             voiceSpeed,
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
