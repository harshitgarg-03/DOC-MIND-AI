"use client";

import type { Props } from "@/types/pdf";
import { User, Sparkles, Copy, Check } from "lucide-react";
import React, { useState } from "react";

export default function ChatMessage({
  message,
  onCitationClick,
  onSuggestionClick,
}: Props) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  return (
    <div className={`message ${isUser ? "message-user" : "message-ai"}`}>
      <div className="message-avatar-bar">
        <div className="message-avatar">
          {isUser ? <User size={13} /> : <Sparkles size={13} />}
        </div>
        <span className="message-role-label">
          {isUser ? "You" : "DocMind AI"}
        </span>
      </div>

      <div className="message-content">{formatMessageText(message.text)}</div>

      {!isUser && message.citations && message.citations.length > 0 && (
        <div className="message-citations">
          <span className="message-citations-label">Sources</span>
          <div className="message-citations-list">
            {message.citations.map((c) => (
              <div
                className="message-citation-chip message-citation-chip-clickable"
                key={c.chunk_index}
                title={c.preview}
                onClick={() => onCitationClick?.(c.page, c.text)}
                role="button"
                tabIndex={0}
              >
                <span className="message-citation-index">
                  {c.chunk_index + 1}
                </span>
                <span className="message-citation-preview">
                  {c.page} · {c.section}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isUser && message.suggestions && message.suggestions.length > 0 && (
        <div className="message-suggestions">
          {message.suggestions.map((s, idx) => (
            <button
              key={idx}
              className="suggested-chip"
              onClick={() => onSuggestionClick?.(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {message.text && !(!isUser && !message.text.trim()) && (
        <button
          className="message-copy-btn"
          onClick={handleCopy}
          title={copied ? "Copied!" : "Copy"}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      )}
    </div>
  );
}

function formatMessageText(text: string) {
  const lines = text.split("\n");

  return lines.map((line, index) => {
    if (line.trim().startsWith("```")) return null;

    const isBullet = line.startsWith("- ") || line.startsWith("* ");
    const isNumbered = line.match(/^\d+\.\s/);

    const contentText = isBullet
      ? line.substring(2)
      : isNumbered
        ? line.replace(/^\d+\.\s/, "")
        : line;

    const formattedContent = parseInlineMarkdown(contentText);

    if (isBullet) {
      return (
        <li key={index} className="message-list-bullet">
          {formattedContent}
        </li>
      );
    }

    if (isNumbered) {
      return (
        <li key={index} className="message-list-numbered">
          {formattedContent}
        </li>
      );
    }

    return (
      <p key={index} className="message-paragraph">
        {formattedContent}
      </p>
    );
  });
}

function parseInlineMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={idx} className="message-inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
