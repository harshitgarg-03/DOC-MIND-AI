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

// pdf.js worker setup (required for Next.js on the client)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
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

  const [pageNumber, setPageNumber] = useState<number>(1);
  const [pageInput, setPageInput] = useState<string>("1");
  const [inputInvalid, setInputInvalid] = useState<boolean>(false);
  const [scale, setScale] = useState<number>(1.15);

  const docSource = useMemo(() => file ?? fileUrl, [file, fileUrl]);

  // Stable identity: changes only when the actual document changes
  const sourceKey = file
    ? `${file.name}-${file.size}-${file.lastModified}`
    : (fileUrl ?? "");

  // Page count is stored together with the document it belongs to.
  // A different document automatically reads as 0 until its own
  // onLoadSuccess fires, and re-renders or hot reload can never wipe the
  // count of the document that is already loaded.
  const [loadedDoc, setLoadedDoc] = useState<{
    key: string;
    pages: number;
  } | null>(null);
  const numPages = loadedDoc?.key === sourceKey ? loadedDoc.pages : 0;

  // New document -> back to page 1.
  // Keep this ABOVE the activePage effect so a citation jump still wins.
  useEffect(() => {
    setPageNumber(1);
  }, [sourceKey]);

  // New citation click -> jump to that page
  useEffect(() => {
    if (activePage?.page) {
      setPageNumber(activePage.page);
    }
  }, [activePage?.page, activePage?.nonce]);

  // Always keep the page within 1..numPages
  const currentPage =
    numPages > 0
      ? Math.min(Math.max(1, pageNumber), numPages)
      : Math.max(1, pageNumber);

  // Keep the input in sync with the actual page
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  // Clear the red "invalid" state after a short time
  useEffect(() => {
    if (!inputInvalid) return;
    const t = setTimeout(() => setInputInvalid(false), 1200);
    return () => clearTimeout(t);
  }, [inputInvalid]);

  const highlightText = activePage?.highlightText;

  // Highlights matching text spans inside the pdf.js text layer
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

  const goPrev = () => {
    if (currentPage > 1) setPageNumber(currentPage - 1);
  };

  const goNext = () => {
    if (numPages > 0 && currentPage < numPages) setPageNumber(currentPage + 1);
  };

  // Enter or Go button -> validate, then jump directly
  const jumpToPage = () => {
    const n = parseInt(pageInput, 10);

    if (numPages === 0 || Number.isNaN(n) || n < 1 || n > numPages) {
      setInputInvalid(true);
      setPageInput(String(currentPage)); // revert to the current valid page
      return;
    }

    setInputInvalid(false);
    setPageNumber(n);
  };

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
            disabled={currentPage <= 1}
            className="preview-btn"
            title="Previous page"
          >
            <ChevronLeft size={14} />
          </button>

          <span className="preview-page-indicator">
            <input
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") jumpToPage();
              }}
              onFocus={(e) => e.target.select()}
              disabled={numPages === 0}
              inputMode="numeric"
              aria-label="Go to page"
              aria-invalid={inputInvalid}
              title={
                numPages ? `Enter a page between 1 and ${numPages}` : "Loading…"
              }
              style={{
                width: "2.8em",
                textAlign: "center",
                background: "transparent",
                color: inputInvalid ? "#ef4444" : "inherit",
                border: "none",
                borderBottom: `1px solid ${
                  inputInvalid ? "#ef4444" : "currentColor"
                }`,
                font: "inherit",
                outline: "none",
              }}
            />{" "}
            / {numPages || "…"}
          </span>

          <button
            onClick={jumpToPage}
            disabled={numPages === 0}
            className="preview-btn"
            title="Go to page"
          >
            Go
          </button>

          <button
            onClick={goNext}
            disabled={numPages === 0 || currentPage >= numPages}
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

          <button
            onClick={onRemove}
            className="preview-btn danger"
            title="Remove PDF"
          >
            <Trash2 size={14} />
            <span>Close</span>
          </button>
        </div>
      </div>

      {/* Main PDF content area: react-pdf with exact-text highlight */}
      <div className="preview-content">
        <div className="pdf-frame-container pdf-react-container">
          <Document
            key={sourceKey}
            file={docSource}
            onLoadSuccess={({ numPages }) =>
              setLoadedDoc({ key: sourceKey, pages: numPages })
            }
            onLoadError={(err) => console.error("PDF load error:", err)}
            loading={<div className="pdf-loading">Loading PDF…</div>}
            error={<div className="pdf-loading">Failed to load PDF.</div>}
          >
            <Page
              key={activePage?.nonce ?? "default"}
              pageNumber={currentPage}
              scale={scale}
              customTextRenderer={customTextRenderer}
              renderAnnotationLayer={false}
              loading={<div className="pdf-loading">Loading page…</div>}
            />
          </Document>
        </div>
      </div>
    </div>
  );
}