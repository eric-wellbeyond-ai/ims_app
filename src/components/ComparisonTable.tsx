import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Tooltip,
} from "@mui/material";
import type { PhaseResult } from "../types/analysis";

interface ComparisonTableProps {
  comparison: PhaseResult[];
}

function fmtPct(val: number): string {
  return `${(val * 100).toFixed(2)}%`;
}

const ACRONYMS = new Set(["wc", "gor"]);

function fmtPhase(phase: string): string {
  return ACRONYMS.has(phase.toLowerCase())
    ? phase.toUpperCase()
    : phase.charAt(0).toUpperCase() + phase.slice(1);
}

function fmtVal(val: number): string {
  return val.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const UNC_CELL_SX = { color: "text.secondary", fontSize: "0.8rem" };

export default function ComparisonTable({ comparison }: ComparisonTableProps) {
  const showUnc = comparison.some((r) => r.sigma_mpfm_mean != null);

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Phase</TableCell>
            <TableCell>Unit</TableCell>
            <TableCell align="right">MPFM Mean</TableCell>
            {showUnc && (
              <TableCell align="right">
                <Tooltip title="Propagated 1-sigma measurement uncertainty on mean MPFM reading">
                  <span>± σ MPFM</span>
                </Tooltip>
              </TableCell>
            )}
            <TableCell align="right">Sep Ref Mean</TableCell>
            {showUnc && (
              <TableCell align="right">
                <Tooltip title="Propagated 1-sigma measurement uncertainty on mean separator reference reading">
                  <span>± σ Sep</span>
                </Tooltip>
              </TableCell>
            )}
            <TableCell align="right">Rel. Deviation</TableCell>
            {showUnc && (
              <TableCell align="right">
                <Tooltip title="Propagated 1-sigma uncertainty on relative deviation, combining MPFM and separator uncertainties">
                  <span>± σ Rel Dev</span>
                </Tooltip>
              </TableCell>
            )}
            <TableCell align="center">
              <Tooltip title="Whether the relative deviation is within the propagated 1-sigma measurement uncertainty">
                <span>Within Uncertainty</span>
              </Tooltip>
            </TableCell>
            <TableCell align="center">Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {comparison.map((row) => {
            return (
              <TableRow key={row.phase}>
                <TableCell sx={{ fontWeight: 600 }}>
                  {fmtPhase(row.phase)}
                </TableCell>
                <TableCell>{row.unit}</TableCell>
                <TableCell align="right">{fmtVal(row.mpfm_mean)}</TableCell>
                {showUnc && (
                  <TableCell align="right" sx={UNC_CELL_SX}>
                    {row.sigma_mpfm_mean != null ? `±${fmtVal(row.sigma_mpfm_mean)}` : "—"}
                  </TableCell>
                )}
                <TableCell align="right">{fmtVal(row.sep_ref_mean)}</TableCell>
                {showUnc && (
                  <TableCell align="right" sx={UNC_CELL_SX}>
                    {row.sigma_sep_mean != null ? `±${fmtVal(row.sigma_sep_mean)}` : "—"}
                  </TableCell>
                )}
                <TableCell align="right">{fmtPct(row.mean_rel_deviation)}</TableCell>
                {showUnc && (
                  <TableCell align="right" sx={UNC_CELL_SX}>
                    {row.sigma_rel_dev != null ? `±${fmtPct(row.sigma_rel_dev)}` : "—"}
                  </TableCell>
                )}
                <TableCell align="center">
                  {row.sigma_rel_dev != null ? (
                    Math.abs(row.mean_rel_deviation) <= row.sigma_rel_dev ? (
                      <Chip label="PASS" color="success" size="small" />
                    ) : (
                      <Chip label="FAIL" color="error" size="small" />
                    )
                  ) : (
                    <Chip label="N/A" size="small" />
                  )}
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
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
