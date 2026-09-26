// import { buffer } from "stream/consumers";

import { authClient } from "@/lib/auth-client";

const API_URL = process.env.API_URL || "http://127.0.0.1:8000";

export async function Upload_Pdf(file: File) {
  const formdata = new FormData();

  formdata.append("file", file);

  // console.log("api url :: ", API_URL)
  // print("api url is :: ", API_URL);
  const response = await fetch(`${API_URL}/upload`, {
    method: "POST",
    headers: await getAuthHeaders(), 
    body: formdata,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Failed to upload PDF. Please try again.");
  }

  return response.json();
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await authClient.token();   
  // console.log("JWT TOKEN IS :::", data?.token);

  return data?.token ? { Authorization: `Bearer ${data.token}` } : {};
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
  // Hamesha document_ids (array) bhejo — single-doc case bhi ek-element
  // array hi hota hai. Backend dono handle karta hai.
  formdata.append("document_ids", JSON.stringify(documentIds));
  formdata.append("history", JSON.stringify(history));

  const response = await fetch(`${API_URL}/ask`, {
    method: "POST",
    headers: await getAuthHeaders(),
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
  const res = await fetch(`${API_URL}/documents/${documentId}`, {
    method: "DELETE",
    headers: await getAuthHeaders()
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.detail || "Failed to delete document.");
  }

  return res.json();
}

export async function get_Document_Message(document_id: string){
  const res = await fetch(`${API_URL}/documents/${document_id}/messages`, {headers: await getAuthHeaders()})

  if(!res.ok) return []

  const data = await res.json()

  return data.messages as { id: string; role: "user" | "assistant"; text: string; citations?: any[] }[];
}

export async function listDocuments() {
  const res = await fetch(`${API_URL}/documents`, {headers: await getAuthHeaders()});
  if (!res.ok) return [];
  const data = await res.json();
  return data.documents as {
    document_id: string;
    filename: string;
    total_pages: number;
    total_chunks: number;
    file_url: string;
  }[];
}