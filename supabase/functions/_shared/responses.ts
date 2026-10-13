import { createOpenAI } from "npm:@ai-sdk/openai";
import { streamText, type ModelMessage } from "npm:ai";

import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
} from "./run-id.ts";

// One-shot Responses call through the Lovable AI Gateway: streams the
// gateway leg and resolves the final text server-side.
export async function generateResponsesText(
  request: Request,
  config: { baseURL: string; apiKey: string; model: string },
  messages: ModelMessage[],
  instructions?: string,
) {
  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: `${config.baseURL.replace(/\/+$/, "").replace(/\/v1$/, "")}/v1`,
    apiKey: config.apiKey,
    headers: { "Lovable-API-Key": config.apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  const reasoning = config.model !== "openai/chat-latest";
  const result = streamText({
    model: provider.responses(config.model),
    ...(instructions ? { instructions } : {}),
    messages,
    abortSignal: request.signal,
    providerOptions: {
      openai: {
        store: false,
        ...(reasoning
          ? {
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              include: ["reasoning.encrypted_content"],
            }
          : {}),
      },
    },
  });
  const text = await result.text;
  return { text, runId: runIdFetch.getRunId() };
}
