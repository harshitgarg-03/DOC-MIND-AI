"use client";

import { UploadViewProps } from "@/types/pdf";
import DropZone from "./dropZone";
import PdfUrlInput from "./pdf_url_input";

export default function UploadView({
  onFileSelect,
  urlInput,
  urlError,
  urlLoading,
  onUrlChange,
  onUrlSubmit,
}: UploadViewProps) {
  return (
    <div className="upload-view">
      <div className="upload-container">
        <div className="upload-heading">
          <h1>
            Analyze <span>Documents</span>
            <br />
            with Instant AI
          </h1>
          <p>
            Drop your PDF or enter a link to summarize, analyze, and query files instantly.
          </p>
        </div>

        <DropZone onFileSelect={onFileSelect} />

        <PdfUrlInput
          value={urlInput}
          error={urlError}
          loading={urlLoading}
          onChange={onUrlChange}
          onSubmit={onUrlSubmit}
        />
      </div>
    </div>
  );
}