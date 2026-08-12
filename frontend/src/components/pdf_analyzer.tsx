"use client";

import { useEffect, useState } from "react";
import Header from "./pdf-analyzer/header";
import UploadView from "./pdf-analyzer/upload_view";
import AnalyzerView from "./analyzer_view";

import { useTheme } from "@/hooks/useTheme";
import { usePdf } from "@/hooks/usePdf";
import { usePdfChat } from "@/hooks/use-pdf-chat";

import { Upload_Pdf } from "@/services/pdf-api";
import { FolderOpen, FileText, Trash2, Plus } from "lucide-react";

interface DocumentItem {
  id: string;
  name: string;
  size: number;
  url: string;
}

export default function PdfAnalyzer() {
  const {
    theme,
    isDark,
    toggle_theme,
  } = useTheme();

  const {
    file,
    fileUrl,
    fileName,
    UrlInput,
    setUrlInput,
    UrlError,
    urlLoading,
    handleFileSubmit,
    handleUrlSubmit,
    removePdf,
    setFileUrl,
    setFileName,
    setFile,
  } = usePdf();

  const {
    query,
    setQuery,
    message,
    isTyping,
    sendMessage,
    chatEndRef,
  } = usePdfChat(fileName);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // Sync uploaded/URL files into sidebar history
  useEffect(() => {
    if (fileUrl && fileName) {
      const exists = documents.some(
        (doc) => doc.url === fileUrl || doc.name === fileName
      );
      if (!exists) {
        setDocuments((prev) => [
          {
            id: crypto.randomUUID(),
            name: fileName,
            size: file ? file.size : 150 * 1024, // default fallback size for URLs (150 KB)
            url: fileUrl,
          },
          ...prev,
        ]);
      }
    }
  }, [fileUrl, fileName, file, documents]);

  const handlePdfUpload = async (uploadedFile: File) => {
    handleFileSubmit(uploadedFile);
    try {
      await Upload_Pdf(uploadedFile);
    } catch (error) {
      console.error("PDF upload failed or was simulated:", error);
    }
  };

  return (
    <div className="pdf-analyzer">
      {/* Moving Ambient Glowing Orbs */}
      <div className="ambient-glows">
        <div className="glow-blob glow-blob-1" />
        <div className="glow-blob glow-blob-2" />
        <div className="glow-blob glow-blob-3" />
      </div>

      <Header
        pdfName={fileName}
        isDark={isDark}
        onToggleTheme={toggle_theme}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
      />

      <div className="app-workspace">
        {/* Mobile Sidebar Overlay */}
        <div
          className={`sidebar-overlay ${sidebarOpen ? "show" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Beautiful Glassmorphic Sidebar */}
        <aside className={`app-sidebar ${sidebarOpen ? "open" : ""}`}>
          <div className="sidebar-header">
            <h2 className="sidebar-title">
              <FolderOpen size={14} />
              <span>Workspace Files</span>
            </h2>
          </div>
          <div className="sidebar-content">
            {documents.length === 0 ? (
              <div className="doc-list-empty">
                <FileText size={24} style={{ margin: "0 auto 10px", opacity: 0.4 }} />
                <p>No documents uploaded yet.</p>
              </div>
            ) : (
              documents.map((doc) => (
                <button
                  key={doc.id}
                  className={`doc-item ${fileUrl === doc.url ? "active" : ""}`}
                  onClick={() => {
                    setFileUrl(doc.url);
                    setFileName(doc.name);
                    setFile(null);
                    setSidebarOpen(false);
                  }}
                >
                  <div className="doc-item-info">
                    <FileText size={15} className="doc-item-icon" />
                    <div className="doc-item-meta">
                      <span className="doc-item-name">{doc.name}</span>
                      <span className="doc-item-size">
                        {(doc.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </div>
                  <span
                    className="doc-item-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
                      if (fileUrl === doc.url) {
                        removePdf();
                      }
                    }}
                  >
                    <Trash2 size={13} />
                  </span>
                </button>
              ))
            )}
          </div>
          <div className="sidebar-footer">
            <button
              className="upload-sidebar-btn"
              onClick={() => {
                removePdf();
                setSidebarOpen(false);
              }}
            >
              <Plus size={14} />
              <span>Upload New PDF</span>
            </button>
          </div>
        </aside>

        {/* Main Content Workspace */}
        <main className="main-workspace">
          {!fileUrl ? (
            <UploadView
              onFileSelect={handlePdfUpload}
              urlInput={UrlInput}
              urlError={UrlError}
              urlLoading={urlLoading}
              onUrlChange={setUrlInput}
              onUrlSubmit={handleUrlSubmit}
            />
          ) : (
            <AnalyzerView
              file={file}
              fileUrl={fileUrl}
              pdfName={fileName}
              messages={message}
              query={query}
              isTyping={isTyping}
              chatEndRef={chatEndRef}
              onRemove={removePdf}
              onQueryChange={setQuery}
              onSend={sendMessage}
            />
          )}
        </main>
      </div>
    </div>
  );
}