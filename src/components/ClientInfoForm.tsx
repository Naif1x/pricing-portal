"use client";

import { useState, useEffect } from "react";
import { ClientInfo } from "@/types";

interface Props {
  value: ClientInfo;
  onChange: (info: ClientInfo) => void;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-text-secondary">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors";

export default function ClientInfoForm({ value, onChange }: Props) {
  const set = (field: keyof ClientInfo, v: string | number) =>
    onChange({ ...value, [field]: v });
  const [validityDisplay, setValidityDisplay] = useState(String(value.validityDays));
  useEffect(() => { setValidityDisplay(String(value.validityDays)); }, [value.validityDays]);

  return (
    <div className="wizard-step space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-text">Client Information</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Enter the client details for this quote.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Company Name *">
          <input
            type="text"
            className={inputClass}
            value={value.companyName}
            onChange={(e) => set("companyName", e.target.value)}
            placeholder="e.g. Acme Corp"
          />
        </Field>

        <Field label="Contact Name *">
          <input
            type="text"
            className={inputClass}
            value={value.contactName}
            onChange={(e) => set("contactName", e.target.value)}
            placeholder="e.g. Ahmed Al-Salem"
          />
        </Field>

        <Field label="Email">
          <input
            type="email"
            className={inputClass}
            value={value.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="email@company.com"
          />
        </Field>

        <Field label="Phone">
          <input
            type="tel"
            className={inputClass}
            value={value.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+966 5X XXX XXXX"
          />
        </Field>

        <Field label="Quote Date">
          <input
            type="date"
            className={inputClass}
            value={value.date}
            readOnly
          />
        </Field>

        <Field label="Validity (Days)">
          <input
            type="number"
            className={`${inputClass}${value.validityDays > 60 || value.validityDays < 1 ? " border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""}`}
            value={validityDisplay}
            onChange={(e) => {
              setValidityDisplay(e.target.value);
              const num = Number(e.target.value);
              if (!isNaN(num)) set("validityDays", num);
            }}
            onBlur={() => setValidityDisplay(String(value.validityDays))}
            min={1}
            max={60}
          />
          {value.validityDays > 60 && (
            <span className="text-xs text-red-500 mt-1">Maximum validity is 60 days</span>
          )}
          {value.validityDays < 1 && (
            <span className="text-xs text-red-500 mt-1">Minimum validity is 1 day</span>
          )}
        </Field>
      </div>

      <Field label="Notes">
        <textarea
          className={`${inputClass} min-h-[80px] resize-y`}
          value={value.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Any special terms, conditions, or notes..."
        />
      </Field>
    </div>
  );
}
