"use client";

import { Loader2 } from "lucide-react";
import type { AnalyzedSentence } from "@/lib/types";
import SyntaxArtifact from "./syntax-artifact";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text?: string;
  images?: string[];
  status?: "ocr" | "analyzing" | "verifying" | "complete" | "error";
  extractedText?: string;
  sentences?: AnalyzedSentence[];
  error?: string;
  batchProgress?: { current: number; total: number };
  timestamp: Date;
}

interface MessageBubbleProps {
  message: ChatMessage;
  bookmarkedSentences?: Set<number>;
  onToggleBookmark?: (index: number) => void;
}

export default function MessageBubble({ message, bookmarkedSentences, onToggleBookmark }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={isUser ? "max-w-[85%]" : "w-full"}>
        {/* User message */}
        {isUser && (
          <div className="space-y-1">
            {message.images && message.images.length > 0 && (
              <div className="flex gap-1.5 justify-end flex-wrap">
                {message.images.map((src, i) => (
                  <img key={i} src={src} alt={`上傳 ${i + 1}`} className="h-16 rounded-lg object-cover border border-stone-200" />
                ))}
              </div>
            )}
            {message.text && (
              <div className="bg-stone-800 text-white px-3 py-2 rounded-2xl rounded-br-sm text-sm">
                <p className="tibetan-text whitespace-pre-wrap">{message.text}</p>
              </div>
            )}
          </div>
        )}

        {/* Assistant message */}
        {!isUser && (
          <div className="space-y-1.5">
            {message.status === "ocr" && (
              <div className="flex items-center gap-2 text-stone-500 text-sm">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>正在識別藏文文字...</span>
              </div>
            )}

            {message.status === "analyzing" && (
              <div className="space-y-1.5">
                {message.extractedText && (
                  <div className="bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5">
                    <p className="text-[9px] uppercase tracking-wider text-stone-400 mb-0.5">OCR 結果</p>
                    <p className="tibetan-text text-sm text-stone-700 whitespace-pre-wrap">{message.extractedText}</p>
                  </div>
                )}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-stone-500 text-sm">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>
                      {message.batchProgress && message.batchProgress.total > 1
                        ? `正在分析語法結構 — 批次 ${message.batchProgress.current}/${message.batchProgress.total}...`
                        : "正在分析語法結構..."}
                    </span>
                  </div>
                  {message.batchProgress && message.batchProgress.total > 1 && (
                    <div className="w-40 h-1 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-stone-400 rounded-full transition-all duration-500"
                        style={{ width: `${((message.batchProgress.current - 1) / message.batchProgress.total) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {message.status === "verifying" && (
              <div className="space-y-1.5">
                {message.extractedText && (
                  <div className="bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5">
                    <p className="text-[9px] uppercase tracking-wider text-stone-400 mb-0.5">OCR 結果</p>
                    <p className="tibetan-text text-sm text-stone-700 whitespace-pre-wrap">{message.extractedText}</p>
                  </div>
                )}
                <div className="flex items-center gap-2 text-stone-500 text-sm">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Gemini 正在審核翻譯品質...</span>
                </div>
              </div>
            )}

            {message.status === "error" && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">
                <strong>錯誤：</strong> {message.error}
              </div>
            )}

            {message.status === "complete" && message.sentences && (
              <SyntaxArtifact
                sentences={message.sentences}
                extractedText={message.extractedText}
                bookmarkedSentences={bookmarkedSentences}
                onToggleBookmark={onToggleBookmark}
              />
            )}
          </div>
        )}

        <p className={`text-[9px] text-stone-300 mt-0.5 ${isUser ? "text-right" : "text-left"}`}>
          {message.timestamp.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}
