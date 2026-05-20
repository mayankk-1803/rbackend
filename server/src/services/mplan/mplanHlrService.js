/**
 * MPLAN HLR Service has been MIGRATED to EzyTM authoritative HLR.
 * See ../hlr/ezytmHlrService.js for active production implementation.
 * See _legacy_mplanHlrService.js for emergency rollback.
 */
export const detectHLR = async () => {
  throw new Error("MPLAN HLR APIs have been fully removed from primary execution flow.");
};
