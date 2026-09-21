/**
 * Access control ka public surface.
 *
 * `import { assertNumberAllowed, isCeoNumber, listAccessEntries } from "../access/index.js"`
 * — folder ke andar ki files (config/service) ko seedha import karne ki zaroorat nahi.
 */
export type { AccessEntry, AccessRole, ResolvedAccess } from "./access.type.js";
export {
    ACCESS_GATE_ENV,
    ADMIN_ACCESS,
    CEO_ACCESS,
} from "./access.config.js";
export {
    ACCESS_DENIED_CODE,
    assertNumberAllowed,
    describeAccessList,
    findAccessEntry,
    isAccessGateEnabled,
    isCeoNumber,
    isNumberAllowed,
    listAccessEntries,
    normalizePhone,
    resolveAccessRole,
} from "./access.service.js";
