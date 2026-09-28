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
import { FileText, FolderOpen, Plus, Trash2, ChevronLeft, ChevronRight, Layers, X, ShieldCheck, Check } from "lucide-react";
import UploadView from "./pdf-analyzer/upload_view";
import AnalyzerView from "./analyzer_view";
import type { ActivePage } from "@/types/pdf";
import { getDocStyle, registerDocs } from "@/lib/doc-colors";
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
  const [compareMode, setCompareMode] = useState<boolean>(false);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  // Compare-mode mein PDF panel kaunsa selected document dikha raha hai
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);

  const handleCitationClick = (page: number, text?: string, documentId?: string) => {
    // Compare-mode: citation jis document ki hai, preview usi pe switch karo
    if (compareMode && documentId && selectedDocumentIds.includes(documentId)) {
      setPreviewDocId(documentId);
    }
    setActivePage({ page, nonce: Date.now(), highlightText: text });
  };

  const toggleCompareSelection = (documentId: string) => {
    setSelectedDocumentIds((prev) =>
      prev.includes(documentId)
        ? prev.filter((id) => id !== documentId)
        : [...prev, documentId],
    );
  };

  const toggleCompareMode = () => {
    setCompareMode((prev) => {
      const next = !prev;
      if (!next) {
        setSelectedDocumentIds([]);
        setPreviewDocId(null);
      } else if (activeDocumentId) {
        // Jo document abhi khula hai use pehle se select kar do
        setSelectedDocumentIds([activeDocumentId]);
        setPreviewDocId(activeDocumentId);
      }
      return next;
    });
  };

  // Preview-doc valid rakho: selected list mein nahi hai to pehla selected lo
  const effectivePreviewId =
    previewDocId && selectedDocumentIds.includes(previewDocId)
      ? previewDocId
      : selectedDocumentIds[0] ?? null;
  const previewDoc = documents.find((d) => d.documentId === effectivePreviewId);

  // Compare-mode ON hai to selected checkboxes wale documents, warna
  // normal single active-document flow (backward-compatible)
  const effectiveDocumentIds = compareMode
    ? selectedDocumentIds
    : activeDocumentId
      ? [activeDocumentId]
      : [];

  const { query, setQuery, message, isTyping, sendMessage, chatEndRef } =
    usePdfChat(fileName, effectiveDocumentIds);

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
      registerDocs(restored.map((d) => d.documentId));
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
      registerDocs([res.document_id]);
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
      setSelectedDocumentIds((prev) => prev.filter((id) => id !== doc.documentId));

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
              className={`compare-mode-btn ${compareMode ? "active" : ""}`}
              onClick={toggleCompareMode}
              disabled={!compareMode && documents.length < 2}
              title={
                documents.length < 2 && !compareMode
                  ? "Upload at least 2 PDFs to compare"
                  : compareMode
                    ? "Exit compare mode"
                    : "Compare multiple PDFs side by side"
              }
            >
              <Layers size={13} />
              <span>{compareMode ? "Exit" : "Compare"}</span>
            </button>
            <button
              className="sidebar-collapse-btn"
              onClick={toggleSidebarCollapse}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft size={14} />
            </button>
          </div>
          {compareMode ? (
            <div className="compare-guide">
              <div className="compare-guide-top">
                <Layers size={13} />
                <strong>Compare mode</strong>
                <span className="compare-guide-count">
                  {selectedDocumentIds.length} selected
                </span>
              </div>
              <p>
                {selectedDocumentIds.length < 2
                  ? "Tick 2 or more PDFs below to start comparing."
                  : "Ready — ask anything about how they differ."}
              </p>
            </div>
          ) : (
            documents.length >= 2 && (
              <button className="compare-teaser" onClick={toggleCompareMode}>
                <Layers size={13} />
                <span>
                  <strong>New:</strong> Compare 2+ PDFs with AI
                </span>
              </button>
            )
          )}
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
                  className={`doc-item ${
                    compareMode
                      ? selectedDocumentIds.includes(doc.documentId) ? "active" : ""
                      : activeDocumentId === doc.documentId ? "active" : ""
                  }`}
                  onClick={() => {
                    if (compareMode) {
                      toggleCompareSelection(doc.documentId);
                      return;
                    }
                    setFileUrl(doc.url);
                    setFileName(doc.name);
                    setFile(null);
                    setActiveDocumentId(doc.documentId);
                    setActivePage(null);
                    setSidebarOpen(false);
                  }}
                >
                  <div className="doc-item-info">
                    {compareMode && (
                      <span
                        className={`compare-check ${
                          selectedDocumentIds.includes(doc.documentId) ? "checked" : ""
                        }`}
                        style={
                          selectedDocumentIds.includes(doc.documentId)
                            ? {
                                background: getDocStyle(doc.documentId).color,
                                borderColor: getDocStyle(doc.documentId).color,
                              }
                            : undefined
                        }
                        aria-hidden="true"
                      >
                        {selectedDocumentIds.includes(doc.documentId) ? (
                          getDocStyle(doc.documentId).letter
                        ) : null}
                      </span>
                    )}
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
          {compareMode && (
            <div className="compare-bar">
              <div className="compare-bar-row">
                <div className="compare-bar-title">
                  <Layers size={14} />
                  <span>Comparing</span>
                </div>
                <div className="compare-bar-chips">
                  {selectedDocumentIds.length === 0 && (
                    <span className="compare-bar-empty">No PDFs selected yet</span>
                  )}
                  {selectedDocumentIds.map((id) => {
                    const doc = documents.find((d) => d.documentId === id);
                    if (!doc) return null;
                    const st = getDocStyle(id);
                    const isViewing = id === effectivePreviewId;
                    return (
                      <div
                        key={id}
                        className={`compare-chip ${isViewing ? "viewing" : ""}`}
                        style={{ borderColor: isViewing ? st.color : undefined }}
                      >
                        <button
                          className="compare-chip-main"
                          onClick={() => {
                            setPreviewDocId(id);
                            setActivePage(null);
                          }}
                          title={`View ${doc.name}`}
                        >
                          <span className="compare-chip-letter" style={{ background: st.color }}>
                            {st.letter}
                          </span>
                          <span className="compare-chip-name">{doc.name}</span>
                        </button>
                        <button
                          className="compare-chip-remove"
                          onClick={() => toggleCompareSelection(id)}
                          title="Remove from comparison"
                          aria-label={`Remove ${doc.name}`}
                        >
                          <X size={11} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <button className="compare-bar-exit" onClick={toggleCompareMode}>
                  <X size={12} />
                  <span>Exit</span>
                </button>
              </div>
              <div className="compare-bar-note">
                <ShieldCheck size={12} />
                <span>
                  Answers use <strong>only the selected PDFs</strong> — no outside
                  knowledge. Click a chip to preview that PDF; source badges (A, B…)
                  show which PDF each point came from.
                </span>
              </div>
            </div>
          )}
          {compareMode && selectedDocumentIds.length < 2 ? (
            <div className="compare-picker">
              <div className="compare-picker-hero">
                <div className="compare-picker-icon">
                  <Layers size={22} />
                </div>
                <h2>Choose PDFs to compare</h2>
                <p>
                  Pick at least 2 documents. Then ask things like “which one is better
                  for an AI/ML role?” or “what are the key differences?”
                </p>
                <div className="compare-picker-progress">
                  <span className={selectedDocumentIds.length >= 1 ? "done" : ""}>1</span>
                  <i />
                  <span className={selectedDocumentIds.length >= 2 ? "done" : ""}>2</span>
                  <em>{selectedDocumentIds.length}/2 selected</em>
                </div>
              </div>
              <div className="compare-picker-grid">
                {documents.map((doc) => {
                  const selected = selectedDocumentIds.includes(doc.documentId);
                  const st = getDocStyle(doc.documentId);
                  return (
                    <button
                      key={doc.id}
                      className={`compare-card ${selected ? "selected" : ""}`}
                      style={selected ? { borderColor: st.color } : undefined}
                      onClick={() => toggleCompareSelection(doc.documentId)}
                    >
                      <span
                        className="compare-card-badge"
                        style={selected ? { background: st.color, borderColor: st.color } : undefined}
                      >
                        {selected ? st.letter : <Check size={12} style={{ opacity: 0 }} />}
                      </span>
                      <FileText size={18} className="compare-card-icon" />
                      <span className="compare-card-name">{doc.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : !fileUrl && !compareMode ? (
            <UploadView
              onFileSelect={handlePdfUpload}
              urlInput={UrlInput}
              urlError={UrlError}
              urlLoading={urlLoading}
              onUrlChange={setUrlInput}
              onUrlSubmit={handleUrlSubmit}
            />
          ) : (
            <div className="main-analyzer-slot">
              <AnalyzerView
                file={compareMode ? null : file}
                fileUrl={compareMode ? previewDoc?.url ?? "" : fileUrl}
                pdfName={compareMode ? previewDoc?.name ?? null : fileName}
                compareMode={compareMode}
                messages={message}
                query={query}
                isTyping={isTyping}
                chatEndRef={chatEndRef}
                activePage={activePage}
                onCitationClick={handleCitationClick}
                onRemove={() => {
                  if (compareMode) {
                    toggleCompareMode();
                  } else {
                    removePdf();
                    setActiveDocumentId(null);
                    setActivePage(null);
                  }
                }}
                onQueryChange={setQuery}
                onSend={sendMessage}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
