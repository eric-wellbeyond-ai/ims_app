import { useNavigate } from "react-router-dom";
import {
  Container,
  Typography,
  Box,
  Button,
  Paper,
  Grid,
  Alert,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadIcon from "@mui/icons-material/Download";
import { useAnalysis } from "../context/AnalysisContext";
import { getExportUrl } from "../api/analysisApi";
import ComparisonTable from "../components/ComparisonTable";
import TimeSeriesChart from "../components/TimeSeriesChart";
import DeviationHistogram from "../components/DeviationHistogram";
import DeviationTimeSeries from "../components/DeviationTimeSeries";
import CrossPlot from "../components/CrossPlot";
import { useEffect } from "react";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { result } = useAnalysis();

  useEffect(() => {
    if (!result) navigate("/");
  }, [result, navigate]);

  if (!result) return null;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4">Validation Results</Typography>
          <Typography variant="body2" color="text.secondary">
            Test window: {new Date(result.test_start).toLocaleString()} &mdash;{" "}
            {new Date(result.test_end).toLocaleString()} | {result.n_samples}{" "}
            data points
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/")}
          >
            Back
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            href={getExportUrl(result.session_id)}
          >
            Export CSV
          </Button>
        </Box>
      </Box>

      {/* Summary Comparison Table */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Summary Comparison
        </Typography>
        <ComparisonTable comparison={result.comparison} />
      </Paper>

      {/* Charts Grid */}
      <Grid container spacing={3}>
        <Grid size={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Time Series Overlay
            </Typography>
            <TimeSeriesChart deviations={result.deviations} />
          </Paper>
        </Grid>

        <Grid size={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Deviation Over Time
            </Typography>
            <DeviationTimeSeries deviations={result.deviations} />
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Deviation Distribution
            </Typography>
            <DeviationHistogram deviations={result.deviations} />
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Cross-Plot
            </Typography>
            <CrossPlot deviations={result.deviations} sigmaTsRows={result.sigma_ts ?? []} />
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}
