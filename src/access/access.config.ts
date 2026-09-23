import type { AccessEntry } from "./access.type.js";

export const CEO_ACCESS: AccessEntry[] = [
  { phone: "8850656051", name: "Vikram Sir", role: "CEO" },
];

export const ADMIN_ACCESS: AccessEntry[] = [
  { phone: "9833322844", name: "Pritam Jio", role: "ADMIN" },
  { phone: "7743990982", name: "Juhi", role: "ADMIN" },
  { phone: "9834759005", name: "Vipul", role: "ADMIN" },
  { phone: "7558666122", name: "Harshal Sir", role: "ADMIN" },
  { phone: "7796419792", name: "Pritam Sarkar", role: "ADMIN" },
];

export const ACCESS_GATE_ENV = {
  ceo: "CEO_PHONES",
  admin: "ADMIN_PHONES",
  enabled: "ACCESS_GATE_ENABLED",
} as const;
