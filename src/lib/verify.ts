import { GoogleGenAI } from "@google/genai";
import type { AnalyzedSentence } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const VERIFY_PROMPT = `你是一位精通藏語和繁體中文的翻譯審核專家。

你的任務是檢查藏文詞語的繁體中文翻譯是否正確。

以下是一組藏文語法分析結果（JSON格式）。請逐一檢查每個詞語（word）的 chineseTranslation 是否準確翻譯了對應的 tibetan 詞語。同時檢查整句的 chineseTranslation 是否通順且準確。

如果所有翻譯都正確，回傳：
{"status": "approved"}

如果發現翻譯錯誤，回傳修正後的完整JSON，格式如下：
{"status": "corrected", "sentences": [完整的修正後句子陣列]}

只修正翻譯（chineseTranslation），不要修改 pos、syntacticRole、structure 等語法分析欄位。

只輸出 JSON，不要添加任何其他文字。`;

export async function verifyTranslations(
  sentences: AnalyzedSentence[],
  maxRetries: number = 2
): Promise<AnalyzedSentence[]> {
  let current = sentences;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        thinkingConfig: { thinkingBudget: 2048 },
        httpOptions: { timeout: 60_000 },
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${VERIFY_PROMPT}\n\n${JSON.stringify({ sentences: current }, null, 2)}`,
            },
          ],
        },
      ],
    });

    const text = response.text?.trim();
    if (!text) break;

    // Parse Gemini's response
    let jsonStr = text;
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    try {
      const result = JSON.parse(jsonStr);

      if (result.status === "approved") {
        // Gemini says translations are good
        return current;
      }

      if (result.status === "corrected" && result.sentences) {
        // Gemini corrected some translations — use the corrected version
        current = result.sentences;
        // Loop again to verify the corrections (up to maxRetries)
        continue;
      }
    } catch {
      // If Gemini returns invalid JSON, just use what we have
      break;
    }
  }

  return current;
}
