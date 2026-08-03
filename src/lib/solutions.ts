import {
  SolutionDef,
  PricingResult,
  LineItem,
  IMPLEMENTATION_DAY_RATE,
  SAR_USD_RATE,
} from "@/types";

function li(
  description: string,
  quantity: number,
  unitPrice: number,
  discount: number,
  category: LineItem["category"]
): LineItem {
  const total = quantity * unitPrice * (1 - discount);
  return { description, quantity, unitPrice, discount, total, category };
}

function implLine(
  manDays: number,
  discount: number,
  label = "Implementation"
): LineItem {
  return li(
    `${label} (${manDays} man-days)`,
    manDays,
    IMPLEMENTATION_DAY_RATE,
    discount,
    "professional-services"
  );
}

function sum(items: LineItem[], cat: LineItem["category"]): number {
  return items.filter((i) => i.category === cat).reduce((s, i) => s + i.total, 0);
}

function result(items: LineItem[], notes?: string[]): PricingResult {
  const annualLicense = sum(items, "license");
  const hardware = sum(items, "hardware");
  const professionalServices = sum(items, "professional-services");
  return {
    annualLicense,
    hardware,
    professionalServices,
    total: annualLicense + hardware + professionalServices,
    lineItems: items,
    notes,
  };
}

// ─── NetSuite ───────────────────────────────────────────────
const NS_MODULES = [
  { label: "Procurement Management", value: "procurement", price: 599 },
  { label: "Inventory Management", value: "inventory", price: 599 },
  { label: "Fixed Asset Management", value: "fixed-asset", price: 599 },
  { label: "Work Orders & Assemblies", value: "work-orders", price: 599 },
  { label: "Contract Renewals", value: "contracts", price: 599 },
  { label: "Quality Management", value: "quality", price: 599 },
  { label: "Mfg WIP & Routings", value: "mfg-wip", price: 599 },
  { label: "Demand Planning", value: "demand-planning", price: 599 },
  { label: "Rebate Management", value: "rebate", price: 399 },
  { label: "Incentive Compensation", value: "incentive", price: 599 },
  { label: "SuiteProjects", value: "projects", price: 899 },
  { label: "WMS", value: "wms", price: 999 },
  { label: "Revenue Management", value: "revenue-mgmt", price: 1699 },
  { label: "Field Service Mgmt Standard", value: "fsm-standard", price: 2499 },
  { label: "Field Service Mgmt Premium", value: "fsm-premium", price: 4499 },
  { label: "OneWorld", value: "oneworld", price: 1999 },
  { label: "OneWorld Additional Country", value: "oneworld-country", price: 799 },
];

const NS_TIERS = [
  { label: "Standard (included)", value: "standard", price: 0 },
  { label: "Premium Tier ($4,999/mo)", value: "premium", price: 4999 },
  { label: "Enterprise Tier ($8,499/mo)", value: "enterprise", price: 8499 },
];

const netsuite: SolutionDef = {
  id: "netsuite",
  name: "NetSuite ERP",
  category: "erp",
  description: "Oracle NetSuite cloud ERP with financials, CRM, inventory, and more",
  solutionType: "ERP",
  inputs: [
    {
      id: "edition",
      label: "Base Edition",
      type: "select",
      options: [
        { label: "FinancialsFirst Standard ($1,899/mo)", value: "standard" },
        { label: "FinancialsFirst Premium ($3,999/mo)", value: "premium" },
      ],
      defaultValue: "premium",
    },
    {
      id: "users",
      label: "Number of Users",
      type: "number",
      defaultValue: 5,
      min: 1,
      max: 500,
      suffix: "users",
      helpText: "General access users at $120/mo each",
    },
    {
      id: "serviceTier",
      label: "Service Tier",
      type: "select",
      options: NS_TIERS.map((t) => ({ label: t.label, value: t.value })),
      defaultValue: "standard",
    },
    {
      id: "modules",
      label: "Additional Modules",
      type: "checkbox-group",
      options: NS_MODULES.map((m) => ({
        label: `${m.label} ($${m.price}/mo)`,
        value: m.value,
      })),
      defaultValue: [],
    },
    {
      id: "commitmentYears",
      label: "Commitment Period",
      type: "select",
      options: [
        { label: "3 Years", value: "3" },
        { label: "5 Years", value: "5" },
      ],
      defaultValue: "3",
    },
    {
      id: "licenseDiscount",
      label: "License Discount (%)",
      type: "number",
      defaultValue: 50,
      min: 0,
      max: 70,
      suffix: "%",
    },
    {
      id: "implDiscount",
      label: "Implementation Discount (%)",
      type: "number",
      defaultValue: 0,
      min: 0,
      max: 50,
      suffix: "%",
    },
  ],
  calculate(v) {
    const months = Number(v.commitmentYears) * 12;
    const editionPrice = v.edition === "premium" ? 3999 : 1899;
    const userPrice = 120;
    const users = Number(v.users) || 1;
    const disc = (Number(v.licenseDiscount) || 0) / 100;
    const implDisc = (Number(v.implDiscount) || 0) / 100;

    const tierPrice =
      NS_TIERS.find((t) => t.value === v.serviceTier)?.price || 0;
    const selectedModules = (v.modules as string[]) || [];

    const items: LineItem[] = [];

    const editionTotal = editionPrice * months;
    const editionSAR = editionTotal * SAR_USD_RATE;
    const annualEdition = editionSAR / Number(v.commitmentYears);
    items.push(
      li(
        `NetSuite ${v.edition === "premium" ? "FinancialsFirst Premium" : "FinancialsFirst Standard"}`,
        1,
        annualEdition,
        disc,
        "license"
      )
    );

    if (users > 0) {
      const userTotal = userPrice * users * months * SAR_USD_RATE;
      const annualUsers = userTotal / Number(v.commitmentYears);
      items.push(li(`General Users`, users, annualUsers / users, disc, "license"));
    }

    if (tierPrice > 0) {
      const tierTotal = tierPrice * months * SAR_USD_RATE;
      const annualTier = tierTotal / Number(v.commitmentYears);
      items.push(
        li(
          `${v.serviceTier === "premium" ? "Premium" : "Enterprise"} Service Tier`,
          1,
          annualTier,
          disc,
          "license"
        )
      );
    }

    for (const modId of selectedModules) {
      const mod = NS_MODULES.find((m) => m.value === modId);
      if (mod) {
        const modTotal = mod.price * months * SAR_USD_RATE;
        const annualMod = modTotal / Number(v.commitmentYears);
        items.push(li(mod.label, 1, annualMod, disc, "license"));
      }
    }

    // Implementation based on delivery timeline (business days by size tier)
    const sizeTier: "small" | "medium" | "enterprise" =
      users <= 15 ? "small" : users <= 40 ? "medium" : "enterprise";

    const NS_IMPL_DAYS: Record<string, Record<string, number>> = {
      base: { small: 60, medium: 80, enterprise: 100 },
      procurement: { small: 5, medium: 10, enterprise: 15 },
      inventory: { small: 5, medium: 10, enterprise: 15 },
      "fixed-asset": { small: 3, medium: 5, enterprise: 10 },
      "work-orders": { small: 3, medium: 5, enterprise: 10 },
      contracts: { small: 5, medium: 10, enterprise: 15 },
      quality: { small: 15, medium: 25, enterprise: 35 },
      "mfg-wip": { small: 5, medium: 10, enterprise: 15 },
      "demand-planning": { small: 7, medium: 10, enterprise: 15 },
      rebate: { small: 15, medium: 25, enterprise: 35 },
      incentive: { small: 3, medium: 5, enterprise: 10 },
      projects: { small: 5, medium: 10, enterprise: 15 },
      wms: { small: 7, medium: 15, enterprise: 30 },
      "revenue-mgmt": { small: 5, medium: 10, enterprise: 15 },
      "fsm-standard": { small: 15, medium: 25, enterprise: 35 },
      "fsm-premium": { small: 15, medium: 25, enterprise: 35 },
      oneworld: { small: 0, medium: 0, enterprise: 0 },
      "oneworld-country": { small: 0, medium: 0, enterprise: 0 },
    };

    const baseDays = NS_IMPL_DAYS.base[sizeTier];
    items.push(implLine(baseDays, implDisc, `SuiteSuccess Base Implementation (${sizeTier})`));

    for (const modId of selectedModules) {
      const mod = NS_MODULES.find((m) => m.value === modId);
      const modDays = NS_IMPL_DAYS[modId]?.[sizeTier] || NS_IMPL_DAYS.quality[sizeTier];
      if (mod && modDays > 0) {
        items.push(implLine(modDays, implDisc, `${mod.label} Implementation`));
      }
    }

    return result(items, [
      "Prices in SAR. USD converted at 3.75 rate.",
      "Annual license shown (commitment spread).",
      `Size tier: ${sizeTier} (${users} users). Implementation days from delivery timeline.`,
    ]);
  },
};

// ─── MS Business Central ────────────────────────────────────
const msBc: SolutionDef = {
  id: "ms-bc",
  name: "Microsoft Business Central",
  category: "erp",
  description: "Microsoft Dynamics 365 Business Central ERP",
  solutionType: "ERP",
  inputs: [
    {
      id: "edition",
      label: "Edition",
      type: "select",
      options: [
        { label: "Essentials (SAR 3,150/user/yr)", value: "essentials" },
        { label: "Premium (SAR 4,950/user/yr)", value: "premium" },
      ],
      defaultValue: "premium",
    },
    { id: "users", label: "Number of Users", type: "number", defaultValue: 10, min: 1, max: 200, suffix: "users" },
    { id: "licenseDiscount", label: "License Discount (%)", type: "number", defaultValue: 25, min: 0, max: 50, suffix: "%" },
    { id: "implDays", label: "Implementation Man-Days", type: "number", defaultValue: 60, min: 10, max: 200 },
    { id: "implDiscount", label: "Implementation Discount (%)", type: "number", defaultValue: 40, min: 0, max: 60, suffix: "%" },
  ],
  calculate(v) {
    const unitPrice = v.edition === "premium" ? 4950 : 3150;
    const users = Number(v.users) || 10;
    const disc = (Number(v.licenseDiscount) || 0) / 100;
    const implDays = Number(v.implDays) || 60;
    const implDisc = (Number(v.implDiscount) || 0) / 100;
    const items: LineItem[] = [
      li(`BC ${v.edition === "premium" ? "Premium" : "Essentials"} License`, users, unitPrice, disc, "license"),
      implLine(implDays, implDisc),
    ];
    return result(items);
  },
};

