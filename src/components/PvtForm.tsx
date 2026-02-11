import { TextField, Stack } from "@mui/material";
import type { PVTConfig } from "../types/analysis";

interface PvtFormProps {
  pvt: PVTConfig;
  onChange: (pvt: PVTConfig) => void;
}

export default function PvtForm({ pvt, onChange }: PvtFormProps) {
  const handleChange = (field: keyof PVTConfig) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    onChange({ ...pvt, [field]: parseFloat(e.target.value) || 0 });
  };

  return (
    <Stack spacing={2}>
      <TextField
        label="Oil Shrinkage Factor"
        type="number"
        value={pvt.oil_shrinkage}
        onChange={handleChange("oil_shrinkage")}
        helperText="Bo^-1 style shrinkage (e.g. 0.9237)"
        inputProps={{ step: 0.0001, min: 0, max: 2 }}
        size="small"
        fullWidth
      />
      <TextField
        label="Flash Factor (scf/stb)"
        type="number"
        value={pvt.flash_factor}
        onChange={handleChange("flash_factor")}
        helperText="Gas evolved when oil flashes to standard (e.g. 94.13)"
        inputProps={{ step: 0.01, min: 0 }}
        size="small"
        fullWidth
      />
      <TextField
        label="BS&W (fraction)"
        type="number"
        value={pvt.bsw}
        onChange={handleChange("bsw")}
        helperText="Basic sediment & water fraction 0-1 (e.g. 0.2496)"
        inputProps={{ step: 0.0001, min: 0, max: 1 }}
        size="small"
        fullWidth
      />
    </Stack>
  );
}
