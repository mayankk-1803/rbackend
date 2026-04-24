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
        operator: operatorInfo.operator,
        circle: operatorInfo.circle,
        logo: operatorInfo.logo,
        source: operatorInfo.source,
      }
    });
  } catch (error) {
    console.error("[Operator Error]:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
