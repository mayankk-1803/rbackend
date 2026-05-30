import express from "express";
import { auth } from "../middlewares/auth.js";
import { isAdmin } from "../middlewares/admin.js";
import { checkPermission } from "../middlewares/rbac.js";
import {
  getProvidersList,
  createProvider,
  updateProvider,
  testProviderApi
} from "../controllers/providerController.js";

const router = express.Router();

// Enforce global admin JWT authentication and authorization
router.use(auth, isAdmin);

// GET: Fetch list of all providers (read scope required)
router.get("/providers", checkPermission("recharges", "read"), getProvidersList);

// POST: Register a new recharge provider (write scope required)
router.post("/providers", checkPermission("recharges", "write"), createProvider);

// PATCH: Granularly update provider configuration (write scope required)
router.patch("/providers/:id", checkPermission("recharges", "write"), updateProvider);

// POST: Safe ping / diagnostic API check (write scope required)
router.post("/providers/:id/test", checkPermission("recharges", "write"), testProviderApi);

export default router;
