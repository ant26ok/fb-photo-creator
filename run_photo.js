const fs = require('fs');
const path = require('path');

const CONFIG = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '5371930289',
  ROUTER_URL: process.env.ROUTER_URL || 'http://208.76.40.125:20128/v1',
  ROUTER_API_KEY: process.env.ROUTER_API_KEY || '',
  PHOTOS_DIR: path.join(__dirname, 'photos'),
  DRAFTS_DIR: path.join(__dirname, 'drafts'),
  STATE_FILE: path.join(__dirname, 'state.json')
};

// Fallback load from fb-poster .env if env vars missing
if (!CONFIG.ROUTER_API_KEY || !CONFIG.TELEGRAM_BOT_TOKEN) {
  try {
    const envContent = fs.readFileSync('/home/antok/fb-poster/.env', 'utf8');
    for (const line of envContent.split('\n')) {
      const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let val = match[2].trim().replace(/^['"]|['"]$/g, '');
        if (key === 'ROUTER_API_KEY' && !CONFIG.ROUTER_API_KEY) CONFIG.ROUTER_API_KEY = val;
        if (key === 'TELEGRAM_BOT_TOKEN' && !CONFIG.TELEGRAM_BOT_TOKEN) CONFIG.TELEGRAM_BOT_TOKEN = val;
        if (key === 'TELEGRAM_CHAT_ID' && !CONFIG.TELEGRAM_CHAT_ID) CONFIG.TELEGRAM_CHAT_ID = val;
      }
    }
  } catch (e) {}
}

const AI_TOPIC_ANGLES = [
  'Pemanfaatan AI Vision & Multimodal dalam Otomasi Dokumen & Citra Medis',
  'Autonomous AI Agents: Membangun Workflow Mandiri Tanpa Intervensi Manual',
  'Large Language Models (LLM) On-Premise vs Cloud untuk Keamanan Data Sensitif di Rumah Sakit',
  'AI Copilot & Coding Assistant: Lonjakan Produktivitas Programmer & Analis Sistem',
  'Sistem Rekomendasi & Predictive Machine Learning dalam Operasional Antrean & Logistik Farmasi',
  'Fine-Tuning vs RAG (Retrieval-Augmented Generation): Solusi Basis Pengetahuan AI di Faskes',
  'AI Governance & Data Privacy: Melindungi Privasi Rekam Medis Elektronik dari Kebocoran',
  'Automasi Validasi Klaim & Deteksi Anomali Koding Diagnosa dengan Machine Learning'
];

function loadState() {
  if (fs.existsSync(CONFIG.STATE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG.STATE_FILE, 'utf8'));
    } catch (e) {}
  }
  return { lastExecutedSlot: null, history: [] };
}

function saveState(state) {
  fs.writeFileSync(CONFIG.STATE_FILE, JSON.stringify(state, null, 2));
}

async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      console.warn(`[RETRY ${i}/${maxRetries}] HTTP ${res.status}: ${await res.text().catch(() => '')}`);
    } catch (err) {
      console.warn(`[RETRY ${i}/${maxRetries}] Network error: ${err.message}`);
      if (i === maxRetries) throw err;
      await new Promise(r => setTimeout(r, 2000 * i));
    }
  }
  throw new Error(`Failed to fetch ${url} after ${maxRetries} attempts`);
}

