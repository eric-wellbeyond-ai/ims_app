import { useState, useEffect } from "react";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Alert,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CalculateIcon from "@mui/icons-material/Calculate";
import type { ComponentInfo, FluidComponent, FluidConfig } from "../types/analysis";
import { useAuthFetch } from "../auth/useAuthFetch";

interface FluidConfigPanelProps {
  config: FluidConfig;
  onChange: (cfg: FluidConfig) => void;
  onShrinkageCalculated: (value: number) => void;
}

export default function FluidConfigPanel({
  config,
  onChange,
  onShrinkageCalculated,
}: FluidConfigPanelProps) {
  const authFetch = useAuthFetch();

  const [availableComponents, setAvailableComponents] = useState<ComponentInfo[]>([]);
  const [loadingComponents, setLoadingComponents] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<{
    oil_shrinkage: number;
    beta_sep: number;
    beta_std: number;
  } | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);

  // Fetch component list once on mount
  useEffect(() => {
    setLoadingComponents(true);
    authFetch("/api/fluid/components")
      .then((r) => r.json())
      .then((data: ComponentInfo[]) => setAvailableComponents(data))
      .catch(() => {/* silently handled — panel still usable if list fails */})
      .finally(() => setLoadingComponents(false));
  // authFetch is stable post-login
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derived
  const ziSum = config.components.reduce((acc, c) => acc + (c.zi || 0), 0);
  const sumOk = Math.abs(ziSum - 1.0) < 0.005;

  const canCalculate =
    config.components.length >= 1 &&
    config.P_sep_bar > 0 &&
    config.T_sep_c > -273.15 &&
    ziSum > 0;

  // ---------------------------------------------------------------------------
  // Composition row handlers
  // ---------------------------------------------------------------------------
  const addRow = () => {
    // Pick the first component not already in the list
    const usedKeys = new Set(config.components.map((c) => c.key));
    const next = availableComponents.find((a) => !usedKeys.has(a.key));
    onChange({
      ...config,
      components: [...config.components, { key: next?.key ?? "C1", zi: 0 }],
    });
    setResult(null);
  };

  const removeRow = (idx: number) => {
    const updated = config.components.filter((_, i) => i !== idx);
    onChange({ ...config, components: updated });
    setResult(null);
  };

  const updateKey = (idx: number, key: string) => {
    const updated = config.components.map((c, i) => (i === idx ? { ...c, key } : c));
    onChange({ ...config, components: updated });
    setResult(null);
  };

  const updateZi = (idx: number, raw: string) => {
    const zi = parseFloat(raw) || 0;
    const updated = config.components.map((c, i) => (i === idx ? { ...c, zi } : c));
    onChange({ ...config, components: updated });
    setResult(null);
  };

  // ---------------------------------------------------------------------------
  // Calculate shrink factor
  // ---------------------------------------------------------------------------
  const handleCalculate = async () => {
    setCalculating(true);
    setCalcError(null);
    setResult(null);
    try {
      const body = {
        components: config.components,
        P_sep: config.P_sep_bar * 1e5,          // bar → Pa
        T_sep: config.T_sep_c + 273.15,          // °C → K
      };
      const res = await authFetch("/api/fluid/shrink-factor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail ?? "Calculation failed");
      }
      const data = await res.json();
      setResult(data);
      onShrinkageCalculated(data.oil_shrinkage);
    } catch (e) {
      setCalcError(e instanceof Error ? e.message : String(e));
    } finally {
      setCalculating(false);
    }
  };

  return (
    <Stack spacing={2}>
      {/* Separator conditions */}
      <Stack direction="row" spacing={2}>
        <TextField
          label="Separator Pressure (bar)"
          type="number"
          value={config.P_sep_bar}
          onChange={(e) => {
            onChange({ ...config, P_sep_bar: parseFloat(e.target.value) || 0 });
            setResult(null);
          }}
          inputProps={{ step: 0.5, min: 0 }}
          size="small"
          sx={{ flex: 1 }}
        />
        <TextField
          label="Separator Temperature (°C)"
          type="number"
          value={config.T_sep_c}
          onChange={(e) => {
            onChange({ ...config, T_sep_c: parseFloat(e.target.value) || 0 });
            setResult(null);
          }}
          inputProps={{ step: 1 }}
          size="small"
          sx={{ flex: 1 }}
        />
      </Stack>

      {/* Composition table */}
      <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Wellstream composition
          </Typography>
          <Typography
            variant="caption"
            color={ziSum === 0 ? "text.disabled" : sumOk ? "success.main" : "warning.main"}
          >
            Sum: {ziSum.toFixed(4)}
          </Typography>
        </Stack>

        {loadingComponents && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <CircularProgress size={14} />
            <Typography variant="caption" color="text.secondary">
              Loading components…
            </Typography>
          </Box>
        )}

        <Stack spacing={1}>
          {config.components.map((row, idx) => (
            <Stack key={idx} direction="row" spacing={1} alignItems="center">
              <Select
                value={row.key}
                onChange={(e) => updateKey(idx, e.target.value)}
                size="small"
                sx={{ flex: 3, minWidth: 140 }}
              >
                {availableComponents.map((c) => (
                  <MenuItem key={c.key} value={c.key}>
                    {c.key} — {c.name}
                  </MenuItem>
                ))}
                {/* Fallback in case list not loaded yet */}
                {!availableComponents.find((c) => c.key === row.key) && (
                  <MenuItem value={row.key}>{row.key}</MenuItem>
                )}
              </Select>
              <TextField
                label="Mole fraction"
                type="number"
                value={row.zi}
                onChange={(e) => updateZi(idx, e.target.value)}
                inputProps={{ step: 0.01, min: 0, max: 1 }}
                size="small"
                sx={{ flex: 2 }}
              />
              <Tooltip title="Remove component">
                <IconButton size="small" onClick={() => removeRow(idx)} color="default">
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          ))}
        </Stack>

        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={addRow}
          sx={{ mt: 1 }}
          disabled={loadingComponents}
        >
          Add component
        </Button>
      </Box>

      {/* Calculate button */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <Button
          variant="outlined"
          startIcon={
            calculating ? <CircularProgress size={16} color="inherit" /> : <CalculateIcon />
          }
          onClick={handleCalculate}
          disabled={!canCalculate || calculating}
        >
          Calculate Shrink Factor
        </Button>

        {result && (
          <Typography variant="body2" color="success.main" sx={{ fontWeight: 500 }}>
            Bo⁻¹ = {result.oil_shrinkage.toFixed(4)}
            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              (β_sep={result.beta_sep.toFixed(3)}, β_std={result.beta_std.toFixed(3)})
            </Typography>
          </Typography>
        )}
      </Box>

      {calcError && (
        <Alert severity="error" onClose={() => setCalcError(null)} sx={{ py: 0 }}>
          {calcError}
        </Alert>
      )}
    </Stack>
  );
}
