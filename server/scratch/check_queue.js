import { rechargeQueue } from "../src/services/rechargeService.js";

async function checkQueue() {
  const waiting = await rechargeQueue.getWaiting();
  const active = await rechargeQueue.getActive();
  const failed = await rechargeQueue.getFailed();
  const delayed = await rechargeQueue.getDelayed();

  console.log("Waiting:", waiting.length);
  console.log("Active:", active.length);
  console.log("Failed:", failed.length);
  console.log("Delayed:", delayed.length);
  
  if (failed.length > 0) {
    console.log("Failed Job Reason:", failed[0].failedReason);
  }

  process.exit(0);
}

checkQueue();
