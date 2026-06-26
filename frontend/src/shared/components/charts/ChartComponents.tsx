'use client';
/**
 * Chart.js wrapper components — drop-in replacements for Recharts.
 * Stubs are declared FIRST so their references are stable when
 * chart containers do child.type identity checks at runtime.
 */

import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
  type ChartOptions,
  type ChartData,
  type ScriptableContext,
} from 'chart.js';
import {
  Bar as ChartBar,
  Line as ChartLine,
  Doughnut as ChartDoughnut,
} from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Filler, Tooltip, Legend,
);

// ─── Shared style defaults ────────────────────────────────────
function isDarkMode() {
  if (typeof document === 'undefined') return true;
  return document.documentElement.classList.contains('dark');
}

function getTooltipStyle() {
  const dark = isDarkMode();
  return {
    backgroundColor: dark ? '#1e293b' : '#ffffff',
    borderColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
    borderWidth: 1,
    titleColor: dark ? '#f8fafc' : '#0f172a',
    bodyColor: dark ? '#94a3b8' : '#475569',
    cornerRadius: 10,
    padding: 10,
    boxPadding: 4,
  };
}

function getAxisDefaults() {
  const dark = isDarkMode();
  return {
    ticks: { color: dark ? '#64748b' : '#94a3b8', font: { size: 12 } },
    grid: { color: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)' },
  };
}

// Keep for backward compat
const darkTooltip = {
  backgroundColor: '#1e293b',
  borderColor: 'rgba(255,255,255,0.1)',
  borderWidth: 1,
  titleColor: '#f8fafc',
  bodyColor: '#94a3b8',
  cornerRadius: 10,
  padding: 10,
  boxPadding: 4,
};

const axisDefaults = {
  ticks: { color: '#64748b', font: { size: 12 } },
  grid: { color: 'rgba(255,255,255,0.05)' },
};

// ─── Prop types ───────────────────────────────────────────────
interface DataItem { [key: string]: string | number; }

interface BarChartProps {
  data: DataItem[];
  children?: React.ReactNode;
  margin?: object;
  width?: number | string;
  height?: number | string;
  layout?: 'horizontal' | 'vertical';
}
interface BarProps {
  dataKey: string; name?: string; fill?: string;
  radius?: number | number[]; barSize?: number;
  data?: Array<{ color?: string }>;
  stackId?: string;
  children?: React.ReactNode;
}
interface AreaProps {
  dataKey: string; name?: string; stroke?: string;
  strokeWidth?: number; fill?: string; type?: string; fillOpacity?: number;
  activeDot?: boolean | object;
}
interface LineItemProps {
  dataKey: string; name?: string; stroke?: string;
  strokeWidth?: number; dot?: boolean | object; activeDot?: boolean | object; type?: string;
}
interface TooltipProps {
  contentStyle?: object; itemStyle?: object;
  formatter?: (v: unknown, n: string) => unknown;
  cursor?: boolean | object;
  content?: (props: unknown) => React.ReactNode;
}
interface PieProps {
  data: Array<{ name: string; value?: number; color?: string; [key: string]: unknown }>;
  dataKey: string; cx?: string | number; cy?: string | number;
  innerRadius?: number; outerRadius?: number; paddingAngle?: number;
  label?: boolean | object | ((props: unknown) => string);
  labelLine?: boolean | object;
  stroke?: string; children?: React.ReactNode;
}
interface CellProps { fill?: string; stroke?: string; }
interface XAxisProps { 
  dataKey?: string; 
  stroke?: string; 
  fontSize?: number; 
  tickLine?: boolean; 
  axisLine?: boolean; 
  dy?: number;
  dx?: number;
  type?: 'number' | 'category';
  hide?: boolean;
  interval?: number | 'preserveStart' | 'preserveEnd' | 'preserveStartEnd';
  angle?: number;
  textAnchor?: string;
  height?: number;
  ticks?: number[];
}
interface YAxisProps { 
  stroke?: string; 
  fontSize?: number; 
  tickFormatter?: (v: unknown) => string; 
  tickLine?: boolean; 
  axisLine?: boolean;
  dy?: number;
  dx?: number;
  type?: 'number' | 'category';
  hide?: boolean;
  dataKey?: string;
  width?: number;
  domain?: unknown[];
  ticks?: number[];
  allowDecimals?: boolean;
  unit?: string;
}
interface LegendProps { iconType?: string; wrapperStyle?: object; }
interface PieChartProps { children?: React.ReactNode; width?: number | string; height?: number | string; }

