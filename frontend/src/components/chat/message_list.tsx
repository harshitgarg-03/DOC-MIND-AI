"use client";

import type { MessageListProps } from "@/types/pdf";
import ChatMessage from "./chat_message";
import { Sparkles, MessageSquare } from "lucide-react";

export default function MessageList({
  messages,
  isTyping,
  chatEndRef,
  onChipClick,
  pdfName,
}: MessageListProps) {
  const name = pdfName || "document.pdf";
  const chips = getSuggestedChips();

  return (
    <div className="message-list">
      {messages.length === 0 && (
        <div className="empty-chat">
          <div className="empty-chat-content">
            <div className="empty-icon-pill">
              <Sparkles size={20} />
            </div>
            <h3 className="empty-chat-title">
              AI Assistant Ready
            </h3>
            <p className="empty-chat-desc">
              Ask questions, analyze key data, or summarize <strong>{name}</strong>. Select a suggested prompt below to start.
            </p>

            {onChipClick && (
              <div className="suggested-chips-container">
                <span className="suggested-chips-title">Suggested Prompts</span>
                <div className="suggested-chips-list">
                  {chips.map((chip, idx) => (
                    <button
                      key={idx}
                      className="suggested-chip"
                      onClick={() => onChipClick(chip)}
                    >
                      <MessageSquare size={11} style={{ opacity: 0.7 }} />
                      <span>{chip}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}

      {isTyping && <TypingIndicator />}

      <div ref={chatEndRef} />
    </div>
  );
}

const TypingIndicator = () => (
  <div className="typing-indicator-box">
    <span className="typing-indicator-label">
      AI Thinking
    </span>
    <div className="typing-dots">
      <div className="typing-dot" />
      <div className="typing-dot" />
      <div className="typing-dot" />
    </div>
  </div>
);

function getSuggestedChips(): string[] {
  return [
    "Summarize this document in 3 bullet points.",
    "What are the main topics or sections in this file?",
    "What are the key findings and conclusions?",
    "Are there any important dates or numbers listed?",
  ];
}