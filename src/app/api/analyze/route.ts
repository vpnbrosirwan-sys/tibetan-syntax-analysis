import { NextRequest, NextResponse } from "next/server";
import { analyzeTibetanSyntax } from "@/lib/deepseek";
import { verifyTranslations } from "@/lib/verify";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const accept = request.headers.get("accept") || "";

  // SSE mode: stream batch progress + verification
  if (accept.includes("text/event-stream")) {
    const { text } = await request.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          // Step 1: DeepSeek analysis (batched)
          const sentences = await analyzeTibetanSyntax(text, (progress) => {
            send("progress", {
              currentBatch: progress.currentBatch,
              totalBatches: progress.totalBatches,
              completedCount: progress.completedSentences.length,
            });
          });

          // Step 2: Gemini translation verification
          send("verifying", {});
          const verified = await verifyTranslations(sentences);

          send("complete", { sentences: verified });
          controller.close();
        } catch (error) {
          send("error", {
            message: error instanceof Error ? error.message : "Analysis failed",
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Regular JSON mode (fallback)
  try {
    const { text } = await request.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const sentences = await analyzeTibetanSyntax(text);
    const verified = await verifyTranslations(sentences);
    return NextResponse.json({ sentences: verified });
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
