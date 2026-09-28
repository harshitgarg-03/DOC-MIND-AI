"use client";

import MessageList from "./message_list";
import ChatInput from "./chat_input";
import type { chatPanleProps } from "@/types/pdf";
import { MessageSquare, Layers } from "lucide-react";

export default function ChatPanel({
  messages,
  query,
  isTyping,
  chatEndRef,
  onQueryChange,
  onSend,
  pdfName,
  onCitationClick,
  compareMode,
}: chatPanleProps) {
  const handleChipClick = (text: string) => {
    onQueryChange(text);
    setTimeout(() => {
      onSend();
    }, 100);
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        {compareMode ? <Layers size={16} /> : <MessageSquare size={16} />}
        <span>{compareMode ? "Compare with AI" : "Ask AI Assistant"}</span>
        {compareMode && <span className="chat-header-tag">Strict · PDFs only</span>}
      </div>

      <MessageList
        messages={messages}
        isTyping={isTyping}
        chatEndRef={chatEndRef}
        onChipClick={handleChipClick}
        pdfName={pdfName}
        onCitationClick={onCitationClick}
        compareMode={compareMode}
      />

      <ChatInput
        query={query}
        isTyping={isTyping}
        onChange={onQueryChange}
        onSend={onSend}
      />
    </div>
  );
}
