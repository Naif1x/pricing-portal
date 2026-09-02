"use client";

import { useState } from "react";
import { ALL_SOLUTIONS } from "@/lib/solutions";
import { CATEGORIES } from "@/types";
import {
  Database,
  Monitor,
  Smartphone,
  Boxes,
  Link,
  Brain,
  Check,
  Search,
} from "lucide-react";

const ICONS: Record<string, React.ElementType> = {
  Database, Monitor, Smartphone, Boxes, Link, Brain,
};

interface Props {
  selected: string[];
  onChange: (ids: string[]) => void;
}

export default function SolutionSelector({ selected, onChange }: Props) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id]
    );
  };

  const filteredSolutions = ALL_SOLUTIONS.filter((s) => {
    const matchesSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !activeCategory || s.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const categoriesWithSolutions = CATEGORIES.filter((c) =>
    ALL_SOLUTIONS.some((s) => s.category === c.id)
  );

  return (
    <div className="wizard-step space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-text">Select Solutions</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Choose the solutions to include in this quote. You can select multiple.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
        <input
          type="text"
          className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          placeholder="Search solutions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0">
        <button
          onClick={() => setActiveCategory(null)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            !activeCategory
              ? "bg-primary text-white"
              : "bg-surface-alt text-text-secondary hover:bg-border"
          }`}
        >
          All ({ALL_SOLUTIONS.length})
        </button>
        {categoriesWithSolutions.map((cat) => {
          const Icon = ICONS[cat.icon];
          const count = ALL_SOLUTIONS.filter((s) => s.category === cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() =>
                setActiveCategory(activeCategory === cat.id ? null : cat.id)
              }
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                activeCategory === cat.id
                  ? "bg-primary text-white"
                  : "bg-surface-alt text-text-secondary hover:bg-border"
              }`}
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {cat.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Solution grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredSolutions.map((sol) => {
          const isSelected = selected.includes(sol.id);
          const cat = CATEGORIES.find((c) => c.id === sol.category);
          const Icon = cat ? ICONS[cat.icon] : Database;
          return (
            <button
              key={sol.id}
              onClick={() => toggle(sol.id)}
              className={`group relative flex flex-col rounded-xl border-2 p-4 text-left transition-all ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-white hover:border-primary/40 hover:shadow-sm"
              }`}
            >
              {isSelected && (
                <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
              <div className="flex items-center gap-2.5">
                {Icon && (
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      isSelected ? "bg-primary/10" : "bg-surface-alt"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 ${
                        isSelected ? "text-primary" : "text-text-secondary"
                      }`}
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-text truncate">
                    {sol.name}
                  </div>
                  <div className="text-xs text-text-secondary">
                    {sol.solutionType}
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-text-secondary line-clamp-2">
                {sol.description}
              </p>
            </button>
          );
        })}
      </div>

      {filteredSolutions.length === 0 && (
        <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-text-secondary">
          No solutions match your search.
        </div>
      )}

      {selected.length > 0 && (
        <div className="rounded-lg bg-primary/5 px-4 py-3">
          <p className="text-sm font-medium text-primary">
            {selected.length} solution{selected.length > 1 ? "s" : ""} selected
          </p>
        </div>
      )}
    </div>
  );
}
