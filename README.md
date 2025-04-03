# [AI-Swift]

AI-Swift 是一個快速、高效的 AI 語音助手，專注於提供即時的語音互動體驗。

AI-Swift is a fast and efficient AI voice assistant, focused on providing real-time voice interaction experience.

> This project is based on [Vercel Swift AI Voice Assistant Template](https://vercel.com/templates/next.js/swift-ai-voice-assistant)

## 功能特點 | Features

- 即時語音轉文字：使用 [OpenAI Whisper](https://github.com/openai/whisper) 進行高準確度的語音識別
- 快速回應生成：採用 [Meta Llama 3](https://llama.meta.com/llama3/) 模型生成自然流暢的回應
- 即時語音合成：使用 [Cartesia Sonic](https://cartesia.ai/sonic) 進行高品質的語音合成
- 智能語音檢測：整合 [VAD](https://www.vad.ricky0123.com/) 技術，精確識別用戶語音片段

- Real-time Speech-to-Text: High-accuracy speech recognition using [OpenAI Whisper](https://github.com/openai/whisper)
- Fast Response Generation: Natural and fluid responses using [Meta Llama 3](https://llama.meta.com/llama3/)
- Real-time Speech Synthesis: High-quality voice synthesis with [Cartesia Sonic](https://cartesia.ai/sonic)
- Intelligent Voice Detection: Precise user speech segment detection using [VAD](https://www.vad.ricky0123.com/)

## 技術架構 | Tech Stack

- 前端框架 | Frontend Framework: [Next.js](https://nextjs.org) (TypeScript)
- 部署平台 | Deployment Platform: [Vercel](https://vercel.com)
- 核心服務 | Core Services:
  - [Groq](https://groq.com) - 提供快速推理能力 | Provides fast inference capabilities
  - [Cartesia](https://cartesia.ai) - 提供語音合成服務 | Provides speech synthesis services


## 開發指南 | Development Guide

### 環境需求 | Prerequisites

- Node.js 16.x 或更高版本 | Node.js 16.x or higher
- pnpm 包管理器 | pnpm package manager

### 安裝步驟 | Installation Steps

1. 克隆專案儲存庫 | Clone the repository
```bash
git clone https://github.com/ai-ng/swift.git
cd swift
```

2. 設定環境變數 | Set up environment variables
```bash
cp .env.example .env.local
```
編輯 `.env.local` 檔案，填入必要的環境變數 | Edit `.env.local` file and fill in the required environment variables:
- GROQ_API_KEY
- CARTESIA_API_KEY

3. 安裝依賴套件 | Install dependencies
```bash
pnpm install
```

4. 啟動開發伺服器 | Start the development server
```bash
pnpm dev
```

## 授權條款 | License

本專案採用 MIT 授權條款 - 詳見 [LICENSE](LICENSE) 檔案
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details

> 本專案基於 [Vercel Swift AI Voice Assistant Template](https://vercel.com/templates/next.js/swift-ai-voice-assistant) 開發
