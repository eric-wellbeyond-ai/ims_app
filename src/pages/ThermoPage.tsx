import { useEffect, useRef, useState } from "react";
import {
  Container,
  Paper,
  Typography,
  Box,
  Chip,
  Button,
  Stack,
} from "@mui/material";
import ScienceIcon from "@mui/icons-material/Science";
import EditIcon from "@mui/icons-material/Edit";
import { useFluidContext } from "../context/FluidContext";
import { useAuthFetch } from "../auth/useAuthFetch";
import FluidConfigPanel from "../components/FluidConfigPanel";

type SaveStatus = "idle" | "saving" | "saved" | "unsaved";

export default function ThermoPage() {
  const authFetch = useAuthFetch();

  const {
    fluidConfig,
    setFluidConfig,
    calculatedShrinkage,
    shrinkageSource,
    calculatedFlashFactor,
    flashFactorSource,
    applyCalculated,
    clearCalculatedShrinkage,
    clearCalculatedFlashFactor,
  } = useFluidContext();

  // The case ID this page saves fluid changes into.
  // Resolved on mount from GET /api/cases/latest.
  const [caseId, setCaseId] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Refs to avoid stale closures in the debounce effect
  const isSavingRef   = useRef(false);
  const saveEnabledRef = useRef(false);  // don't autosave until mount fetch completes

  // On mount: find the latest case so we know where to save fluid changes
  useEffect(() => {
    authFetch("/api/cases/latest")
      .then((r) => {
        if (r.status === 404) return null;
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (data?.id) setCaseId(data.id);
      })
      .catch(() => {/* no case yet; save will be skipped */})
      .finally(() => { saveEnabledRef.current = true; });
  // authFetch is stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced autosave whenever fluid state changes
  useEffect(() => {
    if (!saveEnabledRef.current || caseId === null) return;
    setSaveStatus("unsaved");
    const timer = setTimeout(() => {
      if (isSavingRef.current) return;
      isSavingRef.current = true;
      setSaveStatus("saving");
      authFetch(`/api/cases/${caseId}/fluid`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fluid_config: fluidConfig,
          shrinkage_source: shrinkageSource,
          flash_factor_source: flashFactorSource,
          calculated_flash_factor: calculatedFlashFactor,
        }),
      })
        .then((r) => {
          if (r.ok) setSaveStatus("saved");
          else setSaveStatus("unsaved");
        })
        .catch(() => setSaveStatus("unsaved"))
        .finally(() => { isSavingRef.current = false; });
    }, 2000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fluidConfig, shrinkageSource, flashFactorSource, calculatedFlashFactor, caseId]);

  const anythingCalculated =
    (shrinkageSource === "calculated" && calculatedShrinkage != null) ||
    (flashFactorSource === "calculated" && calculatedFlashFactor != null);

  const handleClearAll = () => {
    clearCalculatedShrinkage();
    clearCalculatedFlashFactor();
  };

  const statusColor: Record<SaveStatus, string> = {
    idle:    "text.disabled",
    saving:  "text.secondary",
    saved:   "success.main",
    unsaved: "warning.main",
  };
  const statusLabel: Record<SaveStatus, string> = {
    idle:    "",
    saving:  "Saving…",
    saved:   "Saved",
    unsaved: "Unsaved changes",
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
        <ScienceIcon color="primary" />
        <Typography variant="h4">Fluid Thermodynamics</Typography>
        {caseId !== null && saveStatus !== "idle" && (
          <Typography
            variant="caption"
            sx={{ ml: "auto", color: statusColor[saveStatus] }}
          >
            {statusLabel[saveStatus]}
          </Typography>
        )}
      </Box>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Define the wellstream composition and separator conditions, then select a
        thermodynamic engine to calculate the oil shrinkage factor (Bo⁻¹) and flash
        factor (scf/stb). <strong>IMS Thermo</strong> uses an internal Peng-Robinson EOS.{" "}
        <strong>PVTsim Nova</strong> delegates to the PVTsim bridge service — ensure the
        bridge is running on Windows before calculating. Results are automatically applied
        in the Configure page.
      </Typography>

      {/* Status banner */}
      {anythingCalculated && (
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
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {shrinkageSource === "calculated" && calculatedShrinkage != null && (
              <Chip
                label={`Bo⁻¹ = ${calculatedShrinkage.toFixed(4)}`}
                color="success"
                size="small"
              />
            )}
            {flashFactorSource === "calculated" && calculatedFlashFactor != null && (
              <Chip
                label={`Flash factor = ${calculatedFlashFactor.toFixed(1)} scf/stb`}
                color="success"
                size="small"
              />
            )}
          </Stack>
          <Typography variant="body2" color="success.dark" sx={{ flex: 1 }}>
            PVT values applied in Configure. Navigate there to run the analysis.
          </Typography>
          <Button
            size="small"
            startIcon={<EditIcon fontSize="small" />}
            onClick={handleClearAll}
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
          onPvtCalculated={applyCalculated}
        />
      </Paper>
    </Container>
  );
}
