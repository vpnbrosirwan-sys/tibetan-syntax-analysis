import type { AnalyzedSentence } from "./types";

// Serializable versions of the chat types (Date → string)
interface StoredChatMessage {
  id: string;
  role: "user" | "assistant";
  text?: string;
  images?: string[];
  status?: "ocr" | "analyzing" | "verifying" | "complete" | "error";
  extractedText?: string;
  sentences?: AnalyzedSentence[];
  error?: string;
  timestamp: string;
}

interface StoredSession {
  id: string;
  title: string;
  timestamp: string;
  messageCount: number;
}

interface StoredBookmarks {
  // key: `${sessionId}-${messageId}`, value: set of sentence indices
  [key: string]: number[];
}

const SESSIONS_KEY = "tsa_sessions";
const MESSAGES_KEY = "tsa_messages";
const BOOKMARKS_KEY = "tsa_bookmarks";

export function saveSessions(sessions: { id: string; title: string; timestamp: Date; messageCount: number }[]) {
  const stored: StoredSession[] = sessions.map((s) => ({
    ...s,
    timestamp: s.timestamp.toISOString(),
  }));
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(stored));
}

export function loadSessions(): { id: string; title: string; timestamp: Date; messageCount: number }[] {
  const raw = localStorage.getItem(SESSIONS_KEY);
  if (!raw) return [];
  const stored: StoredSession[] = JSON.parse(raw);
  return stored.map((s) => ({
    ...s,
    timestamp: new Date(s.timestamp),
  }));
}

export function saveMessages(messagesBySession: Record<string, StoredChatMessage[]>) {
  // Only save completed/error messages, skip in-progress
  const toStore: Record<string, StoredChatMessage[]> = {};
  for (const [sessionId, msgs] of Object.entries(messagesBySession)) {
    toStore[sessionId] = msgs.map((m) => ({
      ...m,
      images: undefined, // Don't store large base64 images
      timestamp: typeof m.timestamp === "string" ? m.timestamp : new Date(m.timestamp).toISOString(),
    }));
  }
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(toStore));
}

export function loadMessages(): Record<string, StoredChatMessage[]> {
  const raw = localStorage.getItem(MESSAGES_KEY);
  if (!raw) return {};
  return JSON.parse(raw);
}

export function hydrateMessages(
  stored: Record<string, StoredChatMessage[]>
): Record<string, { id: string; role: "user" | "assistant"; text?: string; images?: string[]; status?: string; extractedText?: string; sentences?: AnalyzedSentence[]; error?: string; timestamp: Date }[]> {
  const result: Record<string, any[]> = {};
  for (const [sessionId, msgs] of Object.entries(stored)) {
    result[sessionId] = msgs.map((m) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }));
  }
  return result;
}

export function saveBookmarks(bookmarks: Record<string, number[]>) {
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
}

export function loadBookmarks(): Record<string, number[]> {
  const raw = localStorage.getItem(BOOKMARKS_KEY);
  if (!raw) return {};
  return JSON.parse(raw);
}
