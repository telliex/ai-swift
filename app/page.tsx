'use client';

import clsx from 'clsx';
import { useActionState, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { EnterIcon, LoadingIcon } from '@/lib/icons';
import { usePlayer } from '@/lib/usePlayer';
import { track } from '@vercel/analytics';
import { useMicVAD, utils } from '@ricky0123/vad-react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  latency?: number;
};

// 定義每種語言的文本內容
type ContentType = {
  placeholder: string;
  intro: string;
  suggestionsTitle: string;
  suggestions: string[];
  referenceTitle: string;
  referenceText: string;
};

type LanguageContent = {
  en: ContentType;
  'zh-TW': ContentType;
};

const textContent: LanguageContent = {
  en: {
    placeholder: 'Ask me anything',
    intro: 'A fast, open-source voice assistant powered by',
    suggestionsTitle: 'Suggested questions:',
    suggestions: [
      '• "What are the daily management recommendations for diabetes?"',
      '• "What are the latest treatments for hypertension?"',
      '• "What are the common side effects of antibiotics?"',
    ],
    referenceTitle: 'References:',
    referenceText:
      'Answers are based on medical knowledge and PubMed research database. For medical issues, please consult a professional doctor.',
  },
  'zh-TW': {
    placeholder: '請問有什麼可以幫助您的？',
    intro: 'MediSwift - 您的專業醫療語音助手，由',
    suggestionsTitle: '建議問題:',
    suggestions: [
      '• "糖尿病的日常管理有哪些建議？"',
      '• "高血壓的最新治療方法是什麼？"',
      '• "常見抗生素的副作用有哪些？"',
    ],
    referenceTitle: '參考資料:',
    referenceText:
      '回答基於專業醫學知識和 PubMed 研究資料庫。如有醫療問題，請諮詢專業醫生。',
  },
};