// ─── Revel POS ──────────────────────────────────────────────
const REVEL_ADDONS = [
  { label: "Inventory App", value: "inventory", price: 1200 },
  { label: "Warehouse", value: "warehouse", price: 5000 },
  { label: "KDS (Kitchen Display)", value: "kds", price: 720 },
  { label: "Customer Display", value: "customer-display", price: 720 },
  { label: "Clock In/Out", value: "clock", price: 1125 },
  { label: "Custom Receipt Template", value: "receipt", price: 1150 },
  { label: "Delivery Management", value: "delivery", price: 1250 },
  { label: "Gift Card & Loyalty", value: "gift-loyalty", price: 4400 },
  { label: "Online Ordering", value: "online-ordering", price: 2150 },
  { label: "Insights (Per User)", value: "insights", price: 600 },
  { label: "Mobile Terminal", value: "mobile-terminal", price: 3000 },
  { label: "Arabic Language Module", value: "arabic", price: 6000 },
  { label: "API Gold Plan Integration", value: "api-gold", price: 13500 },
];

const REVEL_HW = [
  { label: "Apple iPad 10.2\" 64GB", value: "ipad", price: 1800 },
  { label: "Star Printer TSP143III", value: "printer", price: 1650 },
  { label: "Cash Drawer 4B5C", value: "cash-drawer", price: 450 },
  { label: "Router Linksys WiFi 6", value: "router", price: 900 },
  { label: "iPad Stand (Black Grey)", value: "stand", price: 850 },
];

const revel: SolutionDef = {
  id: "revel",
  name: "Revel POS",
  category: "pos",
  description: "Cloud-based iPad POS for restaurants and retail",
  solutionType: "POS",
  inputs: [
    { id: "locations", label: "Number of Locations", type: "number", defaultValue: 1, min: 1, max: 100, suffix: "locations" },
    { id: "terminalsPerLocation", label: "Terminals per Location", type: "number", defaultValue: 1, min: 1, max: 10, suffix: "terminals" },
    {
      id: "emsType",
      label: "Enterprise Management System",
      type: "select",
      options: [
        { label: "None", value: "none" },
        { label: "Single Location (SAR 1,350)", value: "single" },
        { label: "1-10 Locations (SAR 13,500)", value: "1-10" },
        { label: "11-20 Locations (SAR 15,000)", value: "11-20" },
        { label: "21-30 Locations (SAR 18,500)", value: "21-30" },
      ],
      defaultValue: "single",
    },
    {
      id: "addons",
      label: "Add-Ons",
      type: "checkbox-group",
      options: REVEL_ADDONS.map((a) => ({ label: `${a.label} (SAR ${a.price.toLocaleString()}/yr)`, value: a.value })),
      defaultValue: [],
    },
    { id: "licenseDiscount", label: "License Discount (%)", type: "number", defaultValue: 10, min: 0, max: 50, suffix: "%" },
    { id: "implDays", label: "Implementation Man-Days", type: "number", defaultValue: 22, min: 5, max: 60, helpText: "Small: 22, Medium: 35, Enterprise: 60 (+ 1 day/branch for installation)" },
    { id: "implDiscount", label: "Implementation Discount (%)", type: "number", defaultValue: 20, min: 0, max: 60, suffix: "%" },
    {
      id: "hardware",
      label: "Hardware per Terminal",
      type: "checkbox-group",
      options: REVEL_HW.map((h) => ({ label: `${h.label} (SAR ${h.price.toLocaleString()})`, value: h.value })),
      defaultValue: [],
    },
    { id: "hwDiscount", label: "Hardware Discount (%)", type: "number", defaultValue: 5, min: 0, max: 30, suffix: "%" },
  ],
  calculate(v) {
    const locs = Number(v.locations) || 1;
    const terms = Number(v.terminalsPerLocation) || 1;
    const disc = (Number(v.licenseDiscount) || 0) / 100;
    const implDays = Number(v.implDays) || 22;
    const implDisc = (Number(v.implDiscount) || 0) / 100;
    const hwDisc = (Number(v.hwDiscount) || 0) / 100;
    const totalTerminals = locs * terms;

    const items: LineItem[] = [];

    // Terminal pricing per location
    for (let i = 0; i < locs; i++) {
      if (terms >= 1) items.push(li(`1st Terminal (Location ${i + 1})`, 1, 6000, disc, "license"));
      if (terms >= 2) items.push(li(`2nd Terminal (Location ${i + 1})`, 1, 4000, disc, "license"));
      if (terms >= 3) items.push(li(`3rd+ Terminal (Location ${i + 1})`, terms - 2, 3250, disc, "license"));
    }

    // EMS
    const emsType = v.emsType as string;
    const emsPrices: Record<string, number> = { single: 1350, "1-10": 13500, "11-20": 15000, "21-30": 18500 };
    if (emsType !== "none" && emsPrices[emsType]) {
      items.push(li("Enterprise Management System", 1, emsPrices[emsType], disc, "license"));
    }

    // Add-ons
    const addons = (v.addons as string[]) || [];
    for (const aId of addons) {
      const addon = REVEL_ADDONS.find((a) => a.value === aId);
      if (addon) items.push(li(addon.label, locs, addon.price, disc, "license"));
    }

    // Implementation
    items.push(implLine(implDays, implDisc));

    // Hardware
    const hw = (v.hardware as string[]) || [];
    for (const hId of hw) {
      const h = REVEL_HW.find((x) => x.value === hId);
      if (h) items.push(li(h.label, totalTerminals, h.price, hwDisc, "hardware"));
    }

    return result(items);
  },
};

// ─── Lightspeed X Series ────────────────────────────────────
const lightspeed: SolutionDef = {
  id: "lightspeed",
  name: "Lightspeed X Series",
  category: "pos",
  description: "Cloud POS for retail and hospitality",
  solutionType: "POS",
  inputs: [
    { id: "branches", label: "Number of Branches", type: "number", defaultValue: 1, min: 1, max: 50 },
    { id: "additionalRegisters", label: "Additional Registers per Branch", type: "number", defaultValue: 0, min: 0, max: 10 },
    { id: "licenseDiscount", label: "License Discount (%)", type: "number", defaultValue: 0, min: 0, max: 50, suffix: "%" },
    { id: "implDiscount", label: "Implementation Discount (%)", type: "number", defaultValue: 25, min: 0, max: 60, suffix: "%" },
    {
      id: "hardware",
      label: "Hardware per Register",
      type: "checkbox-group",
      options: REVEL_HW.map((h) => ({ label: `${h.label} (SAR ${h.price.toLocaleString()})`, value: h.value })),
      defaultValue: [],
    },
  ],
  calculate(v) {
    const branches = Number(v.branches) || 1;
    const addRegs = Number(v.additionalRegisters) || 0;
    const disc = (Number(v.licenseDiscount) || 0) / 100;
    const implDisc = (Number(v.implDiscount) || 0) / 100;
    const items: LineItem[] = [
      li("Lightspeed License per Branch", branches, 10755, disc, "license"),
    ];
    if (addRegs > 0) items.push(li("Additional Register Fee", branches * addRegs, 2655, disc, "license"));
    items.push(implLine(15, implDisc, "Lightspeed Implementation"));
    const hw = (v.hardware as string[]) || [];
    const totalRegs = branches * (1 + addRegs);
    for (const hId of hw) {
      const h = REVEL_HW.find((x) => x.value === hId);
      if (h) items.push(li(h.label, totalRegs, h.price, 0, "hardware"));
    }
    return result(items, ["Implementation days: Small 15, Medium 30, Enterprise 45."]);
  },
};

// ─── TCS POS ────────────────────────────────────────────────
const TCS_ADDONS = [
  { label: "Transfer Order Receipting", value: "transfer-order", price: 2945 },
  { label: "Purchase Order Receipt", value: "purchase-order", price: 2945 },
  { label: "Fulfilment of Transfer Order", value: "fulfilment", price: 1070 },
  { label: "Inventory Adjustments", value: "inventory-adj", price: 2945 },
];

