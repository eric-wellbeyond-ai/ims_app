import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Divider,
} from "@mui/material";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import FileOpenIcon from "@mui/icons-material/FileOpen";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useAuthFetch } from "../auth/useAuthFetch";
import type { SavedCase } from "../types/case";

export default function ScenariosPage() {
  const navigate = useNavigate();
  const authFetch = useAuthFetch();

  const [cases, setCases] = useState<SavedCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/cases");
      if (!res.ok) throw new Error(`Failed to load scenarios: ${res.status}`);
      const data = await res.json();
      setCases(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load scenarios");
    } finally {
      setLoading(false);
    }
  // authFetch is stable post-login
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  const handleLoad = async (caseId: number) => {
    try {
      const res = await authFetch(`/api/cases/${caseId}`);
      if (!res.ok) throw new Error("Failed to load case");
      const savedCase: SavedCase = await res.json();
      navigate("/configure", { state: { caseToLoad: savedCase } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load case");
    }
  };

  const handleDelete = async (caseId: number) => {
    setDeleting(caseId);
    try {
      const res = await authFetch(`/api/cases/${caseId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete scenario");
      setCases((prev) => prev.filter((c) => c.id !== caseId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete scenario");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
        <FolderOpenIcon color="primary" />
        <Typography variant="h4">Scenarios</Typography>
      </Box>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Saved analysis configurations. Load a scenario to restore all settings
        and continue working.
      </Typography>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
          <CircularProgress />
        </Box>
      ) : cases.length === 0 ? (
        <Box
          sx={{
            textAlign: "center",
            mt: 6,
            color: "text.secondary",
          }}
        >
          <FolderOpenIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
          <Typography>No saved scenarios yet.</Typography>
          <Typography variant="body2">
            Configure and save a case from the Configure page to see it here.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {cases.map((c) => (
            <Card key={c.id} variant="outlined">
              <CardContent sx={{ pb: 1 }}>
                <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {c.name || `Case ${c.id}`}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(c.created_at).toLocaleString()}
                    </Typography>
                  </Box>
                  {c.has_file && (
                    <Chip
                      icon={<FileOpenIcon fontSize="small" />}
                      label={c.file_name ?? "Data file"}
                      size="small"
                      variant="outlined"
                      sx={{ mt: 0.5 }}
                    />
                  )}
                </Box>
              </CardContent>
              <Divider />
              <CardActions sx={{ px: 2, py: 1, gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleLoad(c.id)}
                >
                  Load
                </Button>
                <Button
                  size="small"
                  color="error"
                  startIcon={
                    deleting === c.id ? (
                      <CircularProgress size={14} color="inherit" />
                    ) : (
                      <DeleteOutlineIcon fontSize="small" />
                    )
                  }
                  onClick={() => handleDelete(c.id)}
                  disabled={deleting === c.id}
                >
                  Delete
                </Button>
              </CardActions>
            </Card>
          ))}
        </Box>
      )}
    </Container>
  );
}
