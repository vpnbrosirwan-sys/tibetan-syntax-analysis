"use client";

import { Plus, MessageSquare, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChatSession {
  id: string;
  title: string;
  timestamp: Date;
  messageCount: number;
}

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNewSession: () => void;
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  onNewSession,
  open,
  onClose,
}: SidebarProps) {
  return (
    <>
      {/* Backdrop (mobile/tablet) */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed lg:relative inset-y-0 left-0 z-50 w-72 bg-stone-50 border-r border-stone-200 flex flex-col transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0 lg:w-0 lg:overflow-hidden lg:border-0"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-200">
          <h2 className="text-sm font-semibold text-stone-700">對話記錄</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={onNewSession}
              className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-200 transition-colors"
              title="新對話"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-200 transition-colors lg:hidden"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-stone-400 text-xs">
              尚無對話記錄
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors flex items-start gap-2.5 group cursor-pointer",
                  activeSessionId === session.id
                    ? "bg-stone-200 text-stone-900"
                    : "text-stone-600 hover:bg-stone-100"
                )}
                onClick={() => {
                  onSelectSession(session.id);
                  onClose();
                }}
              >
                <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0 opacity-50" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-xs">{session.title}</p>
                  <p className="text-[10px] text-stone-400 mt-0.5">
                    {session.timestamp.toLocaleDateString("zh-TW")} · {session.messageCount} 條訊息
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                  className="p-1 rounded-md text-stone-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 mt-0.5"
                  title="刪除對話"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
