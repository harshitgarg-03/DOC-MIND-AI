"use client";

import { PdfUrlInputProps } from "@/types/pdf";
import { Globe, Loader2, AlertCircle } from "lucide-react";

export default function PdfUrlInput({
  value,
  error,
  loading,
  onChange,
  onSubmit,
}: PdfUrlInputProps) {
  return (
    <div className="url-section">
      <div className="url-divider">
        <div className="url-divider-line"></div>
        <span>or paste remote link</span>
        <div className="url-divider-line"></div>
      </div>

      <div className="url-input-wrapper">
        <Globe size={16} style={{ opacity: 0.6 }} />
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSubmit();
            }
          }}
          placeholder="https://example.com/financial_document.pdf"
        />

        <button
          onClick={onSubmit}
          disabled={!value.trim() || loading}
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            "Analyze Link"
          )}
        </button>
      </div>

      {error && (
        <p className="url-error">
          <AlertCircle size={12} />
          {error}
        </p>
      )}

      <p className="url-help">
        Supports any publicly accessible PDF document URL
      </p>
    </div>
  );
}