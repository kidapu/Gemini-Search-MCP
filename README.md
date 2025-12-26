# @kidapu/gemini-search-mcp

[![npm version](https://img.shields.io/npm/v/@kidapu/gemini-search-mcp.svg)](https://www.npmjs.com/package/@kidapu/gemini-search-mcp)

Gemini 2.5 Flash + Google Search Grounding を使った MCP サーバー。

## インストール

### ユーザーレベル（全プロジェクトで使用可能）

```bash
claude mcp add gemini-search -s user -e GEMINI_API_KEY=your_api_key -- npx -y @kidapu/gemini-search-mcp
```

### プロジェクトレベル（このプロジェクトのみ）

```bash
claude mcp add gemini-search -s project -e GEMINI_API_KEY=your_api_key -- npx -y @kidapu/gemini-search-mcp
```

### ローカルインストール

```bash
git clone https://github.com/kidapu/Gemini-Search-MCP.git
cd Gemini-Search-MCP
pnpm install
pnpm run build
cp .env.example .env
# .env を編集して GEMINI_API_KEY を設定
```

Claude Code に登録:

```bash
claude mcp add gemini-search -s user -- node /path/to/Gemini-Search-MCP/build/index.js
```

---

API キーは [Google AI Studio](https://aistudio.google.com/apikey) で取得できます。

## 環境変数

| 変数名 | デフォルト | 説明 |
|--------|-----------|------|
| `GEMINI_API_KEY` | - | Google AI API キー（必須） |
| `GEMINI_MODEL` | `flash` | モデル: `flash`, `flash-lite`, `pro` |
| `GEMINI_THINKING_BUDGET` | `-1` | Thinking: -1=auto, 0=off, 1-24576 |
| `GEMINI_WEB_SEARCH` | `true` | Web検索: true/false |

## モデル

| エイリアス | フルネーム | 特徴 |
|-----------|-----------|------|
| `flash` | `gemini-2.5-flash` | バランス型（デフォルト） |
| `flash-lite` | `gemini-2.5-flash-lite` | 最速・最安 |
| `pro` | `gemini-2.5-pro` | 最高性能 |

### Gemini 3.0 Flash

Gemini 3.0 Flash（2025年12月リリース）を使用する場合は、フルネームで指定:

```bash
GEMINI_MODEL=gemini-3.0-flash
```

## 料金

| モデル | Input (1M tokens) | Output (1M tokens) |
|--------|-------------------|-------------------|
| `gemini-2.5-flash` | $0.15 | $0.60 |
| `gemini-2.5-flash-lite` | $0.10 | $0.40 |
| `gemini-2.5-pro` | $1.25 | $10.00 |
| `gemini-3.0-flash` | $0.50 | $3.00 |

> 最新の料金は [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing) を参照してください。
