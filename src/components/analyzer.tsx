"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Menu } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { AnalyzedSentence } from "@/lib/types";
import ChatInput from "./chat/chat-input";
import MessageBubble, { type ChatMessage } from "./chat/message-bubble";
import Sidebar, { type ChatSession } from "./chat/sidebar";

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

export default function Analyzer() {
  // Sessions
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Messages per session
  const [messagesBySession, setMessagesBySession] = useState<Record<string, ChatMessage[]>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const messages = activeSessionId ? messagesBySession[activeSessionId] || [] : [];

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  const updateMessage = useCallback((sessionId: string, msgId: string, updates: Partial<ChatMessage>) => {
    setMessagesBySession((prev) => ({
      ...prev,
      [sessionId]: (prev[sessionId] || []).map((m) =>
        m.id === msgId ? { ...m, ...updates } : m
      ),
    }));
  }, []);

  const startNewSession = useCallback(() => {
    const id = generateId();
    const session: ChatSession = {
      id,
      title: "新的分析",
      timestamp: new Date(),
      messageCount: 0,
    };
    setSessions((prev) => [session, ...prev]);
    setMessagesBySession((prev) => ({ ...prev, [id]: [] }));
    setActiveSessionId(id);
    return id;
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setMessagesBySession((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (activeSessionId === id) {
      // Switch to another session or create new
      const remaining = sessions.filter((s) => s.id !== id);
      if (remaining.length > 0) {
        setActiveSessionId(remaining[0].id);
      } else {
        setActiveSessionId(null);
      }
    }
  }, [activeSessionId, sessions]);

  // Auto-create first session
  useEffect(() => {
    if (sessions.length === 0) {
      startNewSession();
    }
  }, [sessions.length, startNewSession]);

  const handleSend = useCallback(
    async (text: string, files: File[]) => {
      let sessionId = activeSessionId;
      if (!sessionId) {
        sessionId = startNewSession();
      }

      // Build user message
      const userImages: string[] = [];
      for (const f of files) {
        if (f.type.startsWith("image/")) {
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(f);
          });
          userImages.push(dataUrl);
        }
      }

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        text: text || undefined,
        images: userImages.length > 0 ? userImages : undefined,
        timestamp: new Date(),
      };

      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: "assistant",
        status: files.length > 0 ? "ocr" : "analyzing",
        timestamp: new Date(),
      };

      setMessagesBySession((prev) => ({
        ...prev,
        [sessionId!]: [...(prev[sessionId!] || []), userMsg, assistantMsg],
      }));

      // Update session title from first message
      const title = text
        ? text.substring(0, 30) + (text.length > 30 ? "..." : "")
        : `圖片分析 (${files.length} 張)`;
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, title, messageCount: s.messageCount + 2, timestamp: new Date() }
            : s
        )
      );

      setIsProcessing(true);
      scrollToBottom();

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        let tibetanText = text;

        // Step 1: OCR if files uploaded
        if (files.length > 0) {
          const formData = new FormData();
          for (const f of files) formData.append("file", f);

          const ocrTimeout = AbortSignal.timeout(300_000);
          const ocrRes = await fetch("/api/ocr", {
            method: "POST",
            body: formData,
            signal: AbortSignal.any([controller.signal, ocrTimeout]),
          });
          const ocrData = await ocrRes.json();
          if (!ocrRes.ok) throw new Error(ocrData.error || "OCR failed");

          tibetanText = ocrData.extractedText;
          updateMessage(sessionId!, assistantMsg.id, {
            status: "analyzing",
            extractedText: tibetanText,
          });
          scrollToBottom();
        }

        // Step 2: Syntax analysis via SSE (batched)
        if (!tibetanText) throw new Error("No text to analyze");

        const analyzeRes = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({ text: tibetanText }),
          signal: controller.signal,
        });

        if (!analyzeRes.ok) {
          const errData = await analyzeRes.json().catch(() => ({}));
          throw new Error(errData.error || "Analysis failed");
        }

        // Read SSE stream for batch progress
        const reader = analyzeRes.body?.getReader();
        const decoder = new TextDecoder();
        let analysisResult: { sentences: unknown[] } | null = null;

        if (reader) {
          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            let eventType = "";
            for (const line of lines) {
              if (line.startsWith("event: ")) {
                eventType = line.slice(7).trim();
              } else if (line.startsWith("data: ") && eventType) {
                const data = JSON.parse(line.slice(6));
                if (eventType === "progress") {
                  updateMessage(sessionId!, assistantMsg.id, {
                    batchProgress: { current: data.currentBatch, total: data.totalBatches },
                  });
                  scrollToBottom();
                } else if (eventType === "verifying") {
                  updateMessage(sessionId!, assistantMsg.id, {
                    status: "verifying",
                    batchProgress: undefined,
                  });
                  scrollToBottom();
                } else if (eventType === "complete") {
                  analysisResult = data;
                } else if (eventType === "error") {
                  throw new Error(data.message);
                }
                eventType = "";
              }
            }
          }
        }

        if (!analysisResult) throw new Error("No analysis result received");

        updateMessage(sessionId!, assistantMsg.id, {
          status: "complete",
          extractedText: files.length > 0 ? tibetanText : undefined,
          sentences: analysisResult.sentences as AnalyzedSentence[],
          batchProgress: undefined,
        });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        updateMessage(sessionId!, assistantMsg.id, {
          status: "error",
          error: err instanceof Error ? err.message : "Something went wrong",
        });
      } finally {
        setIsProcessing(false);
        abortRef.current = null;
        scrollToBottom();
      }
    },
    [activeSessionId, startNewSession, updateMessage, scrollToBottom]
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setIsProcessing(false);
  }, []);

  const handleExport = useCallback(
    (msg: ChatMessage) => {
      if (!msg.sentences) return;

      const posColors: Record<string, { bg: string; color: string; label: string }> = {
        noun:         { bg: "#dbeafe", color: "#1e3a5f", label: "名詞" },
        verb:         { bg: "#fee2e2", color: "#7f1d1d", label: "動詞" },
        adjective:    { bg: "#d1fae5", color: "#064e3b", label: "形容詞" },
        adverb:       { bg: "#ede9fe", color: "#3b0764", label: "副詞" },
        pronoun:      { bg: "#fef3c7", color: "#78350f", label: "代詞" },
        particle:     { bg: "#f5f5f4", color: "#292524", label: "助詞" },
        numeral:      { bg: "#ccfbf1", color: "#134e4a", label: "數詞" },
        conjunction:  { bg: "#ffedd5", color: "#7c2d12", label: "連詞" },
        postposition: { bg: "#fce7f3", color: "#831843", label: "後置詞" },
        interjection: { bg: "#fef9c3", color: "#713f12", label: "感嘆詞" },
        unknown:      { bg: "#f5f5f4", color: "#57534e", label: "未知" },
      };
      const roleLabels: Record<string, string> = {
        subject: "主語", object: "賓語", predicate: "謂語",
        modifier: "修飾語", complement: "補語", topic: "主題",
      };

      let html = `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8">
<title>藏文語法分析報告</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Tibetan:wght@400;600&display=swap');
  body { font-family: -apple-system, BlinkMacSystemFont, 'PingFang TC', sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; color: #1c1917; background: #fff; }
  .tibetan { font-family: 'Noto Sans Tibetan', sans-serif; line-height: 1.8; }
  h1 { font-size: 20px; border-bottom: 2px solid #e7e5e4; padding-bottom: 8px; }
  .meta { font-size: 12px; color: #78716c; margin-bottom: 24px; }
  .sentence-block { margin-bottom: 24px; padding: 16px; border: 1px solid #e7e5e4; border-radius: 12px; }
  .original { font-size: 18px; margin-bottom: 4px; }
  .translation { font-size: 14px; color: #44403c; margin-bottom: 12px; }
  .words { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
  .word { display: inline-flex; flex-direction: column; align-items: center; padding: 6px 10px; border-radius: 8px; border: 1px solid #d6d3d1; min-width: 56px; }
  .word .tib { font-size: 16px; }
  .word .cn { font-size: 13px; margin-top: 2px; }
  .word .pos { font-size: 10px; margin-top: 2px; font-weight: 600; }
  .word .role { font-size: 9px; opacity: 0.7; }
  .structure { font-size: 12px; color: #44403c; border-top: 1px solid #e7e5e4; padding-top: 8px; }
  .notes { font-size: 12px; color: #57534e; font-style: italic; }
  .legend { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px; }
  .legend span { font-size: 11px; padding: 2px 8px; border-radius: 12px; }
  .ocr-section { background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 8px; padding: 12px; margin-bottom: 20px; }
  .ocr-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #a8a29e; margin-bottom: 4px; }
</style></head><body>
<h1>📜 藏文語法分析報告</h1>
<p class="meta">日期：${msg.timestamp.toLocaleString("zh-TW")}</p>`;

      // Legend
      html += `<div class="legend">`;
      for (const [, v] of Object.entries(posColors)) {
        html += `<span style="background:${v.bg};color:${v.color}">${v.label}</span>`;
      }
      html += `</div>`;

      // OCR text
      if (msg.extractedText) {
        html += `<div class="ocr-section"><p class="ocr-label">OCR 識別結果</p><p class="tibetan" style="font-size:15px">${msg.extractedText.replace(/\n/g, "<br>")}</p></div>`;
      }

      // Sentences
      for (const s of msg.sentences) {
        html += `<div class="sentence-block">`;
        html += `<p class="original tibetan">${s.original}</p>`;
        html += `<p class="translation">${s.chineseTranslation}</p>`;
        html += `<div class="words">`;
        for (const w of s.words) {
          const c = posColors[w.pos] || posColors.unknown;
          html += `<div class="word" style="background:${c.bg};border-color:${c.bg};color:${c.color}" title="${w.notes || ""}">`;
          html += `<span class="tib tibetan">${w.tibetan}</span>`;
          html += `<span class="cn">${w.chineseTranslation}</span>`;
          html += `<span class="pos">${c.label}</span>`;
          if (w.syntacticRole) html += `<span class="role">${roleLabels[w.syntacticRole] || w.syntacticRole}</span>`;
          html += `</div>`;
        }
        html += `</div>`;
        if (s.structure) html += `<p class="structure"><strong>句子結構：</strong>${s.structure}</p>`;
        if (s.notes) html += `<p class="notes">${s.notes}</p>`;
        html += `</div>`;
      }

      html += `</body></html>`;

      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `藏文語法分析-${new Date().toLocaleDateString("zh-TW")}.html`;
      a.click();
      URL.revokeObjectURL(url);
    },
    []
  );

  return (
    <div className="h-dvh flex bg-white">
      {/* Sidebar */}
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onDeleteSession={deleteSession}
        onNewSession={startNewSession}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center gap-2 px-2 py-1.5 border-b border-stone-100 bg-white/80 backdrop-blur-sm sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-sm font-semibold text-stone-800">藏文語法分析</h1>
            <p className="text-[10px] text-stone-400">Tibetan Syntax Analysis</p>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-stone-400 space-y-3">
              <div className="text-4xl">📜</div>
              <div>
                <p className="text-sm font-medium text-stone-500">歡迎使用藏文語法分析</p>
                <p className="text-xs mt-1">上傳藏文圖片、拍照或直接輸入藏文開始分析</p>
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <MessageBubble
                  message={msg}
                  onExport={
                    msg.role === "assistant" && msg.status === "complete"
                      ? () => handleExport(msg)
                      : undefined
                  }
                />
              </motion.div>
            ))}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-stone-100 bg-white px-2 py-2">
          <div className="max-w-none">
            <ChatInput
              onSend={handleSend}
              isProcessing={isProcessing}
              onStop={handleStop}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
