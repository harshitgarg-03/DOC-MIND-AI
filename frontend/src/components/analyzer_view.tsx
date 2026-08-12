"use client";

import PdfPreview from "./pdf-analyzer/pdf_preview";
import ChatPanel from "./chat/chat_panel";
import type { analyzerProps, Message } from "@/types/pdf";

export default function AnalyzerView(props: analyzerProps) {
  return (
    <div className="analyzer-grid">
      <PdfPreview
        file={props.file}
        fileUrl={props.fileUrl}
        pdfName={props.pdfName}
        onRemove={props.onRemove}
      />

      <ChatPanel
        messages={props.messages}
        query={props.query}
        isTyping={props.isTyping}
        chatEndRef={props.chatEndRef}
        onQueryChange={props.onQueryChange}
        onSend={props.onSend}
        pdfName={props.pdfName}
      />
    </div>
  );
}