const tcs: SolutionDef = {
  id: "tcs",
  name: "TCS POS",
  category: "pos",
  description: "True Cloud Solution point-of-sale system",
  solutionType: "POS",
  inputs: [
    { id: "branches", label: "Number of Branches", type: "number", defaultValue: 1, min: 1, max: 50 },
    { id: "additionalRegisters", label: "Additional Registers per Branch", type: "number", defaultValue: 0, min: 0, max: 10 },
    { id: "licenseDiscount", label: "License Discount (%)", type: "number", defaultValue: 10, min: 0, max: 50, suffix: "%" },
    {
      id: "addons",
      label: "Add-Ons",
      type: "checkbox-group",
      options: TCS_ADDONS.map((a) => ({ label: `${a.label} (SAR ${a.price.toLocaleString()})`, value: a.value })),
      defaultValue: [],
    },
    { id: "implDiscount", label: "Implementation Discount (%)", type: "number", defaultValue: 25, min: 0, max: 60, suffix: "%" },
    {
      id: "hardware",
      label: "Hardware per Register",
      type: "checkbox-group",
      options: REVEL_HW.map((h) => ({ label: `${h.label} (SAR ${h.price.toLocaleString()})`, value: h.value })),
      defaultValue: [],
    },
  ],
  calculate(v) {
    const branches = Number(v.branches) || 1;
    const addRegs = Number(v.additionalRegisters) || 0;
    const disc = (Number(v.licenseDiscount) || 0) / 100;
    const implDisc = (Number(v.implDiscount) || 0) / 100;
    const items: LineItem[] = [
      li("TCS License per Branch", branches, 9318.75, disc, "license"),
    ];
    if (addRegs > 0) items.push(li("Additional Register Fee", branches * addRegs, 1481.25, disc, "license"));
    const addons = (v.addons as string[]) || [];
    for (const aId of addons) {
      const a = TCS_ADDONS.find((x) => x.value === aId);
      if (a) items.push(li(a.label, 1, a.price, 0, "license"));
    }
    items.push(implLine(21, implDisc));
    const hw = (v.hardware as string[]) || [];
    const totalRegs = branches * (1 + addRegs);
    for (const hId of hw) {
      const h = REVEL_HW.find((x) => x.value === hId);
      if (h) items.push(li(h.label, totalRegs, h.price, 0, "hardware"));
    }
    return result(items);
  },
};

// ─── Dingg ──────────────────────────────────────────────────
const dingg: SolutionDef = {
  id: "dingg",
  name: "Dingg",
  category: "pos",
  description: "Salon & spa management POS system",
  solutionType: "POS",
  inputs: [
    {
      id: "package",
      label: "Package",
      type: "select",
      options: [
        { label: "Standard - Up to 8 staff (SAR 5,587.50/yr)", value: "standard" },
        { label: "Pro - Up to 12 staff (SAR 7,462.50/yr)", value: "pro" },
        { label: "Prime - Up to 20 staff (SAR 11,212.50/yr)", value: "prime" },
      ],
      defaultValue: "pro",
    },
    { id: "locations", label: "Number of Locations", type: "number", defaultValue: 1, min: 1, max: 20 },
    { id: "licenseDiscount", label: "License Discount (%)", type: "number", defaultValue: 25, min: 0, max: 50, suffix: "%" },
    { id: "implDays", label: "Implementation Man-Days", type: "number", defaultValue: 50, min: 10, max: 100 },
    { id: "implDiscount", label: "Implementation Discount (%)", type: "number", defaultValue: 40, min: 0, max: 60, suffix: "%" },
  ],
  calculate(v) {
    const prices: Record<string, number> = { standard: 5587.5, pro: 7462.5, prime: 11212.5 };
    const pkg = v.package as string;
    const locs = Number(v.locations) || 1;
    const disc = (Number(v.licenseDiscount) || 0) / 100;
    const implDays = Number(v.implDays) || 50;
    const implDisc = (Number(v.implDiscount) || 0) / 100;
    return result([
      li(`Dingg ${pkg} Package`, locs, prices[pkg] || 7462.5, disc, "license"),
      implLine(implDays, implDisc),
    ]);
  },
};

// ─── Miosalon ───────────────────────────────────────────────
const miosalon: SolutionDef = {
  id: "miosalon",
  name: "Miosalon",
  category: "pos",
  description: "Salon management and POS solution",
  solutionType: "POS",
  inputs: [
    { id: "branches", label: "Number of Branches", type: "number", defaultValue: 1, min: 1, max: 20 },
    { id: "implDiscount", label: "Implementation Discount (%)", type: "number", defaultValue: 25, min: 0, max: 60, suffix: "%" },
  ],
  calculate(v) {
    const branches = Number(v.branches) || 1;
    const implDisc = (Number(v.implDiscount) || 0) / 100;
    return result([
      li("Miosalon License per Branch", branches, 4000, 0, "license"),
      implLine(21, implDisc),
    ]);
  },
};

// ─── Infrasys POS ───────────────────────────────────────────
const INFRASYS_ITEMS = [
  { label: "Digital Menu & Ordering (per device)", value: "digital-menu", price: 462 },
  { label: "Digital Signage (per device)", value: "signage", price: 1386 },
  { label: "Kitchen Display System (per device)", value: "kds", price: 1617 },
  { label: "Online Reservation Module (per outlet)", value: "reservation", price: 1617 },
  { label: "Pre-Order (per outlet)", value: "preorder", price: 1617 },
  { label: "SaaS Workstation", value: "saas", price: 2772 },
  { label: "Third Party Interface", value: "3rd-party", price: 2772 },
  { label: "Table Management System Lite", value: "tms", price: 3780 },
];

const infrasys: SolutionDef = {
  id: "infrasys",
  name: "Infrasys POS",
  category: "pos",
  description: "Cloud POS for hotels and restaurants (Shiji Group)",
  solutionType: "POS",
  inputs: [
    {
      id: "items",
      label: "Modules",
      type: "checkbox-group",
      options: INFRASYS_ITEMS.map((i) => ({ label: `${i.label} (SAR ${i.price.toLocaleString()})`, value: i.value })),
      defaultValue: ["saas"],
    },
    { id: "licenseDiscount", label: "License Discount (%)", type: "number", defaultValue: 10, min: 0, max: 50, suffix: "%" },
    { id: "implDays", label: "Implementation Man-Days", type: "number", defaultValue: 21, min: 5, max: 60, helpText: "Small: 21, Medium: 40, Enterprise: 60 (+ 1 day/branch for installation)" },
    { id: "implDiscount", label: "Implementation Discount (%)", type: "number", defaultValue: 20, min: 0, max: 60, suffix: "%" },
    {
      id: "hardware",
      label: "Hardware",
      type: "checkbox-group",
      options: REVEL_HW.map((h) => ({ label: `${h.label} (SAR ${h.price.toLocaleString()})`, value: h.value })),
      defaultValue: [],
    },
  ],
  calculate(v) {
    const disc = (Number(v.licenseDiscount) || 0) / 100;
    const implDays = Number(v.implDays) || 21;
    const implDisc = (Number(v.implDiscount) || 0) / 100;
    const selected = (v.items as string[]) || [];
    const items: LineItem[] = [];
    for (const id of selected) {
      const item = INFRASYS_ITEMS.find((i) => i.value === id);
      if (item) items.push(li(item.label, 1, item.price, disc, "license"));
    }
    items.push(implLine(implDays, implDisc));
    const hw = (v.hardware as string[]) || [];
    for (const hId of hw) {
      const h = REVEL_HW.find((x) => x.value === hId);
      if (h) items.push(li(h.label, 1, h.price, 0, "hardware"));
    }
    return result(items);
  },
};

// ─── COMO ───────────────────────────────────────────────────
const como: SolutionDef = {
  id: "como",
  name: "COMO",
  category: "crm",
  description: "AI-powered CRM and loyalty platform",
  solutionType: "AI CRM",
  inputs: [
    { id: "branches", label: "Number of Branches", type: "number", defaultValue: 1, min: 1, max: 50 },
    { id: "unitPrice", label: "Unit Price per Branch (SAR)", type: "number", defaultValue: 20000, min: 5000, max: 50000 },
    { id: "licenseDiscount", label: "License Discount (%)", type: "number", defaultValue: 50, min: 0, max: 70, suffix: "%" },
    { id: "implDays", label: "Implementation Man-Days", type: "number", defaultValue: 15, min: 5, max: 45, helpText: "Small: 15, Medium: 25, Enterprise: 45" },
    { id: "implDiscount", label: "Implementation Discount (%)", type: "number", defaultValue: 25, min: 0, max: 60, suffix: "%" },
  ],
  calculate(v) {
    const branches = Number(v.branches) || 1;
    const unitPrice = Number(v.unitPrice) || 20000;
    const disc = (Number(v.licenseDiscount) || 0) / 100;
    const implDays = Number(v.implDays) || 15;
    const implDisc = (Number(v.implDiscount) || 0) / 100;
    return result([
      li("COMO License per Branch", branches, unitPrice, disc, "license"),
      implLine(implDays, implDisc),
    ]);
  },
};

// ─── Jolt ───────────────────────────────────────────────────
const JOLT_MODULES = [
  { label: "Lists", value: "lists", price: 5175 },
  { label: "Sensors", value: "sensors", price: 3881.14 },
  { label: "Labels", value: "labels", price: 2587.24 },
  { label: "Information Library", value: "info-library", price: 1552.58 },
  { label: "Time Clock", value: "time-clock", price: 2069.7 },
  { label: "Scheduling", value: "scheduling", price: 3622.35 },
];

const jolt: SolutionDef = {
  id: "jolt",
  name: "Jolt",
  category: "task-mgmt",
  description: "Digital task management and compliance for operations",
  solutionType: "Task Management",
  inputs: [
    { id: "locations", label: "Number of Locations", type: "number", defaultValue: 1, min: 1, max: 50 },
    {
      id: "modules",
      label: "Modules",
      type: "checkbox-group",
      options: JOLT_MODULES.map((m) => ({ label: `${m.label} (SAR ${m.price.toLocaleString()}/yr)`, value: m.value })),
      defaultValue: ["lists", "info-library"],
    },
    { id: "licenseDiscount", label: "License Discount (%)", type: "number", defaultValue: 15, min: 0, max: 50, suffix: "%" },
    { id: "implDays", label: "Implementation Man-Days", type: "number", defaultValue: 15, min: 1, max: 45, helpText: "Small: 15, Medium: 25, Enterprise: 45" },
    { id: "implDiscount", label: "Implementation Discount (%)", type: "number", defaultValue: 25, min: 0, max: 60, suffix: "%" },
  ],
  calculate(v) {
    const locs = Number(v.locations) || 1;
    const disc = (Number(v.licenseDiscount) || 0) / 100;
    const implDays = Number(v.implDays) || 15;
    const implDisc = (Number(v.implDiscount) || 0) / 100;
    const selected = (v.modules as string[]) || [];
    const items: LineItem[] = [];
    for (const mId of selected) {
      const mod = JOLT_MODULES.find((m) => m.value === mId);
      if (mod) items.push(li(mod.label, locs, mod.price, disc, "license"));
    }
    items.push(implLine(implDays, implDisc));
    return result(items);
  },
};

