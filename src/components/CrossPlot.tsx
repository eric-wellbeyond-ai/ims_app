import { useMemo, useState } from "react";
import { Box, Tabs, Tab } from "@mui/material";
import {
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
  ErrorBar,
} from "recharts";

const PHASES = ["oil", "gas", "water", "liquid"] as const;
type Phase = typeof PHASES[number];

// Maps each phase to its sigma column names in sigma_ts
const SIGMA_MAP: Record<Phase, { mpfm: string; sep: string }> = {
  oil:    { mpfm: "sigma_mpfm_oil",    sep: "sigma_sep_oil_std" },
  gas:    { mpfm: "sigma_mpfm_gas",    sep: "sigma_sep_gas_std" },
  water:  { mpfm: "sigma_mpfm_water",  sep: "sigma_sep_free_water" },
  liquid: { mpfm: "sigma_mpfm_liquid", sep: "sigma_sep_liquid_std" },
};

interface CrossPlotProps {
  deviations: Record<string, number | string | null>[];
  sigmaTsRows: Record<string, number | string | null>[];
}

export default function CrossPlot({ deviations, sigmaTsRows }: CrossPlotProps) {
  const [tab, setTab] = useState(0);
  const phase = PHASES[tab];

  const { scatterData, lineData, domain, hasErrors } = useMemo(() => {
    const sigmaMap = SIGMA_MAP[phase];

    const points = deviations
      .map((d, i) => {
        const s = sigmaTsRows[i] ?? {};
        return {
          sep:    d[`${phase}_sep`]  as number | null,
          mpfm:   d[`${phase}_mpfm`] as number | null,
          errorX: (s[sigmaMap.sep]  as number | null) ?? 0,
          errorY: (s[sigmaMap.mpfm] as number | null) ?? 0,
        };
      })
      .filter(
        (p): p is { sep: number; mpfm: number; errorX: number; errorY: number } =>
          typeof p.sep === "number" &&
          typeof p.mpfm === "number" &&
          !isNaN(p.sep) &&
          !isNaN(p.mpfm)
      );

    const hasErrors = points.some((p) => p.errorX > 0 || p.errorY > 0);

    const allVals = points.flatMap((p) => [p.sep, p.mpfm]);
    const dataMin = Math.min(...allVals);
    const dataMax = Math.max(...allVals);
    const range = dataMax - dataMin || 1;
    const margin = range * 0.02;
    const axisMin = dataMin - margin;
    const axisMax = dataMax + margin;
    const lineData = [
      { sep: axisMin, mpfm: axisMin },
      { sep: axisMax, mpfm: axisMax },
    ];

    return { scatterData: points, lineData, domain: [axisMin, axisMax] as [number, number], hasErrors };
  }, [deviations, sigmaTsRows, phase]);

  return (
    <Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1 }}>
        {PHASES.map((p) => (
          <Tab key={p} label={p.charAt(0).toUpperCase() + p.slice(1)} />
        ))}
      </Tabs>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={scatterData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="sep"
            type="number"
            name="Sep Ref"
            domain={domain}
            tickFormatter={(v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            label={{
              value: "Separator Reference",
              position: "insideBottom",
              offset: -5,
            }}
          />
          <YAxis
            dataKey="mpfm"
            type="number"
            name="MPFM"
            domain={domain}
            tickFormatter={(v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            label={{ value: "MPFM", angle: -90, position: "insideLeft" }}
          />
          <Tooltip
            formatter={(v: number | undefined) =>
              v != null ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : ""
            }
          />
          <Scatter data={scatterData} fill="#1565c0" opacity={0.3} r={2}>
            {hasErrors && (
              <ErrorBar
                dataKey="errorX"
                direction="x"
                width={2}
                strokeWidth={1}
                stroke="#1565c0"
                opacity={0.4}
              />
            )}
            {hasErrors && (
              <ErrorBar
                dataKey="errorY"
                direction="y"
                width={2}
                strokeWidth={1}
                stroke="#1565c0"
                opacity={0.4}
              />
            )}
          </Scatter>
          <Line
            data={lineData}
            dataKey="mpfm"
            stroke="red"
            strokeDasharray="5 5"
            dot={false}
            name="1:1 Line"
            legendType="none"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Box>
  );
}
