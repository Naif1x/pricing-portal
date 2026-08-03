"use client";

import { useState, useEffect, useCallback } from "react";
import { SolutionDef, InputField, PricingResult } from "@/types";
import { getSolution } from "@/lib/solutions";
import {
  ChevronDown,
  ChevronUp,
  Info,
  Minus,
  Plus,
} from "lucide-react";

interface Props {
  solutionIds: string[];
  configurations: Record<string, Record<string, unknown>>;
  results: Record<string, PricingResult>;
  onConfigChange: (
    solutionId: string,
    values: Record<string, unknown>
  ) => void;
  onResultsChange: (solutionId: string, result: PricingResult) => void;
}

function formatSAR(n: number): string {
  return `SAR ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getDefaults(sol: SolutionDef): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const input of sol.inputs) {
    defaults[input.id] = input.defaultValue ?? (input.type === "checkbox-group" ? [] : input.type === "toggle" ? false : 0);
  }
  return defaults;
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  const s = step || 1;
  const clamp = (v: number) => {
    if (min !== undefined && v < min) return min;
    if (max !== undefined && v > max) return max;
    return v;
  };
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center rounded-lg border border-border bg-white">
        <button
          type="button"
          onClick={() => onChange(clamp(value - s))}
          className="flex h-9 w-9 items-center justify-center text-text-secondary hover:bg-surface-alt rounded-l-lg transition-colors"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value) || 0))}
          min={min}
          max={max}
          step={s}
          className="w-20 border-x border-border px-2 py-2 text-center text-sm outline-none"
        />
        <button
          type="button"
          onClick={() => onChange(clamp(value + s))}
          className="flex h-9 w-9 items-center justify-center text-text-secondary hover:bg-surface-alt rounded-r-lg transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {suffix && <span className="text-xs text-text-secondary">{suffix}</span>}
    </div>
  );
}

function InputRenderer({
  field,
  value,
  onChange,
  allValues,
}: {
  field: InputField;
  value: unknown;
  onChange: (v: unknown) => void;
  allValues: Record<string, unknown>;
}) {
  if (field.showWhen) {
    const depValue = allValues[field.showWhen.field];
    if (field.showWhen.value === true || field.showWhen.value === false) {
      if (depValue !== field.showWhen.value) return null;
    } else if (Array.isArray(depValue)) {
      if (!depValue.includes(field.showWhen.value)) return null;
    } else if (depValue !== field.showWhen.value) {
      return null;
    }
  }

  switch (field.type) {
    case "number":
      return (
        <div className="space-y-1">
          <label className="flex items-center gap-1.5 text-sm font-medium text-text-secondary">
            {field.label}
            {field.helpText && (
              <span className="group relative">
                <Info className="h-3.5 w-3.5 text-text-secondary/50 cursor-help" />
                <span className="absolute bottom-full left-0 mb-1 hidden w-56 rounded-md bg-text px-2.5 py-1.5 text-xs text-white shadow-lg group-hover:block z-10">
                  {field.helpText}
                </span>
              </span>
            )}
          </label>
          <NumberInput
            value={Number(value) || 0}
            onChange={(v) => onChange(v)}
            min={field.min}
            max={field.max}
            step={field.step}
            suffix={field.suffix}
          />
        </div>
      );

    case "select":
      return (
        <div className="space-y-1">
          <label className="flex items-center gap-1.5 text-sm font-medium text-text-secondary">
            {field.label}
            {field.helpText && (
              <span className="group relative">
                <Info className="h-3.5 w-3.5 text-text-secondary/50 cursor-help" />
                <span className="absolute bottom-full left-0 mb-1 hidden w-56 rounded-md bg-text px-2.5 py-1.5 text-xs text-white shadow-lg group-hover:block z-10">
                  {field.helpText}
                </span>
              </span>
            )}
          </label>
          <select
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );

    case "toggle":
      return (
        <label className="flex cursor-pointer items-center gap-3">
          <div className="relative">
            <input
              type="checkbox"
              checked={value as boolean}
              onChange={(e) => onChange(e.target.checked)}
              className="peer sr-only"
            />
            <div className="h-6 w-11 rounded-full bg-border transition-colors peer-checked:bg-primary" />
            <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
          </div>
          <span className="text-sm text-text">{field.label}</span>
        </label>
      );

    case "checkbox-group": {
      if (field.withQuantity) {
        const quantities = (value as Record<string, number>) || {};
        const toggleItem = (itemValue: string) => {
          const updated = { ...quantities };
          if (updated[itemValue]) {
            delete updated[itemValue];
          } else {
            updated[itemValue] = 1;
          }
          onChange(updated);
        };
        const setQty = (itemValue: string, qty: number) => {
          onChange({ ...quantities, [itemValue]: Math.max(1, qty) });
        };
        return (
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">
              {field.label}
            </label>
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-border bg-white p-2">
              {field.options?.map((opt) => {
                const isChecked = quantities[opt.value] !== undefined;
                return (
                  <div
                    key={opt.value}
                    className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 transition-colors ${
                      isChecked ? "bg-primary/5" : "hover:bg-surface-alt"
                    }`}
                  >
                    <label className="flex cursor-pointer items-center gap-2.5 flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleItem(opt.value)}
                        className="h-4 w-4 shrink-0 rounded border-border text-primary accent-primary"
                      />
                      <span className={`text-xs leading-snug truncate ${isChecked ? "text-text" : "text-text-secondary"}`}>{opt.label}</span>
                    </label>
                    {isChecked && (
                      <div className="flex items-center rounded border border-border bg-white shrink-0">
                        <button type="button" onClick={() => setQty(opt.value, (quantities[opt.value] || 1) - 1)} className="px-1.5 py-0.5 text-text-secondary hover:bg-surface-alt text-xs">-</button>
                        <input type="number" value={quantities[opt.value] || 1} onChange={(e) => setQty(opt.value, Number(e.target.value) || 1)} className="w-10 text-center text-xs border-x border-border py-0.5 outline-none" min={1} />
                        <button type="button" onClick={() => setQty(opt.value, (quantities[opt.value] || 1) + 1)} className="px-1.5 py-0.5 text-text-secondary hover:bg-surface-alt text-xs">+</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      }
      const selected = (value as string[]) || [];
      const toggleItem = (itemValue: string) => {
        onChange(
          selected.includes(itemValue)
            ? selected.filter((v) => v !== itemValue)
            : [...selected, itemValue]
        );
      };
      return (
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-secondary">
            {field.label}
          </label>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border bg-white p-2">
            {field.options?.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                  selected.includes(opt.value)
                    ? "bg-primary/5 text-text"
                    : "text-text-secondary hover:bg-surface-alt"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt.value)}
                  onChange={() => toggleItem(opt.value)}
                  className="h-4 w-4 rounded border-border text-primary accent-primary"
                />
                <span className="flex-1 text-xs leading-snug">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      );
    }
  }
}

