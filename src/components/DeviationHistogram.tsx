import { useMemo, useState } from "react";
import { Box, Tabs, Tab } from "@mui/material";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

const PHASES = ["oil", "gas", "water", "liquid"] as const;

interface DeviationHistogramProps {
  deviations: Record<string, number | string | null>[];
}

function binData(
  values: number[],
  numBins: number = 30
): { bin: string; count: number; mid: number }[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const binWidth = range / numBins;

  const bins = Array.from({ length: numBins }, (_, i) => ({
    bin: `${(min + i * binWidth).toFixed(1)}`,
    count: 0,
    mid: min + (i + 0.5) * binWidth,
  }));

  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / binWidth), numBins - 1);
    bins[idx].count++;
  }
  return bins;
}

export default function DeviationHistogram({
  deviations,
}: DeviationHistogramProps) {
  const [tab, setTab] = useState(0);
  const phase = PHASES[tab];

  const { bins, mean } = useMemo(() => {
    const values = deviations
      .map((d) => d[`${phase}_rel_dev`])
      .filter((v): v is number => typeof v === "number" && !isNaN(v))
      .map((v) => v * 100);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return { bins: binData(values), mean };
  }, [deviations, phase]);

  return (
    <Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1 }}>
        {PHASES.map((p) => (
          <Tab key={p} label={p.charAt(0).toUpperCase() + p.slice(1)} />
        ))}
      </Tabs>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={bins}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="bin"
            tick={{ fontSize: 9 }}
            label={{ value: "Rel. Deviation (%)", position: "insideBottom", offset: -5 }}
          />
          <YAxis
            label={{ value: "Count", angle: -90, position: "insideLeft" }}
          />
          <Tooltip />
          <Bar dataKey="count" fill="#1565c0" />
          {bins.length > 0 && (
            <ReferenceLine
              x={bins.reduce((prev, curr) =>
                Math.abs(curr.mid - mean) < Math.abs(prev.mid - mean) ? curr : prev
              ).bin}
              stroke="red"
              strokeDasharray="3 3"
              label={{ value: `Mean: ${mean.toFixed(2)}%`, position: "top" }}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}
