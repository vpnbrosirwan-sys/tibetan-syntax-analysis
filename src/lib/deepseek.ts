import OpenAI from "openai";
import { ANALYSIS_SYSTEM_PROMPT } from "./prompts";
import type { AnalyzedSentence } from "./types";

const client = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY!,
  timeout: 90_000,
});

// Split Tibetan text into batches by shad (།) punctuation
function splitIntoBatches(text: string, maxSentencesPerBatch: number = 3): string[] {
  // Split on shad marks, keeping the shad with each sentence
  const rawSentences = text.split(/(?<=།)/).map((s) => s.trim()).filter(Boolean);

  if (rawSentences.length <= maxSentencesPerBatch) {
    return [text];
  }

  const batches: string[] = [];
  for (let i = 0; i < rawSentences.length; i += maxSentencesPerBatch) {
    batches.push(rawSentences.slice(i, i + maxSentencesPerBatch).join("\n"));
  }
  return batches;
}

function parseResponse(content: string): AnalyzedSentence[] {
  let jsonStr = content.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  const parsed = JSON.parse(jsonStr);
  return Array.isArray(parsed) ? parsed : parsed.sentences || [parsed];
}

async function analyzeBatch(text: string): Promise<AnalyzedSentence[]> {
  const response = await client.chat.completions.create({
    model: "deepseek-chat",
    messages: [
      { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
      { role: "user", content: text },
    ],
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("DeepSeek returned empty response");
  }

  try {
    return parseResponse(content);
  } catch {
    // Retry: ask DeepSeek to fix the JSON
    const retryResponse = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "Fix the following malformed JSON and return only valid JSON. Do not add any other text." },
        { role: "user", content: content },
      ],
      response_format: { type: "json_object" },
    });

    const retryContent = retryResponse.choices[0]?.message?.content?.trim();
    if (!retryContent) {
      throw new Error("Failed to parse analysis response");
    }
    return parseResponse(retryContent);
  }
}

export interface BatchProgress {
  currentBatch: number;
  totalBatches: number;
  completedSentences: AnalyzedSentence[];
}

export async function analyzeTibetanSyntax(
  tibetanText: string,
  onProgress?: (progress: BatchProgress) => void
): Promise<AnalyzedSentence[]> {
  const batches = splitIntoBatches(tibetanText, 3);
  const allSentences: AnalyzedSentence[] = [];

  for (let i = 0; i < batches.length; i++) {
    onProgress?.({
      currentBatch: i + 1,
      totalBatches: batches.length,
      completedSentences: [...allSentences],
    });

    const sentences = await analyzeBatch(batches[i]);
    allSentences.push(...sentences);
  }

  return allSentences;
}
