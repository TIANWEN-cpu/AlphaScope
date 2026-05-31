import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

export interface ThemedSelectOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
  badge?: ReactNode;
}

interface ThemedSelectProps {
  value: string;
  options: ThemedSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: ReactNode;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  testId?: string;
  'data-testid'?: string;
  ariaLabel?: string;
  align?: 'left' | 'right';
  maxMenuHeight?: number;
}

export function ThemedSelect({
  value,
  options,
  onChange,
  disabled = false,
  placeholder = '请选择',
  className,
  buttonClassName,
  menuClassName,
  testId,
  'data-testid': dataTestId,
  ariaLabel,
  align = 'left',
  maxMenuHeight = 280,
}: ThemedSelectProps) {
  const [open, setOpen] = useState(false);
  const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;

    const updateRect = () => {
      if (buttonRef.current) setButtonRect(buttonRef.current.getBoundingClientRect());
    };

    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const menu = buttonRect ? (() => {
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1024;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 768;
    const estimatedHeight = Math.min(maxMenuHeight, Math.max(44, options.length * 42 + 12));
    const openUp = viewportHeight - buttonRect.bottom < estimatedHeight + 16 && buttonRect.top > estimatedHeight;
    const width = Math.min(Math.max(buttonRect.width, 240), viewportWidth - 16);
    const left = align === 'right'
      ? Math.max(8, Math.min(buttonRect.right - width, viewportWidth - width - 8))
      : Math.max(8, Math.min(buttonRect.left, viewportWidth - width - 8));
    const top = openUp
      ? Math.max(8, buttonRect.top - estimatedHeight - 8)
      : Math.min(buttonRect.bottom + 8, viewportHeight - 52);

    return createPortal(
      <div
        ref={menuRef}
        style={{ left, top, width, maxHeight: maxMenuHeight }}
        className={cn(
          'custom-scrollbar fixed z-[9999] overflow-y-auto rounded-xl border border-indigo-500/25 bg-[#090a10] p-1.5 text-sm text-neutral-100 shadow-[0_24px_80px_rgba(0,0,0,0.72)] ring-1 ring-black/80 backdrop-blur-xl',
          menuClassName,
        )}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={`${option.value}-${String(option.label)}`}
              type="button"
              disabled={option.disabled}
              onClick={() => {
                if (option.disabled) return;
                onChange(option.value);
                setOpen(false);
              }}
              className={cn(
                'flex min-h-9 w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors',
                option.disabled
                  ? 'cursor-not-allowed text-neutral-600'
                  : selected
                    ? 'bg-indigo-500/18 text-indigo-100'
                    : 'text-neutral-300 hover:bg-white/[0.06] hover:text-white',
              )}
            >
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {option.badge && <span className="shrink-0">{option.badge}</span>}
              {selected && <Check className="h-3.5 w-3.5 shrink-0 text-indigo-300" />}
            </button>
          );
        })}
      </div>,
      document.body,
    );
  })() : null;

  return (
    <div className={cn('relative min-w-0', className)}>
      <button
        ref={buttonRef}
        type="button"
        data-testid={testId ?? dataTestId}
        aria-label={ariaLabel}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen((current) => !current);
        }}
        className={cn(
          'flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/40 px-3 text-left text-sm text-neutral-100 outline-none transition-all',
          disabled
            ? 'cursor-not-allowed text-neutral-600 opacity-70'
            : 'hover:border-indigo-400/40 hover:bg-white/[0.04] focus-visible:border-indigo-400/70 focus-visible:ring-2 focus-visible:ring-indigo-500/15',
          open && 'border-indigo-400/60 ring-2 ring-indigo-500/15',
          buttonClassName,
        )}
      >
        <span className={cn('min-w-0 flex-1 truncate', !selectedOption && 'text-neutral-500')}>
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-neutral-400 transition-transform', open && 'rotate-180 text-indigo-300')} />
      </button>
      {open && !disabled && menu}
    </div>
  );
}
