import { cloneElement, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';

type ChartDimension = number | `${number}%`;

interface StableChartContainerProps {
  children: ReactElement<{ height?: number; width?: number }>;
  className?: string;
  width?: ChartDimension;
  height?: ChartDimension;
}

function resolveDimension(value: ChartDimension, measured: number) {
  if (typeof value === 'number') {
    return value;
  }

  return (measured * Number(value.replace('%', ''))) / 100;
}

export function StableChartContainer({
  children,
  className,
  width = '100%',
  height = '100%',
}: StableChartContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const updateReadyState = () => {
      const rect = element.getBoundingClientRect();
      setSize((current) => {
        const next = {
          width: Math.floor(rect.width),
          height: Math.floor(rect.height),
        };
        if (current.width === next.width && current.height === next.height) {
          return current;
        }
        return next;
      });
    };

    updateReadyState();
    const observer = new ResizeObserver(updateReadyState);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const chartWidth = Math.floor(resolveDimension(width, size.width));
  const chartHeight = Math.floor(resolveDimension(height, size.height));
  const isReady = chartWidth > 0 && chartHeight > 0;
  const containerClassName = className
    ? `${className} min-h-px min-w-px`
    : 'h-full min-h-px w-full min-w-px';

  return (
    <div ref={containerRef} className={containerClassName}>
      {isReady && cloneElement(children, { width: chartWidth, height: chartHeight })}
    </div>
  );
}
