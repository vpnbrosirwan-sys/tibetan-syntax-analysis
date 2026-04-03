"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X, Paperclip, ArrowUp, Camera, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (text: string, files: File[]) => void;
  disabled?: boolean;
  isProcessing?: boolean;
  onStop?: () => void;
}

export default function ChatInput({ onSend, disabled, isProcessing, onStop }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
    }
  }, [input]);

  const addFiles = useCallback((newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
    for (const f of newFiles) {
      if (f.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) =>
          setPreviews((prev) => [...prev, e.target?.result as string]);
        reader.readAsDataURL(f);
      } else {
        setPreviews((prev) => [...prev, ""]);
      }
    }
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(() => {
    if (input.trim() === "" && files.length === 0) return;
    onSend(input, files);
    setInput("");
    setFiles([]);
    setPreviews([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, files, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!disabled && !isProcessing) handleSubmit();
    }
  };

  const canSend = !disabled && !isProcessing && (input.trim() !== "" || files.length > 0);

  return (
    <div className="w-full">
      {/* File previews */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex gap-2 overflow-x-auto pb-2 px-1"
          >
            {files.map((file, i) => (
              <div key={i} className="relative group flex-shrink-0">
                <div className="w-16 h-14 rounded-lg border border-stone-200 bg-stone-50 overflow-hidden flex items-center justify-center">
                  {previews[i] ? (
                    <img src={previews[i]} alt={file.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-stone-400 text-center px-1">
                      {file.name.split(".").pop()?.toUpperCase()}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => removeFile(i)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-stone-400 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className="relative bg-white border border-stone-200 rounded-2xl shadow-sm">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="輸入藏文或上傳圖片..."
          disabled={disabled || isProcessing}
          rows={1}
          className="w-full resize-none bg-transparent px-4 pt-3 pb-11 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none disabled:opacity-50 min-h-[44px] max-h-[200px] overflow-y-auto"
        />

        {/* Bottom toolbar */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-2 py-1.5">
          <div className="flex items-center gap-1">
            {/* File upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                const f = Array.from(e.target.files || []);
                if (f.length > 0) addFiles(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isProcessing}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors disabled:opacity-30"
              title="上傳檔案"
            >
              <Paperclip className="w-4 h-4 -rotate-45" />
            </button>

            {/* Camera capture (iPad) */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = Array.from(e.target.files || []);
                if (f.length > 0) addFiles(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => cameraInputRef.current?.click()}
              disabled={disabled || isProcessing}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors disabled:opacity-30"
              title="拍照上傳"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          {/* Send / Stop */}
          {isProcessing ? (
            <button
              onClick={onStop}
              className="p-1.5 rounded-full bg-stone-800 text-white hover:bg-stone-700 transition-colors"
              title="停止"
            >
              <Square className="w-3.5 h-3.5" fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canSend}
              className="p-1.5 rounded-full bg-stone-800 text-white hover:bg-stone-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="傳送"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
