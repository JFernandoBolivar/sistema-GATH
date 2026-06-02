import React, { CSSProperties } from "react";
import {
  scaleBand,
  scaleLinear,
  max,
  line as d3_line,
  min,
  curveMonotoneX,
} from "d3";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
type Item = {
  key: string;
  metric1: number;
  metric2: number;
};
export function BarChartLine({ data }: { data: Item[] }) {
  const minBars = 10;
  const filledData = [
    ...data,
    ...Array.from({ length: Math.max(0, minBars - data.length) }, (_, i) => ({
      key: `\u00A0`,
      metric1: 0,
      metric2: 0,
    })),
  ];

  const allKeys = filledData.map((d) => d.key);
  const maxMetric1 = max(data.map((d) => d.metric1)) ?? 0;
  const maxMetric2 = max(data.map((d) => d.metric2)) ?? 0;
  const minMetric2 = min(data.map((d) => d.metric2)) ?? 0;

  const xScale = scaleBand()
    .domain(allKeys)
    .range([0, 100])
    .padding(0.3);

  const yScaleMetric1 = scaleLinear().domain([0, maxMetric1]).range([100, 0]);

  const yScaleMetric2 = scaleLinear()
    .domain([minMetric2, maxMetric2])
    .range([100, 0]);

  const line = d3_line<(typeof data)[number]>()
    .x((d) => {
      const xPosition = xScale(d.key) ?? 0;
      const bandwidth = xScale.bandwidth() ?? 0;
      return xPosition + bandwidth / 2;
    })
    .y((d) => yScaleMetric2(d.metric2))
    .curve(curveMonotoneX);

  const d = line(data);

  return (
    <div
      className="relative h-80 w-full grid"
      style={
        {
          "--marginTop": "0px",
          "--marginRight": "25px",
          "--marginBottom": "90px",
          "--marginLeft": "35px",
        } as CSSProperties
      }
    >
      {/* Left Y-axis */}
      <div
        className="absolute 
          h-[calc(100%-var(--marginTop)-var(--marginBottom))]
          translate-y-[var(--marginTop)]
          w-[var(--marginLeft)]
          left-0
          overflow-visible
        "
      >
        {yScaleMetric1
          .ticks(8)
          .map(yScaleMetric1.tickFormat(8, "d"))
          .map((value, i) => (
            <div
              key={i}
              style={{
                right: "0%",
                top: `${yScaleMetric1(+value)}%`,
              }}
              className="absolute -translate-y-1/2 text-[10px] tabular-nums text-violet-400 font-medium text-right w-full pr-1"
            >
              {value}
            </div>
          ))}
      </div>

      {/* Right Y-axis */}
      <div
        className="absolute 
          h-[calc(100%-var(--marginTop)-var(--marginBottom))]
          translate-y-[var(--marginTop)]
          w-[var(--marginRight)]
          right-0
          overflow-visible
        "
      >
        {yScaleMetric2
          .ticks(8)
          .map(yScaleMetric2.tickFormat(8, "d"))
          .map((value, i) => (
            <div
              key={i}
              style={{
                right: "0%",
                top: `${yScaleMetric2(+value)}%`,
              }}
              className="absolute -translate-y-1/2 text-[10px] tabular-nums text-rose-400 font-medium w-full text-right"
            >
              {value}
            </div>
          ))}
      </div>

      {/* Chart Area */}
      <div
        className="absolute inset-0
          z-10
          h-[calc(100%-var(--marginTop)-var(--marginBottom))]
          w-[calc(100%-var(--marginLeft)-var(--marginRight))]
          translate-x-[var(--marginLeft)]
          translate-y-[var(--marginTop)]
          overflow-visible
        "
      >
        {/* Bars */}
        <div className="relative w-full h-full">
          {filledData.map((d) => {
            const barWidth = xScale.bandwidth();
            const barHeight = yScaleMetric1(0) - yScaleMetric1(d.metric1);
            const isFiller = !d.key.trim();

            return (
              <React.Fragment key={`bar-${d.key}-${Math.random()}`}>
                {!isFiller && (
                  <div
                    style={{
                      width: `${barWidth}%`,
                      height: `${barHeight}%`,
                      borderRadius: "6px 6px 0 0",
                      marginLeft: `${xScale(d.key)}%`,
                    }}
                    className="absolute bottom-0 bg-gradient-to-b from-violet-200 to-violet-300"
                  />
                )}
              </React.Fragment>
            );
          })}
          {/* X Axis (Labels) — only real data, not fillers */}
          {data.map((entry, i) => {
            const xPosition = xScale(entry.key)! + xScale.bandwidth() / 2;

            return (
              <div
                key={i}
                className="absolute overflow-visible"
                style={{
                  left: `${xPosition}%`,
                  top: "100%",
                  transform: "rotate(45deg) translateX(4px) translateY(10px)",
                }}
              >
                <HoverCard openDelay={200}>
                  <HoverCardTrigger asChild>
                    <div className="absolute text-[10px] font-medium text-gray-600 whitespace-nowrap max-w-[100px] truncate cursor-default">
                      {entry.key}
                    </div>
                  </HoverCardTrigger>
                  <HoverCardContent side="top" className="w-fit max-w-[280px] text-xs px-2 py-1">
                    {entry.key}
                  </HoverCardContent>
                </HoverCard>
              </div>
            );
          })}
        </div>

        {/* Line */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full overflow-visible pointer-events-none z-20"
          preserveAspectRatio="none"
        >
          <path
            d={d ?? ""}
            fill="none"
            className="text-rose-400"
            stroke="currentColor"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    </div>
  );
}
