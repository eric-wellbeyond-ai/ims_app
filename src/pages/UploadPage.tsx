import { useState, useEffect, useCallback } from "react";
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
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SaveIcon from "@mui/icons-material/Save";
import RestoreIcon from "@mui/icons-material/Restore";
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
// Defaults (used for "New Case" reset and initial state before auto-load)
// ---------------------------------------------------------------------------
const DEFAULT_PVT: PVTConfig = { oil_shrinkage: 1.0, flash_factor: 0.0, bsw: 0.0 };
const DEFAULT_START = "";
const DEFAULT_END   = "";

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

  const [file, setFile]             = useState<File | null>(null);
  const [pvt, setPvt]               = useState<PVTConfig>(DEFAULT_PVT);
  const [testStart, setTestStart]   = useState(DEFAULT_START);
  const [testEnd, setTestEnd]       = useState(DEFAULT_END);
  const [waterCutSamples, setWaterCutSamples] = useState<WaterCutSample[]>([]);
  const [pvtUnc, setPvtUnc]         = useState<PVTUncertainties>(defaultPVTUncertainties());
  const [channelUnc, setChannelUnc] = useState<ChannelUncertainties>(defaultChannelUncertainties());
  const [aggregation, setAggregation] = useState<MeterAggregationConfig>(defaultMeterAggregation());

  // Case management state
  const [loadedCaseId, setLoadedCaseId] = useState<number | null>(null);
  const [saving, setSaving]             = useState(false);
  const [loadingCase, setLoadingCase]   = useState(false);
  const [snackbar, setSnackbar]         = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Apply a saved case to all form fields
  // ---------------------------------------------------------------------------
  const applyCase = useCallback(async (saved: SavedCase) => {
    const cfg = saved.config;
    if (cfg.pvt)                  setPvt(cfg.pvt);
    if (cfg.test_start)           setTestStart(cfg.test_start);
    if (cfg.test_end)             setTestEnd(cfg.test_end);
    if (cfg.water_cut_samples)    setWaterCutSamples(cfg.water_cut_samples);
    if (cfg.pvt_uncertainties)    setPvtUnc(cfg.pvt_uncertainties);
    if (cfg.channel_uncertainties) setChannelUnc(cfg.channel_uncertainties);
    if (cfg.aggregation)          setAggregation(cfg.aggregation);

    if (saved.has_file && saved.file_name) {
      try {
        const f = await fetchCaseFile(saved.id, saved.file_name);
        setFile(f);
      } catch {
        // Non-fatal — user can re-upload
      }
    }

    setLoadedCaseId(saved.id);
  }, []);

  // ---------------------------------------------------------------------------
  // Auto-load last case on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    fetchLatestCase()
      .then((saved) => { if (saved) applyCase(saved); })
      .catch(() => {/* no cases yet or server down — start blank */});
  }, [applyCase]);

  // ---------------------------------------------------------------------------
  // Save current case
  // ---------------------------------------------------------------------------
  const handleSave = async () => {
    setSaving(true);
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
      if (file) form.append("file", file);

      const res = await fetch("/api/cases", { method: "POST", body: form });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      const { id } = await res.json();
      setLoadedCaseId(id);
      setSnackbar("Case saved.");
    } catch (e) {
      setSnackbar(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
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
  // New case — reset everything to defaults
  // ---------------------------------------------------------------------------
  const handleNew = () => {
    setFile(null);
    setPvt(DEFAULT_PVT);
    setTestStart(DEFAULT_START);
    setTestEnd(DEFAULT_END);
    setWaterCutSamples([]);
    setPvtUnc(defaultPVTUncertainties());
    setChannelUnc(defaultChannelUncertainties());
    setAggregation(defaultMeterAggregation());
    setLoadedCaseId(null);
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
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Header + case management buttons */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 1, gap: 1, flexWrap: "wrap" }}>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          MPFM Validation
        </Typography>

        <Tooltip title="Reset all fields to blank defaults">
          <Button
            size="small"
            startIcon={<AddCircleOutlineIcon />}
            onClick={handleNew}
          >
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

        <Tooltip title="Save all current inputs as a new case">
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
            Save Case
          </Button>
        </Tooltip>
      </Box>

      {loadedCaseId !== null && (
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: "block" }}>
          Working from saved case #{loadedCaseId}
        </Typography>
      )}

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
        <WaterCutTable
          samples={waterCutSamples}
          onChange={setWaterCutSamples}
        />
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
          {loading ? "Running Analysis..." : "Run Analysis"}
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
