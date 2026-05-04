import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Container,
  Divider,
  FormControlLabel,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ChatIcon from "@mui/icons-material/Chat";
import SendIcon from "@mui/icons-material/Send";
import AddCommentIcon from "@mui/icons-material/AddComment";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { getRagApiBase, ragHttpErrorHint } from "../config/ragApi";
import {
  useRagChat,
  type Citation,
  type WolframStep,
} from "../context/RagChatContext";

interface HealthPayload {
  status?: string;
  wolfram_available?: boolean;
  backend?: string;
  model?: string;
  rag_max_tokens?: number;
  rag_temperature?: number;
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export default function RagChatPage() {
  const base = getRagApiBase();
  const {
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
  } = useRagChat();

  const [sending, setSending] = useState(false);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  const pollHealth = useCallback(async () => {
    try {
      const res = await fetch(`${base}/health`);
      if (!res.ok) {
        setHealthError(
          `RAG server returned ${res.status}.${ragHttpErrorHint(res.status)}`,
        );
        setHealth(null);
        return;
      }
      const data = (await res.json()) as HealthPayload;
      setHealth(data);
      setHealthError(null);
    } catch {
      setHealthError(
        "Cannot reach the RAG API. Start it with: uvicorn src.api:app --reload --port 8001 (from rag_model/).",
      );
      setHealth(null);
    }
  }, [base]);

  useEffect(() => {
    void pollHealth();
  }, [pollHealth]);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setChatError(null);
    setMessages((m) => [...m, { role: "user", content: text }]);
    setSending(true);

    try {
      const res = await fetch(`${base}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          session_id: sessionId,
          top_k: topK,
          use_wolfram: useWolfram,
        }),
      });

      const body = await parseJsonSafe(res);
      if (!res.ok) {
        const detail =
          body && typeof body === "object" && "detail" in body
            ? String((body as { detail: unknown }).detail)
            : res.statusText;
        const hint = ragHttpErrorHint(res.status);
        throw new Error(`${detail || `HTTP ${res.status}`}${hint ? ` —${hint}` : ""}`);
      }

      const j = body as {
        answer: string;
        citations?: Citation[];
        wolfram?: WolframStep[];
        chunks_used?: number;
      };

      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: j.answer,
          citations: j.citations,
          wolfram: j.wolfram,
          chunksUsed: j.chunks_used,
        },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed";
      setChatError(msg);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `Sorry — something went wrong: ${msg}`,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleNewConversation = async () => {
    await resetConversation();
    void pollHealth();
  };

  const toggleMeta = (idx: number) => {
    setExpandedMeta((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <Container maxWidth="md" sx={{ py: 3, height: "calc(100vh - 24px)", display: "flex", flexDirection: "column" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2, flexShrink: 0 }}>
        <ChatIcon color="primary" />
        <Typography variant="h4" component="h1">
          Assistant
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
          Document Q&amp;A (RAG)
        </Typography>
      </Box>

      {healthError && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setHealthError(null)}>
          {healthError}
        </Alert>
      )}

      {health && !healthError && (
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", alignItems: "center" }} useFlexGap>
          <Chip size="small" label={`LLM: ${health.backend ?? "?"}`} variant="outlined" />
          <Chip size="small" label={health.model ?? "model"} variant="outlined" />
          <Chip
            size="small"
            color={health.wolfram_available ? "success" : "default"}
            label={health.wolfram_available ? "Wolfram ready" : "Wolfram off / unavailable"}
            variant="outlined"
          />
          {health.rag_max_tokens != null && (
            <Chip
              size="small"
              label={`RAG max tokens: ${health.rag_max_tokens}`}
              variant="outlined"
            />
          )}
          {health.rag_temperature != null && (
            <Chip
              size="small"
              label={`RAG temp: ${health.rag_temperature}`}
              variant="outlined"
            />
          )}
        </Stack>
      )}

      <Paper
        elevation={0}
        sx={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: "1px solid",
            borderColor: "divider",
            display: "flex",
            alignItems: "center",
            gap: 2,
            flexWrap: "wrap",
            bgcolor: "grey.50",
          }}
        >
          <Tooltip title="Clear messages and reset server-side history for this session">
            <Button
              size="small"
              startIcon={<AddCommentIcon />}
              onClick={() => void handleNewConversation()}
              variant="outlined"
            >
              New conversation
            </Button>
          </Tooltip>
          <FormControlLabel
            control={
              <Switch
                checked={useWolfram}
                onChange={(e) => setUseWolfram(e.target.checked)}
                size="small"
              />
            }
            label="Wolfram math"
          />
          <TextField
            size="small"
            label="Top K"
            type="number"
            value={topK}
            onChange={(e) => setTopK(Math.min(20, Math.max(1, Number(e.target.value) || 5)))}
            slotProps={{ htmlInput: { min: 1, max: 20 } }}
            sx={{ width: 100 }}
          />
        </Box>

        <Box sx={{ flex: 1, overflowY: "auto", p: 2, bgcolor: "background.default" }}>
          {messages.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
              Ask about your indexed documents — for example uncertainty methods, meter specs, or
              quantitative follow-ups (relative uncertainty, unit conversions) when Wolfram is enabled.
            </Typography>
          )}

          <Stack spacing={2}>
            {messages.map((msg, idx) => {
              const isUser = msg.role === "user";
              const hasMeta =
                msg.role === "assistant" &&
                ((msg.citations && msg.citations.length > 0) ||
                  (msg.wolfram && msg.wolfram.length > 0) ||
                  msg.chunksUsed != null);

              return (
                <Box
                  key={`${idx}-${msg.role}`}
                  sx={{
                    display: "flex",
                    justifyContent: isUser ? "flex-end" : "flex-start",
                  }}
                >
                  <Paper
                    elevation={0}
                    sx={{
                      maxWidth: "92%",
                      px: 2,
                      py: 1.25,
                      borderRadius: 2,
                      bgcolor: isUser ? "primary.main" : "background.paper",
                      color: isUser ? "primary.contrastText" : "text.primary",
                      border: isUser ? "none" : "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {msg.content}
                    </Typography>

                    {hasMeta && (
                      <>
                        <Divider sx={{ my: 1, borderColor: isUser ? "rgba(255,255,255,0.2)" : "divider" }} />
                        <Button
                          size="small"
                          onClick={() => toggleMeta(idx)}
                          endIcon={expandedMeta[idx] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          sx={{
                            color: isUser ? "inherit" : "text.secondary",
                            textTransform: "none",
                            p: 0,
                            minWidth: 0,
                          }}
                        >
                          Sources &amp; computation
                          {msg.chunksUsed != null ? ` · ${msg.chunksUsed} chunks` : ""}
                        </Button>
                        <Collapse in={!!expandedMeta[idx]}>
                          <Box sx={{ mt: 1, textAlign: "left" }}>
                            {msg.citations && msg.citations.length > 0 && (
                              <Typography variant="caption" component="div" color="text.secondary" gutterBottom>
                                Citations
                              </Typography>
                            )}
                            {msg.citations?.map((c, i) => (
                              <Typography
                                key={i}
                                variant="caption"
                                display="block"
                                color="text.secondary"
                                sx={{ fontFamily: "monospace" }}
                              >
                                {c.source}
                                {c.pages ? ` · p. ${c.pages}` : ""} · score {c.score?.toFixed?.(3) ?? c.score}
                              </Typography>
                            ))}
                            {msg.wolfram && msg.wolfram.length > 0 && (
                              <>
                                <Typography variant="caption" component="div" color="text.secondary" sx={{ mt: 1 }}>
                                  Wolfram (wolframscript)
                                </Typography>
                                {msg.wolfram.map((w, wi) => (
                                  <Box
                                    key={wi}
                                    sx={{
                                      mt: 0.5,
                                      p: 1,
                                      bgcolor: "grey.100",
                                      borderRadius: 1,
                                      fontFamily: "monospace",
                                      fontSize: "0.7rem",
                                      overflowX: "auto",
                                    }}
                                  >
                                    <Typography variant="caption" display="block" color="text.secondary">
                                      {w.ok ? "ok" : "error"}
                                    </Typography>
                                    <Box
                                      component="pre"
                                      sx={{
                                        m: 0,
                                        whiteSpace: "pre-wrap",
                                        fontFamily: "monospace",
                                        fontSize: "inherit",
                                      }}
                                    >
                                      {w.code}
                                    </Box>
                                    {(w.stdout || w.error) && (
                                      <Box
                                        component="pre"
                                        sx={{
                                          m: "8px 0 0",
                                          whiteSpace: "pre-wrap",
                                          fontFamily: "monospace",
                                          fontSize: "inherit",
                                        }}
                                      >
                                        {w.stdout || w.error}
                                      </Box>
                                    )}
                                  </Box>
                                ))}
                              </>
                            )}
                          </Box>
                        </Collapse>
                      </>
                    )}
                  </Paper>
                </Box>
              );
            })}
          </Stack>
          <div ref={scrollAnchorRef} />
        </Box>

        {chatError && (
          <Alert severity="error" sx={{ mx: 2, mb: 1 }} onClose={() => setChatError(null)}>
            {chatError}
          </Alert>
        )}

        <Box
          sx={{
            p: 2,
            borderTop: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
            position: "relative",
          }}
        >
          {sending && (
            <LinearProgress
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 3,
              }}
            />
          )}
          <Stack direction="row" spacing={1} alignItems="flex-end">
            <TextField
              fullWidth
              multiline
              minRows={2}
              maxRows={8}
              placeholder="Type your question…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sending}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <Tooltip title="Send (Enter — Shift+Enter for newline)">
              <span>
                <IconButton
                  color="primary"
                  onClick={() => void send()}
                  disabled={sending || !input.trim()}
                  sx={{ mb: 0.5 }}
                >
                  {sending ? <CircularProgress size={24} color="inherit" /> : <SendIcon />}
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Box>
      </Paper>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: "block" }}>
        API: <Box component="span" sx={{ fontFamily: "monospace" }}>{base}</Box>
        {" · "}
        Override with <Box component="span" sx={{ fontFamily: "monospace" }}>VITE_RAG_API_URL</Box>
        {" · "}
        Shorter answers: set <Box component="span" sx={{ fontFamily: "monospace" }}>IMS_RAG_MAX_TOKENS</Box> (e.g. 384) and/or{" "}
        <Box component="span" sx={{ fontFamily: "monospace" }}>IMS_RAG_TEMPERATURE</Box> (e.g. 0.05) on the RAG server, then restart uvicorn.
      </Typography>
    </Container>
  );
}
