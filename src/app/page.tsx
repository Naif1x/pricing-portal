"use client";

import { useState, useCallback } from "react";
import { ClientInfo, PricingResult } from "@/types";
import ClientInfoForm from "@/components/ClientInfoForm";
import SolutionSelector from "@/components/SolutionSelector";
import SolutionConfigurator from "@/components/SolutionConfigurator";
import QuoteSummary from "@/components/QuoteSummary";
import {
  ChevronLeft,
  ChevronRight,
  User,
  LayoutGrid,
  Settings,
  FileCheck,
} from "lucide-react";

const STEPS = [
  { id: "client", label: "Client Info", icon: User },
  { id: "select", label: "Solutions", icon: LayoutGrid },
  { id: "configure", label: "Configure", icon: Settings },
  { id: "review", label: "Review & Export", icon: FileCheck },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function in30Days() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export default function PricingPortal() {
  const [step, setStep] = useState(0);

  const [client, setClient] = useState<ClientInfo>({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    date: today(),
    validUntil: in30Days(),
    notes: "",
  });

  const [selectedSolutions, setSelectedSolutions] = useState<string[]>([]);

  const [configurations, setConfigurations] = useState<
    Record<string, Record<string, unknown>>
  >({});

  const [results, setResults] = useState<Record<string, PricingResult>>({});

  const handleConfigChange = useCallback(
    (solutionId: string, values: Record<string, unknown>) => {
      setConfigurations((prev) => ({ ...prev, [solutionId]: values }));
    },
    []
  );

  const handleResultsChange = useCallback(
    (solutionId: string, result: PricingResult) => {
      setResults((prev) => ({ ...prev, [solutionId]: result }));
    },
    []
  );

  const canProceed = () => {
    switch (step) {
      case 0:
        return client.companyName.trim() !== "" && client.contactName.trim() !== "";
      case 1:
        return selectedSolutions.length > 0;
      case 2:
        return selectedSolutions.every((id) => results[id]);
      default:
        return true;
    }
  };

  const grandTotal = selectedSolutions.reduce(
    (sum, id) => sum + (results[id]?.total || 0),
    0
  );

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="border-b border-border bg-primary-dark shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Trustangle" className="h-9 w-auto" />
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-white">
                Pricing Portal
              </h1>
              <p className="text-xs text-white/70">
                Sales Quote Generator
              </p>
            </div>
          </div>
          {selectedSolutions.length > 0 && step >= 2 && (
            <div className="text-right">
              <p className="text-xs text-white/70">Grand Total</p>
              <p className="text-lg font-bold text-accent">
                SAR{" "}
                {grandTotal.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          )}
        </div>
      </header>

      {/* Step indicator */}
      <div className="border-b border-border bg-white overflow-x-auto">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex min-w-0">
            {STEPS.map((s, i) => {
              const isActive = i === step;
              const isComplete = i < step;
              return (
                <button
                  key={s.id}
                  onClick={() => i <= step && setStep(i)}
                  disabled={i > step}
                  className={`flex flex-1 items-center justify-center gap-2 border-b-2 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? "border-primary text-primary"
                      : isComplete
                        ? "border-transparent text-text-secondary hover:text-primary cursor-pointer"
                        : "border-transparent text-text-secondary/50 cursor-default"
                  }`}
                >
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      isActive
                        ? "bg-primary text-white"
                        : isComplete
                          ? "bg-success text-white"
                          : "bg-surface-alt text-text-secondary"
                    }`}
                  >
                    {isComplete ? "✓" : i + 1}
                  </div>
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {step === 0 && (
          <ClientInfoForm value={client} onChange={setClient} />
        )}

        {step === 1 && (
          <SolutionSelector
            selected={selectedSolutions}
            onChange={setSelectedSolutions}
          />
        )}

        {step === 2 && (
          <SolutionConfigurator
            solutionIds={selectedSolutions}
            configurations={configurations}
            results={results}
            onConfigChange={handleConfigChange}
            onResultsChange={handleResultsChange}
          />
        )}

        {step === 3 && (
          <QuoteSummary
            client={client}
            solutionIds={selectedSolutions}
            results={results}
            configurations={configurations}
          />
        )}

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={() => setStep(step - 1)}
            disabled={step === 0}
            className="flex items-center gap-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-white disabled:opacity-40 disabled:cursor-default"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          {step < STEPS.length - 1 && (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="flex items-center gap-1 rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-white shadow transition-all hover:bg-primary-light disabled:opacity-40 disabled:cursor-default"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
