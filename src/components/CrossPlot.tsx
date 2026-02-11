import { useMemo, useState } from "react";
import { Box, Tabs, Tab } from "@mui/material";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from "recharts";

const PHASES = ["oil", "gas", "water", "liquid"] as const;

interface CrossPlotProps {
  deviations: Record<string, number | string | null>[];
}

export default function CrossPlot({ deviations }: CrossPlotProps) {
  const [tab, setTab] = useState(0);
  const phase = PHASES[tab];

  const { scatterData, lineData } = useMemo(() => {
    const points = deviations
      .map((d) => ({
        sep: d[`${phase}_sep`] as number | null,
        mpfm: d[`${phase}_mpfm`] as number | null,
      }))
      .filter(
        (p): p is { sep: number; mpfm: number } =>
          typeof p.sep === "number" &&
          typeof p.mpfm === "number" &&
          !isNaN(p.sep) &&
          !isNaN(p.mpfm)
      );

    const allVals = points.flatMap((p) => [p.sep, p.mpfm]);
    const min = Math.min(...allVals);
    const max = Math.max(...allVals);
    const lineData = [
      { sep: min, mpfm: min },
      { sep: max, mpfm: max },
    ];

    return { scatterData: points, lineData };
  }, [deviations, phase]);

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
            label={{ value: "MPFM", angle: -90, position: "insideLeft" }}
          />
          <Tooltip />
          <Scatter
            data={scatterData}
            fill="#1565c0"
            opacity={0.3}
            r={2}
          />
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
