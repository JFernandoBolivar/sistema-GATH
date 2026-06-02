import { pie, arc, PieArcDatum } from "d3";

type Item = { name: string; value: number };
export function DonutChartCenterText({ data, total }: { data: Item[]; total: number }) {
  const radius = 420;
  const gap = 0.01;
  const lightStrokeEffect = 10;

  const innerRadius = radius / 1.625;
  const arcGenerator = arc<PieArcDatum<Item>>()
    .innerRadius(innerRadius)
    .outerRadius(radius)
    .cornerRadius(4);

  const arcClip =
    arc<PieArcDatum<Item>>()
      .innerRadius(innerRadius + lightStrokeEffect / 2)
      .outerRadius(radius)
      .cornerRadius(4) || undefined;

  const labelRadius = radius * 0.825;
  const arcLabel = arc<PieArcDatum<Item>>()
    .innerRadius(labelRadius)
    .outerRadius(labelRadius);

  const pieLayout = pie<Item>()
    .value((d) => d.value)
    .padAngle(0);

  const arcs = pieLayout(data);

  function computeAngle(d: PieArcDatum<Item>) {
    return ((d.endAngle - d.startAngle) * 180) / Math.PI;
  }

  const colors = ["#7e4cfe", "#895cfc", "#956bff", "#a37fff", "#b291fd", "#b597ff"];

  return (
    <div className="relative w-full">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-zinc-500">Total</p>
          <p className="text-4xl transition-colors duration-300 font-bold">
            {total}
          </p>
        </div>
      </div>
      <svg
        viewBox={`-${radius} -${radius} ${radius * 2} ${radius * 2}`}
        className="w-full h-auto max-w-[20rem] mx-auto overflow-visible"
      >
        {arcs.map((d, i) => (
          <clipPath key={`donut-c1-clip-${i}`} id={`donut-c1-clip-${i}`}>
            <path d={arcClip(d) || undefined} />
          </clipPath>
        ))}

        {arcs.map((d, i) => {
          const angle = computeAngle(d);
          const centroid = arcLabel.centroid(d);

          return (
            <g key={i}>
              <g clipPath={`url(#donut-c1-clip-${i})`}>
                <path
                  fill={colors[i]}
                  stroke="#ffffff33"
                  strokeWidth={lightStrokeEffect}
                  d={arcGenerator(d) || undefined}
                />
              </g>

              <g opacity={angle > 20 ? 1 : 0}>
                <text
                  transform={`translate(${centroid[0]}, ${centroid[1]})`}
                  textAnchor="middle"
                  fontSize={38}
                >
                  <tspan y="-0.4em" fontWeight="600" fill="#eee">
                    {d.data.name}
                  </tspan>
                  <tspan x={0} y="0.7em" fillOpacity={0.7} fill="#eee">
                    {d.data.value.toFixed(1)}%
                  </tspan>
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
