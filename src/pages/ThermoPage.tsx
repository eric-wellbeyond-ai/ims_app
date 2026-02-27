import {
  Container,
  Paper,
  Typography,
  Box,
  Chip,
  Button,
} from "@mui/material";
import ScienceIcon from "@mui/icons-material/Science";
import EditIcon from "@mui/icons-material/Edit";
import { useFluidContext } from "../context/FluidContext";
import FluidConfigPanel from "../components/FluidConfigPanel";

export default function ThermoPage() {
  const {
    fluidConfig,
    setFluidConfig,
    calculatedShrinkage,
    shrinkageSource,
    applyCalculated,
    clearCalculated,
  } = useFluidContext();

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
        <ScienceIcon color="primary" />
        <Typography variant="h4">Fluid Thermodynamics</Typography>
      </Box>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Define the wellstream composition and separator conditions. The Peng-Robinson
        EOS performs a two-stage flash to calculate the oil shrinkage factor (Bo⁻¹),
        which is automatically applied in the Configure page.
      </Typography>

      {/* Status banner */}
      {shrinkageSource === "calculated" && calculatedShrinkage != null && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            mb: 3,
            p: 1.5,
            borderRadius: 2,
            bgcolor: "success.50",
            border: "1px solid",
            borderColor: "success.200",
          }}
        >
          <Chip
            label={`Bo⁻¹ = ${calculatedShrinkage.toFixed(4)}`}
            color="success"
            size="small"
          />
          <Typography variant="body2" color="success.dark" sx={{ flex: 1 }}>
            Shrinkage factor is applied in Configure. Navigate there to run the analysis.
          </Typography>
          <Button
            size="small"
            startIcon={<EditIcon fontSize="small" />}
            onClick={clearCalculated}
            color="inherit"
            sx={{ color: "text.secondary" }}
          >
            Use manual
          </Button>
        </Box>
      )}

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Fluid Configuration
        </Typography>
        <FluidConfigPanel
          config={fluidConfig}
          onChange={setFluidConfig}
          onShrinkageCalculated={applyCalculated}
        />
      </Paper>
    </Container>
  );
}
