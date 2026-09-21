"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PdfPreview from "./pdf-analyzer/pdf_preview";
import ChatPanel from "./chat/chat_panel";
import type { analyzerProps } from "@/types/pdf";

const MIN_PCT = 28;
const MAX_PCT = 74;
const STORAGE_KEY = "analyzer-split-ratio";

export default function AnalyzerView(props: analyzerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const [leftPct, setLeftPct] = useState<number>(55);
  const [isDesktop, setIsDesktop] = useState(true);

  // Saved split-ratio load karo (sirf client pe, SSR-safe)
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = parseFloat(saved);
      if (!Number.isNaN(parsed)) setLeftPct(parsed);
    }

    const mq = window.matchMedia("(min-width: 901px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let pct = ((e.clientX - rect.left) / rect.width) * 100;
    pct = Math.min(MAX_PCT, Math.max(MIN_PCT, pct));
    setLeftPct(pct);
  }, []);

  const stopDragging = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    setLeftPct((current) => {
      localStorage.setItem(STORAGE_KEY, String(current));
      return current;
    });
  }, []);

  const startDragging = () => {
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopDragging);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopDragging);
    };
  }, [handleMouseMove, stopDragging]);

  return (
    <div
      className="analyzer-grid"
      ref={containerRef}
      style={
        isDesktop
          ? { gridTemplateColumns: `${leftPct}% 6px ${100 - leftPct}%` }
          : undefined
      }
    >
      <PdfPreview
        file={props.file}
        fileUrl={props.fileUrl}
        pdfName={props.pdfName}
        onRemove={props.onRemove}
        activePage={props.activePage}
      />

      {isDesktop && (
        <div
          className="analyzer-resizer"
          onMouseDown={startDragging}
          role="separator"
          aria-orientation="vertical"
          title="Drag to resize"
        />
      )}

      <ChatPanel
        messages={props.messages}
        query={props.query}
        isTyping={props.isTyping}
        chatEndRef={props.chatEndRef}
        onQueryChange={props.onQueryChange}
        onSend={props.onSend}
        pdfName={props.pdfName}
        onCitationClick={props.onCitationClick}
      />
    </div>
  );
}