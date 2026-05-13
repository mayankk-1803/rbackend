import express from "express";
import { auth } from "../middlewares/auth.js";
import { 
  generateKeys, 
  getKeys, 
  rotateSecret, 
  toggleKeyStatus, 
  getAnalytics, 
  getLogs,
  getApiManifest
} from "../controllers/developerController.js";

const router = express.Router();

// All developer routes require standard user authentication
router.use(auth);

router.post("/keys/generate", generateKeys);
router.get("/keys", getKeys);
router.post("/keys/rotate", rotateSecret);
router.put("/keys/:clientId/toggle", toggleKeyStatus);

router.get("/analytics", getAnalytics);
router.get("/logs", getLogs);
router.get("/manifest", getApiManifest);

export default router;
