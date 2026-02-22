import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Typography,
  Box,
  Button,
  Paper,
  Alert,
  CircularProgress,
  Divider,
  Tooltip,
  Snackbar,
  TextField,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SaveIcon from "@mui/icons-material/Save";
import RestoreIcon from "@mui/icons-material/Restore";
import UndoIcon from "@mui/icons-material/Undo";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import FileUpload from "../components/FileUpload";
import PvtForm from "../components/PvtForm";
import UncertaintyForm from "../components/UncertaintyForm";
import AggregationForm from "../components/AggregationForm";
import WaterCutTable from "../components/WaterCutTable";
import TestWindowPicker from "../components/TestWindowPicker";
import { useAnalysis } from "../context/AnalysisContext";
import type {
  PVTConfig,
  WaterCutSample,
  PVTUncertainties,
  ChannelUncertainties,
  MeterAggregationConfig,
} from "../types/analysis";
import {
  defaultPVTUncertainties,
  defaultChannelUncertainties,
  defaultMeterAggregation,
} from "../types/analysis";
import type { SavedCase } from "../types/case";

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------
const DEFAULT_PVT: PVTConfig = { oil_shrinkage: 1.0, flash_factor: 0.0, bsw: 0.0 };
const DEFAULT_START = "";
const DEFAULT_END   = "";
const DEFAULT_NAME  = "New Case";

type SaveStatus = "never-saved" | "saved" | "saving" | "unsaved";

