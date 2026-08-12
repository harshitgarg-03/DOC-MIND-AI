"use client";

import { useRef, type DragEvent } from "react";
import { DropZoneProps } from "@/types/pdf";
import { UploadCloud } from "lucide-react";

export default function DropZone({ onFileSelect }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <>
      <div
        className="drop-zone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <div className="drop-zone-icon-pulse">
          <UploadCloud size={32} />
        </div>

        <div className="drop-zone-text-group">
          <h3>Drag & drop your PDF here</h3>
          <p>or click to browse from local files</p>
        </div>

        <button
          className="drop-zone-upload-btn"
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
        >
          Select Document
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onFileSelect(file);
          }
        }}
      />
    </>
  );
}
