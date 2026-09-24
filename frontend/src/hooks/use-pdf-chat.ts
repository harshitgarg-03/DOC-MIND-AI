"use client";

import { Ask_Question, get_Document_Message} from "@/services/pdf-api";
import { Message } from "@/types/pdf";
import { useEffect, useRef, useState } from "react";

const chatCache = new Map<string, Message[]>();

export function usePdfChat(
  pdfName?: string | null,
  documentId?: string | null,
) {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll to latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [message, isTyping]);

  // Load history when PDF changes
  useEffect(() => {
    if (!documentId) {
      setMessage([]);
      return;
    }

    // Show cache immediately
    setMessage(chatCache.get(documentId) ?? []);

    // Then load latest history from DB
    get_Document_Message(documentId)
      .then((dbMessages) => {
        const history: Message[] = dbMessages.map((m) => ({
          id: m.id,
          role: m.role,
          text: m.text,
          citations: m.citations,
        }));

        setMessage(history);
        chatCache.set(documentId, history);
      })
      .catch((error) => {
        console.error("Failed to load chat history:", error);
      });
  }, [documentId]);

  // Update message state + cache together
  const updateMessages = (
    updater: (prev: Message[]) => Message[],
  ) => {
    if (!documentId) return;

    setMessage((prev) => {
      const updated = updater(prev);
      chatCache.set(documentId, updated);
      return updated;
    });
  };

  const sendMessage = async () => {
    const text = query.trim();

    if (!text || isTyping) return;

    if (!documentId) {
      setMessage((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "user",
          text,
        },
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: "Is PDF ka document_id nahi mila — upload dobara try karo.",
        },
      ]);

      setQuery("");
      return;
    }

    // Previous messages → RAG history
    const history = message.map(({ role, text }) => ({
      role,
      text,
    }));

    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text,
    };

    updateMessages((prev) => [...prev, userMessage]);
    setQuery("");
    setIsTyping(true);

    // Add empty assistant message
    const assistantId = crypto.randomUUID();

    updateMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        text: "",
      },
    ]);

    let displayed = "";
    let queue = "";
    let citations: Message["citations"];
    let suggestions: Message["suggestions"];
    let streamEnded = false;
    let streamErrored = false;

    // Reveal streamed text gradually
    const revealTimer = setInterval(() => {
      if (queue.length > 0) {
        const chunk = queue.slice(0, 2);
        queue = queue.slice(2);
        displayed += chunk;

        updateMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, text: displayed }
              : msg,
          ),
        );

        return;
      }

      if (!streamEnded) return;

      clearInterval(revealTimer);
      setIsTyping(false);

      updateMessages((prev) =>
        prev.map((msg) =>
          msg.id !== assistantId
            ? msg
            : {
                ...msg,
                text: streamErrored
                  ? "Sorry! Unable to generate response for now."
                  : displayed,
                citations: streamErrored ? undefined : citations,
                suggestions: streamErrored ? undefined : suggestions, 
              },
        ),
      );
    }, 16);

    try {
      const stream = Ask_Question(text, documentId, history);

      for await (const event of stream) {
        if (event.type === "token") {
          queue += event.value;
        }

        if (event.type === "citations") {
          citations = event.value;
        }
        if (event.type === "suggestions") {  
          suggestions = event.value;
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      streamErrored = true;
      queue = "";
    } finally {
      streamEnded = true;
    }
  };

  return {
    query,
    setQuery,
    message,
    isTyping,
    sendMessage,
    chatEndRef,
  };
}