// ─── SerVme ─────────────────────────────────────────────────
const servme: SolutionDef = {
  id: "servme",
  name: "SerVme",
  category: "crm",
  description: "Restaurant reservation, CRM, and guest management",
  solutionType: "Reservation & CRM",
  inputs: [
    {
      id: "tier",
      label: "Tier",
      type: "select",
      options: [
        { label: "Starter (SAR 5,625/location/yr)", value: "starter" },
        { label: "Essential (SAR 11,250/location/yr)", value: "essential" },
        { label: "Advance (SAR 13,500/location/yr)", value: "advance" },
      ],
      defaultValue: "advance",
    },
    { id: "locations", label: "Number of Locations", type: "number", defaultValue: 1, min: 1, max: 30 },
    { id: "licenseDiscount", label: "License Discount (%)", type: "number", defaultValue: 25, min: 0, max: 50, suffix: "%" },
    { id: "implDays", label: "Implementation Man-Days", type: "number", defaultValue: 15, min: 5, max: 45, helpText: "Small: 15, Medium: 25, Enterprise: 45" },
    { id: "implDiscount", label: "Implementation Discount (%)", type: "number", defaultValue: 40, min: 0, max: 60, suffix: "%" },
  ],
  calculate(v) {
    const prices: Record<string, number> = { starter: 5625, essential: 11250, advance: 13500 };
    const tier = v.tier as string;
    const locs = Number(v.locations) || 1;
    const disc = (Number(v.licenseDiscount) || 0) / 100;
    const implDays = Number(v.implDays) || 15;
    const implDisc = (Number(v.implDiscount) || 0) / 100;
    return result([
      li(`SerVme ${tier} License`, locs, prices[tier] || 13500, disc, "license"),
      implLine(implDays, implDisc),
    ]);
  },
};

// ─── Lynnc ──────────────────────────────────────────────────
const lynnc: SolutionDef = {
  id: "lynnc",
  name: "Lynnc",
  category: "aggregator",
  description: "Delivery aggregator integration platform",
  solutionType: "Aggregators",
  inputs: [
    {
      id: "package",
      label: "Package",
      type: "select",
      options: [
        { label: "L - Up to 250 orders/mo (SAR 1,350)", value: "l" },
        { label: "Y - Up to 600 orders/mo (SAR 2,430)", value: "y" },
        { label: "N - Up to 1,000 orders/mo (SAR 3,600)", value: "n" },
        { label: "N+ - Up to 2,000 orders/mo (SAR 1,552.58)", value: "n+" },
        { label: "C - Up to 3,000 orders/mo (SAR 2,069.70)", value: "c" },
      ],
      defaultValue: "c",
    },
    { id: "locations", label: "Number of Locations", type: "number", defaultValue: 1, min: 1, max: 20 },
    { id: "licenseDiscount", label: "License Discount (%)", type: "number", defaultValue: 15, min: 0, max: 50, suffix: "%" },
    { id: "implDays", label: "Implementation Man-Days", type: "number", defaultValue: 10, min: 1, max: 20, helpText: "Small: 10, Medium: 15, Enterprise: 20" },
    { id: "implDiscount", label: "Implementation Discount (%)", type: "number", defaultValue: 25, min: 0, max: 60, suffix: "%" },
  ],
  calculate(v) {
    const prices: Record<string, number> = { l: 1350, y: 2430, n: 3600, "n+": 1552.58, c: 2069.7 };
    const pkg = v.package as string;
    const locs = Number(v.locations) || 1;
    const disc = (Number(v.licenseDiscount) || 0) / 100;
    const implDays = Number(v.implDays) || 10;
    const implDisc = (Number(v.implDiscount) || 0) / 100;
    return result([
      li(`Lynnc ${pkg.toUpperCase()} Package`, locs, prices[pkg] || 2069.7, disc, "license"),
      implLine(implDays, implDisc),
    ]);
  },
};

// ─── Bayzat HR ──────────────────────────────────────────────
const bayzatHR: SolutionDef = {
  id: "bayzat-hr",
  name: "Bayzat HR",
  category: "hr",
  description: "HR, payroll, and insurance management platform",
  solutionType: "HR",
  inputs: [
    { id: "employees", label: "Number of Employees", type: "number", defaultValue: 100, min: 10, max: 5000, suffix: "employees" },
    { id: "pricePerEmployee", label: "Price per Employee (SAR/yr)", type: "number", defaultValue: 300, min: 100, max: 500 },
    { id: "licenseDiscount", label: "License Discount (%)", type: "number", defaultValue: 30, min: 0, max: 50, suffix: "%" },
    { id: "implDays", label: "Implementation Man-Days", type: "number", defaultValue: 21, min: 5, max: 50 },
    { id: "implDiscount", label: "Implementation Discount (%)", type: "number", defaultValue: 25, min: 0, max: 60, suffix: "%" },
  ],
  calculate(v) {
    const emps = Number(v.employees) || 100;
    const price = Number(v.pricePerEmployee) || 300;
    const disc = (Number(v.licenseDiscount) || 0) / 100;
    const implDays = Number(v.implDays) || 21;
    const implDisc = (Number(v.implDiscount) || 0) / 100;
    return result([
      li("Bayzat HR License", emps, price, disc, "license"),
      implLine(implDays, implDisc),
    ]);
  },
};

// ─── Kayan HR ───────────────────────────────────────────────
const kayanHR: SolutionDef = {
  id: "kayan-hr",
  name: "Kayan HR",
  category: "hr",
  description: "Comprehensive HR management system",
  solutionType: "HR",
  inputs: [
    {
      id: "package",
      label: "Package",
      type: "select",
      options: [
        { label: "Full Package (SAR 450/employee/yr)", value: "full" },
        { label: "Core Package (SAR 300/employee/yr)", value: "core" },
      ],
      defaultValue: "full",
      helpText: "Full: includes Performance, Talent, Career Path, Succession. Core: People, Payroll, Time, Self-Service.",
    },
    { id: "employees", label: "Number of Employees", type: "number", defaultValue: 100, min: 10, max: 5000, suffix: "employees" },
    { id: "licenseDiscount", label: "License Discount (%)", type: "number", defaultValue: 30, min: 0, max: 50, suffix: "%" },
    { id: "implDays", label: "Implementation Man-Days", type: "number", defaultValue: 20, min: 5, max: 65, helpText: "Small (1-100): 20, Medium (101-500): 45, Enterprise (501+): 65" },
    { id: "implDiscount", label: "Implementation Discount (%)", type: "number", defaultValue: 25, min: 0, max: 60, suffix: "%" },
  ],
  calculate(v) {
    const price = v.package === "core" ? 300 : 450;
    const emps = Number(v.employees) || 100;
    const disc = (Number(v.licenseDiscount) || 0) / 100;
    const implDays = Number(v.implDays) || 20;
    const implDisc = (Number(v.implDiscount) || 0) / 100;
    return result([
      li(`Kayan HR ${v.package === "core" ? "Core" : "Full"} Package`, emps, price, disc, "license"),
      implLine(implDays, implDisc),
    ]);
  },
};

// ─── Basher HR ──────────────────────────────────────────────
const basherHR: SolutionDef = {
  id: "basher-hr",
  name: "Basher HR",
  category: "hr",
  description: "Cloud-based HR and payroll system",
  solutionType: "HR",
  inputs: [
    { id: "employees", label: "Number of Employees", type: "number", defaultValue: 100, min: 10, max: 5000, suffix: "employees" },
    { id: "implDays", label: "Implementation Man-Days", type: "number", defaultValue: 21, min: 5, max: 50 },
    { id: "implDiscount", label: "Implementation Discount (%)", type: "number", defaultValue: 25, min: 0, max: 60, suffix: "%" },
  ],
  calculate(v) {
    const emps = Number(v.employees) || 100;
    const implDays = Number(v.implDays) || 21;
    const implDisc = (Number(v.implDiscount) || 0) / 100;
    const selfServicePerHundred = 4455;
    const basePerHundred = 37500;
    const additionalPerEmp = 89.55;
    const baseCost = basePerHundred + selfServicePerHundred;
    const additionalCost = Math.max(0, emps - 100) * additionalPerEmp;
    const totalLicense = baseCost + additionalCost;
    return result([
      li("Basher HR Base License (100 employees)", 1, baseCost, 0, "license"),
      ...(emps > 100 ? [li("Additional Employees", emps - 100, additionalPerEmp, 0, "license")] : []),
      implLine(implDays, implDisc),
    ], ["Base includes 100 employees. Additional employees at SAR 89.55 each."]);
  },
};

// ─── Omniful ────────────────────────────────────────────────
const OMNIFUL_ADDONS = [
  { label: "Enterprise Setup & Onboarding", value: "enterprise-setup", price: 10000 * SAR_USD_RATE },
  { label: "Multi-Brand Management", value: "multi-brand", price: 500 * SAR_USD_RATE },
  { label: "Whitelabeling / Branded Platform", value: "whitelabel", price: 1000 * SAR_USD_RATE },
];