export default function Home() {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const player = usePlayer();
  const [language, setLanguage] = useState<'en' | 'zh-TW'>('en'); // 預設英文

  const vad = useMicVAD({
    startOnLoad: true, // 初始化語音活動檢測，設置為加載時自動啟動
    onSpeechEnd: (audio) => {
      // 當檢測到語音結束時：
      player.stop();
      const wav = utils.encodeWAV(audio);
      const blob = new Blob([wav], { type: 'audio/wav' });
      submit(blob);
      const isFirefox = navigator.userAgent.includes('Firefox');
      if (isFirefox) vad.pause();
    },
    workletURL: '/vad.worklet.bundle.min.js', // 語音檢測的 Web Worker 腳本
    modelURL: '/silero_vad.onnx', // 語音檢測模型
    positiveSpeechThreshold: 0.6, // 語音檢測閾值
    minSpeechFrames: 4, // 最小語音幀數
    ortConfig(ort) {
      // 配置 ONNX Runtime 環境
      const isSafari = /^((?!chrome|android).)*safari/i.test(
        navigator.userAgent
      );

      ort.env.wasm = {
        wasmPaths: {
          'ort-wasm-simd-threaded.wasm': '/ort-wasm-simd-threaded.wasm',
          'ort-wasm-simd.wasm': '/ort-wasm-simd.wasm',
          'ort-wasm.wasm': '/ort-wasm.wasm',
          'ort-wasm-threaded.wasm': '/ort-wasm-threaded.wasm',
        },
        numThreads: isSafari ? 1 : 4,
      };
    },
  });

  useEffect(() => {
    function keyDown(e: KeyboardEvent) {
      if (e.key === 'Enter') return inputRef.current?.focus();
      if (e.key === 'Escape') return setInput('');
    }

    window.addEventListener('keydown', keyDown);
    return () => window.removeEventListener('keydown', keyDown);
  });

  const [messages, submit, isPending] = useActionState<
    Array<Message>,
    string | Blob
  >(async (prevMessages, data) => {
    const formData = new FormData();

    if (typeof data === 'string') {
      formData.append('input', data);
      track('Text input');
    } else {
      formData.append('input', data, 'audio.wav');
      track('Speech input');
    }

    formData.append('language', language);

    for (const message of prevMessages) {
      formData.append('message', JSON.stringify(message));
    }

    const submittedAt = Date.now();

    const response = await fetch('/api', {
      method: 'POST',
      body: formData,
    });

    const transcript = decodeURIComponent(
      response.headers.get('X-Transcript') || ''
    );
    const text = decodeURIComponent(response.headers.get('X-Response') || '');

    // 檢查是否為中文界面的響應
    const isChineseUI = response.headers.get('X-Chinese-UI') === 'true';

    if (!response.ok || !transcript || !text || !response.body) {
      if (response.status === 429) {
        toast.error('Too many requests. Please try again later.');
      } else {
        toast.error((await response.text()) || 'An error occurred.');
      }

      return prevMessages;
    }

    const latency = Date.now() - submittedAt;
    player.play(response.body, () => {
      const isFirefox = navigator.userAgent.includes('Firefox');
      if (isFirefox) vad.start();
    });
    setInput(transcript);

    // 如果是中文界面，顯示提示消息
    if (isChineseUI) {
      // 嘗試使用中文語音，但提醒用戶可能會有問題
      toast.info(
        '正在嘗試使用中文語音，如果聽到英文，這是因為中文語音支援尚在測試中。',
        {
          duration: 5000,
          position: 'bottom-center',
        }
      );
    }

    return [
      ...prevMessages,
      {
        role: 'user',
        content: transcript,
      },
      {
        role: 'assistant',
        content: text,
        latency,
      },
    ];
  }, []);

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit(input);
  }

  // 使用選擇的語言獲取對應文本
  const content = textContent[language];

  return (
    <>
      <div className="pb-4 min-h-28" />

      <div className="flex items-center justify-center mb-4 space-x-2">
        <button
          type="button"
          onClick={() => setLanguage('en')}
          className={clsx(
            'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
            language === 'en'
              ? 'bg-neutral-800 text-white dark:bg-white dark:text-black'
              : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
          )}
        >
          English
        </button>
        <button
          type="button"
          onClick={() => setLanguage('zh-TW')}
          className={clsx(
            'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
            language === 'zh-TW'
              ? 'bg-neutral-800 text-white dark:bg-white dark:text-black'
              : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
          )}
        >
          繁體中文
        </button>
      </div>

      <form
        className="rounded-full bg-neutral-200/80 dark:bg-neutral-800/80 flex items-center w-full max-w-3xl border border-transparent hover:border-neutral-300 focus-within:border-neutral-400 hover:focus-within:border-neutral-400 dark:hover:border-neutral-700 dark:focus-within:border-neutral-600 dark:hover:focus-within:border-neutral-600"
        onSubmit={handleFormSubmit}
      >
        <input
          type="text"
          className="bg-transparent focus:outline-none p-4 w-full placeholder:text-neutral-600 dark:placeholder:text-neutral-400"
          required
          placeholder={content.placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          ref={inputRef}
        />

        <button
          type="submit"
          className="p-4 text-neutral-700 hover:text-black dark:text-neutral-300 dark:hover:text-white"
          disabled={isPending}
          aria-label="Submit"
        >
          {isPending ? <LoadingIcon /> : <EnterIcon />}
        </button>
      </form>

      <div className="text-neutral-400 dark:text-neutral-600 pt-4 text-center max-w-xl text-balance min-h-28 space-y-4">
        {messages.length > 0 && (
          <p>
            {messages.at(-1)?.content}
            <span className="text-xs font-mono text-neutral-300 dark:text-neutral-700">
              {' '}
              ({messages.at(-1)?.latency}ms)
            </span>
          </p>
        )}

        {messages.length === 0 && (
          <>
            <p>
              {content.intro} <A href="https://groq.com">Groq</A>,{' '}
              <A href="https://cartesia.ai">Cartesia</A>{' '}
              {language === 'zh-TW' ? '和' : 'and'}{' '}
              <A href="https://pubmed.ncbi.nlm.nih.gov">PubMed</A>{' '}
              {language === 'zh-TW'
                ? '提供支持。提供醫療知識、健康建議和最新研究資訊。'
                : 'providing medical knowledge, health advice and latest research information.'}
            </p>

            <div className="text-sm text-neutral-500 mt-4">
              <p>{content.suggestionsTitle}</p>
              <ul className="mt-2 space-y-1">
                {content.suggestions.map(
                  (suggestion: string, index: number) => (
                    <li key={index}>{suggestion}</li>
                  )
                )}
              </ul>
            </div>
          </>
        )}

        {messages.length > 0 && messages.at(-1)?.role === 'assistant' && (
          <div className="mt-6 text-xs text-neutral-400 max-w-2xl">
            <p className="font-medium">{content.referenceTitle}</p>
            <p className="mt-1">{content.referenceText}</p>
          </div>
        )}
      </div>

      <div
        className={clsx(
          'absolute size-36 blur-3xl rounded-full bg-gradient-to-b from-red-200 to-red-400 dark:from-red-600 dark:to-red-800 -z-50 transition ease-in-out',
          {
            'opacity-0': vad.loading || vad.errored,
            'opacity-30': !vad.loading && !vad.errored && !vad.userSpeaking,
            'opacity-100 scale-110': vad.userSpeaking,
          }
        )}
      />

      {/* 修改中文提示 */}
      {language === 'zh-TW' && (
        <div className="text-xs text-neutral-400 dark:text-neutral-600 absolute bottom-4 left-0 right-0 text-center">
          注意：中文語音支援正在測試中，可能會有不穩定的情況
        </div>
      )}
    </>
  );
}

function A(props: any) {
  return (
    <a
      {...props}
      className="text-neutral-500 dark:text-neutral-500 hover:underline font-medium"
    />
  );
}
