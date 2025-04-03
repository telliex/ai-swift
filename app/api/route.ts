import Groq from 'groq-sdk';
import { headers } from 'next/headers';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import { unstable_after as after } from 'next/server';
import { searchPubMed } from '@/lib/pubmed';
const groq = new Groq();

const schema = zfd.formData({
  input: z.union([zfd.text(), zfd.file()]),
  language: zfd.text().optional().default('en'),
  message: zfd.repeatableOfType(
    zfd.json(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
  ),
});

export async function POST(request: Request) {
  console.time('transcribe ' + request.headers.get('x-vercel-id') || 'local');

  const { data, success } = schema.safeParse(await request.formData());
  if (!success) return new Response('Invalid request', { status: 400 });

  const transcript = await getTranscript(data.input);
  if (!transcript) return new Response('Invalid audio', { status: 400 });

  console.timeEnd(
    'transcribe ' + request.headers.get('x-vercel-id') || 'local'
  );
  console.time(
    'text completion ' + request.headers.get('x-vercel-id') || 'local'
  );

  // 檢查是否包含醫學查詢關鍵詞
  const needsPubMedSearch =
    /treatment|research|study|medicine|disease|syndrome|latest|update/i.test(
      transcript
    );

  let pubmedResults = null;
  if (needsPubMedSearch) {
    pubmedResults = await searchPubMed(transcript);
  }

  // 獲取語言設置
  const language = data.language || 'en';

  // 根據語言選擇調整系統提示
  let systemPrompt = '';
  if (language === 'zh-TW') {
    systemPrompt = `- 你是 Swift，一個友善且樂於助人的語音助手。
    - 請使用繁體中文回應用戶的請求，並保持簡潔。
    - 如果你不理解用戶的請求，請尋求澄清。
    - 你沒有獲取即時信息的能力，所以不應提供實時數據。
    - 你不能執行回應以外的其他操作。
    - 請使用適合語音播放的自然中文，避免使用標記語言、表情符號或其他格式。
    - 用戶位置是 ${location()}。
    - 現在的時間是 ${time()}。
    - 你的大型語言模型是 Llama 3，由 Meta 創建的 80 億參數版本。它託管在 Groq 上，這是一家開發快速推理技術的 AI 基礎設施公司。
    - 你的文字轉語音模型是 Sonic，由 Cartesia 創建和託管，這是一家開發快速且逼真的語音合成技術的公司。
    - 你使用 Next.js 構建，並託管在 Vercel 上。`;
  } else {
    systemPrompt = `- You are Swift, a friendly and helpful voice assistant.
    - Respond briefly to the user's request, and do not provide unnecessary information.
    - If you don't understand the user's request, ask for clarification.
    - You do not have access to up-to-date information, so you should not provide real-time data.
    - You are not capable of performing actions other than responding to the user.
    - Do not use markdown, emojis, or other formatting in your responses. Respond in a way easily spoken by text-to-speech software.
    - User location is ${location()}.
    - The current time is ${time()}.
    - Your large language model is Llama 3, created by Meta, the 8 billion parameter version. It is hosted on Groq, an AI infrastructure company that builds fast inference technology.
    - Your text-to-speech model is Sonic, created and hosted by Cartesia, a company that builds fast and realistic speech synthesis technology.
    - You are built with Next.js and hosted on Vercel.`;
  }

  if (pubmedResults) {
    systemPrompt += `\n\nReferenced research:\n`;
    pubmedResults.forEach((result: any, index: number) => {
      systemPrompt += `${index + 1}. "${result.title}" (${
        result.pubDate
      })\n   Key findings: ${result.abstract?.substring(0, 200)}...\n`;
    });
  }

  const completion = await groq.chat.completions.create({
    model: 'llama3-8b-8192',
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...data.message,
      {
        role: 'user',
        content: transcript,
      },
    ],
  });

  const response = completion.choices[0].message.content;
  console.timeEnd(
    'text completion ' + request.headers.get('x-vercel-id') || 'local'
  );

  console.time(
    'cartesia request ' + request.headers.get('x-vercel-id') || 'local'
  );

  // 檢查並轉換TTS的輸入
  // 根據語言選擇適當的語音模型和ID
  const useChineseUI = language === 'zh-TW';

  // 設置語音模型和ID
  let modelId = 'sonic-english';
  let voiceId = '79a125e8-cd45-4c13-8a67-188112f4dd22'; // 默認英文聲音ID
  let ttsText = response;

  // 如果是中文模式，嘗試使用中文語音
  if (useChineseUI) {
    try {
      // 根據截圖，使用Chinese Caller語音
      // 注意：這裡的modelId和voiceId需要根據實際的Cartesia API文檔進行調整
      modelId = 'sonic-chinese'; // 假設的中文模型ID
      voiceId = 'chinese-caller-id'; // 需要替換為實際的Chinese Caller ID
    } catch (error) {
      // 如果中文語音失敗，回退到英文提示
      console.error('Failed to use Chinese voice:', error);
      modelId = 'sonic-english';
      voiceId = '79a125e8-cd45-4c13-8a67-188112f4dd22';
      ttsText =
        "I'm sorry, but the text-to-speech service couldn't process Chinese. You can read my text response on screen.";
    }
  }

  const voice = await fetch('https://api.cartesia.ai/tts/bytes', {
    method: 'POST',
    headers: {
      'Cartesia-Version': '2024-06-30',
      'Content-Type': 'application/json',
      'X-API-Key': process.env.CARTESIA_API_KEY!,
    },
    body: JSON.stringify({
      model_id: modelId,
      transcript: ttsText,
      voice: {
        mode: 'id',
        id: voiceId,
      },
      output_format: {
        container: 'raw',
        encoding: 'pcm_f32le',
        sample_rate: 24000,
      },
    }),
  });

  console.timeEnd(
    'cartesia request ' + request.headers.get('x-vercel-id') || 'local'
  );

  if (!voice.ok) {
    console.error(await voice.text());
    return new Response('Voice synthesis failed', { status: 500 });
  }

  console.time('stream ' + request.headers.get('x-vercel-id') || 'local');
  after(() => {
    console.timeEnd('stream ' + request.headers.get('x-vercel-id') || 'local');
  });

  return new Response(voice.body, {
    headers: {
      'X-Transcript': encodeURIComponent(transcript),
      'X-Response': encodeURIComponent(response),
      'X-Chinese-UI': useChineseUI ? 'true' : 'false', // 新增標頭，標記是否使用中文界面
    },
  });
}

function location() {
  const headersList = headers();

  const country = headersList.get('x-vercel-ip-country');
  const region = headersList.get('x-vercel-ip-country-region');
  const city = headersList.get('x-vercel-ip-city');

  if (!country || !region || !city) return 'unknown';

  return `${city}, ${region}, ${country}`;
}

function time() {
  return new Date().toLocaleString('en-US', {
    timeZone: headers().get('x-vercel-ip-timezone') || undefined,
  });
}

async function getTranscript(input: string | File) {
  if (typeof input === 'string') return input;

  try {
    const { text } = await groq.audio.transcriptions.create({
      file: input,
      model: 'whisper-large-v3',
    });

    return text.trim() || null;
  } catch {
    return null; // Empty audio file
  }
}