// ─────────────────────────────────────────────────────────────
// STUBS — declared first so their function identity is stable
// when chart containers compare child.type at runtime.
// ─────────────────────────────────────────────────────────────
export function XAxis(_p: XAxisProps) { return null; }
export function YAxis(_p: YAxisProps) { return null; }
export function CartesianGrid(_p: any) { return null; }

export function BarStub(_p: BarProps) { return null; }
export { BarStub as Bar };

export function AreaStub(_p: AreaProps) { return null; }
export { AreaStub as Area };

export function LineStub(_p: LineItemProps) { return null; }
export { LineStub as Line };

export function PieStub(_p: PieProps) { return null; }
export { PieStub as Pie };

export function CellStub(_p: CellProps) { return null; }
export { CellStub as Cell };

export function TooltipStub(_p: TooltipProps) { return null; }
export { TooltipStub as Tooltip };
export { TooltipStub as RechartsTooltip };

export function LegendStub(_p: LegendProps) { return null; }
export { LegendStub as Legend };

// ─────────────────────────────────────────────────────────────
// ResponsiveContainer
// ─────────────────────────────────────────────────────────────
export function ResponsiveContainer({
  children, width = '100%', height = '100%', minWidth, minHeight,
}: {
  children?: React.ReactNode; width?: string | number;
  height?: string | number; minWidth?: number; minHeight?: number;
}) {
  return (
    <div style={{
      width: typeof width === 'number' ? `${width}px` : width,
      height: typeof height === 'number' ? `${height}px` : height,
      minWidth, minHeight, position: 'relative',
    }}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BarChart
// ─────────────────────────────────────────────────────────────
export function BarChart({ data, children }: BarChartProps) {
  let xDataKey = 'name';
  let yTickFormatter: ((v: any) => string) | undefined;
  const bars: BarProps[] = [];
  let showLegend = false;

  React.Children.forEach(children, (child: any) => {
    if (!child) return;
    const t = child.type;
    if (t === XAxis) xDataKey = child.props.dataKey || 'name';
    if (t === YAxis) yTickFormatter = child.props.tickFormatter;
    if (t === BarStub) bars.push(child.props);
    if (t === LegendStub) showLegend = true;
  });

  const labels = data.map((d) => String(d[xDataKey] ?? ''));

  const datasets = bars.map((bar) => {
    const perItemColors = bar.data?.map((d) => d.color || bar.fill || '#3B82F6');
    return {
      label: bar.name || bar.dataKey,
      data: data.map((d) => Number(d[bar.dataKey] ?? 0)),
      backgroundColor: perItemColors ?? (bar.fill || '#3B82F6'),
      borderRadius: Array.isArray(bar.radius) ? bar.radius[0] : (bar.radius ?? 6),
      barThickness: bar.barSize,
      borderSkipped: false as const,
    };
  });

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: showLegend
        ? { labels: { color: '#94a3b8', boxWidth: 12 } }
        : { display: false },
      tooltip: { ...getTooltipStyle() },
    },
    scales: {
      x: { ...getAxisDefaults(), grid: { color: 'transparent' } },
      y: {
        ...getAxisDefaults(),
        ticks: { ...getAxisDefaults().ticks, callback: yTickFormatter || ((v: any) => v) },
      },
    },
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <ChartBar data={{ labels, datasets }} options={options} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AreaChart
// ─────────────────────────────────────────────────────────────
export function AreaChart({ data, children }: BarChartProps) {
  let xDataKey = 'name';
  let yTickFormatter: ((v: any) => string) | undefined;
  const areas: AreaProps[] = [];

  React.Children.forEach(children, (child: any) => {
    if (!child) return;
    const t = child.type;
    if (t === XAxis) xDataKey = child.props.dataKey || 'name';
    if (t === YAxis) yTickFormatter = child.props.tickFormatter;
    if (t === AreaStub) areas.push(child.props);
  });

  const labels = data.map((d) => String(d[xDataKey] ?? ''));

  const datasets = areas.map((area) => ({
    label: area.name || area.dataKey,
    data: data.map((d) => Number(d[area.dataKey] ?? 0)),
    borderColor: area.stroke || '#3B82F6',
    borderWidth: area.strokeWidth ?? 3,
    fill: true,
    backgroundColor: (context: ScriptableContext<'line'>) => {
      const chart = context.chart;
      const { ctx, chartArea } = chart;
      if (!chartArea) return 'transparent';
      const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
      gradient.addColorStop(0, `${area.stroke || '#3B82F6'}4D`);
      gradient.addColorStop(1, `${area.stroke || '#3B82F6'}00`);
      return gradient;
    },
    tension: 0.4,
    pointRadius: 0,
    pointHoverRadius: 6,
  }));

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { ...getTooltipStyle() },
    },
    scales: {
      x: { ...getAxisDefaults(), grid: { color: 'transparent' } },
      y: {
        ...getAxisDefaults(),
        ticks: { ...getAxisDefaults().ticks, callback: yTickFormatter || ((v: any) => v) },
      },
    },
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <ChartLine data={{ labels, datasets }} options={options} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LineChart
// ─────────────────────────────────────────────────────────────
export function LineChart({ data, children }: BarChartProps) {
  let xDataKey = 'name';
  let yTickFormatter: ((v: any) => string) | undefined;
  const lines: LineItemProps[] = [];
  let showLegend = false;

  React.Children.forEach(children, (child: any) => {
    if (!child) return;
    const t = child.type;
    if (t === XAxis) xDataKey = child.props.dataKey || 'name';
    if (t === YAxis) yTickFormatter = child.props.tickFormatter;
    if (t === LineStub) lines.push(child.props);
    if (t === LegendStub) showLegend = true;
  });

  const labels = data.map((d) => String(d[xDataKey] ?? ''));

  const datasets = lines.map((line) => ({
    label: line.name || line.dataKey,
    data: data.map((d) => Number(d[line.dataKey] ?? 0)),
    borderColor: line.stroke || '#3B82F6',
    borderWidth: line.strokeWidth ?? 2,
    fill: false,
    tension: 0.4,
    pointRadius: 3,
    pointHoverRadius: 6,
  }));

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: showLegend ? { labels: { color: '#94a3b8', boxWidth: 12 } } : { display: false },
      tooltip: { ...getTooltipStyle() },
    },
    scales: {
      x: { ...getAxisDefaults(), grid: { color: 'transparent' } },
      y: {
        ...getAxisDefaults(),
        ticks: { ...getAxisDefaults().ticks, callback: yTickFormatter || ((v: any) => v) },
      },
    },
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <ChartLine data={{ labels, datasets }} options={options} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PieChart
// ─────────────────────────────────────────────────────────────
export function PieChart({ children }: PieChartProps) {
  let pieProps: PieProps | null = null;
  let showLegend = false;

  React.Children.forEach(children, (child: any) => {
    if (!child) return;
    if (child.type === PieStub) pieProps = child.props;
    if (child.type === LegendStub) showLegend = true;
  });

  if (!pieProps) return null;

  const p = pieProps as PieProps;
  const labels = p.data.map((d) => d.name);
  const values = p.data.map((d) => d.value ?? 0);

  // Collect Cell fill colors from Pie's children
  const cellColors: string[] = [];
  React.Children.forEach(p.children, (child: any) => {
    if (child?.type === CellStub) {
      cellColors.push(child.props.fill || '#64748b');
    }
  });

  const defaultColors = ['#0A6EFF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];
  const finalColors = cellColors.length > 0
    ? cellColors
    : p.data.map((d, i) => d.color || defaultColors[i % defaultColors.length]);

  const isDoughnut = (p.innerRadius ?? 0) > 0;

  const chartData: ChartData<'doughnut'> = {
    labels,
    datasets: [{
      data: values,
      backgroundColor: finalColors,
      borderColor: 'transparent',
      borderWidth: 0,
      hoverOffset: 4,
    }],
  };

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: isDoughnut
      ? `${Math.round((p.innerRadius! / (p.outerRadius! || 105)) * 100)}%`
      : '0%',
    plugins: {
      legend: showLegend
        ? { position: 'bottom', labels: { color: '#94a3b8', boxWidth: 12, padding: 16 } }
        : { display: false },
      tooltip: { ...getTooltipStyle() },
    },
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <ChartDoughnut data={chartData} options={options} />
    </div>
  );
}