const omniful: SolutionDef = {
  id: "omniful",
  name: "Omniful",
  category: "operations",
  description: "Order, warehouse, and transportation management",
  solutionType: "Order and Warehouse Management",
  inputs: [
    {
      id: "modules",
      label: "Modules",
      type: "checkbox-group",
      options: [
        { label: "OMS - Order Management ($1,699/mo)", value: "oms" },
        { label: "WMS - Warehouse Management ($66/mo/user)", value: "wms" },
        { label: "TMS - Transportation Management ($900/mo)", value: "tms" },
        { label: "Sales ($80/mo)", value: "sales" },
      ],
      defaultValue: ["oms"],
    },
    { id: "wmsUsers", label: "WMS Users", type: "number", defaultValue: 8, min: 8, max: 100, helpText: "Minimum 8 users", showWhen: { field: "modules", value: "wms" } },
    {
      id: "commitment",
      label: "Commitment Period",
      type: "select",
      options: [
        { label: "1 Year (0% discount)", value: "1" },
        { label: "2 Years (15% discount)", value: "2" },
        { label: "3 Years (25% discount)", value: "3" },
      ],
      defaultValue: "3",
    },
    {
      id: "addons",
      label: "Add-Ons",
      type: "checkbox-group",
      options: OMNIFUL_ADDONS.map((a) => ({ label: `${a.label} (SAR ${a.price.toLocaleString()})`, value: a.value })),
      defaultValue: [],
    },
    { id: "implDays", label: "Implementation Man-Days", type: "number", defaultValue: 25, min: 5, max: 40, helpText: "Small: 25, Medium: 30, Enterprise: 40" },
    { id: "implDiscount", label: "Implementation Discount (%)", type: "number", defaultValue: 25, min: 0, max: 60, suffix: "%" },
  ],
  calculate(v) {
    const mods = (v.modules as string[]) || [];
    const commitment = Number(v.commitment) || 3;
    const discountMap: Record<number, number> = { 1: 0, 2: 0.15, 3: 0.25 };
    const disc = discountMap[commitment] || 0;
    const wmsUsers = Number(v.wmsUsers) || 8;
    const implDays = Number(v.implDays) || 21;
    const implDisc = (Number(v.implDiscount) || 0) / 100;
    const items: LineItem[] = [];

    if (mods.includes("oms")) {
      items.push(li("OMS - Order Management (Annual)", 1, 1699 * 12 * SAR_USD_RATE, disc, "license"));
    }
    if (mods.includes("wms")) {
      items.push(li("WMS - Warehouse Management (Annual)", wmsUsers, 66 * 12 * SAR_USD_RATE, disc, "license"));
    }
    if (mods.includes("tms")) {
      items.push(li("TMS - Transportation Management (Annual)", 1, 900 * 12 * SAR_USD_RATE, disc, "license"));
    }
    if (mods.includes("sales")) {
      items.push(li("Sales Module (Annual)", 1, 80 * 12 * SAR_USD_RATE, disc, "license"));
    }

    const addons = (v.addons as string[]) || [];
    for (const aId of addons) {
      const addon = OMNIFUL_ADDONS.find((a) => a.value === aId);
      if (addon) items.push(li(addon.label, 1, addon.price, 0, "license"));
    }

    items.push(implLine(implDays, implDisc));

    return result(items, [`${commitment}-year commitment with ${disc * 100}% discount applied.`]);
  },
};

// ─── Unleashed ──────────────────────────────────────────────
const unleashed: SolutionDef = {
  id: "unleashed",
  name: "Unleashed",
  category: "operations",
  description: "Inventory management for growing businesses",
  solutionType: "Inventory Management",
  inputs: [
    {
      id: "tier",
      label: "Tier",
      type: "select",
      options: [
        { label: "Mid-sized (3 users, SAR 15,885/yr)", value: "mid" },
        { label: "Scaling (8 users, SAR 29,295/yr)", value: "scaling" },
        { label: "Enterprise (20 users, SAR 45,000/yr)", value: "enterprise" },
      ],
      defaultValue: "mid",
    },
    { id: "additionalUsers", label: "Additional Users", type: "number", defaultValue: 0, min: 0, max: 100, helpText: "Mid: SAR 4,455/user, Scaling: SAR 4,005/user, Enterprise: SAR 3,105/user" },
    { id: "licenseDiscount", label: "License Discount (%)", type: "number", defaultValue: 25, min: 0, max: 50, suffix: "%" },
    { id: "implDays", label: "Implementation Man-Days", type: "number", defaultValue: 15, min: 5, max: 25, helpText: "Small: 15, Medium: 20, Enterprise: 25" },
    { id: "implDiscount", label: "Implementation Discount (%)", type: "number", defaultValue: 40, min: 0, max: 60, suffix: "%" },
  ],
  calculate(v) {
    const tierPrices: Record<string, number> = { mid: 15885, scaling: 29295, enterprise: 45000 };
    const userPrices: Record<string, number> = { mid: 4455, scaling: 4005, enterprise: 3105 };
    const tier = v.tier as string;
    const addUsers = Number(v.additionalUsers) || 0;
    const disc = (Number(v.licenseDiscount) || 0) / 100;
    const implDays = Number(v.implDays) || 15;
    const implDisc = (Number(v.implDiscount) || 0) / 100;
    const items: LineItem[] = [
      li(`Unleashed ${tier} License`, 1, tierPrices[tier] || 15885, disc, "license"),
    ];
    if (addUsers > 0) {
      items.push(li("Additional Users", addUsers, userPrices[tier] || 4455, disc, "license"));
    }
    items.push(implLine(implDays, implDisc));
    return result(items);
  },
};

// ─── Onfleet ────────────────────────────────────────────────
const onfleet: SolutionDef = {
  id: "onfleet",
  name: "Onfleet",
  category: "operations",
  description: "Last-mile delivery management platform",
  solutionType: "Fleet Management",
  inputs: [
    {
      id: "tier",
      label: "Tier",
      type: "select",
      options: [
        { label: "Launch - 2,000 tasks (SAR 24,750/yr)", value: "launch" },
        { label: "Scale - 5,000 tasks (SAR 56,925/yr)", value: "scale" },
        { label: "Enterprise - Advanced (SAR 118,125/yr)", value: "enterprise" },
      ],
      defaultValue: "enterprise",
    },
    { id: "licenseDiscount", label: "License Discount (%)", type: "number", defaultValue: 25, min: 0, max: 50, suffix: "%" },
    { id: "implDays", label: "Implementation Man-Days", type: "number", defaultValue: 5, min: 1, max: 10, helpText: "Small: 5, Medium: 7, Enterprise: 10" },
    { id: "implDiscount", label: "Implementation Discount (%)", type: "number", defaultValue: 40, min: 0, max: 60, suffix: "%" },
  ],
  calculate(v) {
    const prices: Record<string, number> = { launch: 24750, scale: 56925, enterprise: 118125 };
    const tier = v.tier as string;
    const disc = (Number(v.licenseDiscount) || 0) / 100;
    const implDays = Number(v.implDays) || 5;
    const implDisc = (Number(v.implDiscount) || 0) / 100;
    return result([
      li(`Onfleet ${tier} License`, 1, prices[tier] || 118125, disc, "license"),
      implLine(implDays, implDisc),
    ]);
  },
};

// ─── Fiix ───────────────────────────────────────────────────
const fiix: SolutionDef = {
  id: "fiix",
  name: "Fiix",
  category: "operations",
  description: "CMMS for maintenance management",
  solutionType: "Maintenance Management",
  inputs: [
    {
      id: "tier",
      label: "Tier",
      type: "select",
      options: [
        { label: "Basic (SAR 2,025/user/yr)", value: "basic" },
        { label: "Professional (SAR 3,375/user/yr)", value: "professional" },
        { label: "Enterprise (SAR 4,950/user/yr)", value: "enterprise" },
      ],
      defaultValue: "professional",
    },
    { id: "users", label: "Number of Users", type: "number", defaultValue: 25, min: 1, max: 200, suffix: "users" },
    { id: "licenseDiscount", label: "License Discount (%)", type: "number", defaultValue: 10, min: 0, max: 50, suffix: "%" },
    { id: "implDays", label: "Implementation Man-Days", type: "number", defaultValue: 20, min: 5, max: 40, helpText: "Small: 20, Medium: 30, Enterprise: 40" },
    { id: "implDiscount", label: "Implementation Discount (%)", type: "number", defaultValue: 30, min: 0, max: 60, suffix: "%" },
  ],
  calculate(v) {
    const prices: Record<string, number> = { basic: 2025, professional: 3375, enterprise: 4950 };
    const tier = v.tier as string;
    const users = Number(v.users) || 25;
    const disc = (Number(v.licenseDiscount) || 0) / 100;
    const implDays = Number(v.implDays) || 20;
    const implDisc = (Number(v.implDiscount) || 0) / 100;
    return result([
      li(`Fiix ${tier} License`, users, prices[tier] || 3375, disc, "license"),
      implLine(implDays, implDisc),
    ]);
  },
};

// ─── Jigsaw ─────────────────────────────────────────────────
const JIGSAW_ITEMS = [
  { label: "Mobile Ordering App (per location)", value: "mobile-app", price: 0 },
  { label: "Web Ordering (per location)", value: "web-ordering", price: 0 },
  { label: "Kiosk App (per location)", value: "kiosk", price: 0 },
  { label: "Order Subscription (per location)", value: "order-sub", price: 0 },
  { label: "Reservation/Booking (per location)", value: "reservation", price: 0 },
  { label: "Self-Services Ordering", value: "self-service", price: 0 },
  { label: "Loyalty (per location)", value: "loyalty", price: 0 },
  { label: "Scan to Order (per location)", value: "scan-order", price: 0 },
  { label: "Scan to Pay (per location)", value: "scan-pay", price: 0 },
  { label: "Dine (per location)", value: "dine", price: 4500 },
  { label: "QR Digital Ordering (per location)", value: "qr-ordering", price: 12375 },
  { label: "Wallet", value: "wallet", price: 2500 },
  { label: "Website Hosting", value: "website", price: 24500 },
];

