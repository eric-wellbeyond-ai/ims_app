import { TextField, Stack, Chip, Tooltip, IconButton } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import type { PVTConfig, PVTUncertainties } from "../types/analysis";

interface PvtFormProps {
  pvt: PVTConfig;
  onChange: (pvt: PVTConfig) => void;
  pvtUnc: PVTUncertainties;
  onUncChange: (unc: PVTUncertainties) => void;
  /** When set, the shrinkage field is locked to this calculated value. */
  shrinkageFromFluid?: number | null;
  /** Called when the user wants to revert shrinkage to manual entry. */
  onClearCalculatedShrinkage?: () => void;
}

export default function PvtForm({
  pvt,
  onChange,
  pvtUnc,
  onUncChange,
  shrinkageFromFluid,
  onClearCalculatedShrinkage,
}: PvtFormProps) {
  const handleChange = (field: keyof PVTConfig) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    onChange({ ...pvt, [field]: parseFloat(e.target.value) || 0 });
  };

  const handleUncChange = (field: keyof PVTUncertainties) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    onUncChange({ ...pvtUnc, [field]: parseFloat(e.target.value) || 0 });
  };

  const shrinkageLocked = shrinkageFromFluid != null;

  return (
    <Stack spacing={2}>
      {/* Oil Shrinkage Factor */}
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <TextField
          label="Oil Shrinkage Factor"
          type="number"
          value={pvt.oil_shrinkage}
          onChange={handleChange("oil_shrinkage")}
          helperText={
            shrinkageLocked
              ? "Calculated from fluid composition"
              : "Bo^-1 style shrinkage (e.g. 0.9237)"
          }
          inputProps={{ step: 0.0001, min: 0, max: 2 }}
          size="small"
          sx={{ flex: 3 }}
          disabled={shrinkageLocked}
          InputProps={
            shrinkageLocked
              ? {
                  endAdornment: (
                    <Tooltip title="Switch back to manual entry">
                      <IconButton
                        size="small"
                        edge="end"
                        onClick={onClearCalculatedShrinkage}
                        tabIndex={-1}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  ),
                }
              : undefined
          }
        />
        <Stack sx={{ flex: 1 }} spacing={0.5}>
          <TextField
            label="± (%)"
            type="number"
            value={pvtUnc.oil_shrinkage_pct}
            onChange={handleUncChange("oil_shrinkage_pct")}
            helperText="Relative uncertainty"
            inputProps={{ step: 0.1, min: 0 }}
            size="small"
          />
          {shrinkageLocked && (
            <Chip
              label="Calculated"
              size="small"
              color="success"
              variant="outlined"
              sx={{ fontSize: "0.65rem", height: 18 }}
            />
          )}
        </Stack>
      </Stack>

      <Stack direction="row" spacing={1} alignItems="flex-start">
        <TextField
          label="Flash Factor (scf/stb)"
          type="number"
          value={pvt.flash_factor}
          onChange={handleChange("flash_factor")}
          helperText="Gas evolved when oil flashes to standard (e.g. 94.13)"
          inputProps={{ step: 0.01, min: 0 }}
          size="small"
          sx={{ flex: 3 }}
        />
        <TextField
          label="± (%)"
          type="number"
          value={pvtUnc.flash_factor_pct}
          onChange={handleUncChange("flash_factor_pct")}
          helperText="Relative uncertainty"
          inputProps={{ step: 0.1, min: 0 }}
          size="small"
          sx={{ flex: 1 }}
        />
      </Stack>

      <Stack direction="row" spacing={1} alignItems="flex-start">
        <TextField
          label="BS&W (fraction)"
          type="number"
          value={pvt.bsw}
          onChange={handleChange("bsw")}
          helperText="Basic sediment & water fraction 0-1 (e.g. 0.2496)"
          inputProps={{ step: 0.0001, min: 0, max: 1 }}
          size="small"
          sx={{ flex: 3 }}
        />
        <TextField
          label="± (%)"
          type="number"
          value={pvtUnc.bsw_pct}
          onChange={handleUncChange("bsw_pct")}
          helperText="Relative uncertainty"
          inputProps={{ step: 0.1, min: 0 }}
          size="small"
          sx={{ flex: 1 }}
        />
      </Stack>
    </Stack>
  );
}
