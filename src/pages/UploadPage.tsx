import { useState } from "react";
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
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import FileUpload from "../components/FileUpload";
import PvtForm from "../components/PvtForm";
import WaterCutTable from "../components/WaterCutTable";
import TestWindowPicker from "../components/TestWindowPicker";
import { useAnalysis } from "../context/AnalysisContext";
import type { PVTConfig, WaterCutSample } from "../types/analysis";

export default function UploadPage() {
  const navigate = useNavigate();
  const { runAnalysis, loading, error } = useAnalysis();

  const [file, setFile] = useState<File | null>(null);
  const [pvt, setPvt] = useState<PVTConfig>({
    oil_shrinkage: 0.9237,
    flash_factor: 94.13,
    bsw: 0.2496,
  });
  // Pre-populated with known sample data for testing
  const [testStart, setTestStart] = useState("2025-10-10T19:00:00");
  const [testEnd, setTestEnd] = useState("2025-10-11T07:00:00");
  const [waterCutSamples, setWaterCutSamples] = useState<WaterCutSample[]>([
    { timestamp: "2025-10-10T20:00:00", value: 0.25 },
    { timestamp: "2025-10-11T02:00:00", value: 0.24 },
  ]);

  const canSubmit = file && testStart && testEnd && !loading;

  const handleSubmit = async () => {
    if (!file || !testStart || !testEnd) return;
    try {
      await runAnalysis(file, {
        pvt,
        test_start: testStart,
        test_end: testEnd,
        water_cut_samples: waterCutSamples,
      });
      navigate("/dashboard");
    } catch {
      // Error is stored in context
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        MPFM Validation
      </Typography>
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
        <PvtForm pvt={pvt} onChange={setPvt} />
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
    </Container>
  );
}
