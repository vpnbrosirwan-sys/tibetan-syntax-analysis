"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Menu } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { AnalyzedSentence } from "@/lib/types";
import { saveSessions, loadSessions, saveMessages, loadMessages, hydrateMessages, saveBookmarks, loadBookmarks } from "@/lib/storage";
import ChatInput from "./chat/chat-input";
import MessageBubble, { type ChatMessage } from "./chat/message-bubble";
import Sidebar, { type ChatSession } from "./chat/sidebar";

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

export default function Analyzer() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [messagesBySession, setMessagesBySession] = useState<Record<string, ChatMessage[]>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [bookmarks, setBookmarks] = useState<Record<string, number[]>>({});
  const [loaded, setLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const messages = activeSessionId ? messagesBySession[activeSessionId] || [] : [];

  // Load from localStorage on mount
  useEffect(() => {
    const storedSessions = loadSessions();
    const storedMessages = hydrateMessages(loadMessages());
    const storedBookmarks = loadBookmarks();

    if (storedSessions.length > 0) {
      setSessions(storedSessions);
      setMessagesBySession(storedMessages as Record<string, ChatMessage[]>);
      setActiveSessionId(storedSessions[0].id);
    }
    setBookmarks(storedBookmarks);
    setLoaded(true);
  }, []);

  // Persist sessions whenever they change
  useEffect(() => {
    if (loaded) saveSessions(sessions);
  }, [sessions, loaded]);

  // Persist messages whenever they change (debounced by checking loaded)
  useEffect(() => {
    if (loaded) saveMessages(messagesBySession as any);
  }, [messagesBySession, loaded]);

  // Persist bookmarks
  useEffect(() => {
    if (loaded) saveBookmarks(bookmarks);
  }, [bookmarks, loaded]);

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
    // Clean up bookmarks for this session
    setBookmarks((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (key.startsWith(id + "-")) delete next[key];
      }
      return next;
    });
    if (activeSessionId === id) {
      const remaining = sessions.filter((s) => s.id !== id);
      setActiveSessionId(remaining.length > 0 ? remaining[0].id : null);
    }
  }, [activeSessionId, sessions]);

  // Auto-create first session
  useEffect(() => {
    if (loaded && sessions.length === 0) {
      startNewSession();
    }
  }, [sessions.length, startNewSession, loaded]);

  const toggleBookmark = useCallback((messageId: string, sentenceIndex: number) => {
    const key = `${activeSessionId}-${messageId}`;
    setBookmarks((prev) => {
      const current = prev[key] || [];
      const exists = current.includes(sentenceIndex);
      return {
        ...prev,
        [key]: exists ? current.filter((i) => i !== sentenceIndex) : [...current, sentenceIndex],
      };
    });
  }, [activeSessionId]);

  const handleSend = useCallback(
    async (text: string, files: File[]) => {
      let sessionId = activeSessionId;
      if (!sessionId) {
        sessionId = startNewSession();
      }

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

        if (files.length > 0) {
          const formData = new FormData();
          for (const f of files) formData.append("file", f);

          const ocrRes = await fetch("/api/ocr", {
            method: "POST",
            body: formData,
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(300_000)]),
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

        if (!tibetanText) throw new Error("No text to analyze");

        const analyzeRes = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify({ text: tibetanText }),
          signal: controller.signal,
        });

        if (!analyzeRes.ok) {
          const errData = await analyzeRes.json().catch(() => ({}));
          throw new Error(errData.error || "Analysis failed");
        }

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

  if (!loaded) return null;

  return (
    <div className="h-dvh flex bg-white">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onDeleteSession={deleteSession}
        onNewSession={startNewSession}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
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
                  bookmarkedSentences={
                    msg.role === "assistant" && msg.status === "complete"
                      ? new Set(bookmarks[`${activeSessionId}-${msg.id}`] || [])
                      : undefined
                  }
                  onToggleBookmark={
                    msg.role === "assistant" && msg.status === "complete"
                      ? (index: number) => toggleBookmark(msg.id, index)
                      : undefined
                  }
                />
              </motion.div>
            ))}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>

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