const JIGSAW_TIER_PRICES: Record<string, Record<string, number>> = {
  "1-3": { "mobile-app": 9000, "web-ordering": 4500, "kiosk": 13500, "order-sub": 6750, "reservation": 3375, "self-service": 3375, "loyalty": 2250, "scan-order": 900, "scan-pay": 900 },
  "4-10": { "mobile-app": 6750, "web-ordering": 3375, "kiosk": 11250, "order-sub": 5625, "reservation": 3375, "self-service": 3375, "loyalty": 1800, "scan-order": 900, "scan-pay": 900 },
  "11-20": { "mobile-app": 4500, "web-ordering": 2250, "kiosk": 9000, "order-sub": 4500, "reservation": 2250, "self-service": 2250, "loyalty": 1350, "scan-order": 900, "scan-pay": 900 },
  "21-50": { "mobile-app": 3375, "web-ordering": 1125, "kiosk": 6750, "order-sub": 3375, "reservation": 1125, "self-service": 1125, "loyalty": 900, "scan-order": 900, "scan-pay": 900 },
  "51+": { "mobile-app": 2250, "web-ordering": 675, "kiosk": 4500, "order-sub": 2250, "reservation": 675, "self-service": 675, "loyalty": 450, "scan-order": 450, "scan-pay": 450 },
};

const jigsaw: SolutionDef = {
  id: "jigsaw",
  name: "Jigsaw",
  category: "digital",
  description: "Mobile/web ordering, loyalty, and digital engagement platform",
  solutionType: "Mobile/Web App",
  inputs: [
    {
      id: "tier",
      label: "Location Tier",
      type: "select",
      options: [
        { label: "1-3 Locations", value: "1-3" },
        { label: "4-10 Locations", value: "4-10" },
        { label: "11-20 Locations", value: "11-20" },
        { label: "21-50 Locations", value: "21-50" },
        { label: "51+ Locations", value: "51+" },
      ],
      defaultValue: "1-3",
    },
    { id: "locations", label: "Number of Locations", type: "number", defaultValue: 1, min: 1, max: 200 },
    {
      id: "items",
      label: "Products",
      type: "checkbox-group",
      options: JIGSAW_ITEMS.map((i) => ({ label: i.label, value: i.value })),
      defaultValue: ["mobile-app"],
    },
    { id: "licenseDiscount", label: "License Discount (%)", type: "number", defaultValue: 25, min: 0, max: 50, suffix: "%" },
    { id: "implDays", label: "Implementation Man-Days", type: "number", defaultValue: 15, min: 5, max: 50, helpText: "Prebuilt: 10-20 days, Custom: 25-50 days depending on product" },
    { id: "implDiscount", label: "Implementation Discount (%)", type: "number", defaultValue: 20, min: 0, max: 60, suffix: "%" },
  ],
  calculate(v) {
    const tier = v.tier as string;
    const locs = Number(v.locations) || 1;
    const disc = (Number(v.licenseDiscount) || 0) / 100;
    const implDays = Number(v.implDays) || 15;
    const implDisc = (Number(v.implDiscount) || 0) / 100;
    const selected = (v.items as string[]) || [];
    const tierPrices = JIGSAW_TIER_PRICES[tier] || JIGSAW_TIER_PRICES["1-3"];
    const items: LineItem[] = [];

    for (const itemId of selected) {
      const tierPrice = tierPrices[itemId];
      if (tierPrice !== undefined) {
        const label = JIGSAW_ITEMS.find((i) => i.value === itemId)?.label || itemId;
        items.push(li(label, locs, tierPrice, disc, "license"));
      } else {
        const fixedItem = JIGSAW_ITEMS.find((i) => i.value === itemId);
        if (fixedItem && fixedItem.price > 0) {
          items.push(li(fixedItem.label, itemId === "wallet" || itemId === "website" ? 1 : locs, fixedItem.price, disc, "license"));
        }
      }
    }

    items.push(implLine(implDays, implDisc));

    return result(items);
  },
};

// ─── Shiji PMS ──────────────────────────────────────────────
const SHIJI_INTERFACES = [
  { label: "Shiji Analytics (per user)", value: "analytics", price: 6930, perRoom: false },
  { label: "Token Service (per property)", value: "token", price: 6750, perRoom: false },
  { label: "Tiger TMS Internet (per room)", value: "tms-internet", price: 22.5, perRoom: true },
  { label: "Tiger TMS IPTV (per room)", value: "tms-iptv", price: 22.5, perRoom: true },
  { label: "Tiger TMS Call Accounting (per room)", value: "tms-call", price: 22.5, perRoom: true },
  { label: "Zucchetti CRS (per room)", value: "zuc-crs", price: 22.5, perRoom: true },
  { label: "STR Interface (per room)", value: "str", price: 67.5, perRoom: true },
  { label: "Simple Reservation (per room)", value: "simple-res", price: 67.5, perRoom: true },
  { label: "ASSA ABLOY VingCard (per room)", value: "vingcard", price: 22.5, perRoom: true },
  { label: "IPTV LG Pro (per room)", value: "iptv-lg", price: 22.5, perRoom: true },
  { label: "Passport ID Scan (per room)", value: "passport", price: 22.5, perRoom: true },
  { label: "HSIA Reivernet (per room)", value: "hsia", price: 22.5, perRoom: true },
  { label: "Reachware Integration (per room)", value: "reachware", price: 67.5, perRoom: true },
  { label: "ERP Interface (per room)", value: "erp", price: 22.5, perRoom: true },
  { label: "GRMS & DND (per room)", value: "grms", price: 22.5, perRoom: true },
  { label: "Bookboost (per room)", value: "bookboost", price: 22.5, perRoom: true },
];

const shijiPms: SolutionDef = {
  id: "shiji-pms",
  name: "Shiji PMS",
  category: "hospitality",
  description: "Property management system for hotels",
  solutionType: "PMS",
  inputs: [
    { id: "rooms", label: "Number of Rooms", type: "number", defaultValue: 100, min: 10, max: 1000, suffix: "rooms" },
    { id: "pmsDiscount", label: "PMS License Discount (%)", type: "number", defaultValue: 35, min: 0, max: 50, suffix: "%" },
    {
      id: "interfaces",
      label: "Interfaces & Add-ons",
      type: "checkbox-group",
      options: SHIJI_INTERFACES.map((i) => ({
        label: `${i.label} (SAR ${i.price})`,
        value: i.value,
      })),
      defaultValue: [],
    },
    { id: "interfaceDiscount", label: "Interface Discount (%)", type: "number", defaultValue: 10, min: 0, max: 50, suffix: "%" },
    { id: "implDays", label: "Implementation Man-Days (PMS)", type: "number", defaultValue: 15, min: 5, max: 40 },
    { id: "implDiscount", label: "Implementation Discount (%)", type: "number", defaultValue: 20, min: 0, max: 60, suffix: "%" },
  ],
  calculate(v) {
    const rooms = Number(v.rooms) || 100;
    const pmsDisc = (Number(v.pmsDiscount) || 0) / 100;
    const intDisc = (Number(v.interfaceDiscount) || 0) / 100;
    const implDays = Number(v.implDays) || 15;
    const implDisc = (Number(v.implDiscount) || 0) / 100;
    const items: LineItem[] = [
      li("Shiji Enterprise PMS (per room)", rooms, 750, pmsDisc, "license"),
    ];

    const selected = (v.interfaces as string[]) || [];
    let totalInterfaceImplDays = 0;
    for (const iId of selected) {
      const iface = SHIJI_INTERFACES.find((i) => i.value === iId);
      if (iface) {
        const qty = iface.perRoom ? rooms : 1;
        items.push(li(iface.label, qty, iface.price, intDisc, "license"));
        totalInterfaceImplDays += iface.perRoom ? 2 : 1;
      }
    }

    items.push(implLine(implDays, implDisc, "PMS Implementation"));
    if (totalInterfaceImplDays > 0) {
      items.push(implLine(totalInterfaceImplDays, implDisc, "Interface Implementation"));
    }

    return result(items);
  },
};

// ─── Zucchetti ──────────────────────────────────────────────
const zucchetti: SolutionDef = {
  id: "zucchetti",
  name: "Zucchetti",
  category: "hospitality",
  description: "Channel manager and booking engine for hotels",
  solutionType: "Channel Manager & Booking Engine",
  inputs: [
    {
      id: "channelManager",
      label: "Channel Manager",
      type: "select",
      options: [
        { label: "3 IDS (SAR 1,954/yr)", value: "3ids" },
        { label: "5 IDS (SAR 2,911/yr)", value: "5ids" },
        { label: "10 IDS (SAR 4,926/yr)", value: "10ids" },
      ],
      defaultValue: "5ids",
    },
    { id: "additionalIDS", label: "Additional IDS", type: "number", defaultValue: 0, min: 0, max: 20, helpText: "SAR 712 per additional IDS" },
    {
      id: "bookingEngine",
      label: "Booking Engine",
      type: "select",
      options: [
        { label: "None", value: "none" },
        { label: "Enterprise Version (SAR 6,750/yr)", value: "enterprise" },
      ],
      defaultValue: "enterprise",
    },
    {
      id: "bookingTier",
      label: "Booking Engine Room Tier",
      type: "select",
      options: [
        { label: "Up to 75 rooms (SAR 8,346/yr)", value: "75+" },
      ],
      defaultValue: "75+",
      showWhen: { field: "bookingEngine", value: "enterprise" },
    },
    { id: "licenseDiscount", label: "License Discount (%)", type: "number", defaultValue: 25, min: 0, max: 50, suffix: "%" },
    { id: "implDays", label: "Implementation Man-Days", type: "number", defaultValue: 15, min: 5, max: 40 },
    { id: "implDiscount", label: "Implementation Discount (%)", type: "number", defaultValue: 40, min: 0, max: 60, suffix: "%" },
  ],
  calculate(v) {
    const cmPrices: Record<string, number> = { "3ids": 1954, "5ids": 2911, "10ids": 4926 };
    const cm = v.channelManager as string;
    const addIDS = Number(v.additionalIDS) || 0;
    const disc = (Number(v.licenseDiscount) || 0) / 100;
    const implDays = Number(v.implDays) || 15;
    const implDisc = (Number(v.implDiscount) || 0) / 100;
    const items: LineItem[] = [
      li("Channel Manager Package", 1, cmPrices[cm] || 2911, disc, "license"),
    ];
    if (addIDS > 0) items.push(li("Additional IDS", addIDS, 712, disc, "license"));
    if (v.bookingEngine === "enterprise") {
      items.push(li("Simple Booking Enterprise", 1, 6750, disc, "license"));
      items.push(li("Booking Engine 75+ Rooms", 1, 8346, disc, "license"));
    }
    items.push(implLine(implDays, implDisc));
    return result(items);
  },
};

