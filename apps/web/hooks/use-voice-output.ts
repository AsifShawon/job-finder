"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type VoiceStatus = "idle" | "loading" | "speaking" | "paused";

interface SpeakOptions {
  messageId?: number;
  preferRemote?: boolean;
}

export function useVoiceOutput(locale: "bn" | "en") {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [speakingMessageId, setSpeakingMessageId] = useState<number | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    setIsSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      window.speechSynthesis?.cancel();
      audioRef.current?.pause();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    audioRef.current?.pause();
    setStatus("idle");
    setSpeakingMessageId(null);
  }, []);

  const pause = useCallback(() => {
    if (status !== "speaking") {
      return;
    }
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    } else {
      window.speechSynthesis?.pause();
    }
    setStatus("paused");
  }, [status]);

  const resume = useCallback(() => {
    if (status !== "paused") {
      return;
    }
    if (audioRef.current?.paused) {
      void audioRef.current.play().catch(() => setStatus("idle"));
    } else {
      window.speechSynthesis?.resume();
    }
    setStatus("speaking");
  }, [status]);

  const speakWithRemoteTts = useCallback(async (text: string, messageId?: number) => {
    setStatus("loading");
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 2000), lang: locale }),
    });
    if (!response.ok) {
      throw new Error("tts_failed");
    }
    const blob = await response.blob();
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onplaying = () => {
      setStatus("speaking");
      setSpeakingMessageId(messageId ?? null);
    };
    audio.onpause = () => {
      if (!audio.ended) {
        setStatus("paused");
      }
    };
    audio.onended = () => {
      setStatus("idle");
      setSpeakingMessageId(null);
    };
    audio.onerror = () => {
      setStatus("idle");
      setSpeakingMessageId(null);
    };
    await audio.play();
  }, [locale]);

  const speak = useCallback(async (text: string, options: SpeakOptions = {}) => {
    const clean = text.trim();
    if (!clean) {
      return;
    }
    stop();

    if (!options.preferRemote && typeof window !== "undefined" && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = locale === "bn" ? "bn-BD" : "en-US";
      const voices = window.speechSynthesis.getVoices();
      const preferred = locale === "bn"
        ? voices.find((voice) => voice.lang.toLowerCase().startsWith("bn"))
        : voices.find((voice) => voice.lang.toLowerCase().startsWith("en"));
      if (preferred) {
        utterance.voice = preferred;
      }
      utterance.onstart = () => {
        setStatus("speaking");
        setSpeakingMessageId(options.messageId ?? null);
      };
      utterance.onend = () => {
        setStatus("idle");
        setSpeakingMessageId(null);
      };
      utterance.onerror = () => {
        void speakWithRemoteTts(clean, options.messageId).catch(() => {
          setStatus("idle");
          setSpeakingMessageId(null);
        });
      };
      window.speechSynthesis.speak(utterance);
      return;
    }

    await speakWithRemoteTts(clean, options.messageId).catch(() => {
      setStatus("idle");
      setSpeakingMessageId(null);
    });
  }, [locale, speakWithRemoteTts, stop]);

  return {
    enabled,
    setEnabled,
    status,
    isSupported,
    speakingMessageId,
    speak,
    pause,
    resume,
    stop,
  };
}
