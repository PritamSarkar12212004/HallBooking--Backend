import type { AccessEntry } from "./access.type.js";

export const CEO_ACCESS: AccessEntry[] = [
  { phone: "7796419792", name: "Ceo", role: "CEO" },
];

export const ADMIN_ACCESS: AccessEntry[] = [
  // { phone: "9876543210", name: "Admin 1", role: "ADMIN" },
];

/** Env variable ke naam — config ke saath rakhe hain taake ek jagah sab mile. */
export const ACCESS_GATE_ENV = {
  /** Comma separated CEO numbers. */
  ceo: "CEO_PHONES",
  /** Comma separated admin/staff numbers. */
  admin: "ADMIN_PHONES",
  /** `false` karne par whitelist check band (default: on). */
  enabled: "ACCESS_GATE_ENABLED",
} as const;
