"use client";

import type { Props } from "@/types/pdf";
import { User, Sparkles } from "lucide-react";
import React from "react";

export default function ChatMessage({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`message ${isUser ? "message-user" : "message-ai"}`}>
      <div className="message-avatar-bar">
        <div className="message-avatar">
          {isUser ? (
            <User size={13} />
          ) : (
            <Sparkles size={13} />
          )}
        </div>
        <span className="message-role-label">
          {isUser ? "You" : "DocMind AI"}
        </span>
      </div>

      <div className="message-content">
        {formatMessageText(message.text)}
      </div>

      {!isUser && message.citations && message.citations.length > 0 && (
        <div className="message-citations">
          <span className="message-citations-label">Sources</span>
          <div className="message-citations-list">
            {message.citations.map((c) => (
              <div key={c.chunk_index} className="message-citation-chip" title={c.preview}>
                <span className="message-citation-index">{c.chunk_index + 1}</span>
                <span className="message-citation-preview">{c.preview}</span>
              </div>
            ))}
          </div>
        </div>
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