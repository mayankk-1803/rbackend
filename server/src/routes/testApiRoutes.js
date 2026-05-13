import express from "express";
import { handleTestApiToken } from "../controllers/testApiController.js";

const router = express.Router();

router.get("/", handleTestApiToken);

export default router;
