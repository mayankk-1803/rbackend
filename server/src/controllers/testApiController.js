import { testGetBalance } from "../services/testApiService.js";

export const handleTestApiToken = async (req, res) => {
  try {
    const rawData = await testGetBalance();
    
    // ERechargeWorld typically returns XML
    res.set("Content-Type", "text/xml");
    return res.send(rawData);
  } catch (error) {
    console.error("[CRITICAL] TEST API ERROR:", error.message);
    
    return res.status(500).json({
      success: false,
      message: error.message || "Test API failed"
    });
  }
};
