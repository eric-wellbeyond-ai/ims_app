import { useState } from "react";
import { Box, Tabs, Tab } from "@mui/material";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const PHASES = ["oil", "gas", "water", "liquid"] as const;
const COLORS = { mpfm: "#1565c0", sep: "#f57c00" };

interface TimeSeriesChartProps {
  deviations: Record<string, number | string | null>[];
}

export default function TimeSeriesChart({ deviations }: TimeSeriesChartProps) {
  const [tab, setTab] = useState(0);
  const phase = PHASES[tab];

  return (
    <Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1 }}>
        {PHASES.map((p) => (
          <Tab key={p} label={p.charAt(0).toUpperCase() + p.slice(1)} />
        ))}
      </Tabs>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={deviations}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="timestamp"
            tick={{ fontSize: 10 }}
            tickFormatter={(v: string) =>
              v ? new Date(v).toLocaleTimeString() : ""
            }
          />
          <YAxis tickFormatter={(v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 1 })} />
          <Tooltip
            labelFormatter={(v) =>
              typeof v === "string" && v ? new Date(v).toLocaleString() : String(v ?? "")
            }
            formatter={(v: number | undefined) =>
              v != null ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : ""
            }
          />
          <Legend />
          <Line
            type="monotone"
            dataKey={`${phase}_mpfm`}
            stroke={COLORS.mpfm}
            name="MPFM"
            dot={false}
            strokeWidth={1.5}
          />
          <Line
            type="monotone"
            dataKey={`${phase}_sep`}
            stroke={COLORS.sep}
            name="Sep Ref"
            dot={false}
            strokeWidth={1.5}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}
