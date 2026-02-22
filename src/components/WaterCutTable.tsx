import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  IconButton,
  Button,
  Paper,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import type { WaterCutSample } from "../types/analysis";

interface WaterCutTableProps {
  samples: WaterCutSample[];
  onChange: (samples: WaterCutSample[]) => void;
}

export default function WaterCutTable({
  samples,
  onChange,
}: WaterCutTableProps) {
  const addRow = () => {
    onChange([...samples, { timestamp: "", value: 0 }]);
  };

  const removeRow = (index: number) => {
    onChange(samples.filter((_, i) => i !== index));
  };

  const updateRow = (
    index: number,
    field: keyof WaterCutSample,
    value: string | number
  ) => {
    const updated = samples.map((s, i) =>
      i === index ? { ...s, [field]: value } : s
    );
    onChange(updated);
  };

  return (
    <>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Sampling Time</TableCell>
              <TableCell>Water Cut (%)</TableCell>
              <TableCell width={50} />
            </TableRow>
          </TableHead>
          <TableBody>
            {samples.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{ color: "text.secondary" }}>
                  No spot samples added
                </TableCell>
              </TableRow>
            )}
            {samples.map((sample, i) => (
              <TableRow key={i}>
                <TableCell>
                  <TextField
                    type="datetime-local"
                    value={sample.timestamp}
                    onChange={(e) => updateRow(i, "timestamp", e.target.value)}
                    size="small"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    type="number"
                    value={sample.value}
                    onChange={(e) =>
                      updateRow(i, "value", parseFloat(e.target.value) || 0)
                    }
                    size="small"
                    inputProps={{ step: 0.1, min: 0, max: 100 }}
                    fullWidth
                  />
                </TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => removeRow(i)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Button
        startIcon={<AddIcon />}
        onClick={addRow}
        size="small"
        sx={{ mt: 1 }}
      >
        Add Sample
      </Button>
    </>
  );
}
