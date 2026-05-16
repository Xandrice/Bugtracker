"use client";

import {
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "./cn";

export type SelectOption = {
    value: string;
    label: ReactNode;
    /**
     * Optional short label shown in the closed trigger (e.g. "P0" for "P0 (Immediate Attention)").
     * Defaults to label.
     */
    short?: ReactNode;
    icon?: ReactNode;
    disabled?: boolean;
};

export interface SelectProps {
    name?: string;
    value?: string;
    defaultValue?: string;
    options: SelectOption[];
    onChange?: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    triggerClassName?: string;
    menuClassName?: string;
    size?: "xs" | "sm" | "md";
    /** Match trigger width to widest option — default true for popovers */
    fullWidth?: boolean;
    /**
     * Cap the menu's height to roughly this many options. Anything more must
     * be scrolled to. Default: as many as fit in the viewport (capped at ~10).
     */
    maxVisibleItems?: number;
    "aria-label"?: string;
}

const SIZE_CLASSES = {
    xs: "h-7 px-2 text-xs",
    sm: "h-8 px-2.5 text-xs",
    md: "h-9 px-3 text-sm",
};

const ITEM_HEIGHT = {
    xs: 28,
    sm: 30,
    md: 34,
};
const MENU_PADDING = 8; // p-1 top + bottom
const MENU_GAP = 4;
const MIN_MENU_WIDTH = 140;

/**
 * Drop-in replacement for native <select>. Renders an accessible button +
 * portaled floating menu, themed with our tokens so dropdowns look identical
 * on Windows/Mac/Linux in both light and dark mode and never get clipped by
 * parent overflow containers.
 *
 * Includes a hidden <input> with the current value so it works inside
 * standard <form action={serverAction}> setups.
 */
export function Select({
    name,
    value,
    defaultValue,
    options,
    onChange,
    placeholder = "Select…",
    disabled,
    className,
    triggerClassName,
    menuClassName,
    size = "sm",
    fullWidth = true,
    maxVisibleItems,
    ...aria
}: SelectProps) {
    const isControlled = value !== undefined;
    const [internal, setInternal] = useState<string>(defaultValue ?? "");
    const current = isControlled ? value! : internal;
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const [mounted, setMounted] = useState(false);
    const [position, setPosition] = useState<{
        top: number;
        left: number;
        width: number;
        openUp: boolean;
        maxHeight: number;
    } | null>(null);

    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const id = useId();

    const activeIndex = useMemo(
        () => options.findIndex((o) => o.value === current),
        [options, current]
    );
    const active = activeIndex >= 0 ? options[activeIndex] : null;

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (open) setHighlight(activeIndex >= 0 ? activeIndex : 0);
    }, [open, activeIndex]);

    // Compute menu position relative to viewport (fixed positioning).
    const computePosition = () => {
        const trigger = triggerRef.current;
        if (!trigger) return;
        const rect = trigger.getBoundingClientRect();
        const viewportH = window.innerHeight;
        const spaceBelow = viewportH - rect.bottom - MENU_GAP;
        const spaceAbove = rect.top - MENU_GAP;
        const itemH = ITEM_HEIGHT[size];
        const cappedItems = maxVisibleItems ?? 10;
        const desiredMaxHeight = cappedItems * itemH + MENU_PADDING;
        const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
        const available = openUp ? spaceAbove : spaceBelow;
        const maxHeight = Math.max(
            Math.min(desiredMaxHeight, itemH * 2 + MENU_PADDING),
            Math.min(desiredMaxHeight, available)
        );
        const width = Math.max(MIN_MENU_WIDTH, rect.width);
        const top = openUp
            ? Math.max(8, rect.top - MENU_GAP - maxHeight)
            : rect.bottom + MENU_GAP;
        const left = Math.min(
            Math.max(8, rect.left),
            window.innerWidth - width - 8
        );
        setPosition({ top, left, width, openUp, maxHeight });
    };

    useLayoutEffect(() => {
        if (!open) {
            setPosition(null);
            return;
        }
        computePosition();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, size, maxVisibleItems]);

    useEffect(() => {
        if (!open) return;

        const onWindowChange = () => computePosition();
        const onClick = (e: MouseEvent) => {
            const target = e.target as Node;
            if (triggerRef.current?.contains(target)) return;
            if (menuRef.current?.contains(target)) return;
            setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        window.addEventListener("scroll", onWindowChange, true);
        window.addEventListener("resize", onWindowChange);
        document.addEventListener("mousedown", onClick);
        document.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("scroll", onWindowChange, true);
            window.removeEventListener("resize", onWindowChange);
            document.removeEventListener("mousedown", onClick);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const commit = (next: string) => {
        if (!isControlled) setInternal(next);
        onChange?.(next);
        setOpen(false);
    };

    const onTriggerKey = (e: React.KeyboardEvent) => {
        if (disabled) return;
        if (!open) {
            if (
                e.key === "Enter" ||
                e.key === " " ||
                e.key === "ArrowDown" ||
                e.key === "ArrowUp"
            ) {
                e.preventDefault();
                setOpen(true);
            }
            return;
        }
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((i) => (i + 1) % options.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((i) => (i - 1 + options.length) % options.length);
        } else if (e.key === "Enter") {
            e.preventDefault();
            const opt = options[highlight];
            if (opt && !opt.disabled) commit(opt.value);
        }
    };

    const menu =
        open && mounted && position
            ? createPortal(
                  <div
                      ref={menuRef}
                      role="listbox"
                      style={{
                          position: "fixed",
                          top: position.top,
                          left: position.left,
                          width: position.width,
                          maxHeight: position.maxHeight,
                          zIndex: 1000,
                      }}
                      className={cn(
                          "overflow-auto rounded-md border border-border bg-elevated p-1 shadow-pop",
                          menuClassName
                      )}
                  >
                      {options.map((opt, i) => {
                          const selected = opt.value === current;
                          const highlighted = i === highlight;
                          return (
                              <button
                                  key={opt.value}
                                  type="button"
                                  role="option"
                                  aria-selected={selected}
                                  disabled={opt.disabled}
                                  onMouseEnter={() => setHighlight(i)}
                                  onClick={() => !opt.disabled && commit(opt.value)}
                                  className={cn(
                                      "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors",
                                      "disabled:opacity-50",
                                      highlighted && !opt.disabled
                                          ? "bg-muted text-foreground"
                                          : "text-foreground",
                                      selected && "font-medium"
                                  )}
                              >
                                  <span className="flex items-center gap-2 truncate min-w-0">
                                      {opt.icon && (
                                          <span className="shrink-0 flex items-center">
                                              {opt.icon}
                                          </span>
                                      )}
                                      <span className="truncate">{opt.label}</span>
                                  </span>
                                  {selected && (
                                      <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                                  )}
                              </button>
                          );
                      })}
                  </div>,
                  document.body
              )
            : null;

    return (
        <div className={cn("relative", fullWidth && "w-full", className)}>
            {name && <input type="hidden" name={name} value={current} />}
            <button
                ref={triggerRef}
                type="button"
                id={id}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={aria["aria-label"]}
                onClick={() => !disabled && setOpen((v) => !v)}
                onKeyDown={onTriggerKey}
                className={cn(
                    "inline-flex w-full items-center justify-between gap-2 rounded-md border border-input bg-elevated text-foreground transition-colors focus-ring hover:border-border-strong disabled:opacity-50 disabled:pointer-events-none",
                    SIZE_CLASSES[size],
                    triggerClassName
                )}
            >
                <span className="flex items-center gap-1.5 truncate min-w-0">
                    {active?.icon && (
                        <span className="shrink-0 flex items-center">{active.icon}</span>
                    )}
                    <span className="truncate">
                        {active ? active.short ?? active.label : (
                            <span className="text-subtle-foreground">{placeholder}</span>
                        )}
                    </span>
                </span>
                <ChevronDown
                    className={cn(
                        "h-3.5 w-3.5 shrink-0 text-subtle-foreground transition-transform",
                        open && "rotate-180"
                    )}
                />
            </button>
            {menu}
        </div>
    );
}
