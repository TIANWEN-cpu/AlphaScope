import { ReactElement, useEffect, useRef, useState } from 'react';
import { ResponsiveContainer } from 'recharts';

interface SafeResponsiveContainerProps {
  children: ReactElement;
  className?: string;
  minHeight?: number;
  width?: string | number;
  height?: string | number;
  debounce?: number;
  fallback?: ReactElement | null;
}

export function SafeResponsiveContainer({
  children,
  className = 'h-full w-full min-w-0',
  minHeight = 160,
  width = '100%',
  height = '100%',
  debounce = 80,
  fallback = null,
}: SafeResponsiveContainerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [dimension, setDimension] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = host.getBoundingClientRect();
        const style = window.getComputedStyle(host);
        const isVisible =
          rect.width > 1
          && rect.height > 1
          && style.display !== 'none'
          && style.visibility !== 'hidden';
        setDimension(
          isVisible
            ? { width: Math.round(rect.width), height: Math.round(rect.height) }
            : null,
        );
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={hostRef} className={className} style={{ minHeight }}>
      {dimension ? (
        <ResponsiveContainer
          width={width}
          height={height}
          debounce={debounce}
          minWidth={0}
          minHeight={minHeight}
          initialDimension={dimension}
        >
          {children}
        </ResponsiveContainer>
      ) : fallback}
    </div>
  );
}
