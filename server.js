IN LOO
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const app  = express();
app.use(cors());
app.use(express.json());

// ── Supabase ──────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { realtime: { transport: ws } }
);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'ok', app: 'نبضلی backend' }));

// ── مرحله ۱: تولید متن با Claude ─────────────────────────────────────────────
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
        max_tokens: 600,
        messages: [{
          role:    'user',
          content: `یک متن مدیتیشن راهنما به زبان فارسی بنویس.\nموضوع: ${keyword}\nمدت: ${duration} دقیقه\nصدا: ${voice}\nفقط متن مدیتیشن بنویس، بدون توضیح اضافه.`,
        }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || 'چشمانت را ببند و نفس عمیقی بکش...';
    res.json({ text });

  } catch (err) {
    console.error('Text generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── مرحله ۲: تبدیل متن به صدا با ElevenLabs + آپلود در Supabase ─────────────
app.post('/api/generate-audio', async (req, res) => {
  try {
    const { text, voiceId, sessionId } = req.body;

    // ۱. تولید صدا با ElevenLabs
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
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability:        0.75,
            similarity_boost: 0.8,
            style:            0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!ttsResponse.ok) {
      const err = await ttsResponse.text();
      throw new Error(`ElevenLabs error: ${err}`);
    }

    // ۲. دریافت فایل صوتی
    const audioBuffer = await ttsResponse.arrayBuffer();
    const audioBytes  = new Uint8Array(audioBuffer);

    // ۳. آپلود در Supabase Storage
    const fileName = `${sessionId}_${Date.now()}.mp3`;
    const { data: uploadData, error: uploadError } = await supabase.storage
    .from('audio')
     .upload(fileName, Buffer.from(audioBytes), {
      contentType: 'audio/mpeg',
    upsert: true,
  });

    if (uploadError) throw new Error(`Supabase upload error: ${uploadError.message}`);

    // ۴. دریافت URL عمومی
    const { data: urlData } = supabase.storage
      .from('audio')
      .getPublicUrl(fileName);

    res.json({ audioUrl: urlData.publicUrl });

  } catch (err) {
    console.error('Audio generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── شروع سرور ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`نبضلی backend running on port ${PORT}`);
});
