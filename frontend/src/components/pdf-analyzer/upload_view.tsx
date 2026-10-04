"use client";

import { UploadViewProps } from "@/types/pdf";
import DropZone from "./dropZone";
import PdfUrlInput from "./pdf_url_input";
import UploadLoader from "./upload_loader";

type Props = UploadViewProps & {
  isUploading?: boolean;
  uploadingFile?: { name: string; size: number } | null;
};

export default function UploadView({
  onFileSelect,
  urlInput,
  urlError,
  urlLoading,
  onUrlChange,
  onUrlSubmit,
  isUploading = false,
  uploadingFile = null,
}: Props) {
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

        {isUploading && uploadingFile ? (
          <UploadLoader
            fileName={uploadingFile.name}
            fileSize={uploadingFile.size}
          />
        ) : (
          <>
            <DropZone onFileSelect={onFileSelect} />

            <PdfUrlInput
              value={urlInput}
              error={urlError}
              loading={urlLoading}
              onChange={onUrlChange}
              onSubmit={onUrlSubmit}
            />
          </>
        )}
      </div>
    </div>
  );
}