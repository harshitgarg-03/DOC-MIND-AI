"use client";

import { useEffect, useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { formatFileSize } from "@/lib/utils";
import { PdfPreviewProps } from "@/types/pdf";
import {
  FileText,
  ExternalLink,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

// pdf.js worker setup — Next.js client-side ke liye zaroori hai
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export default function PdfPreview({
  file,
  fileUrl,
  pdfName,
  onRemove,
  activePage,
}: PdfPreviewProps) {
  const name = pdfName || "document.pdf";
  const size = file ? formatFileSize(file.size) : null;

  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.15);

  const docSource = useMemo(() => file ?? fileUrl, [file, fileUrl]);

  // Jab bhi ek naya citation click ho (activePage badle), usi page pe jump karo
  useEffect(() => {
    if (activePage?.page) {
      setPageNumber(activePage.page);
    }
  }, [activePage?.page, activePage?.nonce]);

  const highlightText = activePage?.highlightText;

  // pdf.js text-layer ke andar match hone wale text-spans ko highlight karta hai.
  const customTextRenderer = useMemo(() => {
    if (!highlightText) return undefined;

    const needle = highlightText
      .trim()
      .split(/\s+/)
      .slice(0, 12)
      .join(" ")
      .toLowerCase();

    return (textItem: { str: string }) => {
      const hay = textItem.str.toLowerCase().trim();
      if (needle.length > 3 && hay.length > 2 && needle.includes(hay)) {
        return `<mark class="pdf-highlight">${textItem.str}</mark>`;
      }
      return textItem.str;
    };
  }, [highlightText]);

  const goPrev = () => setPageNumber((p) => Math.max(1, p - 1));
  const goNext = () => setPageNumber((p) => Math.min(numPages || p, p + 1));

  return (
    <div className="pdf-preview">
      {/* Premium Toolbar */}
      <div className="preview-toolbar">
        <div className="preview-file-info">
          <FileText size={16} className="text-accent" />
          <span className="preview-file-name" title={name}>
            {name}
          </span>
          {size && <span className="preview-file-size">{size}</span>}
        </div>

        <div className="preview-page-controls">
          <button
            onClick={goPrev}
            disabled={pageNumber <= 1}
            className="preview-btn"
            title="Previous page"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="preview-page-indicator">
            {pageNumber} / {numPages || "…"}
          </span>
          <button
            onClick={goNext}
            disabled={pageNumber >= numPages}
            className="preview-btn"
            title="Next page"
          >
            <ChevronRight size={14} />
          </button>

          <button
            onClick={() => setScale((s) => Math.max(0.6, s - 0.15))}
            className="preview-btn"
            title="Zoom out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={() => setScale((s) => Math.min(2.5, s + 0.15))}
            className="preview-btn"
            title="Zoom in"
          >
            <ZoomIn size={14} />
          </button>
        </div>

        <div className="preview-actions">
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="preview-btn"
            title="Open PDF in new tab"
          >
            <ExternalLink size={14} />
            <span>Open Tab</span>
          </a>

          <button onClick={onRemove} className="preview-btn danger" title="Remove PDF">
            <Trash2 size={14} />
            <span>Close</span>
          </button>
        </div>
      </div>

      {/* Main Real PDF Content Area — react-pdf, exact-text highlight ke sath */}
      <div className="preview-content">
        <div className="pdf-frame-container pdf-react-container">
          <Document
            file={docSource}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            loading={<div className="pdf-loading">Loading PDF…</div>}
            error={<div className="pdf-loading">Failed to load PDF.</div>}
          >
            <Page
              key={`${pageNumber}-${activePage?.nonce ?? "default"}`}
              pageNumber={pageNumber}
              scale={scale}
              customTextRenderer={customTextRenderer}
              renderAnnotationLayer={false}
            />
          </Document>
        </div>
      </div>
    </div>
  );
}