// ─── InConcert ──────────────────────────────────────────────
const inconcert: SolutionDef = {
  id: "inconcert",
  name: "InConcert",
  category: "contact-center",
  description: "Omnichannel contact center platform",
  solutionType: "Contact Center",
  inputs: [
    { id: "concurrentUsers", label: "Concurrent Users", type: "number", defaultValue: 10, min: 1, max: 200, suffix: "users" },
    {
      id: "modules",
      label: "Modules",
      type: "checkbox-group",
      options: [
        { label: "Call Center License (SAR 4,968/user)", value: "callcenter" },
        { label: "Helpdesk Module (SAR 1,800.90/user)", value: "helpdesk" },
        { label: "Quality Management (SAR 993.60/user)", value: "quality" },
        { label: "WhatsApp License (SAR 18,630 flat)", value: "whatsapp" },
        { label: "Chatbot - Menu guided (SAR 24,840 flat)", value: "chatbot" },
        { label: "Oracle Cloud Hosting (SAR 931.50/user)", value: "hosting" },
      ],
      defaultValue: ["callcenter", "helpdesk"],
    },
    { id: "licenseDiscount", label: "License Discount (%)", type: "number", defaultValue: 20, min: 0, max: 50, suffix: "%" },
    { id: "implDays", label: "Implementation Man-Days", type: "number", defaultValue: 21, min: 5, max: 50 },
    { id: "implDiscount", label: "Implementation Discount (%)", type: "number", defaultValue: 25, min: 0, max: 60, suffix: "%" },
  ],
  calculate(v) {
    const users = Number(v.concurrentUsers) || 10;
    const disc = (Number(v.licenseDiscount) || 0) / 100;
    const implDays = Number(v.implDays) || 21;
    const implDisc = (Number(v.implDiscount) || 0) / 100;
    const mods = (v.modules as string[]) || [];
    const perUser: Record<string, { label: string; price: number }> = {
      callcenter: { label: "InConcert Call Center License", price: 4968 },
      helpdesk: { label: "Helpdesk Module", price: 1800.9 },
      quality: { label: "Quality Management Module", price: 993.6 },
      hosting: { label: "Oracle Cloud Hosting", price: 931.5 },
    };
    const flat: Record<string, { label: string; price: number }> = {
      whatsapp: { label: "WhatsApp License", price: 18630 },
      chatbot: { label: "Chatbot - Menu Guided", price: 24840 },
    };
    const items: LineItem[] = [];
    for (const mId of mods) {
      if (perUser[mId]) items.push(li(perUser[mId].label, users, perUser[mId].price, disc, "license"));
      if (flat[mId]) items.push(li(flat[mId].label, 1, flat[mId].price, disc, "license"));
    }
    items.push(implLine(implDays, implDisc));
    return result(items);
  },
};

// ─── Reachware ──────────────────────────────────────────────
const RW_CONNECT = [
  { label: "ERP <> Ecommerce (up to 500 orders)", value: "erp-ecom", price: 3500 },
  { label: "POS <> Ecommerce (up to 10K orders)", value: "pos-ecom", price: 16800 },
  { label: "ERP <> HR (pack of 20 employees)", value: "erp-hr", price: 850 },
  { label: "ERP <> POS (per branch)", value: "erp-pos", price: 2800 },
  { label: "ERP <> PMS (per property)", value: "erp-pms", price: 5600 },
  { label: "ERP <> OMS", value: "erp-oms", price: 8400 },
  { label: "POS <> OMS (per branch)", value: "pos-oms", price: 2800 },
  { label: "POS <> Payment Gateway (per device)", value: "pos-payment", price: 1800 },
  { label: "POS <> COMO (per branch)", value: "pos-como", price: 2800 },
  { label: "POS <> Reservation System (per location)", value: "pos-reservation", price: 1400 },
  { label: "POS <> Jigsaw (per location)", value: "pos-jigsaw", price: 2800 },
  { label: "POS <> Call Center (per location)", value: "pos-callcenter", price: 2800 },
  { label: "POS <> Lynnc/Deliverect (per location)", value: "pos-lynnc", price: 1400 },
  { label: "PMS <> Booking Engine (per property)", value: "pms-booking", price: 5600 },
  { label: "PMS <> Shomos (per property)", value: "pms-shomos", price: 5600 },
];

const RW_FATOORA = [
  { label: "ERP <> ZATCA (per 10K invoices)", value: "erp-zatca", price: 4500 },
  { label: "PMS <> ZATCA (per 200 rooms)", value: "pms-zatca", price: 14000 },
  { label: "POS <> ZATCA (per branch)", value: "pos-zatca", price: 2800 },
  { label: "Ecommerce <> ZATCA (per 500 invoices)", value: "ecom-zatca", price: 225 },
];

const RW_EXTEND = [
  { label: "Advanced Material Supply Management", value: "material-supply", price: 37500 },
  { label: "Budget Control Module", value: "budget-control", price: 30000 },
  { label: "Equipment Leasing/Rental", value: "equipment-lease", price: 30000 },
  { label: "NetSuite Payment Application - AR", value: "ns-payment-ar", price: 30000 },
  { label: "NetSuite ARAP Netting", value: "ns-arap", price: 30000 },
  { label: "NetSuite Bank Integration", value: "ns-bank", price: 30000 },
  { label: "Requisition Workflow", value: "requisition", price: 30000 },
  { label: "Franchise Management", value: "franchise", price: 30000 },
  { label: "Fund Request Approval", value: "fund-request", price: 30000 },
  { label: "Investment Portfolio Valuation", value: "investment", price: 30000 },
  { label: "Property Management", value: "property-mgmt", price: 30000 },
  { label: "Design to Stock", value: "design-stock", price: 37500 },
  { label: "NetSuite Franchise Module", value: "ns-franchise", price: 36500 },
  { label: "Car Lease", value: "car-lease", price: 27000 },
];

const rwConnect: SolutionDef = {
  id: "rw-connect",
  name: "Reachware Connect",
  category: "integration",
  description: "System-to-system integration connectors (ERP, POS, PMS, eCommerce)",
  solutionType: "Integration",
  inputs: [
    {
      id: "modules",
      label: "Connect Modules (set quantity per module)",
      type: "checkbox-group",
      withQuantity: true,
      options: RW_CONNECT.map((m) => ({ label: `${m.label} (SAR ${m.price.toLocaleString()})`, value: m.value })),
      defaultValue: {},
    },
    {
      id: "implType",
      label: "Implementation Type",
      type: "select",
      options: [
        { label: "Prebuilt (21 days)", value: "prebuilt" },
        { label: "Custom (90 days)", value: "custom" },
      ],
      defaultValue: "prebuilt",
    },
    { id: "licenseDiscount", label: "License Discount (%)", type: "number", defaultValue: 25, min: 0, max: 50, suffix: "%" },
    { id: "implDiscount", label: "Implementation Discount (%)", type: "number", defaultValue: 40, min: 0, max: 60, suffix: "%" },
  ],
  calculate(v) {
    const disc = (Number(v.licenseDiscount) || 0) / 100;
    const implDisc = (Number(v.implDiscount) || 0) / 100;
    const implDays = v.implType === "custom" ? 90 : 21;
    const items: LineItem[] = [];
    const modules = (v.modules as Record<string, number>) || {};
    for (const [mId, qty] of Object.entries(modules)) {
      const m = RW_CONNECT.find((x) => x.value === mId);
      if (m) items.push(li(m.label, qty, m.price, disc, "license"));
    }
    items.push(implLine(implDays, implDisc, `Connect Implementation (${v.implType})`));
    return result(items);
  },
};

const rwFatoora: SolutionDef = {
  id: "rw-fatoora",
  name: "Reachware Fatoora",
  category: "integration",
  description: "ZATCA e-invoicing compliance integration",
  solutionType: "E-Invoicing",
  inputs: [
    {
      id: "modules",
      label: "Fatoora Modules (set quantity per module)",
      type: "checkbox-group",
      withQuantity: true,
      options: RW_FATOORA.map((m) => ({ label: `${m.label} (SAR ${m.price.toLocaleString()})`, value: m.value })),
      defaultValue: {},
    },
    {
      id: "implType",
      label: "Implementation Type",
      type: "select",
      options: [
        { label: "Prebuilt (10 days)", value: "prebuilt" },
        { label: "Custom (40 days)", value: "custom" },
      ],
      defaultValue: "prebuilt",
    },
    { id: "licenseDiscount", label: "License Discount (%)", type: "number", defaultValue: 25, min: 0, max: 50, suffix: "%" },
    { id: "implDiscount", label: "Implementation Discount (%)", type: "number", defaultValue: 40, min: 0, max: 60, suffix: "%" },
  ],
  calculate(v) {
    const disc = (Number(v.licenseDiscount) || 0) / 100;
    const implDisc = (Number(v.implDiscount) || 0) / 100;
    const implDays = v.implType === "custom" ? 40 : 10;
    const items: LineItem[] = [];
    const modules = (v.modules as Record<string, number>) || {};
    for (const [mId, qty] of Object.entries(modules)) {
      const m = RW_FATOORA.find((x) => x.value === mId);
      if (m) items.push(li(m.label, qty, m.price, disc, "license"));
    }
    items.push(implLine(implDays, implDisc, `Fatoora Implementation (${v.implType})`));
    return result(items);
  },
};

