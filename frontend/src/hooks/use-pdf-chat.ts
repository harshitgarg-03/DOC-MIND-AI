"use client";

import { Ask_Question } from "@/services/pdf-api";
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [message, isTyping]);

  const prevDocIdRef = useRef<string | null | undefined>(documentId) 

  useEffect(() => {
    const prevId = prevDocIdRef.current;

    if (prevId) {
      chatCache.set(prevId, message);   // purana wala save karo before switching
    }

    if (documentId) {
      setMessage(chatCache.get(documentId) ?? []);   // naya wala restore karo
    } else {
      setMessage([]);
    }

    prevDocIdRef.current = documentId;
  }, [documentId]);

  const sendMessage = async () => {
    const text = query.trim();

    if (!text || isTyping) return;

    if (!documentId) {
      setMessage((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", text },
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: "Is PDF ka document_id nahi mila — upload dobara try karo.",
        },
      ]);

      setQuery("");
      return;
    }

    const historyForRequest = message.map((m) => ({ role: m.role, text: m.text }));


    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text,
    };

    setMessage((prev) => {
      const updated = [...prev, userMessage];
      chatCache.set(documentId, updated);   // har update pe cache bhi sync kari
      return updated;
    });

    setQuery("");
    setIsTyping(true);

    // Create ONE assistant message
    const assistantId = crypto.randomUUID();

    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      text: "",
    };

    setMessage((prev) => [...prev, assistantMessage]);

    let queue = "";
    let displayed = "";
    let streamEnded = false;
    let streamErrored = false;

    const CHARS_PER_TICK = 2;
    const TICK_MS = 16;

    const updateAndCache = (updater: (prev: Message[]) => Message[]) => {
      setMessage((prev) => {
        const updated = updater(prev);
        chatCache.set(documentId, updated);   // streaming ke dauraan bhi cache sync
        return updated;
      });
    };


    const revealTimer = setInterval(() => {
      if (queue.length > 0) {
        const take = Math.min(CHARS_PER_TICK, queue.length);
        displayed += queue.slice(0, take);
        queue = queue.slice(take);

        updateAndCache((prev) => prev.map((msg) => (msg.id === assistantId ? { ...msg, text: displayed } : msg)));
      } else if (streamEnded) {
        clearInterval(revealTimer);
        setIsTyping(false);

        if (streamErrored) {
          setMessage((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    text: "Sorry! Unable to generate response for now.",
                  }
                : msg,
            ),
          );
        } else if (pendingCitations?.length) {
          setMessage((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? { ...msg, citations: pendingCitations }
                : msg,
            ),
          );
        }
      }
    }, TICK_MS);

    let pendingCitations: Message["citations"] = undefined;

    try {
      const stream = Ask_Question(text, documentId, historyForRequest);

      for await (const event of stream) {
        if (event.type === "token") {
          queue += event.value; // just fill the queue — the timer above does the revealing
        }
        if (event.type === "citations") {
          pendingCitations = event.value;
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      streamErrored = true;
      queue = ""; // drop whatever was mid-reveal, error message will replace it
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
