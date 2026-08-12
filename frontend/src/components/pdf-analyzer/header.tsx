import { HeaderProps } from "@/types/pdf";
import { Menu } from "lucide-react";

export default function Header({
  pdfName,
  isDark,
  onToggleTheme,
  onToggleSidebar,
}: HeaderProps) {
  return (
    <header className="app-header">
      <div className="brand-group">
        <button className="sidebar-toggle" onClick={onToggleSidebar} aria-label="Toggle Sidebar">
          <Menu size={18} />
        </button>
        <div className="brand">
          <div className="brand-icon-wrapper">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span>DocMind AI</span>
        </div>
      </div>

      <div className="header-actions">
        {pdfName && (
          <div className="active-doc-badge">
            <span className="pdf-name" title={pdfName}>
              {pdfName}
            </span>
          </div>
        )}

        <button className="theme-toggle-btn" onClick={onToggleTheme} aria-label="Toggle theme">
          {isDark ? (
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
            </svg>
          ) : (
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}
