import { useEffect, useMemo, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle, ChartMarkerPoint, ChartPriceLine, ThemePreset } from "../../types";

interface TradingChartProps {
  candles: Candle[];
  themePreset: ThemePreset;
  markers: ChartMarkerPoint[];
  priceLines: ChartPriceLine[];
}

const themeAccentMap: Record<ThemePreset, string> = {
  emerald: "#0ecb81",
  blue: "#3b82f6",
  violet: "#a855f7",
  amber: "#f59e0b",
};

const average = (candles: Candle[], period: number) =>
  candles.map((candle, index) => {
    const slice = candles.slice(Math.max(0, index - period + 1), index + 1);
    const value = slice.reduce((sum, item) => sum + item.close, 0) / slice.length;
    return {
      time: candle.time as UTCTimestamp,
      value,
    };
  });

export const TradingChart = ({ candles, themePreset, markers, priceLines }: TradingChartProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<{
    candle?: ISeriesApi<"Candlestick">;
    volume?: ISeriesApi<"Histogram">;
    ma7?: ISeriesApi<"Line">;
    ma25?: ISeriesApi<"Line">;
    ma99?: ISeriesApi<"Line">;
  }>({});
  const priceLineRefs = useRef<IPriceLine[]>([]);

  const ma7 = useMemo(() => average(candles, 7), [candles]);
  const ma25 = useMemo(() => average(candles, 25), [candles]);
  const ma99 = useMemo(() => average(candles, 99), [candles]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const { width, height } = container.getBoundingClientRect();

    const chart = createChart(container, {
      width: width || 600,
      height: height || 300,
      layout: {
        background: { type: ColorType.Solid, color: "#242830" },
        textColor: "#848e9c",
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: "#2b3139" },
        horzLines: { color: "#2b3139" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      timeScale: {
        borderColor: "#2b3139",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: "#2b3139",
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#0ecb81",
      downColor: "#f6465d",
      borderVisible: false,
      wickUpColor: "#0ecb81",
      wickDownColor: "#f6465d",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
      color: "#4b5563",
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    const ma7Series = chart.addSeries(LineSeries, {
      color: "#f0b90b",
      lineWidth: 2,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    const ma25Series = chart.addSeries(LineSeries, {
      color: themeAccentMap[themePreset],
      lineWidth: 2,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    const ma99Series = chart.addSeries(LineSeries, {
      color: "#a855f7",
      lineWidth: 1,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    chartRef.current = chart;
    seriesRefs.current = {
      candle: candleSeries,
      volume: volumeSeries,
      ma7: ma7Series,
      ma25: ma25Series,
      ma99: ma99Series,
    };

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          chart.resize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      priceLineRefs.current.forEach((line) => {
        candleSeries.removePriceLine(line);
      });
      priceLineRefs.current = [];
      chart.remove();
      chartRef.current = null;
      seriesRefs.current = {};
    };
  }, [themePreset]);

  useEffect(() => {
    if (!seriesRefs.current.candle || !seriesRefs.current.volume || !seriesRefs.current.ma7 || !seriesRefs.current.ma25 || !seriesRefs.current.ma99) {
      return;
    }

    seriesRefs.current.candle.setData(
      candles.map((candle) => ({
        time: candle.time as UTCTimestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      })),
    );
    seriesRefs.current.volume.setData(
      candles.map((candle) => ({
        time: candle.time as UTCTimestamp,
        value: candle.volume,
        color: candle.close >= candle.open ? "rgba(14, 203, 129, 0.35)" : "rgba(246, 70, 93, 0.35)",
      })),
    );
    seriesRefs.current.ma7.setData(ma7);
    seriesRefs.current.ma25.setData(ma25);
    seriesRefs.current.ma99.setData(ma99);
    createSeriesMarkers(
      seriesRefs.current.candle,
      markers.map((marker) => ({
        time: marker.time as UTCTimestamp,
        position: marker.position,
        color: marker.color,
        shape: marker.shape,
        text: marker.text,
      })),
    );
    priceLineRefs.current.forEach((line) => {
      seriesRefs.current.candle?.removePriceLine(line);
    });
    priceLineRefs.current = priceLines.map((line) =>
      seriesRefs.current.candle!.createPriceLine({
        price: line.price,
        color: line.color,
        lineStyle: 2,
        lineWidth: 1,
        axisLabelVisible: true,
        title: line.title,
      }),
    );
    chartRef.current?.timeScale().fitContent();
  }, [candles, ma7, ma25, ma99, markers, priceLines]);

  return <div ref={containerRef} className="h-full w-full" />;
};
