"use client";

import { Ask_Question, get_Document_Message } from "@/services/pdf-api";
import { Message } from "@/types/pdf";
import { useEffect, useRef, useState } from "react";

const chatCache = new Map<string, Message[]>();

export function usePdfChat(
  pdfName?: string | null,
  documentIds?: string[] | null,
) {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const ids = documentIds && documentIds.length > 0 ? documentIds : null;
  // Compare-mode mein cache-key sorted-joined ids hai, taaki order matter na kare
  const cacheKey = ids ? [...ids].sort().join(",") : null;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [message, isTyping]);

  useEffect(() => {
    if (!cacheKey || !ids) {
      setMessage([]);
      return;
    }

    setMessage(chatCache.get(cacheKey) ?? []);

    // Persisted history sirf single-doc mode mein load hoti hai — DB schema
    // (ChatMessage) per-document hai, compare-mode ki apni history nahi hoti
    if (ids.length === 1) {
      get_Document_Message(ids[0])
        .then((dbMessages) => {
          const history: Message[] = dbMessages.map((m) => ({
            id: m.id,
            role: m.role,
            text: m.text,
            citations: m.citations,
          }));
          setMessage(history);
          chatCache.set(cacheKey, history);
        })
        .catch((error) => {
          console.error("Failed to load chat history:", error);
        });
    }
  }, [cacheKey]);

  const updateMessages = (updater: (prev: Message[]) => Message[]) => {
    if (!cacheKey) return;
    setMessage((prev) => {
      const updated = updater(prev);
      chatCache.set(cacheKey, updated);
      return updated;
    });
  };

  const sendMessage = async () => {
    const text = query.trim();
    if (!text || isTyping) return;

    if (!ids || ids.length === 0) {
      setMessage((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", text },
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: "Koi document select nahi hai — upload karo ya sidebar se select karo.",
        },
      ]);
      setQuery("");
      return;
    }

    const history = message.map(({ role, text }) => ({ role, text }));

    const userMessage: Message = { id: crypto.randomUUID(), role: "user", text };
    updateMessages((prev) => [...prev, userMessage]);
    setQuery("");
    setIsTyping(true);

    const assistantId = crypto.randomUUID();
    updateMessages((prev) => [...prev, { id: assistantId, role: "assistant", text: "" }]);

    let displayed = "";
    let queue = "";
    let citations: Message["citations"];
    let suggestions: Message["suggestions"];
    let streamEnded = false;
    let streamErrored = false;

    const revealTimer = setInterval(() => {
      if (queue.length > 0) {
        const chunk = queue.slice(0, 2);
        queue = queue.slice(2);
        displayed += chunk;

        updateMessages((prev) =>
          prev.map((msg) => (msg.id === assistantId ? { ...msg, text: displayed } : msg)),
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
                text: streamErrored ? "Sorry! Unable to generate response for now." : displayed,
                citations: streamErrored ? undefined : citations,
                suggestions: streamErrored ? undefined : suggestions,
              },
        ),
      );
    }, 16);

    try {
      const stream = Ask_Question(text, ids, history);
      for await (const event of stream) {
        if (event.type === "token") queue += event.value;
        if (event.type === "citations") citations = event.value;
        if (event.type === "suggestions") suggestions = event.value;
      }
    } catch (error) {
      console.error("Chat error:", error);
      streamErrored = true;
      queue = "";
    } finally {
      streamEnded = true;
    }
  };

  return { query, setQuery, message, isTyping, sendMessage, chatEndRef };
}