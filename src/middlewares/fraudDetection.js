import { connection as redis } from "../config/redis.js";
import FraudLog from "../models/FraudLog.js";
import { sendAlert } from "../services/alertService.js";
import eventBus from "../config/eventBus.js";

const FRAUD_TTL = 3600; // 1 hour

export const fraudDetectionMiddleware = async (req, res, next) => {
    // Requires authenticated route so req.user expected to exist, else bypass or fail
    const userId = req.body.userId; // Defaulting to body for test purposes, ideally req.user.id
    if (!userId) return next();
    
    const { amount, mobile } = req.body;
    let riskScore = 0;
    const reasons = [];
    
    try {
        const pipeline = redis.pipeline();
        pipeline.incr(`fraud:user:${userId}:txn_count`);
        pipeline.expire(`fraud:user:${userId}:txn_count`, FRAUD_TTL);
        
        if (amount) {
            pipeline.incrby(`fraud:user:${userId}:amount_sum`, amount);
            pipeline.expire(`fraud:user:${userId}:amount_sum`, FRAUD_TTL);
        }
        
        if (mobile) {
            pipeline.sadd(`fraud:mobile:${mobile}:unique_users`, userId);
            pipeline.expire(`fraud:mobile:${mobile}:unique_users`, FRAUD_TTL);
            pipeline.scard(`fraud:mobile:${mobile}:unique_users`);
        }
        
        const results = await pipeline.exec();
        
        // results is an array of [error, result]
        const txn_count = results[0][1];
        const amount_sum = amount ? results[2][1] : 0;
        const unique_users = mobile ? results[6][1] : 1;
        
        // RULE 1: High Transaction Frequency (e.g., > 10 in an hour)
        if (txn_count > 10) {
            riskScore += 45;
            reasons.push("High transaction frequency in short timeframe");
        }
        
        // RULE 2: Sudden Amount Spike (e.g., > 10000 in an hour)
        if (amount_sum > 10000) {
            riskScore += 35;
            reasons.push("Abnormal amount volume for user");
        }
        
        // RULE 3: Multiple Users Same Mobile (e.g., > 3 unique users topping up the same number)
        if (unique_users > 3) {
            riskScore += 50;
            reasons.push("Multiple distinct users recharging same mobile");
        }
        
        if (riskScore > 0) {
            let actionTaken = "NONE";
            let statusCode = 200;
            
            if (riskScore > 70) {
                actionTaken = "BLOCKED";
                statusCode = 403;
                
                // Massive alert check
                await sendAlert("FRAUD_SPIKE", "High Risk Transaction Blocked", `User: ${userId}, Mobile: ${mobile}, Score: ${riskScore}`);
                eventBus.emit("fraud_alert", { userId, mobile, riskScore, actionTaken });
                
            } else if (riskScore > 40) {
                actionTaken = "FLAGGED";
            }
            
            // Log Asynchronously
            FraudLog.create({
                userId,
                mobile,
                riskScore,
                actionTaken,
                reasons,
                txnData: { amount, mobile }
            }).catch(e => console.error("FraudLog Error", e));
            
            if (actionTaken === "BLOCKED") {
                return res.status(statusCode).json({ success: false, message: "Transaction blocked due to security policies." });
            }
        }
        
        next();
    } catch (err) {
        console.error("Fraud Detection Error:", err);
        next(); // Soft fail logic
    }
};
