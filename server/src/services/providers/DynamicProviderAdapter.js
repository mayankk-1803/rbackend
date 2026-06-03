import prisma from "../../config/prisma.js";
import axios from "axios";

export class DynamicProviderAdapter {
  constructor(code) {
    this.code = String(code).toUpperCase().trim();
  }

  /**
   * Fetches the dynamic provider configuration from the database.
   */
  async getProviderConfig() {
    const provider = await prisma.provider.findUnique({
      where: { code: this.code }
    });
    if (!provider) {
      throw new Error(`Dynamic provider config not found for code: ${this.code}`);
    }
    return provider;
  }

  /**
   * Returns capabilities metadata.
   */
  getCapabilities() {
    return {
      supportsRecharge: false,
      supportsBalance: true,
      supportsStatus: true,
      supportsDiagnostics: true,
      supportsHealthChecks: true
    };
  }

  /**
   * Recharge Protection: recharge() must immediately fail when ENABLE_DYNAMIC_RECHARGE=false.
   */
  async recharge(payload) {
    if (process.env.ENABLE_DYNAMIC_RECHARGE === "true") {
      throw new Error("Dynamic recharge execution is not yet integrated.");
    }
    throw new Error("Dynamic recharge providers are disabled in safe mode");
  }

  /**
   * Ping Host Diagnostics check.
   */
  async ping() {
    const config = await this.getProviderConfig();
    const targetUrl = config.apiUrl || config.baseUrl;
    if (!targetUrl) {
      throw new Error("No API URL or Base URL configured for this provider.");
    }

    const start = Date.now();
    try {
      const response = await axios.get(targetUrl, { timeout: 4000 });
      return {
        success: true,
        latency: Date.now() - start,
        statusCode: response.status,
        message: "Ping Check Successful"
      };
    } catch (axiosErr) {
      return {
        success: false,
        latency: Date.now() - start,
        statusCode: axiosErr.response?.status || 500,
        error: axiosErr.message,
        message: "Ping Check Failed: Destination unreachable"
      };
    }
  }

  /**
   * Health Check Heartbeat.
   */
  async healthCheck() {
    try {
      const pingRes = await this.ping();
      return {
        success: pingRes.success,
        latency: pingRes.latency,
        status: pingRes.success ? "HEALTHY" : "DOWN",
        message: pingRes.message
      };
    } catch (err) {
      return {
        success: false,
        latency: 0,
        status: "DOWN",
        message: err.message
      };
    }
  }

  /**
   * Balance Query.
   */
  async getBalance() {
    if (process.env.ENABLE_DYNAMIC_PROVIDER_ADAPTER !== "true") {
      throw new Error("Dynamic provider adapter is disabled in system configuration.");
    }
    const config = await this.getProviderConfig();
    const targetUrl = config.balanceUrl;
    if (!targetUrl) {
      throw new Error("No Balance URL configured for this provider.");
    }

    const start = Date.now();
    try {
      const response = await axios.get(targetUrl, {
        headers: { 
          Authorization: `Bearer ${config.apiKey}`,
          Accept: "application/json"
        },
        timeout: 4000
      });

      const raw = response.data;
      const balanceVal = raw?.balance ?? raw?.walletBalance ?? raw?.data?.balance ?? 0;

      return {
        success: true,
        balance: Number(balanceVal),
        latency: Date.now() - start,
        message: "Balance fetched successfully",
        raw
      };
    } catch (err) {
      return {
        success: false,
        balance: 0,
        latency: Date.now() - start,
        error: err.message,
        message: "Balance check failed"
      };
    }
  }

  /**
   * Alias for getBalance to match health monitoring interface.
   */
  async balance() {
    return this.getBalance();
  }

  /**
   * Status Check.
   */
  async checkStatus(txnId, providerTxnId) {
    if (process.env.ENABLE_DYNAMIC_PROVIDER_ADAPTER !== "true") {
      throw new Error("Dynamic provider adapter is disabled in system configuration.");
    }
    const config = await this.getProviderConfig();
    const targetUrl = config.statusCheckUrl;
    if (!targetUrl) {
      throw new Error("No Status Check URL configured for this provider.");
    }

    // Interpolate txnId and providerTxnId placeholders in URL
    const queryUrl = targetUrl
      .replace("{txnId}", String(txnId || ""))
      .replace("{providerTxnId}", String(providerTxnId || ""));

    const start = Date.now();
    try {
      const response = await axios.get(queryUrl, {
        headers: { 
          Authorization: `Bearer ${config.apiKey}`,
          Accept: "application/json"
        },
        timeout: 4000
      });

      const raw = response.data;
      const statusValue = raw?.status ?? raw?.payment_status ?? raw?.data?.status ?? "PENDING";

      return {
        success: true,
        status: statusValue,
        latency: Date.now() - start,
        message: "Status check completed",
        raw
      };
    } catch (err) {
      return {
        success: false,
        status: "FAILED",
        latency: Date.now() - start,
        error: err.message,
        message: "Status query failed"
      };
    }
  }

  /**
   * Alias checkStatus.
   */
  async status(txnId, providerTxnId) {
    return this.checkStatus(txnId, providerTxnId);
  }
}

export default DynamicProviderAdapter;
