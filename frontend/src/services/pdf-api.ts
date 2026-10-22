import { authClient } from "@/lib/auth-client";

const API_URL = process.env.API_URL || "http://127.0.0.1:8000";

// ---------- Auth helpers ----------

export class AuthError extends Error {
  constructor(message = "Session expired. Please sign in again.") {
    super(message);
    this.name = "AuthError";
  }
}

let redirectingToLogin = false;

async function handleSessionExpired() {
  if (typeof window === "undefined" || redirectingToLogin) return;
  redirectingToLogin = true;

  try {
    await authClient.signOut();   
  } catch {
    // signOut fail ho jaaye to bhi niche redirect hoga (?expired=1 loop rokta hai)
  }

  window.location.href = "/login?expired=1";
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data, error } = await authClient.token();

  if (error || !data?.token) {
    await handleSessionExpired();
    throw new AuthError();
  }

  return { Authorization: `Bearer ${data.token}` };
}

async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = {
    ...((init.headers as Record<string, string>) || {}),
    ...(await getAuthHeaders()),
  };

  const res = await fetch(url, { ...init, headers });

  if (res.status === 401) {
    await handleSessionExpired();
    throw new AuthError();
  }

  return res;
}

// ---------- API calls ----------

export async function Upload_Pdf(file: File) {
  const formdata = new FormData();
  formdata.append("file", file);

  const response = await authedFetch(`${API_URL}/upload`, {
    method: "POST",
    body: formdata,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Failed to upload PDF. Please try again.");
  }

  return response.json();
}

export type StreamEvent =
  | { type: "token"; value: string }
  | { type: "citations"; value: import("@/types/pdf").Citation[] }
  | { type: "suggestions"; value: string[] };


export async function* Ask_Question(
  question: string,
  documentIds: string[],
  history: { role: string; text: string }[] = []
): AsyncGenerator<StreamEvent> {
  const formdata = new FormData();

  formdata.append("question", question);
  
  formdata.append("document_ids", JSON.stringify(documentIds));
  formdata.append("history", JSON.stringify(history));

  const response = await authedFetch(`${API_URL}/ask`, {
    method: "POST",
    body: formdata,
  });

  if (!response.ok || !response.body) {
    throw new Error("failed to get response try again .! ");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r\n/g, "\n");

    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const event of events) {
      const lines = event.split("\n");
      const dataLine = lines.find((line) => line.startsWith("data:"));
      if (!dataLine) continue;

      try {
        const data = JSON.parse(dataLine.replace(/^data:\s*/, ""));
        if (data.token) {
          yield { type: "token", value: data.token };
        }
        if (data.citations) {
          yield { type: "citations", value: data.citations };
        }
        if (data.suggestions) {
          yield { type: "suggestions", value: data.suggestions };
        }
        if (data.error) {
          throw new Error(data.error);
        }
      } catch (e) {
        continue;
      }
    }
  }
}

export async function deleteDocument(documentId: string) {
  const res = await authedFetch(`${API_URL}/documents/${documentId}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.detail || "Failed to delete document.");
  }

  return res.json();
}

export async function get_Document_Message(document_id: string) {
  try {
    const res = await authedFetch(`${API_URL}/documents/${document_id}/messages`);

    if (!res.ok) return [];

    const data = await res.json();

    return data.messages as { id: string; role: "user" | "assistant"; text: string; citations?: any[] }[];
  } catch (e) {
    if (e instanceof AuthError) return []; 
    throw e;
  }
}

export async function listDocuments() {
  try {
    const res = await authedFetch(`${API_URL}/documents`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.documents as {
      document_id: string;
      filename: string;
      total_pages: number;
      total_chunks: number;
      file_url: string;
    }[];
  } catch (e) {
    if (e instanceof AuthError) return [];  
    throw e;
  }
}