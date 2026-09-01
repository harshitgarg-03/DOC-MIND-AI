export type Theme = "dark" | "light";


export interface UploadResponse {
  status: string;
  document_id: string;
  filename: string;
  characters_extracted: number;
  total_pdf_chunks: number;
  total_pages: number;
}


export interface Citation {
  chunk_index: number;
  page: number;
  section: string;
  preview: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  citations?: Citation[];
}

export interface PdfState {
  file: File | null;
  fileUrl: string | null;
  pdfName: string | null;
}

export interface HeaderProps {
  pdfName: string | null;
  isDark: boolean;
  onToggleTheme: () => void;
  onToggleSidebar?: () => void;
}

export interface DropZoneProps {
  onFileSelect: (file: File) => void;
}

export interface PdfUrlInputProps {
  value: string;
  error: string;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}
export interface MessageListProps {
  messages: Message[];
  isTyping: boolean;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  onChipClick?: (text: string) => void;
  pdfName?: string | null;
}
export interface chatINputProps {
  query: string;
  isTyping: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
}
export interface chatPanleProps {
  messages: Message[];
  query: string;
  isTyping: boolean;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  onQueryChange: (value: string) => void;
  onSend: () => void;
  pdfName?: string | null;
}
export interface analyzerProps {
  file: File | null;
  fileUrl: string;
  pdfName: string | null;
  messages: Message[];
  query: string;
  isTyping: boolean;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  fileSize?: number | string | null;

  onRemove: () => void;
  onQueryChange: (value: string) => void;
  onSend: () => void;
}
export interface Props {
  message: Message;
}
export interface UploadViewProps {
  onFileSelect: (file: File) => void;

  urlInput: string;
  urlError: string;
  urlLoading: boolean;

  onUrlChange: (value: string) => void;
  onUrlSubmit: () => void;
}

export interface PdfPreviewProps {
  file: File | null;
  fileUrl: string;
  pdfName: string | null;
  onRemove: () => void;
}
