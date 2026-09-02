export interface InputField {
  id: string;
  label: string;
  type: "number" | "select" | "checkbox-group" | "toggle";
  options?: { label: string; value: string; price?: number }[];
  defaultValue?: number | string | string[] | boolean | Record<string, number>;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  helpText?: string;
  showWhen?: { field: string; value: string | boolean };
  withQuantity?: boolean;
}

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  category: "license" | "hardware" | "professional-services";
}

export interface PricingResult {
  annualLicense: number;
  hardware: number;
  professionalServices: number;
  total: number;
  lineItems: LineItem[];
  notes?: string[];
}

export interface SolutionDef {
  id: string;
  name: string;
  category: string;
  description: string;
  solutionType: string;
  inputs: InputField[];
  calculate: (values: Record<string, unknown>) => PricingResult;
}

export interface ClientInfo {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  date: string;
  validityDays: number;
  notes: string;
}

export interface QuoteSelection {
  solutionId: string;
  values: Record<string, unknown>;
  result: PricingResult;
}

export interface Quote {
  client: ClientInfo;
  selections: QuoteSelection[];
  grandTotal: number;
  generatedAt: string;
}

export const CATEGORIES = [
  { id: "erp", label: "ERP", icon: "Database" },
  { id: "instorecx", label: "InstoreCX", icon: "Monitor" },
  { id: "field-automation", label: "Field Automation", icon: "Boxes" },
  { id: "digital", label: "Digital Omnichannel", icon: "Smartphone" },
  { id: "data-ai", label: "Data & AI", icon: "Brain" },
  { id: "integration", label: "Integration", icon: "Link" },
] as const;

export const SAR_USD_RATE = 3.75;
export const IMPLEMENTATION_DAY_RATE = 3750;
