#!/usr/bin/env node
import { config as dotenvConfig } from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Get the directory where this script is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from the script's directory (not cwd)
dotenvConfig({ path: join(__dirname, "..", ".env") });

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
  apiKey: process.env.GEMINI_SEARCH_MCP_API_KEY,
  model: resolveModel(process.env.GEMINI_MODEL || "flash"),
  timeout: parseInt(process.env.GEMINI_API_TIMEOUT || "120000"),
  // Thinking mode: -1 = auto (default), 0 = off, 1-24576 = token budget
  thinkingBudget: parseInt(process.env.GEMINI_THINKING_BUDGET || "-1"),
  // Web search: true = on (default for this MCP), false = off
  webSearch: parseBool(process.env.GEMINI_WEB_SEARCH, true),
};

if (!config.apiKey) {
  console.error("Error: GEMINI_SEARCH_MCP_API_KEY is required");
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
