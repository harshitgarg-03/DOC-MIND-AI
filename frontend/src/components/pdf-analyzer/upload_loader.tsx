"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { formatFileSize } from "@/lib/utils";

interface UploadLoaderProps {
  fileName: string;
  fileSize?: number;
} 

function formatElapsed(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function UploadLoader({ fileName, fileSize }: UploadLoaderProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="ul-card" role="status" aria-live="polite">
      <div className="ul-ring">
        <div className="ul-ring-track" />
        <div className="ul-ring-spinner" />
        <div className="ul-ring-icon">
          <FileText size={22} />
        </div>
      </div>

      <h3 className="ul-title">Processing your PDF</h3>
      <p className="ul-sub">Reading pages and building the search index</p>

      <div className="ul-file">
        <FileText size={14} />
        <span className="ul-file-name" title={fileName}>
          {fileName}
        </span>
        {fileSize ? <span className="ul-file-size">{formatFileSize(fileSize)}</span> : null}
      </div>

      <div className="ul-bar" aria-hidden="true" />

      <div className="ul-meta">
        <span>Please keep this tab open</span>
        <span className="ul-timer">{formatElapsed(elapsed)}</span>
      </div>

      {elapsed >= 15 && (
        <p className="ul-hint">
          Large PDFs are split into many chunks and indexed, so this can take a
          few minutes. Your chat will open automatically when it&apos;s ready.
        </p>
      )}
    </div>
  );
}