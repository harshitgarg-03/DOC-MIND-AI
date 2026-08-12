"use client";

import { formatFileSize } from "@/lib/utils";
import { PdfPreviewProps } from "@/types/pdf";
import { FileText, ExternalLink, Trash2 } from "lucide-react";

export default function PdfPreview({
  file,
  fileUrl,
  pdfName,
  onRemove,
}: PdfPreviewProps) {
  const name = pdfName || "document.pdf";
  const size = file ? formatFileSize(file.size) : null;

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

      {/* Main Real PDF Content Area */}
      <div className="preview-content">
        <div className="pdf-frame-container">
          <iframe
            src={fileUrl}
            title={`PDF Preview: ${name}`}
            className="pdf-iframe"
          />
        </div>
      </div>
    </div>
  );
}