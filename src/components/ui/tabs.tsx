"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TabItem = { id: string; label: string };

// Only the active panel is mounted. Keeping inactive ones in the DOM with
// `hidden` would break any map inside them — Leaflet measures its container on
// mount and renders blank when that container has no size.
export function Tabs({
  items,
  panels,
  className,
}: {
  items: TabItem[];
  panels: Record<string, ReactNode>;
  className?: string;
}) {
  const [activeId, setActiveId] = useState(items[0]?.id);

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <div
        role="tablist"
        className="flex gap-1 self-start rounded-full border border-border bg-surface-2 p-1"
      >
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${item.id}`}
              onClick={() => setActiveId(item.id)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                isActive
                  ? "bg-surface text-foreground shadow-soft"
                  : "text-muted hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {activeId && (
        <div role="tabpanel" id={`panel-${activeId}`}>
          {panels[activeId]}
        </div>
      )}
    </div>
  );
}
