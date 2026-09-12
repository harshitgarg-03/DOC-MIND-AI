// import { buffer } from "stream/consumers";

const API_URL = process.env.API_URL || "http://127.0.0.1:8000";

export async function Upload_Pdf(file: File) {
  const formdata = new FormData();

  formdata.append("file", file);

  // console.log("api url :: ", API_URL)
  // print("api url is :: ", API_URL);
  const response = await fetch(`${API_URL}/upload`, {
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
  | { type: "citations"; value: import("@/types/pdf").Citation[] };

export async function* Ask_Question(
  question: string, documentId: string, history: {role: string, text:string}[] = []
): AsyncGenerator<StreamEvent> {
  const formdata = new FormData();

  formdata.append("question", question);
  formdata.append("document_id", documentId);
  formdata.append("history", JSON.stringify(history));

  const response = await fetch(`${API_URL}/ask`, {
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
      // Block ke andar se "data:" wali line nikalo, poore block ka check mat karo
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
        if (data.error) {
          throw new Error(data.error);
        }
      } catch (e) {
        // incomplete JSON chunk — skip, agla read pe complete hoga
        continue;
      }
    }
  }
}


export async function get_Document_Message(document_id: string){
  const res = await fetch(`${API_URL}/documents/${document_id}/messages`)

  if(!res.ok) return []

  const data = await res.json()

  return data.messages as { id: string; role: "user" | "assistant"; text: string; citations?: any[] }[];
}