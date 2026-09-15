"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const volumeConfig = {
  info: { label: "Info / other", color: "var(--chart-2)" },
  warn: { label: "Warnings", color: "var(--chart-4)" },
  error: { label: "Errors", color: "var(--chart-1)" },
} satisfies ChartConfig;

const LEVEL_COLOR: Record<string, string> = {
  FATAL: "var(--chart-1)",
  ERROR: "var(--chart-1)",
  WARN: "var(--chart-4)",
  INFO: "var(--chart-2)",
  DEBUG: "var(--chart-3)",
  TRACE: "var(--chart-5)",
  UNKNOWN: "var(--muted-foreground)",
};

function formatBucket(bucket: string) {
  return bucket.length > 10 ? `${bucket.slice(11)}:00` : bucket.slice(5);
}

export function VolumeChart({
  data,
}: {
  data: { bucket: string; total: number; error: number; warn: number; info: number }[];
}) {
  if (!data.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No entries in range.</p>;
  }

  return (
    <ChartContainer config={volumeConfig} className="h-[260px] w-full">
      <AreaChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="bucket"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={formatBucket}
          minTickGap={24}
        />
        <YAxis tickLine={false} axisLine={false} width={36} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          dataKey="info"
          stackId="1"
          stroke="var(--color-info)"
          fill="var(--color-info)"
          fillOpacity={0.25}
        />
        <Area
          dataKey="warn"
          stackId="1"
          stroke="var(--color-warn)"
          fill="var(--color-warn)"
          fillOpacity={0.3}
        />
        <Area
          dataKey="error"
          stackId="1"
          stroke="var(--color-error)"
          fill="var(--color-error)"
          fillOpacity={0.4}
        />
      </AreaChart>
    </ChartContainer>
  );
}

export function LevelsChart({ data }: { data: { level: string; count: number }[] }) {
  const config = Object.fromEntries(
    data.map((item) => [item.level, { label: item.level, color: LEVEL_COLOR[item.level] }]),
  ) satisfies ChartConfig;

  if (!data.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No entries.</p>;
  }

  return (
    <ChartContainer config={config} className="mx-auto h-[260px] w-full">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="level" />} />
        <Pie data={data} dataKey="count" nameKey="level" innerRadius={55} outerRadius={95}>
          {data.map((item) => (
            <Cell key={item.level} fill={LEVEL_COLOR[item.level] ?? "var(--chart-3)"} />
          ))}
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="level" />} />
      </PieChart>
    </ChartContainer>
  );
}

export function LoggersChart({ data }: { data: { logger: string; count: number }[] }) {
  if (!data.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No entries.</p>;
  }

  const config = { count: { label: "Entries", color: "var(--chart-2)" } } satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="h-[260px] w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 12, right: 16 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="logger"
          width={170}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: string) => (value.length > 26 ? `…${value.slice(-25)}` : value)}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
