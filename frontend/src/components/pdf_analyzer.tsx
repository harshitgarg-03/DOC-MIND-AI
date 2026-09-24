"use client";
import { usePdfChat } from "@/hooks/use-pdf-chat";
import { usePdf } from "@/hooks/usePdf";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/hooks/useToast";
import { authClient } from "@/lib/auth-client";
import { deleteDocument, listDocuments, Upload_Pdf } from "@/services/pdf-api";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "./pdf-analyzer/header";
import { FileText, FolderOpen, Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import UploadView from "./pdf-analyzer/upload_view";
import AnalyzerView from "./analyzer_view";
import type { ActivePage } from "@/types/pdf";
// import { authClient } from "@/lib/auth-client";

interface DocumentItem {
  id: string;
  documentId: string;
  name: string;
  size: number;
  url: string;
}

const API_URL = process.env.API_URL || "http://127.0.0.1:8000";

export default function PdfAnalyzer() {
  const { theme, isDark, toggle_theme } = useTheme();
  const { showToast } = useToast();
  const router = useRouter();

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

  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [activePage, setActivePage] = useState<ActivePage | null>(null);

  const handleCitationClick = (page: number, text?: string) => {
    setActivePage({ page, nonce: Date.now(), highlightText: text });
  };

  const { query, setQuery, message, isTyping, sendMessage, chatEndRef } =
    usePdfChat(fileName, activeDocumentId);

  useEffect(() => {
    const savedId = localStorage.getItem("activeDocumentId");
    if (savedId) setActiveDocumentId(savedId);
  }, []);

  useEffect(() => {
    if (activeDocumentId) {
      localStorage.setItem("activeDocumentId", activeDocumentId);
    } else {
      localStorage.removeItem("activeDocumentId");
    }
  }, [activeDocumentId]);

  useEffect(() => {
    if (sessionLoading || !session) return;
    listDocuments().then((docs) => {
      const restored: DocumentItem[] = docs.map((d) => ({
        id: crypto.randomUUID(),
        documentId: d.document_id,
        name: d.filename,
        size: 0,
        url: `${API_URL}${d.file_url}`,
      }));
      setDocuments(restored);

      // NEW: re-select the previously active doc, if it still exists
      const savedId = localStorage.getItem("activeDocumentId");
      if (savedId) {
        const match = restored.find((d) => d.documentId === savedId);
        if (match) {
          setFileUrl(match.url);
          setFileName(match.name);
          setFile(null);
          setActiveDocumentId(match.documentId);
        } else {
          localStorage.removeItem("activeDocumentId");
        }
      }
    });
  }, [sessionLoading, session]);

  const handlePdfUpload = async (uploadedFile: File) => {
    try {
      const res = await Upload_Pdf(uploadedFile);
      handleFileSubmit(uploadedFile);
      setActiveDocumentId(res.document_id);
      setActivePage(null);

      setDocuments((prev) => {
        const exists = prev.some((d) => d.documentId === res.document_id);
        if (exists) return prev;
        return [
          {
            id: crypto.randomUUID(),
            documentId: res.document_id,
            name: res.filename,
            size: uploadedFile.size,
            url: `${API_URL}/files/${res.document_id}.pdf`,
          },
          ...prev,
        ];
      });

      showToast(`"${res.filename}" uploaded successfully`, "success");
    } catch (error: any) {
      console.error("PDF upload failed:", error);
      showToast(
        error.message || "Something went wrong while uploading the PDF.",
        "error",
      );
    }
  };

  const handleDeleteDocument = async (doc: DocumentItem) => {
    try {
      await deleteDocument(doc.documentId);

      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));

      if (activeDocumentId === doc.documentId) {
        removePdf();
        setActiveDocumentId(null);
      }

      showToast(`"${doc.name}" deleted`, "success");
    } catch (error: any) {
      console.error("Delete failed:", error);
      showToast(error.message || "Failed to delete document.", "error");
    }
  };

  const handleLogout = async () => {
    try {
      await authClient.signOut();
      localStorage.removeItem("activeDocumentId");
      showToast("Logged out successfully", "success");
      router.push("/login");
      router.refresh();
    } catch (error: any) {
      console.error("Logout failed:", error);
      showToast(error.message || "Failed to log out. Please try again.", "error");
    }
  };

  // Desktop collapse-state ko remember karo, taaki refresh pe wapas na khule
  useEffect(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    if (saved === "true") setSidebarCollapsed(true);
  }, []);

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebarCollapsed", String(next));
      return next;
    });
  };

  return (
    <div className="pdf-analyzer">
      <Header
        pdfName={fileName}
        isDark={isDark}
        onToggleTheme={toggle_theme}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        onLogout={handleLogout}
      />

      <div className="app-workspace">
        <div
          className={`sidebar-overlay ${sidebarOpen ? "show" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />

        <aside className={`app-sidebar ${sidebarOpen ? "open" : ""} ${sidebarCollapsed ? "collapsed" : ""}`}>
          <div className="sidebar-header">
            <h2 className="sidebar-title">
              <FolderOpen size={14} />
              <span>Workspace Files</span>
            </h2>
            <button
              className="sidebar-collapse-btn"
              onClick={toggleSidebarCollapse}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft size={14} />
            </button>
          </div>
          <div className="sidebar-content">
            {documents.length === 0 ? (
              <div className="doc-list-empty">
                <FileText
                  size={24}
                  style={{ margin: "0 auto 10px", opacity: 0.4 }}
                />
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
                    setActiveDocumentId(doc.documentId);
                    setActivePage(null);
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
                      handleDeleteDocument(doc);
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
                setActiveDocumentId(null);
                setSidebarOpen(false);
              }}
            >
              <Plus size={14} />
              <span>Upload New PDF</span>
            </button>
          </div>
        </aside>

        {sidebarCollapsed && (
          <button
            className="sidebar-expand-btn"
            onClick={toggleSidebarCollapse}
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <ChevronRight size={14} />
          </button>
        )}

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
              activePage={activePage}
              onCitationClick={handleCitationClick}
              onRemove={() => {
                removePdf();
                setActiveDocumentId(null);
                setActivePage(null);
              }}
              onQueryChange={setQuery}
              onSend={sendMessage}
            />
          )}
        </main>
      </div>
    </div>
  );
}
