export type TibetanPOS =
  | "noun"
  | "verb"
  | "adjective"
  | "adverb"
  | "pronoun"
  | "particle"
  | "numeral"
  | "conjunction"
  | "postposition"
  | "interjection"
  | "unknown";

export interface AnalyzedWord {
  tibetan: string;
  transliteration?: string;
  pos: TibetanPOS;
  chineseTranslation: string;
  syntacticRole?: "subject" | "object" | "predicate" | "modifier" | "complement" | "topic";
  notes?: string;
}

export interface AnalyzedSentence {
  original: string;
  words: AnalyzedWord[];
  chineseTranslation: string;
  structure: string;
  notes?: string;
}

export interface AnalysisResult {
  extractedText: string;
  sentences: AnalyzedSentence[];
  metadata: {
    sourceType: "image" | "pdf" | "text";
    processingTime: number;
  };
}
