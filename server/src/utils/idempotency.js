import prisma from "../config/prisma.js";
import crypto from "crypto";
import { Prisma } from "@prisma/client";

/**
 * Normalizes values for deterministic hashing.
 */
const normalizeValue = (val) => {
  if (val === undefined) return null;
  if (typeof val === "string") return val.trim().toLowerCase();
  if (typeof val === "number") return val.toFixed(2);
  if (val instanceof Prisma.Decimal) return val.toFixed(2);
  return val;
};

/**
 * Sorts object keys recursively for deterministic canonicalization.
 */
const sortObjectKeys = (obj) => {
  if (obj === null || typeof obj !== "object") return normalizeValue(obj);
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
  const sorted = {};
  Object.keys(obj).sort().forEach(key => {
    sorted[key] = sortObjectKeys(obj[key]);
  });
  return sorted;
};

/**
 * Generates a SHA-256 hash from a deterministically canonicalized payload.
 */
export const generateRequestHash = (payload) => {
  if (!payload) return crypto.createHash("sha256").update("").digest("hex");
  const cleanPayload = typeof payload === "object" ? sortObjectKeys(payload) : normalizeValue(payload);
  const str = typeof cleanPayload === "string" ? cleanPayload : JSON.stringify(cleanPayload);
  return crypto.createHash("sha256").update(str).digest("hex");
};

/**
 * Checks and claims an idempotency key atomically inside a transaction client.
 * Validates payload request hash to prevent mutation attacks.
 * Returns true if the key is successfully claimed, false if it already exists.
 */
export const claimIdempotencyKey = async (key, payloadOrTx, txOrUndefined, ttlSeconds = 86400) => {
  let payload = null;
  let tx = null;
  
  // Backward compatibility support for signature: claimIdempotencyKey(key, tx)
  if (payloadOrTx && typeof payloadOrTx.idempotencyRecord !== 'undefined') {
    tx = payloadOrTx;
  } else if (payloadOrTx === undefined && txOrUndefined === undefined) {
    tx = null;
  } else {
    payload = payloadOrTx;
    tx = txOrUndefined;
  }

  const client = tx || prisma;
  const requestHash = generateRequestHash(payload);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  const existing = await client.idempotencyRecord.findUnique({
    where: { key }
  });

  if (existing) {
    if (payload && existing.requestHash && existing.requestHash !== requestHash) {
      throw new Error(`MUTATED_PAYLOAD: The request payload does not match the original request for idempotency key ${key}.`);
    }
    if (existing.expiresAt < new Date()) {
      await client.idempotencyRecord.delete({ where: { key } });
    } else {
      return false; // Already claimed/processing
    }
  }

  try {
    await client.idempotencyRecord.create({
      data: {
        key,
        requestHash,
        expiresAt,
        status: "PENDING"
      }
    });
    return true;
  } catch (error) {
    // Prisma unique constraint violation code
    if (error.code === "P2002") {
      const reFetch = await client.idempotencyRecord.findUnique({ where: { key } });
      if (reFetch && payload && reFetch.requestHash && reFetch.requestHash !== requestHash) {
        throw new Error(`MUTATED_PAYLOAD: The request payload does not match the original request for idempotency key ${key}.`);
      }
      return false;
    }
    throw error;
  }
};

/**
 * Updates the status of an idempotency record.
 */
export const updateIdempotencyStatus = async (key, status, tx = null) => {
  const client = tx || prisma;
  try {
    await client.idempotencyRecord.update({
      where: { key },
      data: { status }
    });
  } catch (error) {
    console.error(`[Idempotency] Failed to update status for ${key} to ${status}:`, error);
  }
};

/**
 * Recovers stale PENDING records (older than 5 minutes) to prevent stuck operations.
 */
export const recoverStaleIdempotencyRecords = async () => {
  const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);
  try {
    const staleRecords = await prisma.idempotencyRecord.findMany({
      where: {
        status: "PENDING",
        createdAt: { lt: staleThreshold }
      }
    });

    for (const record of staleRecords) {
      await prisma.idempotencyRecord.update({
        where: { key: record.key },
        data: { status: "FAILED" }
      });
      console.log(`[Idempotency Recovery] Marked stale record ${record.key} as FAILED for safe replay.`);
    }
  } catch (err) {
    console.error("[Idempotency Recovery] Error recovering stale records:", err);
  }
};
