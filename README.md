# gemini-search-mcp

Gemini 2.5 Flash + Google Search Grounding を使った MCP サーバー。

## セットアップ

### 1. 依存関係のインストール

```bash
pnpm install
pnpm run build
```

### 2. 環境変数の設定

```bash
cp .env.example .env
```

`.env` を編集して API キーを設定:

```bash
GEMINI_API_KEY=your_api_key_here
```

API キーは [Google AI Studio](https://aistudio.google.com/apikey) で取得できます。

### 3. Claude Code に登録

```bash
claude mcp add gemini-search -- node /Users/kidapu/00-DocRoot/02-projects/ClaudeCodeDevEnv/gemini-search-mcp/build/index.js
```

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
