import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  Typography,
  Stack,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { ChannelUncertainties } from "../types/analysis";

interface UncertaintyFormProps {
  unc: ChannelUncertainties;
  onChange: (unc: ChannelUncertainties) => void;
}

const CHANNELS: { label: string; field: keyof ChannelUncertainties; helper: string }[] = [
  { label: "Sep Liquid (%)",  field: "sep_liquid_pct",  helper: "Separator total liquid flow meter — applied to all timestamps" },
  { label: "Sep Gas (%)",     field: "sep_gas_pct",     helper: "Separator gas orifice meter — applied to all timestamps" },
  { label: "MPFM Oil (%)",    field: "mpfm_oil_pct",    helper: "Applied equally to all 3 MPFM oil channels" },
  { label: "MPFM Gas (%)",    field: "mpfm_gas_pct",    helper: "Applied equally to all 3 MPFM gas channels" },
  { label: "MPFM Water (%)",  field: "mpfm_water_pct",  helper: "Applied equally to all 3 MPFM water channels" },
];

export default function UncertaintyForm({ unc, onChange }: UncertaintyFormProps) {
  const handleChange = (field: keyof ChannelUncertainties) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...unc, [field]: parseFloat(e.target.value) || 0 });
    };

  return (
    <Accordion disableGutters variant="outlined">
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle1">Measurement Uncertainties (optional)</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Enter relative uncertainties (%) for each channel. Leave at 0 to omit
          error bars and uncertainty columns. One value applies uniformly to all
          timestamps for that channel.
        </Typography>
        <Stack spacing={2}>
          {CHANNELS.map(({ label, field, helper }) => (
            <TextField
              key={field}
              label={label}
              type="number"
              value={unc[field]}
              onChange={handleChange(field)}
              helperText={helper}
              inputProps={{ step: 0.1, min: 0 }}
              size="small"
              fullWidth
            />
          ))}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
