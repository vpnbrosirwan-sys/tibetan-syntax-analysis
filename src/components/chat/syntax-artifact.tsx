"use client";

import { useRef, useCallback } from "react";
import type { AnalyzedSentence } from "@/lib/types";
import { Download, Star } from "lucide-react";

const POS_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  noun:         { bg: "bg-blue-100",    text: "text-blue-900",    border: "border-blue-300",    label: "名詞" },
  verb:         { bg: "bg-red-100",     text: "text-red-900",     border: "border-red-300",     label: "動詞" },
  adjective:    { bg: "bg-emerald-100", text: "text-emerald-900", border: "border-emerald-300", label: "形容詞" },
  adverb:       { bg: "bg-purple-100",  text: "text-purple-900",  border: "border-purple-300",  label: "副詞" },
  pronoun:      { bg: "bg-amber-100",   text: "text-amber-900",   border: "border-amber-300",   label: "代詞" },
  particle:     { bg: "bg-stone-100",   text: "text-stone-800",   border: "border-stone-300",   label: "助詞" },
  numeral:      { bg: "bg-teal-100",    text: "text-teal-900",    border: "border-teal-300",    label: "數詞" },
  conjunction:  { bg: "bg-orange-100",  text: "text-orange-900",  border: "border-orange-300",  label: "連詞" },
  postposition: { bg: "bg-pink-100",    text: "text-pink-900",    border: "border-pink-300",    label: "後置詞" },
  interjection: { bg: "bg-yellow-100",  text: "text-yellow-900",  border: "border-yellow-300",  label: "感嘆詞" },
  unknown:      { bg: "bg-stone-100",   text: "text-stone-700",   border: "border-stone-300",   label: "未知" },
};

const ROLE_LABELS: Record<string, string> = {
  subject: "主語",
  object: "賓語",
  predicate: "謂語",
  modifier: "修飾語",
  complement: "補語",
  topic: "主題",
};

interface SyntaxArtifactProps {
  sentences: AnalyzedSentence[];
  extractedText?: string;
  onExport?: () => void;
  bookmarkedSentences?: Set<number>;
  onToggleBookmark?: (index: number) => void;
}

export default function SyntaxArtifact({
  sentences,
  extractedText,
  onExport,
  bookmarkedSentences,
  onToggleBookmark,
}: SyntaxArtifactProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  const handlePdfExport = useCallback(async () => {
    const el = contentRef.current;
    if (!el) return;

    const html2canvas = (await import("html2canvas-pro")).default;
    const { jsPDF } = await import("jspdf");

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/png");
    const imgWidth = 190; // A4 width minus margins (mm)
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const pageHeight = 277; // A4 height minus margins (mm)

    const pdf = new jsPDF("p", "mm", "a4");
    let yOffset = 0;

    while (yOffset < imgHeight) {
      if (yOffset > 0) pdf.addPage();
      pdf.addImage(imgData, "PNG", 10, 10 - yOffset, imgWidth, imgHeight);
      yOffset += pageHeight;
    }

    pdf.save(`藏文語法分析-${new Date().toLocaleDateString("zh-TW")}.pdf`);
  }, []);

  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-stone-50 border-b border-stone-200">
        <span className="text-xs font-medium text-stone-500">語法分析結果</span>
        <button
          onClick={handlePdfExport}
          className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700 transition-colors px-1.5 py-0.5 rounded hover:bg-stone-100"
        >
          <Download className="w-3 h-3" />
          匯出 PDF
        </button>
      </div>

      {/* Content area — captured for PDF */}
      <div ref={contentRef}>
        {/* POS Legend */}
        <div className="flex flex-wrap gap-1 px-3 py-1.5 border-b border-stone-100">
          {Object.entries(POS_COLORS).filter(([k]) => k !== "unknown").map(([key, val]) => (
            <span
              key={key}
              className={`inline-flex items-center px-1.5 py-0 rounded-full text-[9px] font-medium ${val.bg} ${val.text}`}
            >
              {val.label}
            </span>
          ))}
        </div>

        {/* OCR Text */}
        {extractedText && (
          <div className="px-3 py-2 border-b border-stone-100">
            <p className="text-[9px] uppercase tracking-wider text-stone-400 mb-0.5">OCR 識別結果</p>
            <p className="tibetan-text text-base text-stone-800 whitespace-pre-wrap">{extractedText}</p>
          </div>
        )}

        {/* Sentences */}
        <div className="divide-y divide-stone-100">
          {sentences.map((sentence, si) => {
            const isBookmarked = bookmarkedSentences?.has(si);
            return (
              <div key={si} className="px-3 py-2 space-y-1.5">
                {/* Original + Translation + Bookmark */}
                <div className="flex items-start gap-1.5">
                  <div className="flex-1 min-w-0">
                    <p className="tibetan-text text-lg text-stone-900">{sentence.original}</p>
                    <p className="chinese-text text-sm text-stone-700">{sentence.chineseTranslation}</p>
                  </div>
                  {onToggleBookmark && (
                    <button
                      onClick={() => onToggleBookmark(si)}
                      className={`p-1 rounded flex-shrink-0 mt-1 transition-colors ${
                        isBookmarked
                          ? "text-amber-500 hover:text-amber-600"
                          : "text-stone-300 hover:text-amber-400"
                      }`}
                      title={isBookmarked ? "取消收藏" : "收藏此句"}
                    >
                      <Star className="w-3.5 h-3.5" fill={isBookmarked ? "currentColor" : "none"} />
                    </button>
                  )}
                </div>

                {/* Word cards */}
                <div className="flex flex-wrap gap-1">
                  {sentence.words.map((word, wi) => {
                    const colors = POS_COLORS[word.pos] || POS_COLORS.unknown;
                    return (
                      <div
                        key={wi}
                        className={`inline-flex flex-col items-center px-2 py-1 rounded-lg border ${colors.bg} ${colors.border} ${colors.text} group relative cursor-default`}
                      >
                        <span className="tibetan-text text-base leading-snug">{word.tibetan}</span>
                        <span className="chinese-text text-xs">{word.chineseTranslation}</span>
                        <span className="text-[9px] opacity-70 font-medium leading-none">{colors.label}</span>
                        {word.syntacticRole && (
                          <span className="text-[8px] opacity-60 leading-none">{ROLE_LABELS[word.syntacticRole] || word.syntacticRole}</span>
                        )}
                        {word.notes && (
                          <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-stone-800 text-white text-[11px] rounded-lg p-2 w-48 shadow-xl z-20">
                            {word.transliteration && (
                              <p className="font-mono text-stone-400 text-[10px] mb-0.5">{word.transliteration}</p>
                            )}
                            <p>{word.notes}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Structure */}
                {sentence.structure && (
                  <p className="text-xs text-stone-600 pt-1 border-t border-stone-100">
                    <span className="font-medium text-stone-700">句子結構：</span>
                    {sentence.structure}
                  </p>
                )}
                {sentence.notes && (
                  <p className="text-xs text-stone-600 italic">{sentence.notes}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
