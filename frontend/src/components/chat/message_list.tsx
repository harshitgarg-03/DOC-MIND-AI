"use client";

import type { MessageListProps } from "@/types/pdf";
import ChatMessage from "./chat_message";
import { Sparkles, MessageSquare, Layers } from "lucide-react";

export default function MessageList({
  messages,
  isTyping,
  chatEndRef,
  onChipClick,
  pdfName,
  onCitationClick,
  compareMode,
}: MessageListProps) {
  const name = pdfName || "document.pdf";
  const chips = compareMode ? getCompareChips() : getSuggestedChips();

  return (
    <div className="message-list">
      {messages.length === 0 && (
        <div className="empty-chat">
          <div className="empty-chat-content">
            <div className="empty-icon-pill">
              {compareMode ? <Layers size={20} /> : <Sparkles size={20} />}
            </div>
            <h3 className="empty-chat-title">
              {compareMode ? "Compare your PDFs" : "AI Assistant Ready"}
            </h3>
            <p className="empty-chat-desc">
              {compareMode ? (
                <>
                  Ask how the selected documents differ, which one fits better, or
                  what they have in common. Answers use <strong>only these PDFs</strong>
                  {" "}— no outside knowledge.
                </>
              ) : (
                <>
                  Ask questions, analyze key data, or summarize <strong>{name}</strong>. Select a suggested prompt below to start.
                </>
              )}
            </p>

            {onChipClick && (
              <div className="suggested-chips-container">
                <span className="suggested-chips-title">
                  {compareMode ? "Try comparing" : "Suggested Prompts"}
                </span>
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
        <ChatMessage key={msg.id} message={msg} onCitationClick={onCitationClick} onSuggestionClick={onChipClick} />
        
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

function getCompareChips(): string[] {
  return [
    "What are the key differences between these documents?",
    "Which document is stronger overall, and why?",
    "What do these documents have in common?",
    "Compare the skills and experience mentioned in each.",
  ];
}

function getSuggestedChips(): string[] {
  return [
    "Summarize this document in 3 bullet points.",
    "What are the main topics or sections in this file?",
    "What are the key findings and conclusions?",
    "Are there any important dates or numbers listed?",
  ];
}