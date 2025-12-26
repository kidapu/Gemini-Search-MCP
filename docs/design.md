# Gemini Search MCP サーバー設計

## 概要

o3-search-mcp を参考に、Gemini Flash 2.5 + Google Search Grounding を使った MCP サーバーの設計。

## 参考リポジトリ

- [o3-search-mcp](https://github.com/yoshiko-pg/o3-search-mcp) - OpenAI o3 モデルを使った Web 検索 MCP サーバー

## ディレクトリ構造

```
gemini-search-mcp/
├── index.ts           # メインエントリーポイント
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── README.md
├── LICENSE
└── docs/
    └── design.md      # この設計ドキュメント
```

## 主要コンポーネント

### 1. package.json

```json
{
  "name": "gemini-search-mcp",
  "version": "0.0.1",
  "description": "MCP server for AI agents to use Gemini 2.5 Flash with Google Search grounding",
  "main": "build/index.js",
  "type": "module",
  "bin": {
    "gemini-search-mcp": "build/index.js"
  },
  "scripts": {
    "build": "tsc && chmod +x build/index.js",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.13.2",
    "@google/genai": "^1.33.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "typescript": "^5.8.0"
  },
  "engines": {
    "node": ">=18"
  },
  "packageManager": "pnpm@10.10.0"
}
```

### 2. index.ts（メイン実装）

```typescript
#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

// Create server instance
const server = new McpServer({
  name: "gemini-search-mcp",
  version: "0.0.1",
});

// Model presets for easy switching
const MODEL_PRESETS: Record<string, string> = {
  // Aliases for convenience
  "flash": "gemini-2.5-flash",
  "flash-lite": "gemini-2.5-flash-lite",
  "pro": "gemini-2.5-pro",
  // Full model names also work
  "gemini-2.5-flash": "gemini-2.5-flash",
  "gemini-2.5-flash-lite": "gemini-2.5-flash-lite",
  "gemini-2.5-pro": "gemini-2.5-pro",
};

// Resolve model name from preset or use as-is
function resolveModel(input: string): string {
  return MODEL_PRESETS[input.toLowerCase()] || input;
}

// Parse boolean environment variable
function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

// Configuration from environment variables
const config = {
  apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
  model: resolveModel(process.env.GEMINI_MODEL || "flash"),
  timeout: parseInt(process.env.GEMINI_API_TIMEOUT || "120000"),
  // Thinking mode: -1 = auto (default), 0 = off, 1-24576 = token budget
  thinkingBudget: parseInt(process.env.GEMINI_THINKING_BUDGET || "-1"),
  // Web search: true = on (default for this MCP), false = off
  webSearch: parseBool(process.env.GEMINI_WEB_SEARCH, true),
};

if (!config.apiKey) {
  console.error("Error: GOOGLE_API_KEY or GEMINI_API_KEY is required");
  process.exit(1);
}

// Initialize Gemini client
const genai = new GoogleGenAI({ apiKey: config.apiKey });

// Helper: Format grounding metadata into readable citations
function formatGroundingMetadata(metadata: any): string {
  if (!metadata?.groundingChunks?.length) return "";

  const sources = metadata.groundingChunks
    .filter((chunk: any) => chunk.web?.uri)
    .map((chunk: any, i: number) =>
      `[${i + 1}] ${chunk.web.title || "Source"}: ${chunk.web.uri}`
    )
    .join("\n");

  return sources ? `\n\n---\n**Sources:**\n${sources}` : "";
}

// Define the gemini-search tool
server.tool(
  "gemini-search",
  `An AI agent powered by Gemini 2.5 Flash with Google Search grounding.
Useful for finding the latest information, troubleshooting errors, researching topics,
and discussing ideas. Returns responses with cited sources from the web.`,
  {
    query: z
      .string()
      .describe(
        "Natural language query to search and analyze. Ask questions, search for information, or request analysis of complex topics."
      ),
  },
  async ({ query }) => {
    try {
      // Build generation config
      const generationConfig: any = {};

      // Configure thinking mode
      // -1 = auto (model default), 0 = off, >0 = specific budget
      if (config.thinkingBudget >= 0) {
        generationConfig.thinkingConfig = {
          thinkingBudget: config.thinkingBudget,
        };
      }
      // thinkingBudget = -1 means use model default (auto)

      // Configure tools (web search)
      const tools: any[] = [];
      if (config.webSearch) {
        tools.push({ googleSearch: {} });
      }

      const response = await genai.models.generateContent({
        model: config.model,
        contents: query,
        config: {
          ...(tools.length > 0 && { tools }),
          ...generationConfig,
        },
      });

      // Extract text response
      const text = response.text || "No response text available.";

      // Extract and format grounding sources
      const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
      const citations = formatGroundingMetadata(groundingMetadata);

      return {
        content: [
          {
            type: "text",
            text: text + citations,
          },
        ],
      };
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
          },
        ],
      };
    }
  }
);

// Main entry point
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
```

### 3. .env.example

```bash
# Required: Google AI API Key
# Get your key at: https://aistudio.google.com/apikey
GOOGLE_API_KEY=your_api_key_here

# ============================================================
# Model Selection
# ============================================================
# Short aliases (recommended):
#   flash      -> gemini-2.5-flash      (default, balanced)
#   flash-lite -> gemini-2.5-flash-lite (fastest, cheapest)
#   pro        -> gemini-2.5-pro        (most capable)
#
# Full model names also supported:
#   gemini-2.5-flash
#   gemini-2.5-flash-lite
#   gemini-2.5-pro
# ============================================================
GEMINI_MODEL=flash

# Optional: API timeout in milliseconds (default: 120000 = 2 minutes)
GEMINI_API_TIMEOUT=120000

# ============================================================
# Thinking Mode
# ============================================================
# -1 = auto (model default: Flash=ON, Flash-Lite=OFF, Pro=ON)
#  0 = off (disable thinking)
#  1-24576 = specific token budget
# Note: Pro cannot disable thinking
# ============================================================
GEMINI_THINKING_BUDGET=-1

# ============================================================
# Web Search (Google Search Grounding)
# ============================================================
# true  = enabled (default for this MCP server)
# false = disabled
# ============================================================
GEMINI_WEB_SEARCH=true
```

### 4. tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./build",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "resolveJsonModule": true
  },
  "include": ["index.ts"],
  "exclude": ["node_modules", "build"]
}
```

### 5. .gitignore

```
node_modules/
build/
.env
*.log
```

## 設定方法

### Claude Code / Claude Desktop

```json
{
  "mcpServers": {
    "gemini-search": {
      "command": "npx",
      "args": ["-y", "gemini-search-mcp"],
      "env": {
        "GOOGLE_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### ローカル開発

```json
{
  "mcpServers": {
    "gemini-search": {
      "command": "node",
      "args": ["/path/to/gemini-search-mcp/build/index.js"],
      "env": {
        "GOOGLE_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## o3-search-mcp との比較

| 項目 | o3-search-mcp | gemini-search-mcp |
|------|---------------|-------------------|
| Provider | OpenAI | Google AI |
| Model | o3, o4-mini, gpt-5 | flash, flash-lite, pro |
| Search | `web_search_preview` tool | `googleSearch` grounding |
| Citations | なし（テキストのみ） | groundingMetadata で引用付き |
| Thinking | `reasoning.effort` (low/medium/high) | `thinkingBudget` (0-24576 tokens) |
| 価格 | 有料 | 無料枠あり（2026/1/5 まで無料） |
| SDK | `openai` | `@google/genai` |

## 環境変数一覧

| 変数名 | 必須 | デフォルト | 説明 |
|--------|------|-----------|------|
| `GOOGLE_API_KEY` | Yes | - | Google AI API キー |
| `GEMINI_API_KEY` | No | - | `GOOGLE_API_KEY` の別名 |
| `GEMINI_MODEL` | No | `flash` | 使用するモデル（エイリアスまたはフルネーム） |
| `GEMINI_API_TIMEOUT` | No | `120000` | タイムアウト（ミリ秒） |
| `GEMINI_THINKING_BUDGET` | No | `-1` | Thinking: -1=auto, 0=off, 1-24576=budget |
| `GEMINI_WEB_SEARCH` | No | `true` | Web検索: true=on, false=off |

## モデル比較

| エイリアス | フルネーム | 特徴 | 用途 |
|-----------|-----------|------|------|
| `flash` | `gemini-2.5-flash` | バランス型 | 汎用、推論タスク |
| `flash-lite` | `gemini-2.5-flash-lite` | 最速・最安 | 高速応答、大量処理 |
| `pro` | `gemini-2.5-pro` | 最高性能 | 複雑な分析、高精度 |

## デフォルト動作

| 機能 | Flash | Flash-Lite | Pro |
|------|-------|------------|-----|
| **Thinking** | ON（Auto） | OFF | ON（常時、OFF不可） |
| **Web検索** | OFF | OFF | OFF |

- **Thinking**: モデルが回答前に「考える」プロセス。`thinkingBudget` で制御
- **Web検索**: Google Search Grounding。明示的に有効化が必要

## 追加機能案（将来の拡張）

1. **Dynamic Retrieval**: `dynamicRetrievalConfig` で検索を動的に制御
2. **Search Suggestions**: `searchEntryPoint.renderedContent` で関連検索を表示
3. **マルチモーダル対応**: 画像付きクエリのサポート
4. **ストリーミング**: レスポンスのストリーミング出力

## 参考リンク

- [Grounding with Google Search | Gemini API](https://ai.google.dev/gemini-api/docs/google-search)
- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini models](https://ai.google.dev/gemini-api/docs/models)
- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk)
