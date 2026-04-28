import { detectOperator } from "../services/operatorService.js";

export const getOperator = async (req, res) => {
  try {
    const { mobile } = req.params;

    // Validate mobile number
    if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
      return res.status(400).json({ success: false, message: "Invalid Indian mobile number" });
    }

    const operatorInfo = await detectOperator(mobile);

    res.json({
      success: true,
      data: {
        operator: operatorInfo?.operator || "Unknown",
        circle: operatorInfo?.circle || "Unknown",
        logo: operatorInfo?.logo || "",
        source: operatorInfo?.source || "fallback",
      }
    });
  } catch (error) {
    console.error("[Operator Error]:", error);
    res.json({ success: true, data: { operator: "Unknown", circle: "Unknown", logo: "", source: "error_fallback" } });
  }
};
