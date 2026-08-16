"use client";

import { Ask_Question } from "@/services/pdf-api";
import { Message } from "@/types/pdf";
import { useEffect, useRef, useState } from "react";

export function usePdfChat(pdfName?: string | null) {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [message, isTyping]);

  useEffect(() => {
    setMessage([]);
  }, [pdfName]);

  const sendMessage = async () => {
    const text = query.trim();

    if (!text || isTyping) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text,
    };

    // Add user message
    setMessage((prev) => [...prev, userMessage]);

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

    // Smoothing buffer: raw tokens from the backend arrive in bursts
    // (Gemini often sends a whole sentence in one chunk). We decouple
    // network delivery from what's shown on screen by pushing incoming
    // text into a queue, then draining a few characters at a fixed
    // interval — this is what gives the steady, human-reading-speed
    // "typewriter" feel instead of jumpy bursts.
    let queue = "";
    let displayed = "";
    let streamEnded = false;
    let streamErrored = false;

    const CHARS_PER_TICK = 2; // higher = faster reveal
    const TICK_MS = 16; // ~60fps

    const revealTimer = setInterval(() => {
      if (queue.length > 0) {
        const take = Math.min(CHARS_PER_TICK, queue.length);
        displayed += queue.slice(0, take);
        queue = queue.slice(take);

        setMessage((prev) =>
          prev.map((msg) =>
            msg.id === assistantId ? { ...msg, text: displayed } : msg
          )
        );
      } else if (streamEnded) {
        clearInterval(revealTimer);
        setIsTyping(false);

        if (streamErrored) {
          setMessage((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? { ...msg, text: "Sorry! Unable to generate response for now." }
                : msg
            )
          );
        } else if (pendingCitations?.length) {
          setMessage((prev) =>
            prev.map((msg) =>
              msg.id === assistantId ? { ...msg, citations: pendingCitations } : msg
            )
          );
        }
      }
    }, TICK_MS);

    // Citations arrive as a separate event after all tokens — store them
    // separately and attach to the message once the reveal is complete
    // (attaching mid-reveal would show sources before the answer finishes).
    let pendingCitations: Message["citations"] = undefined;

    try {
      const stream = Ask_Question(text);

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