"use client";

import { Ask_Question } from "@/services/pdf-api";
import { Message } from "@/types/pdf";
import { useEffect, useRef, useState } from "react";

export function usePdfChat(pdfName?: string | null) {
  const [query, setQuery] = useState<string>("");
  const [message, setMessage] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState<boolean>(false);

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

    setMessage((prev) => [...prev, userMessage]);
    setQuery("");
    setIsTyping(true);

    try {
      const data = await Ask_Question(text);
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: data.answer,
      };
      setMessage((prev) => [...prev, assistantMessage]);
    } catch (error) {
    
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: "sorry! unable to generate response for now",
      };

      setMessage((prev) => [...prev, assistantMessage]);
    } finally {
      setIsTyping(false);
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