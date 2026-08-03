import { BarChart, BoxplotChart, HeatmapChart, LineChart, PieChart, RadarChart, ScatterChart, TreemapChart } from 'echarts/charts';
import {
  AriaComponent,
  CalendarComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  TransformComponent,
  VisualMapComponent,
} from 'echarts/components';
import { init, use, type EChartsCoreOption } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import type { ECElementEvent } from 'echarts';
import { Download } from 'lucide-react';
import { useEffect, useRef } from 'react';

use([
  BarChart,
  BoxplotChart,
  HeatmapChart,
  LineChart,
  PieChart,
  RadarChart,
  ScatterChart,
  TreemapChart,
  AriaComponent,
  CalendarComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  TransformComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

type Props = {
  title: string;
  description: string;
  filename: string;
  option: EChartsCoreOption;
  height?: number;
  onDataClick?: (data: { name?: string; value?: number; user_id?: number }) => void;
};

export default function ReportChart({ title, description, filename, option, height = 340, onDataClick }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<ReturnType<typeof init> | null>(null);

  useEffect(() => {
    if (!container.current) return;

    chart.current = init(container.current, undefined, { renderer: 'canvas' });
    chart.current.setOption({
      animationDuration: 450,
      color: ['#ea580c', '#f59e0b', '#0f766e', '#2563eb', '#7c3aed', '#dc2626', '#64748b'],
      textStyle: { fontFamily: 'Figtree, sans-serif' },
      aria: {
        show: true,
        decal: { show: true },
        description,
      },
      ...option,
    });

    const observer = new ResizeObserver(() => chart.current?.resize());
    observer.observe(container.current);

    return () => {
      observer.disconnect();
      chart.current?.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    chart.current?.setOption({
      aria: { show: true, decal: { show: true }, description },
      ...option,
    }, true);
  }, [description, option]);

  useEffect(() => {
    const instance = chart.current;
    if (!instance || !onDataClick) return;

    const handleClick = (params: ECElementEvent) => {
      const raw = params.data;
      const data = raw && typeof raw === 'object' ? raw as { value?: number; user_id?: number } : { value: Number(raw) };
      onDataClick({ name: params.name, ...data });
    };
    instance.on('click', handleClick);

    return () => instance.off('click', handleClick);
  }, [onDataClick]);

  const download = async () => {
    if (!chart.current) return;
    const dataUrl = chart.current.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      excludeComponents: ['toolbox'],
    });
    const blob = await fetch(dataUrl).then((response) => response.blob());
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.download = `${filename.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}.png`;
    anchor.href = objectUrl;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-neutral-100 px-5 py-4">
        <div>
          <h3 className="font-semibold text-neutral-900">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-neutral-500">{description}</p>
        </div>
        <button
          type="button"
          onClick={download}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-600 transition hover:border-orange-200 hover:text-orange-700"
          title={`Download ${title} as PNG`}
        >
          <Download size={14} />
          PNG
        </button>
      </div>
      <div ref={container} style={{ height }} role="img" aria-label={description} />
    </section>
  );
}
