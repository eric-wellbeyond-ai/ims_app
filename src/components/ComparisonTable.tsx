import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
} from "@mui/material";
import type { PhaseResult } from "../types/analysis";

interface ComparisonTableProps {
  comparison: PhaseResult[];
}

function fmtPct(val: number): string {
  return `${(val * 100).toFixed(2)}%`;
}

function fmtVal(val: number): string {
  return val.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function ComparisonTable({ comparison }: ComparisonTableProps) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Phase</TableCell>
            <TableCell>Unit</TableCell>
            <TableCell align="right">MPFM Mean</TableCell>
            <TableCell align="right">Sep Ref Mean</TableCell>
            <TableCell align="right">Rel. Deviation</TableCell>
            <TableCell align="right">Std Dev</TableCell>
            <TableCell align="center">95% CI</TableCell>
            <TableCell align="center">Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {comparison.map((row) => (
            <TableRow key={row.phase}>
              <TableCell sx={{ fontWeight: 600, textTransform: "capitalize" }}>
                {row.phase}
              </TableCell>
              <TableCell>{row.unit}</TableCell>
              <TableCell align="right">{fmtVal(row.mpfm_mean)}</TableCell>
              <TableCell align="right">{fmtVal(row.sep_ref_mean)}</TableCell>
              <TableCell align="right">{fmtPct(row.mean_rel_deviation)}</TableCell>
              <TableCell align="right">{fmtPct(row.std_rel_deviation)}</TableCell>
              <TableCell align="center">
                [{fmtPct(row.ci95_rel_lower)}, {fmtPct(row.ci95_rel_upper)}]
              </TableCell>
              <TableCell align="center">
                {row.within_acceptance === true && (
                  <Chip label="PASS" color="success" size="small" />
                )}
                {row.within_acceptance === false && (
                  <Chip label="FAIL" color="error" size="small" />
                )}
                {row.within_acceptance === null && (
                  <Chip label="N/A" size="small" />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