type FormSnapshot = {
  pvt:              PVTConfig;
  testStart:        string;
  testEnd:          string;
  waterCutSamples:  WaterCutSample[];
  pvtUnc:           PVTUncertainties;
  channelUnc:       ChannelUncertainties;
  aggregation:      MeterAggregationConfig;
  caseName:         string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function fetchLatestCase(): Promise<SavedCase | null> {
  const res = await fetch("/api/cases/latest");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch latest case: ${res.status}`);
  return res.json();
}

async function fetchCaseFile(caseId: number, fileName: string): Promise<File> {
  const res = await fetch(`/api/cases/${caseId}/file`);
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);
  const blob = await res.blob();
  return new File([blob], fileName, { type: blob.type || "application/octet-stream" });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function UploadPage() {
  const navigate = useNavigate();
  const { runAnalysis, loading, error } = useAnalysis();

  // Form state
  const [file, setFile]             = useState<File | null>(null);
  const [pvt, setPvt]               = useState<PVTConfig>(DEFAULT_PVT);
  const [testStart, setTestStart]   = useState(DEFAULT_START);
  const [testEnd, setTestEnd]       = useState(DEFAULT_END);
  const [waterCutSamples, setWaterCutSamples] = useState<WaterCutSample[]>([]);
  const [pvtUnc, setPvtUnc]         = useState<PVTUncertainties>(defaultPVTUncertainties());
  const [channelUnc, setChannelUnc] = useState<ChannelUncertainties>(defaultChannelUncertainties());
  const [aggregation, setAggregation] = useState<MeterAggregationConfig>(defaultMeterAggregation());

  // Case management state
  const [caseName, setCaseName]         = useState(DEFAULT_NAME);
  const [loadedCaseId, setLoadedCaseId] = useState<number | null>(null);
  const [saveStatus, setSaveStatus]     = useState<SaveStatus>("never-saved");
  const [saving, setSaving]             = useState(false);
  const [loadingCase, setLoadingCase]   = useState(false);
  const [snackbar, setSnackbar]         = useState<string | null>(null);

  // Refs
  const savedSnapshotRef   = useRef<FormSnapshot | null>(null);
  const autosaveEnabledRef = useRef(false);
  const isSavingRef        = useRef(false);

  // ---------------------------------------------------------------------------
  // Save core (create or update; includeFile = false for autosave)
  // ---------------------------------------------------------------------------
  const performSaveCore = useCallback(
    async (includeFile: boolean): Promise<boolean> => {
      if (isSavingRef.current) return false;
      isSavingRef.current = true;
      setSaveStatus("saving");
      try {
        const config = {
          pvt,
          test_start: testStart,
          test_end: testEnd,
          water_cut_samples: waterCutSamples,
          pvt_uncertainties: pvtUnc,
          channel_uncertainties: channelUnc,
          aggregation,
        };
        const form = new FormData();
        form.append("config", JSON.stringify(config));
        form.append("name", caseName);
        if (includeFile && file) form.append("file", file);

        if (loadedCaseId !== null) {
          const res = await fetch(`/api/cases/${loadedCaseId}`, {
            method: "PUT",
            body: form,
          });
          if (!res.ok) throw new Error(`Save failed: ${res.status}`);
        } else {
          // First save — always include file
          if (file && !includeFile) form.append("file", file);
          const res = await fetch("/api/cases", { method: "POST", body: form });
          if (!res.ok) throw new Error(`Save failed: ${res.status}`);
          const { id } = await res.json();
          setLoadedCaseId(id);
        }

        savedSnapshotRef.current = {
          pvt, testStart, testEnd, waterCutSamples, pvtUnc, channelUnc, aggregation, caseName,
        };
        setSaveStatus("saved");
        return true;
      } catch (e) {
        setSaveStatus("unsaved");
        setSnackbar(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
        return false;
      } finally {
        isSavingRef.current = false;
      }
    },
    [pvt, testStart, testEnd, waterCutSamples, pvtUnc, channelUnc, aggregation, caseName, file, loadedCaseId],
  );

  // Keep a ref that always points to the latest performSaveCore (for autosave timer)
  const performSaveCoreRef = useRef(performSaveCore);
  useEffect(() => { performSaveCoreRef.current = performSaveCore; }, [performSaveCore]);

  // ---------------------------------------------------------------------------
  // Apply a saved case to all form fields
  // ---------------------------------------------------------------------------
  const applyCase = useCallback(async (saved: SavedCase) => {
    autosaveEnabledRef.current = false; // suppress while loading

    const cfg = saved.config;
    if (cfg.pvt)                   setPvt(cfg.pvt);
    if (cfg.test_start)            setTestStart(cfg.test_start);
    if (cfg.test_end)              setTestEnd(cfg.test_end);
    if (cfg.water_cut_samples)     setWaterCutSamples(cfg.water_cut_samples);
    if (cfg.pvt_uncertainties)     setPvtUnc(cfg.pvt_uncertainties);
    if (cfg.channel_uncertainties) setChannelUnc(cfg.channel_uncertainties);
    if (cfg.aggregation)           setAggregation(cfg.aggregation);
    setCaseName(saved.name ?? DEFAULT_NAME);

    if (saved.has_file && saved.file_name) {
      try {
        const f = await fetchCaseFile(saved.id, saved.file_name);
        setFile(f);
      } catch {
        // Non-fatal — user can re-upload
      }
    }

    setLoadedCaseId(saved.id);
    setSaveStatus("saved");

    savedSnapshotRef.current = {
      pvt:             cfg.pvt             ?? DEFAULT_PVT,
      testStart:       cfg.test_start      ?? DEFAULT_START,
      testEnd:         cfg.test_end        ?? DEFAULT_END,
      waterCutSamples: cfg.water_cut_samples ?? [],
      pvtUnc:          cfg.pvt_uncertainties  ?? defaultPVTUncertainties(),
      channelUnc:      cfg.channel_uncertainties ?? defaultChannelUncertainties(),
      aggregation:     cfg.aggregation     ?? defaultMeterAggregation(),
      caseName:        saved.name          ?? DEFAULT_NAME,
    };

    // Re-enable autosave after React has flushed the state updates
    setTimeout(() => { autosaveEnabledRef.current = true; }, 200);
  }, []);

  // ---------------------------------------------------------------------------
  // Auto-load last case on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    fetchLatestCase()
      .then((saved) => { if (saved) return applyCase(saved); })
      .catch(() => {/* no cases yet — start blank */})
      .finally(() => {
        // If applyCase was skipped (no saved case), still enable autosave
        setTimeout(() => { autosaveEnabledRef.current = true; }, 200);
      });
  }, [applyCase]);

  // ---------------------------------------------------------------------------
  // Autosave — debounce 3 s after any config change
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!autosaveEnabledRef.current) return;
    setSaveStatus("unsaved");
    const timer = setTimeout(() => {
      performSaveCoreRef.current(false);
    }, 3000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pvt, testStart, testEnd, waterCutSamples, pvtUnc, channelUnc, aggregation, caseName]);

  // ---------------------------------------------------------------------------
  // Manual save (includes file)
  // ---------------------------------------------------------------------------
  const handleSave = async () => {
    setSaving(true);
    const ok = await performSaveCoreRef.current(true);
    if (ok) setSnackbar("Saved.");
    setSaving(false);
  };

  // ---------------------------------------------------------------------------
  // Retrieve last case
  // ---------------------------------------------------------------------------
  const handleLoadLast = async () => {
    setLoadingCase(true);
    try {
      const saved = await fetchLatestCase();
      if (!saved) { setSnackbar("No saved cases found."); return; }
      await applyCase(saved);
      setSnackbar(`Loaded: ${saved.name}`);
    } catch (e) {
      setSnackbar(`Load failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoadingCase(false);
    }
  };

  // ---------------------------------------------------------------------------
  // New case — reset everything
  // ---------------------------------------------------------------------------
  const handleNew = () => {
    autosaveEnabledRef.current = false;
    setFile(null);
    setPvt(DEFAULT_PVT);
    setTestStart(DEFAULT_START);
    setTestEnd(DEFAULT_END);
    setWaterCutSamples([]);
    setPvtUnc(defaultPVTUncertainties());
    setChannelUnc(defaultChannelUncertainties());
    setAggregation(defaultMeterAggregation());
    setCaseName(DEFAULT_NAME);
    setLoadedCaseId(null);
    setSaveStatus("never-saved");
    savedSnapshotRef.current = null;
    setTimeout(() => { autosaveEnabledRef.current = true; }, 200);
  };

  // ---------------------------------------------------------------------------
  // Discard changes — restore last saved snapshot
  // ---------------------------------------------------------------------------
  const handleDiscard = () => {
    const snap = savedSnapshotRef.current;
    if (!snap) return;
    autosaveEnabledRef.current = false;
    setPvt(snap.pvt);
    setTestStart(snap.testStart);
    setTestEnd(snap.testEnd);
    setWaterCutSamples(snap.waterCutSamples);
    setPvtUnc(snap.pvtUnc);
    setChannelUnc(snap.channelUnc);
    setAggregation(snap.aggregation);
    setCaseName(snap.caseName);
    setSaveStatus("saved");
    setTimeout(() => { autosaveEnabledRef.current = true; }, 200);
  };

  // ---------------------------------------------------------------------------
  // Run analysis
  // ---------------------------------------------------------------------------
  const canSubmit = file && testStart && testEnd && !loading;

  const handleSubmit = async () => {
    if (!file || !testStart || !testEnd) return;
    try {
      await runAnalysis(file, {
        pvt,
        test_start: testStart,
        test_end: testEnd,
        water_cut_samples: waterCutSamples.filter((s) => Boolean(s.timestamp)),
        pvt_uncertainties: pvtUnc,
        channel_uncertainties: channelUnc,
        aggregation,
      });
      navigate("/dashboard");
    } catch {
      // Error is stored in context
    }
  };

  // ---------------------------------------------------------------------------
  // Save status label
  // ---------------------------------------------------------------------------
  const statusColor: Record<SaveStatus, string> = {
    "never-saved": "text.disabled",
    "saved":       "success.main",
    "saving":      "text.secondary",
    "unsaved":     "warning.main",
  };
  const statusLabel: Record<SaveStatus, string> = {
    "never-saved": "",
    "saved":       "Saved",
    "saving":      "Saving…",
    "unsaved":     "Unsaved changes",
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 1, gap: 1, flexWrap: "wrap" }}>
        <Typography variant="h4" sx={{ flexShrink: 0 }}>
          MPFM Validation
        </Typography>

        {/* Inline case name */}
        <TextField
          value={caseName}
          onChange={(e) => setCaseName(e.target.value)}
          variant="standard"
          size="small"
          sx={{ flexGrow: 1, minWidth: 160, mx: 1 }}
          inputProps={{ style: { fontWeight: 500 } }}
        />

        {/* Save status */}
        <Typography
          variant="caption"
          sx={{ color: statusColor[saveStatus], minWidth: 110, textAlign: "right" }}
        >
          {saveStatus === "saving" && (
            <CircularProgress size={10} sx={{ mr: 0.5 }} />
          )}
          {statusLabel[saveStatus]}
        </Typography>
      </Box>

      {/* Action buttons */}
      <Box sx={{ display: "flex", gap: 1, mb: 3, flexWrap: "wrap" }}>
        <Tooltip title="Reset all fields to blank defaults">
          <Button size="small" startIcon={<AddCircleOutlineIcon />} onClick={handleNew}>
            New Case
          </Button>
        </Tooltip>

        <Tooltip title="Reload the most recently saved workspace">
          <Button
            size="small"
            startIcon={
              loadingCase
                ? <CircularProgress size={16} color="inherit" />
                : <RestoreIcon />
            }
            onClick={handleLoadLast}
            disabled={loadingCase}
          >
            Retrieve Last Case
          </Button>
        </Tooltip>

        {saveStatus === "unsaved" && savedSnapshotRef.current && (
          <Tooltip title="Discard unsaved changes and revert to last saved state">
            <Button
              size="small"
              color="warning"
              startIcon={<UndoIcon />}
              onClick={handleDiscard}
            >
              Revert to Saved
            </Button>
          </Tooltip>
        )}

        <Tooltip title="Save all current inputs (including file) immediately">
          <Button
            size="small"
            variant="outlined"
            startIcon={
              saving
                ? <CircularProgress size={16} color="inherit" />
                : <SaveIcon />
            }
            onClick={handleSave}
            disabled={saving}
          >
            Save
          </Button>
        </Tooltip>
      </Box>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Upload meter trend data and configure fluid properties to run the
        validation analysis.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Trend Data
        </Typography>
        <FileUpload file={file} onFileChange={setFile} />
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Fluid Properties (PVT)
        </Typography>
        <PvtForm pvt={pvt} onChange={setPvt} pvtUnc={pvtUnc} onUncChange={setPvtUnc} />
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Meter Aggregation
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Choose how individual meter readings are combined into a single MPFM
          value for comparison against the reference.
        </Typography>
        <AggregationForm config={aggregation} onChange={setAggregation} />
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <UncertaintyForm unc={channelUnc} onChange={setChannelUnc} />
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Test Window
        </Typography>
        <TestWindowPicker
          start={testStart}
          end={testEnd}
          onStartChange={setTestStart}
          onEndChange={setTestEnd}
        />
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Water Cut Spot Samples
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Optional: enter spot water cut samples taken during the test period.
        </Typography>
        <WaterCutTable samples={waterCutSamples} onChange={setWaterCutSamples} />
      </Paper>

      <Divider sx={{ mb: 3 }} />

      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          size="large"
          startIcon={
            loading ? <CircularProgress size={20} color="inherit" /> : <PlayArrowIcon />
          }
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {loading ? "Running Analysis…" : "Run Analysis"}
        </Button>
      </Box>

      <Snackbar
        open={snackbar !== null}
        autoHideDuration={3000}
        onClose={() => setSnackbar(null)}
        message={snackbar}
      />
    </Container>
  );
}
