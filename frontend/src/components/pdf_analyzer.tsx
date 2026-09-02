"use client";
import { usePdfChat } from "@/hooks/use-pdf-chat";
import { usePdf } from "@/hooks/usePdf";
import { useTheme } from "@/hooks/useTheme";
import { Upload_Pdf } from "@/services/pdf-api";
import { useState } from "react";
import Header from "./pdf-analyzer/header";
import { FileText, FolderOpen, Plus, Trash2 } from "lucide-react";
import UploadView from "./pdf-analyzer/upload_view";
import AnalyzerView from "./analyzer_view";

interface DocumentItem {
  id: string;    
  documentId: string; 
  name: string;
  size: number;
  url: string;
}

export default function PdfAnalyzer() {
  const { theme, isDark, toggle_theme } = useTheme();

  const {
    file, fileUrl, fileName, UrlInput, setUrlInput, UrlError, urlLoading,
    handleFileSubmit, handleUrlSubmit, removePdf, setFileUrl, setFileName, setFile,
  } = usePdf();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);  // NAYA
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  const { query, setQuery, message, isTyping, sendMessage, chatEndRef } =
    usePdfChat(fileName, activeDocumentId);  

  const handlePdfUpload = async (uploadedFile: File) => {
    try {
      const res = await Upload_Pdf(uploadedFile); 
      handleFileSubmit(uploadedFile);  
      setActiveDocumentId(res.document_id);

      setDocuments((prev) => {
        const exists = prev.some((d) => d.documentId === res.document_id);
        if (exists) return prev;
        return [
          {
            id: crypto.randomUUID(),
            documentId: res.document_id,
            name: res.filename,
            size: uploadedFile.size,
            url: URL.createObjectURL(uploadedFile),
          },
          ...prev,
        ];
      });
    } catch (error) {
      console.error("PDF upload failed:", error);
    }
  };

  return (
    <div className="pdf-analyzer">
      {/* ... ambient glows same ... */}

      <Header
        pdfName={fileName}
        isDark={isDark}
        onToggleTheme={toggle_theme}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
      />

      <div className="app-workspace">
        <div className={`sidebar-overlay ${sidebarOpen ? "show" : ""}`} onClick={() => setSidebarOpen(false)} />

        <aside className={`app-sidebar ${sidebarOpen ? "open" : ""}`}>
          <div className="sidebar-header">
            <h2 className="sidebar-title"><FolderOpen size={14} /><span>Workspace Files</span></h2>
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
                  className={`doc-item ${activeDocumentId === doc.documentId ? "active" : ""}`}
                  onClick={() => {
                    setFileUrl(doc.url);
                    setFileName(doc.name);
                    setFile(null);
                    setActiveDocumentId(doc.documentId);   // <-- switch karte waqt documentId bhi badlo
                    setSidebarOpen(false);
                  }}
                >
                  <div className="doc-item-info">
                    <FileText size={15} className="doc-item-icon" />
                    <div className="doc-item-meta">
                      <span className="doc-item-name">{doc.name}</span>
                      <span className="doc-item-size">{(doc.size / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>
                  <span
                    className="doc-item-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
                      if (activeDocumentId === doc.documentId) {
                        removePdf();
                        setActiveDocumentId(null);
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
            <button className="upload-sidebar-btn" onClick={() => { removePdf(); setActiveDocumentId(null); setSidebarOpen(false); }}>
              <Plus size={14} /><span>Upload New PDF</span>
            </button>
          </div>
        </aside>

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
              onRemove={() => { removePdf(); setActiveDocumentId(null); }}
              onQueryChange={setQuery}
              onSend={sendMessage}
            />
          )}
        </main>
      </div>
    </div>
  );
}