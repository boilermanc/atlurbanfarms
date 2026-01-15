import React from 'react';

export type ChartType = 'line' | 'bar' | 'pie';

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

interface ReportChartProps {
  type: ChartType;
  data: ChartDataPoint[];
  height?: number;
  showLabels?: boolean;
  showValues?: boolean;
  formatValue?: (value: number) => string;
}

const DEFAULT_COLORS = [
  '#10b981', // emerald-500
  '#3b82f6', // blue-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#84cc16', // lime-500
  '#f97316', // orange-500
  '#6366f1', // indigo-500
];

const ReportChart: React.FC<ReportChartProps> = ({
  type,
  data,
  height = 200,
  showLabels = true,
  showValues = true,
  formatValue = (v) => v.toLocaleString(),
}) => {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-slate-400"
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  // Assign colors to data points
  const coloredData = data.map((d, i) => ({
    ...d,
    color: d.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
  }));

  if (type === 'pie') {
    return <PieChart data={coloredData} height={height} formatValue={formatValue} />;
  }

  if (type === 'line') {
    return (
      <LineChart
        data={coloredData}
        height={height}
        maxValue={maxValue}
        showLabels={showLabels}
        showValues={showValues}
        formatValue={formatValue}
      />
    );
  }

  // Bar chart
  return (
    <BarChart
      data={coloredData}
      height={height}
      maxValue={maxValue}
      showLabels={showLabels}
      showValues={showValues}
      formatValue={formatValue}
    />
  );
};

// Line Chart Component
const LineChart: React.FC<{
  data: ChartDataPoint[];
  height: number;
  maxValue: number;
  showLabels: boolean;
  showValues: boolean;
  formatValue: (value: number) => string;
}> = ({ data, height, maxValue, showLabels, showValues, formatValue }) => {
  const chartHeight = height - 40; // Leave space for labels
  const chartWidth = 100; // Percentage
  const pointSpacing = chartWidth / Math.max(data.length - 1, 1);

  // Create path for the line
  const points = data.map((d, i) => {
    const x = i * pointSpacing;
    const y = chartHeight - (d.value / maxValue) * chartHeight;
    return { x, y, ...d };
  });

  // Create SVG path
  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  // Create area fill path
  const areaD = `${pathD} L ${points[points.length - 1].x} ${chartHeight} L 0 ${chartHeight} Z`;

  return (
    <div style={{ height }} className="relative">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full"
        style={{ height: chartHeight }}
        preserveAspectRatio="none"
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
          <line
            key={ratio}
            x1="0"
            y1={chartHeight * (1 - ratio)}
            x2={chartWidth}
            y2={chartHeight * (1 - ratio)}
            stroke="#334155"
            strokeWidth="0.2"
            strokeDasharray="1,1"
          />
        ))}

        {/* Area fill */}
        <path d={areaD} fill="rgba(16, 185, 129, 0.1)" />

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke="#10b981"
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="0.8"
            fill="#10b981"
            className="hover:r-[1.2] transition-all cursor-pointer"
          >
            <title>{`${p.label}: ${formatValue(p.value)}`}</title>
          </circle>
        ))}
      </svg>

      {/* X-axis labels */}
      {showLabels && (
        <div className="flex justify-between mt-2 text-xs text-slate-400 overflow-hidden">
          {data.length <= 10 ? (
            data.map((d, i) => (
              <span key={i} className="truncate text-center" style={{ maxWidth: `${100 / data.length}%` }}>
                {d.label}
              </span>
            ))
          ) : (
            <>
              <span>{data[0].label}</span>
              <span>{data[Math.floor(data.length / 2)]?.label}</span>
              <span>{data[data.length - 1].label}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// Bar Chart Component
const BarChart: React.FC<{
  data: ChartDataPoint[];
  height: number;
  maxValue: number;
  showLabels: boolean;
  showValues: boolean;
  formatValue: (value: number) => string;
}> = ({ data, height, maxValue, showLabels, showValues, formatValue }) => {
  const chartHeight = height - 30; // Leave space for labels

  return (
    <div style={{ height }} className="flex flex-col">
      <div className="flex-1 flex items-end gap-1" style={{ height: chartHeight }}>
        {data.map((d, i) => {
          const barHeight = (d.value / maxValue) * 100;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center justify-end group relative"
            >
              {showValues && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-700 px-2 py-1 rounded text-xs text-white whitespace-nowrap z-10">
                  {formatValue(d.value)}
                </div>
              )}
              <div
                className="w-full rounded-t transition-all hover:opacity-80 cursor-pointer"
                style={{
                  height: `${barHeight}%`,
                  minHeight: d.value > 0 ? '2px' : '0',
                  backgroundColor: d.color,
                }}
                title={`${d.label}: ${formatValue(d.value)}`}
              />
            </div>
          );
        })}
      </div>

      {/* X-axis labels */}
      {showLabels && (
        <div className="flex gap-1 mt-2">
          {data.map((d, i) => (
            <div
              key={i}
              className="flex-1 text-xs text-slate-400 text-center truncate"
              title={d.label}
            >
              {d.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Pie Chart Component
const PieChart: React.FC<{
  data: ChartDataPoint[];
  height: number;
  formatValue: (value: number) => string;
}> = ({ data, height, formatValue }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const size = Math.min(height, 200);
  const center = size / 2;
  const radius = size * 0.35;

  // Calculate pie slices
  let currentAngle = -90; // Start from top
  const slices = data.map((d) => {
    const percentage = total > 0 ? (d.value / total) * 100 : 0;
    const angle = (percentage / 100) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    // Calculate path
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);

    const largeArc = angle > 180 ? 1 : 0;

    const pathD = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    return {
      ...d,
      percentage,
      pathD,
    };
  });

  return (
    <div className="flex items-center gap-6" style={{ height }}>
      {/* Pie */}
      <svg viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0" style={{ width: size, height: size }}>
        {slices.map((slice, i) => (
          <path
            key={i}
            d={slice.pathD}
            fill={slice.color}
            stroke="#1e293b"
            strokeWidth="1"
            className="hover:opacity-80 transition-opacity cursor-pointer"
          >
            <title>{`${slice.label}: ${formatValue(slice.value)} (${slice.percentage.toFixed(1)}%)`}</title>
          </path>
        ))}
        {/* Center hole for donut effect */}
        <circle cx={center} cy={center} r={radius * 0.5} fill="#1e293b" />
      </svg>

      {/* Legend */}
      <div className="flex-1 space-y-2 overflow-y-auto" style={{ maxHeight: height }}>
        {slices.map((slice, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: slice.color }}
            />
            <span className="text-slate-300 truncate flex-1">{slice.label}</span>
            <span className="text-slate-400 whitespace-nowrap">
              {slice.percentage.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReportChart;
