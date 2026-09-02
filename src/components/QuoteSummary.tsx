"use client";

import { useState } from "react";
import { ClientInfo, PricingResult, CATEGORIES } from "@/types";
import { getSolution } from "@/lib/solutions";
import {
  Loader2,
  FileSpreadsheet,
  Check,
  AlertCircle,
} from "lucide-react";

interface Props {
  client: ClientInfo;
  solutionIds: string[];
  results: Record<string, PricingResult>;
  configurations: Record<string, Record<string, unknown>>;
}

function formatSAR(n: number): string {
  return `SAR ${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function QuoteSummary({
  client,
  solutionIds,
  results,
  configurations,
}: Props) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const grandTotal = solutionIds.reduce(
    (sum, id) => sum + (results[id]?.total || 0),
    0
  );
  const totalLicense = solutionIds.reduce(
    (sum, id) => sum + (results[id]?.annualLicense || 0),
    0
  );
  const totalHardware = solutionIds.reduce(
    (sum, id) => sum + (results[id]?.hardware || 0),
    0
  );
  const totalPS = solutionIds.reduce(
    (sum, id) => sum + (results[id]?.professionalServices || 0),
    0
  );

  const categorizedSolutions = CATEGORIES.map((cat) => ({
    ...cat,
    solutions: solutionIds
      .map((id) => getSolution(id))
      .filter((s) => s && s.category === cat.id),
  })).filter((c) => c.solutions.length > 0);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setSuccess(false);

    try {
      const payload = {
        client,
        solutions: solutionIds.map((id) => ({
          id,
          name: getSolution(id)?.name || id,
          solutionType: getSolution(id)?.solutionType || "",
          configuration: configurations[id] || {},
          result: results[id],
        })),
        grandTotal,
      };

      const res = await fetch("/api/generate-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `Server error: ${res.status}`);
      }

      const html = await res.text();
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (win) {
        win.addEventListener("load", () => {
          setTimeout(() => {
            win.print();
            URL.revokeObjectURL(url);
          }, 600);
        });
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate quote");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="wizard-step space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-text">Quote Summary</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Review the complete quote before generating the PDF.
        </p>
      </div>

      {/* Client info card */}
      <div className="rounded-xl border border-border bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-text-secondary uppercase tracking-wide">
          Client
        </h3>
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <span className="text-text-secondary">Company: </span>
            <span className="font-medium">{client.companyName || "—"}</span>
          </div>
          <div>
            <span className="text-text-secondary">Contact: </span>
            <span className="font-medium">{client.contactName || "—"}</span>
          </div>
          <div>
            <span className="text-text-secondary">Date: </span>
            <span className="font-medium">{client.date || "—"}</span>
          </div>
          <div>
            <span className="text-text-secondary">Validity: </span>
            <span className="font-medium">{client.validityDays} calendar days from date of issue</span>
          </div>
        </div>
      </div>

      {/* Solutions breakdown by category */}
      {categorizedSolutions.map((cat) => (
        <div
          key={cat.id}
          className="rounded-xl border border-border bg-white overflow-hidden"
        >
          <div className="border-b border-border bg-surface-alt/50 px-5 py-3">
            <h3 className="text-sm font-semibold text-text">{cat.label}</h3>
          </div>
          <div className="divide-y divide-border">
            {cat.solutions.map((sol) => {
              if (!sol) return null;
              const r = results[sol.id];
              if (!r) return null;
              return (
                <div key={sol.id} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-text">
                      {sol.name}
                    </span>
                    <span className="text-sm font-bold text-primary">
                      {formatSAR(r.total)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
                    <span>License: {formatSAR(r.annualLicense)}</span>
                    {r.hardware > 0 && (
                      <span>Hardware: {formatSAR(r.hardware)}</span>
                    )}
                    <span>Services: {formatSAR(r.professionalServices)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Grand totals */}
      <div className="rounded-xl border-2 border-primary bg-primary/5 p-5">
        <h3 className="mb-3 text-sm font-semibold text-primary uppercase tracking-wide">
          Grand Total
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Total Annual Licenses</span>
            <span className="font-medium">{formatSAR(totalLicense)}</span>
          </div>
          {totalHardware > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Total Hardware</span>
              <span className="font-medium">{formatSAR(totalHardware)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">
              Total Professional Services
            </span>
            <span className="font-medium">{formatSAR(totalPS)}</span>
          </div>
          <div className="flex justify-between border-t border-primary/30 pt-2 text-lg font-bold text-primary">
            <span>Grand Total</span>
            <span>{formatSAR(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Generate button */}
      <div className="flex flex-col items-center gap-3 pt-2">
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-primary-light hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating Quote...
            </>
          ) : success ? (
            <>
              <Check className="h-4 w-4" />
              Downloaded! Generate Again
            </>
          ) : (
            <>
              <FileSpreadsheet className="h-4 w-4" />
              Generate Quote
            </>
          )}
        </button>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-danger/10 px-4 py-2 text-sm text-danger">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {success && (
          <p className="text-xs text-success">
            Quote downloaded successfully.
          </p>
        )}
      </div>
    </div>
  );
}
