"use client";

import { chatINputProps } from "@/types/pdf";
import { Send } from "lucide-react";
import { useEffect, useRef } from "react";

export default function ChatInput({
  query,
  isTyping,
  onChange,
  onSend,
}: chatINputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-expand textarea height as content grows
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.min(scrollHeight, 180)}px`; // cap height at 180px
    }
  }, [query]);

  return (
    <div className="chat-input-container">
      <form
        className="chat-input-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
      >
        <textarea
          ref={textareaRef}
          value={query}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder="Ask anything about this PDF…"
          rows={1}
        />

        <button
          className="send-button"
          type="submit"
          disabled={!query.trim() || isTyping}
          aria-label="Send message"
        >
          <Send size={14} />
        </button>
      </form>

      <p className="chat-hint">
        Enter to send · Shift+Enter for newline
      </p>
    </div>
  );
}