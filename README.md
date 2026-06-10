# نبضلی Backend

## متغیرهای محیطی (Environment Variables)

در Railway این متغیرها را اضافه کنید:

```
ANTHROPIC_KEY=sk-ant-...
ELEVENLABS_KEY=sk_...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
PORT=3000
```

## Endpoints

- `GET /` — health check
- `POST /api/generate-text` — تولید متن با Claude
- `POST /api/generate-audio` — تولید صدا با ElevenLabs + آپلود در Supabase
