"use client";

import MessageList from "./message_list";
import ChatInput from "./chat_input";
import type { chatPanleProps } from "@/types/pdf";
import { MessageSquare } from "lucide-react";

export default function ChatPanel({
  messages,
  query,
  isTyping,
  chatEndRef,
  onQueryChange,
  onSend,
  pdfName,
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
        <MessageSquare size={16} />
        <span>Ask AI Assistant</span>
      </div>

      <MessageList
        messages={messages}
        isTyping={isTyping}
        chatEndRef={chatEndRef}
        onChipClick={handleChipClick}
        pdfName={pdfName}
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