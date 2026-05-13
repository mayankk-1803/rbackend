import { detectOperator } from "../services/operatorService.js";

export const getOperator = async (req, res) => {
  try {
    const { mobile } = req.params;

    // Validate mobile number
    if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
      return res.json({ success: false, message: "Invalid Indian mobile number format", fallback: true });
    }

    const result = await detectOperator(mobile);

    // Pass the result directly since the service now formats it properly
    res.json(result);
  } catch (error) {
    console.error("[Operator Error]:", error);
    res.json({ success: false, message: "Operator detection failed", fallback: true });
  }
};