function SolutionCard({
  solution,
  values,
  result,
  onValuesChange,
}: {
  solution: SolutionDef;
  values: Record<string, unknown>;
  result: PricingResult | undefined;
  onValuesChange: (values: Record<string, unknown>) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-surface-alt/50 transition-colors"
      >
        <div>
          <h3 className="text-base font-semibold text-text">{solution.name}</h3>
          <p className="text-xs text-text-secondary">{solution.solutionType}</p>
        </div>
        <div className="flex items-center gap-3">
          {result && (
            <span className="text-sm font-semibold text-primary">
              {formatSAR(result.total)}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-text-secondary" />
          ) : (
            <ChevronDown className="h-4 w-4 text-text-secondary" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border">
          <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-2">
            {/* Inputs */}
            <div className="space-y-4">
              {solution.inputs.map((field) => (
                <InputRenderer
                  key={field.id}
                  field={field}
                  value={values[field.id]}
                  onChange={(v) =>
                    onValuesChange({ ...values, [field.id]: v })
                  }
                  allValues={values}
                />
              ))}
            </div>

            {/* Live preview */}
            {result && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-text">
                  Price Breakdown
                </h4>
                <div className="space-y-1 rounded-lg bg-surface p-3">
                  {result.lineItems.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between gap-2 text-xs"
                    >
                      <span className="text-text-secondary flex-1">
                        {item.description}
                        {item.quantity > 1 && (
                          <span className="text-text-secondary/60">
                            {" "}
                            x{item.quantity}
                          </span>
                        )}
                        {item.discount > 0 && (
                          <span className="ml-1 text-success">
                            (-{(item.discount * 100).toFixed(0)}%)
                          </span>
                        )}
                      </span>
                      <span className="font-medium text-text whitespace-nowrap">
                        {formatSAR(item.total)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1 rounded-lg bg-primary/5 p-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Annual License</span>
                    <span className="font-medium">
                      {formatSAR(result.annualLicense)}
                    </span>
                  </div>
                  {result.hardware > 0 && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Hardware</span>
                      <span className="font-medium">
                        {formatSAR(result.hardware)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-text-secondary">
                      Professional Services
                    </span>
                    <span className="font-medium">
                      {formatSAR(result.professionalServices)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-primary/20 pt-1 text-sm font-bold text-primary">
                    <span>Total</span>
                    <span>{formatSAR(result.total)}</span>
                  </div>
                </div>

                {result.notes && result.notes.length > 0 && (
                  <div className="text-xs text-text-secondary/70 italic">
                    {result.notes.map((n, i) => (
                      <p key={i}>{n}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SolutionConfigurator({
  solutionIds,
  configurations,
  results,
  onConfigChange,
  onResultsChange,
}: Props) {
  const recalculate = useCallback(
    (solId: string, values: Record<string, unknown>) => {
      const sol = getSolution(solId);
      if (!sol) return;
      const r = sol.calculate(values);
      onResultsChange(solId, r);
    },
    [onResultsChange]
  );

  useEffect(() => {
    for (const id of solutionIds) {
      const sol = getSolution(id);
      if (!sol) continue;
      if (!configurations[id]) {
        const defaults = getDefaults(sol);
        onConfigChange(id, defaults);
        recalculate(id, defaults);
      }
    }
  }, [solutionIds, configurations, onConfigChange, recalculate]);

  const handleValuesChange = (
    solId: string,
    values: Record<string, unknown>
  ) => {
    onConfigChange(solId, values);
    recalculate(solId, values);
  };

  return (
    <div className="wizard-step space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-text">
          Configure Solutions
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Adjust the parameters for each selected solution. Prices update in
          real-time.
        </p>
      </div>

      <div className="space-y-4">
        {solutionIds.map((id) => {
          const sol = getSolution(id);
          if (!sol) return null;
          const vals = configurations[id] || getDefaults(sol);
          return (
            <SolutionCard
              key={id}
              solution={sol}
              values={vals}
              result={results[id]}
              onValuesChange={(v) => handleValuesChange(id, v)}
            />
          );
        })}
      </div>
    </div>
  );
}
