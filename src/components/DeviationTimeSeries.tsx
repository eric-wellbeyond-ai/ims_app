import { useState } from "react";
import { Box, Tabs, Tab } from "@mui/material";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

const PHASES = ["oil", "gas", "water", "liquid"] as const;

interface DeviationTimeSeriesProps {
  deviations: Record<string, number | string | null>[];
}

export default function DeviationTimeSeries({
  deviations,
}: DeviationTimeSeriesProps) {
  const [tab, setTab] = useState(0);
  const phase = PHASES[tab];

  // Convert relative deviation to percentage
  const data = deviations.map((d) => ({
    timestamp: d.timestamp,
    deviation:
      typeof d[`${phase}_rel_dev`] === "number"
        ? (d[`${phase}_rel_dev`] as number) * 100
        : null,
  }));

  return (
    <Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1 }}>
        {PHASES.map((p) => (
          <Tab key={p} label={p.charAt(0).toUpperCase() + p.slice(1)} />
        ))}
      </Tabs>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="timestamp"
            tick={{ fontSize: 10 }}
            tickFormatter={(v: string) =>
              v ? new Date(v).toLocaleTimeString() : ""
            }
          />
          <YAxis
            tickFormatter={(v: number) => v.toFixed(1)}
            label={{
              value: "Rel. Deviation (%)",
              angle: -90,
              position: "insideLeft",
            }}
          />
          <Tooltip
            labelFormatter={(v: string) =>
              v ? new Date(v).toLocaleString() : ""
            }
            formatter={(v: number) => [`${v.toFixed(2)}%`, "Deviation"]}
          />
          <ReferenceLine y={0} stroke="#000" strokeWidth={0.5} />
          <ReferenceLine
            y={5}
            stroke="red"
            strokeDasharray="5 5"
            label={{ value: "+5%", position: "right", fill: "red" }}
          />
          <ReferenceLine
            y={-5}
            stroke="red"
            strokeDasharray="5 5"
            label={{ value: "-5%", position: "right", fill: "red" }}
          />
          <Line
            type="monotone"
            dataKey="deviation"
            stroke="#1565c0"
            dot={false}
            strokeWidth={1}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}
