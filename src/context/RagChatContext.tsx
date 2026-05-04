import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { getRagApiBase } from "../config/ragApi";

export interface WolframStep {
  code: string;
  ok: boolean;
  stdout?: string;
  stderr?: string;
  error?: string | null;
}

export interface Citation {
  source: string;
  pages?: string;
  score: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  wolfram?: WolframStep[];
  chunksUsed?: number;
}

interface RagChatContextValue {
  sessionId: string;
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  useWolfram: boolean;
  setUseWolfram: Dispatch<SetStateAction<boolean>>;
  topK: number;
  setTopK: Dispatch<SetStateAction<number>>;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  expandedMeta: Record<number, boolean>;
  setExpandedMeta: Dispatch<SetStateAction<Record<number, boolean>>>;
  chatError: string | null;
  setChatError: Dispatch<SetStateAction<string | null>>;
  resetConversation: () => Promise<void>;
}

const RagChatContext = createContext<RagChatContextValue | null>(null);

export function RagChatProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const sessionIdRef = useRef(sessionId);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [useWolfram, setUseWolfram] = useState(true);
  const [topK, setTopK] = useState(5);
  const [input, setInput] = useState("");
  const [expandedMeta, setExpandedMeta] = useState<Record<number, boolean>>({});
  const [chatError, setChatError] = useState<string | null>(null);

  const resetConversation = useCallback(async () => {
    const base = getRagApiBase();
    const sid = sessionIdRef.current;
    setMessages([]);
    setInput("");
    setChatError(null);
    setExpandedMeta({});
    try {
      await fetch(`${base}/chat/reset?session_id=${encodeURIComponent(sid)}`, {
        method: "POST",
      });
    } catch {
      /* ignore */
    }
    setSessionId(crypto.randomUUID());
  }, []);

  const value: RagChatContextValue = {
    sessionId,
    messages,
    setMessages,
    useWolfram,
    setUseWolfram,
    topK,
    setTopK,
    input,
    setInput,
    expandedMeta,
    setExpandedMeta,
    chatError,
    setChatError,
    resetConversation,
  };

  return <RagChatContext.Provider value={value}>{children}</RagChatContext.Provider>;
}

export function useRagChat(): RagChatContextValue {
  const ctx = useContext(RagChatContext);
  if (!ctx) {
    throw new Error("useRagChat must be used within RagChatProvider");
  }
  return ctx;
}
