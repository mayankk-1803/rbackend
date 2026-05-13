import { executeRecharge } from "./recharge.js";
import { checkStatus } from "./status.js";
import { getBalance } from "./balance.js";
import { processWebhook } from "./webhook.js";

export default {
  recharge: executeRecharge,
  status: checkStatus,
  balance: getBalance,
  webhook: processWebhook
};
