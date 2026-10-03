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
  const [pageInput, setPageInput] = useState<string>("1");
  const [scale, setScale] = useState<number>(1.15);

  const docSource = useMemo(() => file ?? fileUrl, [file, fileUrl]);

  // Sirf tab page 1 pe jao jab asli document source badle (compare-mode A <-> B).
  // IMPORTANT: yahan numPages ko 0 mat karo. Agar fileUrl badle lekin `file`
  // wahi rahe, to <Document> reload nahi hota, onLoadSuccess dobara nahi chalta,
  // aur total pages hamesha "…" dikhta rehta hai (Next button bhi disabled).
  // Ye effect activePage wale effect se PEHLE hai, taaki citation-click ka
  // page-jump isko override kar sake.
  useEffect(() => {
    setPageNumber(1);
  }, [docSource]);

  // Naya citation click -> usi page pe jump
  useEffect(() => {
    if (activePage?.page) {
      setPageNumber(activePage.page);
    }
  }, [activePage?.page, activePage?.nonce]);

  // Page hamesha 1..numPages ke andar rakho (citation page range se bahar ho to bhi)
  const currentPage =
    numPages > 0
      ? Math.min(Math.max(1, pageNumber), numPages)
      : Math.max(1, pageNumber);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

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

  const goPrev = () => setPageNumber(Math.max(1, currentPage - 1));
  const goNext = () => setPageNumber(Math.min(numPages, currentPage + 1));

  // Page number type karke Enter dabao -> seedha us page pe
  const jumpToPage = () => {
    const n = parseInt(pageInput, 10);
    if (!Number.isNaN(n) && numPages > 0) {
      setPageNumber(Math.min(Math.max(1, n), numPages));
    } else {
      setPageInput(String(currentPage));
    }
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
              onBlur={jumpToPage}
              inputMode="numeric"
              aria-label="Go to page"
              title="Type a page number and press Enter"
              style={{
                width: "2.4em",
                textAlign: "center",
                background: "transparent",
                color: "inherit",
                border: "none",
                borderBottom: "1px solid currentColor",
                font: "inherit",
                outline: "none",
              }}
            />{" "}
            / {numPages || "…"}
          </span>

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
            onLoadError={(err) => console.error("PDF load error:", err)}
            loading={<div className="pdf-loading">Loading PDF…</div>}
            error={<div className="pdf-loading">Failed to load PDF.</div>}
          >
            <Page
              key={`${currentPage}-${activePage?.nonce ?? "default"}`}
              pageNumber={currentPage}
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