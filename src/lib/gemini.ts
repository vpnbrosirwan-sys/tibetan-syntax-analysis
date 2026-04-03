interface ImageInput {
  base64Data: string;
  mimeType: string;
}

export async function extractTibetanText(
  images: ImageInput[]
): Promise<string> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY!;

  const requests = images.map((img) => ({
    image: { content: img.base64Data },
    features: [
      { type: "DOCUMENT_TEXT_DETECTION" },
    ],
    imageContext: {
      languageHints: ["bo"],
    },
  }));

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requests }),
    }
  );

  const data = await response.json();

  if (data.error) {
    throw new Error(`Vision API error: ${data.error.message}`);
  }

  const texts: string[] = [];
  for (const resp of data.responses) {
    if (resp.error) {
      throw new Error(`Vision API error: ${resp.error.message}`);
    }
    const fullText =
      resp.fullTextAnnotation?.text ||
      resp.textAnnotations?.[0]?.description ||
      "";
    if (fullText) {
      texts.push(fullText.trim());
    }
  }

  if (texts.length === 0) {
    throw new Error("No text detected in the image(s)");
  }

  return texts.join("\n");
}
