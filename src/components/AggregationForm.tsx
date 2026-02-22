import {
  FormControl,
  FormLabel,
  Select,
  MenuItem,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Stack,
  Typography,
} from "@mui/material";
import type { MeterAggregationConfig, AggregationMode } from "../types/analysis";

const AVAILABLE_METERS = ["mpfm1", "mpfm2", "mpfm3"];

interface Props {
  config: MeterAggregationConfig;
  onChange: (config: MeterAggregationConfig) => void;
}

export default function AggregationForm({ config, onChange }: Props) {
  const toggleMeter = (id: string) => {
    const already = config.meter_ids.includes(id);
    // Prevent deselecting the last meter
    if (already && config.meter_ids.length === 1) return;
    const meter_ids = already
      ? config.meter_ids.filter((m) => m !== id)
      : [...config.meter_ids, id];
    onChange({ ...config, meter_ids });
  };

  return (
    <Stack spacing={2}>
      <FormControl size="small">
        <FormLabel sx={{ mb: 0.5 }}>Aggregation method</FormLabel>
        <Select
          value={config.mode}
          onChange={(e) =>
            onChange({ ...config, mode: e.target.value as AggregationMode })
          }
        >
          <MenuItem value="sum">Sum of meters</MenuItem>
          <MenuItem value="by_difference" disabled>
            By difference (coming soon)
          </MenuItem>
        </Select>
      </FormControl>

      {config.mode === "sum" && (
        <FormControl component="fieldset">
          <FormLabel sx={{ mb: 0.5 }}>Meters to include</FormLabel>
          <FormGroup row>
            {AVAILABLE_METERS.map((id) => (
              <FormControlLabel
                key={id}
                label={
                  <Typography variant="body2">
                    {id.toUpperCase()}
                  </Typography>
                }
                control={
                  <Checkbox
                    size="small"
                    checked={config.meter_ids.includes(id)}
                    onChange={() => toggleMeter(id)}
                  />
                }
              />
            ))}
          </FormGroup>
        </FormControl>
      )}
    </Stack>
  );
}
