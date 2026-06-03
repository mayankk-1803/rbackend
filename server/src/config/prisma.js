

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Append-only immutability middleware for RoutingAuditLog
prisma.$use(async (params, next) => {
  if (params.model === "RoutingAuditLog") {
    const blockedActions = ["update", "updateMany", "delete", "deleteMany", "upsert"];
    if (blockedActions.includes(params.action)) {
      throw new Error(`Immutability Violation: Mutations are blocked on the ${params.model} audit log table.`);
    }
  }
  return next(params);
});

export default prisma;