async function runPhotoGenerator() {
  console.log('====================================================');
  console.log(`[FB PHOTO RUN] ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`);
  console.log('====================================================');

  const state = loadState();
  const currentSlot = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' }) + '_' + String(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false })).trim();

  if (state.lastExecutedSlot === currentSlot) {
    console.log(`[SLOT GUARD] Slot ${currentSlot} sudah dieksekusi sebelumnya. Melewati eksekusi.`);
    return { status: 'skipped', slot: currentSlot };
  }

  // 1. Pilih angle topik dan ambil blacklist riwayat
  const selectedAngle = AI_TOPIC_ANGLES[Math.floor(Math.random() * AI_TOPIC_ANGLES.length)];
  const recentTopics = (state.history || []).map(h => h.title).filter(Boolean).slice(-10);
  const blacklistText = recentTopics.length > 0
    ? `\nDaftar topik yang sudah pernah dibuat (JANGAN PERNAH MENGULANG TOPIK ATAU JUDUL INI):\n${recentTopics.map(t => '- ' + t).join('\n')}\n`
    : '';

  console.log(`[AI DRAFT] Meminta Gemini 3.8 Flash membuat materi baru: "${selectedAngle}"...`);

  const systemPrompt = `You are an elite tech storyteller and AI systems engineer. You write high-engagement Facebook posts about Artificial Intelligence (AI) for software engineers, tech leads, and IT professionals. Return ONLY valid JSON with keys "title", "post_text", "image_prompt". Do NOT include markdown code fences (no \`\`\`json). Output MUST start with { and end with }.`;

  const userPrompt = `Create one insightful, highly shareable Facebook post about: ${selectedAngle}.

Author context: Ardyanto (Antok), Full-stack Programmer & Sistem Analis bidang IT Rumah Sakit. Eksplorasi praktis AI, automasi, arsitektur data. Gaya tulisan santai, edukatif, padat wawasan. PENTING: DILARANG menyebut nama RSK Ngesti Waluyo (gunakan 'rumah sakit tempat saya bekerja' atau 'faskes'). Dilarang menyertakan link repo GitHub.
${blacklistText}
Target length: 900-1400 characters in Bahasa Indonesia.
WAJIB CALL TO ACTION (CTA) sebelum hashtag: ajak pembaca untuk Like, Komen pengalaman jika pernah mengalami hal serupa, dan Share ke rekan-rekan IT lainnya.
End with 5-7 relevant tech hashtags.

SKILL FOTOGRAFI & PROMPT THUMBNAIL FOTO (image_prompt):
- Must be written in English.
- Goal: MAXIMUM STOPPING POWER on Facebook mobile feed. An eye-catching thumbnail photograph that instantly hooks viewers who scroll past.
- Visual Concept: Dramatic cinematic shot of AI technology matching the story. Choose ONE powerful focal subject: e.g. glowing quantum neural AI processor with intricate silicon microscopic circuitry, pulsating optical data cables in a dark-mode server rack, futuristic medical robotic telemetry, or floating translucent data holograms.
- Lighting & Optics: Intense dramatic contrast (Chiaroscuro), electric cyan and radiant warm amber rim lighting, razor-sharp focus on the hero object, creamy f/1.4 lens bokeh in background, cinematic volumetric haze.
- Composition: Golden ratio, clean uncluttered frame, 8k photorealistic texture.
- Absolute negative constraints: NO text, NO letters, NO words, NO logos, NO watermark, NO cartoon/CGI look.

Return JSON strictly matching: {"title": "...", "post_text": "...", "image_prompt": "..."}`;

  const chatRes = await fetchWithRetry(`${CONFIG.ROUTER_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.ROUTER_API_KEY}`
    },
    body: JSON.stringify({
      model: 'ag/gemini-3.8-flash',
      stream: false,
      temperature: 0.85,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  });

  const chatData = await chatRes.json();
  const rawContent = chatData.choices?.[0]?.message?.content || '';
  const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Gagal parse JSON dari respons AI');
  const parsed = JSON.parse(jsonMatch[0]);

  console.log(`[AI DRAFT READY] Topik: "${parsed.title}"`);

  // 2. Generate Image with Retry
  console.log(`[AI IMAGE] Meminta foto dari Gemini 3.1 Flash Image...`);
  let imgBuffer = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const imgRes = await fetch(`${CONFIG.ROUTER_URL}/images/generations?response_format=binary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.ROUTER_API_KEY}`
        },
        body: JSON.stringify({
          model: 'ag/gemini-3.1-flash-image',
          prompt: parsed.image_prompt
        })
      });
      if (imgRes.ok) {
        imgBuffer = Buffer.from(await imgRes.arrayBuffer());
        console.log(`[AI IMAGE SUCCESS] Foto selesai (Percobaan ${attempt}): ${imgBuffer.length} bytes`);
        break;
      }
    } catch (e) {
      console.warn(`[AI IMAGE RETRY ${attempt}] Error: ${e.message}`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  if (!imgBuffer) throw new Error('Gagal membuat gambar AI setelah 3 percobaan');

  const photoFile = path.join(CONFIG.PHOTOS_DIR, `fb_photo_${Date.now()}.jpg`);
  fs.writeFileSync(photoFile, imgBuffer);

  // 3. Kirim ke Telegram Antok
  console.log('[TELEGRAM] Mengirim foto dan teks draft ke Telegram...');
  const formData = new FormData();
  formData.append('chat_id', CONFIG.TELEGRAM_CHAT_ID);
  formData.append('caption', `📸 <b>FOTO KONTEN FB SIAP POSTING</b>\n<b>Topik:</b> ${parsed.title}`);
  formData.append('parse_mode', 'HTML');
  formData.append('photo', new Blob([imgBuffer], { type: 'image/jpeg' }), path.basename(photoFile));

  await fetchWithRetry(`https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendPhoto`, {
    method: 'POST',
    body: formData
  });

  const escapedText = parsed.post_text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const timeStr = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
  const msgPayload = {
    chat_id: CONFIG.TELEGRAM_CHAT_ID,
    text: `📘 <b>DRAFT POSTINGAN FACEBOOK (SIAP SALIN)</b>\n━━━━━━━━━━━━━━━━━━━━\n📌 <b>Topik:</b> ${parsed.title}\n🕒 <b>Jadwal:</b> ${timeStr} WIB\n\n📋 <b>Ketuk blok teks di bawah untuk salin:</b>\n\n<pre><code>${escapedText}</code></pre>\n\n━━━━━━━━━━━━━━━━━━━━\n💡 <i>Simpan foto di atas ke galeri, ketuk teks untuk salin, lalu posting langsung ke feed Facebook Anda.</i>`,
    parse_mode: 'HTML'
  };

  await fetchWithRetry(`https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(msgPayload)
  });

  // 4. Update State
  state.lastExecutedSlot = currentSlot;
  state.history.push({
    title: parsed.title,
    slot: currentSlot,
    timestamp: new Date().toISOString()
  });
  if (state.history.length > 50) state.history.shift();
  saveState(state);

  console.log('====================================================');
  console.log('[SUCCESS] Konten foto & teks Facebook berhasil terkirim ke Telegram!');
  console.log('====================================================');
  return { status: 'success', title: parsed.title, slot: currentSlot };
}

if (require.main === module) {
  runPhotoGenerator().catch(err => {
    console.error('[FATAL ERROR]:', err);
    process.exit(1);
  });
}

module.exports = {
  runPhotoGenerator
};
