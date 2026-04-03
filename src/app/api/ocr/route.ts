import { NextRequest, NextResponse } from "next/server";
import { extractTibetanText } from "@/lib/gemini";

export const maxDuration = 300; // Two-pass OCR with verification

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("file") as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const images = [];
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `Unsupported file type: ${file.type}. Accepted: JPEG, PNG, WebP, HEIC, PDF` },
          { status: 400 }
        );
      }
      if (file.size > 20 * 1024 * 1024) {
        return NextResponse.json({ error: `File "${file.name}" too large. Max 20MB per file.` }, { status: 400 });
      }
      const bytes = await file.arrayBuffer();
      images.push({
        base64Data: Buffer.from(bytes).toString("base64"),
        mimeType: file.type,
      });
    }

    const extractedText = await extractTibetanText(images);

    return NextResponse.json({ extractedText });
  } catch (error) {
    console.error("OCR error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "OCR failed" },
      { status: 500 }
    );
  }
}