const rwExtend: SolutionDef = {
  id: "rw-extend",
  name: "Reachware Extend",
  category: "integration",
  description: "Extended ERP customization modules (NetSuite add-ons)",
  solutionType: "ERP Extensions",
  inputs: [
    {
      id: "modules",
      label: "Extend Modules",
      type: "checkbox-group",
      options: RW_EXTEND.map((m) => ({ label: `${m.label} (SAR ${m.price.toLocaleString()})`, value: m.value })),
      defaultValue: [],
    },
    { id: "licenseDiscount", label: "License Discount (%)", type: "number", defaultValue: 25, min: 0, max: 50, suffix: "%" },
    { id: "implDays", label: "Implementation Man-Days", type: "number", defaultValue: 35, min: 10, max: 100, helpText: "Prebuilt: 35 days" },
    { id: "implDiscount", label: "Implementation Discount (%)", type: "number", defaultValue: 40, min: 0, max: 60, suffix: "%" },
  ],
  calculate(v) {
    const disc = (Number(v.licenseDiscount) || 0) / 100;
    const implDays = Number(v.implDays) || 35;
    const implDisc = (Number(v.implDiscount) || 0) / 100;
    const items: LineItem[] = [];
    for (const mId of (v.modules as string[]) || []) {
      const m = RW_EXTEND.find((x) => x.value === mId);
      if (m) items.push(li(m.label, 1, m.price, disc, "license"));
    }
    items.push(implLine(implDays, implDisc));
    return result(items);
  },
};

const rwInsight: SolutionDef = {
  id: "rw-insight",
  name: "Reachware Insight",
  category: "integration",
  description: "Business intelligence dashboards and analytics",
  solutionType: "BI & Analytics",
  inputs: [
    { id: "locations", label: "Number of Locations", type: "number", defaultValue: 1, min: 1, max: 50, helpText: "SAR 2,800/location" },
    { id: "datasets", label: "Additional Datasets", type: "number", defaultValue: 0, min: 0, max: 20, helpText: "SAR 1,400 each" },
    { id: "dashboards", label: "Additional Dashboards", type: "number", defaultValue: 0, min: 0, max: 20, helpText: "SAR 1,200 each" },
    { id: "users", label: "Additional Users", type: "number", defaultValue: 0, min: 0, max: 50, helpText: "SAR 400 each" },
    {
      id: "implType",
      label: "Implementation Type",
      type: "select",
      options: [
        { label: "Prebuilt (15 days)", value: "prebuilt" },
        { label: "Custom (90 days)", value: "custom" },
      ],
      defaultValue: "prebuilt",
    },
    { id: "licenseDiscount", label: "License Discount (%)", type: "number", defaultValue: 25, min: 0, max: 50, suffix: "%" },
    { id: "implDiscount", label: "Implementation Discount (%)", type: "number", defaultValue: 40, min: 0, max: 60, suffix: "%" },
  ],
  calculate(v) {
    const disc = (Number(v.licenseDiscount) || 0) / 100;
    const implDisc = (Number(v.implDiscount) || 0) / 100;
    const implDays = v.implType === "custom" ? 90 : 15;
    const locs = Number(v.locations) || 1;
    const items: LineItem[] = [
      li("Insight BI (per location)", locs, 2800, disc, "license"),
    ];
    const datasets = Number(v.datasets) || 0;
    if (datasets > 0) items.push(li("Additional Dataset", datasets, 1400, disc, "license"));
    const dashboards = Number(v.dashboards) || 0;
    if (dashboards > 0) items.push(li("Additional Dashboard", dashboards, 1200, disc, "license"));
    const users = Number(v.users) || 0;
    if (users > 0) items.push(li("Additional User", users, 400, disc, "license"));
    items.push(implLine(implDays, implDisc, `Insight Implementation (${v.implType})`));
    return result(items);
  },
};

// ─── Drive Thru ─────────────────────────────────────────────
const DRIVE_THRU_ITEMS = [
  { label: "PAR G5 2 Headset Package", value: "headset-pkg", price: 23846 },
  { label: "PAR Acoustic Kit", value: "acoustic", price: 384 },
  { label: "PAR Magnetic Loop Detector Board", value: "loop-detector", price: 1153 },
  { label: "PAR Magnetic Loop Prefab", value: "loop-prefab", price: 461 },
  { label: "Speaker Post (Powder Coated, 5yr warranty)", value: "speaker-post", price: 2769 },
  { label: "QSR Drive Thru Timer AWC600", value: "timer", price: 11538 },
  { label: "TOPS Software (annual)", value: "tops", price: 692 },
  { label: "Reporting Software (annual)", value: "reporting", price: 907 },
  { label: "Single 55\" Samsung Digital Menu Board", value: "digital-menu-single", price: 23076 },
  { label: "One Side Menu Display with Light", value: "menu-display", price: 41538 },
];

const drivethru: SolutionDef = {
  id: "drive-thru",
  name: "Drive Thru",
  category: "hardware",
  description: "PAR drive-thru communication and timer systems",
  solutionType: "Drive Thru",
  inputs: [
    {
      id: "items",
      label: "Hardware & Software Items",
      type: "checkbox-group",
      options: DRIVE_THRU_ITEMS.map((i) => ({ label: `${i.label} (SAR ${i.price.toLocaleString()})`, value: i.value })),
      defaultValue: ["headset-pkg", "acoustic", "loop-detector", "loop-prefab", "speaker-post", "timer", "tops", "reporting", "digital-menu-single"],
    },
    { id: "implDays", label: "Installation Man-Days", type: "number", defaultValue: 1, min: 1, max: 10 },
    { id: "implRate", label: "Installation Day Rate (SAR)", type: "number", defaultValue: 5500, min: 3750, max: 10000 },
  ],
  calculate(v) {
    const selected = (v.items as string[]) || [];
    const implDays = Number(v.implDays) || 1;
    const rate = Number(v.implRate) || 5500;
    const items: LineItem[] = [];
    for (const iId of selected) {
      const item = DRIVE_THRU_ITEMS.find((i) => i.value === iId);
      if (item) {
        const cat = item.value === "tops" || item.value === "reporting" ? "license" as const : "hardware" as const;
        items.push(li(item.label, 1, item.price, 0, cat));
      }
    }
    items.push(li(`Installation (${implDays} days)`, implDays, rate, 0, "professional-services"));
    return result(items);
  },
};

// ─── Info Websites ──────────────────────────────────────────
const infoWebsites: SolutionDef = {
  id: "info-websites",
  name: "Info Websites",
  category: "websites",
  description: "Professional branded website design and development",
  solutionType: "Websites",
  inputs: [
    { id: "websites", label: "Number of Websites", type: "number", defaultValue: 1, min: 1, max: 10 },
    { id: "mobileOrdering", label: "Mobile Ordering License (SAR 18,000/site/yr)", type: "toggle", defaultValue: true },
    { id: "implCostPerSite", label: "Implementation per Site (SAR)", type: "number", defaultValue: 40000, min: 20000, max: 100000, helpText: "Group website typically SAR 70,000; individual brand SAR 40,000" },
  ],
  calculate(v) {
    const sites = Number(v.websites) || 1;
    const implCost = Number(v.implCostPerSite) || 40000;
    const items: LineItem[] = [];
    if (v.mobileOrdering) {
      items.push(li("Mobile Ordering License", sites, 18000, 0, "license"));
    }
    items.push(li("Website Implementation", sites, implCost, 0, "professional-services"));
    return result(items);
  },
};

// ─── Jigsaw RDN (Digital Ordering) ──────────────────────────
const jigsawRdn: SolutionDef = {
  id: "jigsaw-rdn",
  name: "Jigsaw RDN (Digital Ordering)",
  category: "digital",
  description: "Restaurant digital network for digital ordering",
  solutionType: "Digital Ordering",
  inputs: [
    { id: "locations", label: "Number of Locations", type: "number", defaultValue: 1, min: 1, max: 30 },
    { id: "unitPrice", label: "License per Location (SAR/yr)", type: "number", defaultValue: 4500 },
    { id: "onboardingPerLocation", label: "Onboarding per Location (SAR)", type: "number", defaultValue: 2500 },
  ],
  calculate(v) {
    const locs = Number(v.locations) || 1;
    const price = Number(v.unitPrice) || 4500;
    const onboarding = Number(v.onboardingPerLocation) || 2500;
    return result([
      li("Jigsaw RDN License", locs, price, 0, "license"),
      li("Onboarding", locs, onboarding, 0, "professional-services"),
    ], ["Payment rates: 1.75% + 1 SAR for Mada, 2.75% + 1 SAR for Visa/MC/AMEX"]);
  },
};

// ─── Export All ─────────────────────────────────────────────
export const ALL_SOLUTIONS: SolutionDef[] = [
  netsuite,
  msBc,
  revel,
  lightspeed,
  tcs,
  dingg,
  miosalon,
  infrasys,
  como,
  servme,
  jolt,
  lynnc,
  bayzatHR,
  kayanHR,
  basherHR,
  omniful,
  unleashed,
  onfleet,
  fiix,
  jigsaw,
  jigsawRdn,
  infoWebsites,
  shijiPms,
  zucchetti,
  inconcert,
  rwConnect,
  rwFatoora,
  rwExtend,
  rwInsight,
  drivethru,
];

export function getSolution(id: string): SolutionDef | undefined {
  return ALL_SOLUTIONS.find((s) => s.id === id);
}

export function getSolutionsByCategory(category: string): SolutionDef[] {
  return ALL_SOLUTIONS.filter((s) => s.category === category);
}
