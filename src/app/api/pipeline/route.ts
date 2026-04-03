import { NextRequest } from "next/server";
import { extractTibetanText } from "@/lib/gemini";
import { analyzeTibetanSyntax } from "@/lib/deepseek";

export const maxDuration = 180;

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const contentType = request.headers.get("content-type") || "";
        let tibetanText: string;

        if (contentType.includes("multipart/form-data")) {
          const formData = await request.formData();
          const files = formData.getAll("file") as File[];

          if (files.length === 0) {
            send("error", { message: "No files provided" });
            controller.close();
            return;
          }

          send("ocr-start", {});

          const images = [];
          for (const file of files) {
            const bytes = await file.arrayBuffer();
            images.push({
              base64Data: Buffer.from(bytes).toString("base64"),
              mimeType: file.type,
            });
          }
          tibetanText = await extractTibetanText(images);

          send("ocr-complete", { extractedText: tibetanText });
        } else {
          const body = await request.json();
          tibetanText = body.text;

          if (!tibetanText) {
            send("error", { message: "No text provided" });
            controller.close();
            return;
          }
        }

        send("analysis-start", {});

        const sentences = await analyzeTibetanSyntax(tibetanText);

        send("analysis-complete", { sentences, extractedText: tibetanText });

        controller.close();
      } catch (error) {
        send("error", {
          message: error instanceof Error ? error.message : "Pipeline failed",
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
