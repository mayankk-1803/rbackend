import { connection as redis } from "../config/redis.js";
import FraudLog from "../models/FraudLog.js";
import { sendAlert } from "../services/alertService.js";
import eventBus from "../config/eventBus.js";

const FRAUD_TTL = 60; // 1 minute window for some checks
const LONGER_TTL = 3600; // 1 hour window

export const fraudDetectionMiddleware = async (req, res, next) => {
    const userId = req.body.userId || (req.user && req.user.id);
    if (!userId) return next();
    
    const { amount, mobile } = req.body;
    let riskScore = 0;
    const reasons = [];
    
    try {
        const pipeline = redis.pipeline();
        
        // 1. Transaction count per minute for SAME MOBILE
        const mobileKey = `fraud:mobile:${mobile}:count_min`;
        pipeline.incr(mobileKey);
        pipeline.expire(mobileKey, FRAUD_TTL);
        
        // 2. Repeated same amount for same mobile/user
        const repeatAmountKey = `fraud:user:${userId}:mobile:${mobile}:amount:${amount}:count`;
        pipeline.incr(repeatAmountKey);
        pipeline.expire(repeatAmountKey, LONGER_TTL);
        
        // 3. Overall user transaction count
        const userTxnKey = `fraud:user:${userId}:count_hour`;
        pipeline.incr(userTxnKey);
        pipeline.expire(userTxnKey, LONGER_TTL);

        const results = await pipeline.exec();
        
        const mobileTxnCountMin = results[0][1];
        const repeatAmountCount = results[2][1];
        const userTxnCountHour = results[4][1];
        
        // RULE: 5 transactions/min (same mobile)
        if (mobileTxnCountMin >= 5) {
            riskScore += 80;
            reasons.push("Rapid transactions to same mobile (>5/min)");
        }
        
        // RULE: repeated same amount (more than 3 times in an hour for same mobile)
        if (repeatAmountCount > 3) {
            riskScore += 40;
            reasons.push("Repeated identical amount to same mobile");
        }
        
        // RULE: High user frequency
        if (userTxnCountHour > 15) {
            riskScore += 50;
            reasons.push("High hourly transaction volume for user");
        }

        if (riskScore > 0) {
            let actionTaken = "NONE";
            let statusCode = 200;
            
            if (riskScore >= 70) {
                actionTaken = "BLOCKED";
                statusCode = 403;
                
                await sendAlert("FRAUD_BLOCKED", "High Risk Transaction Blocked", `User: ${userId}, Mobile: ${mobile}, Score: ${riskScore}, Reasons: ${reasons.join(", ")}`);
                eventBus.emit("fraud_alert", { userId, mobile, riskScore, actionTaken, reasons });
            } else if (riskScore >= 30) {
                actionTaken = "FLAGGED";
                eventBus.emit("fraud_alert", { userId, mobile, riskScore, actionTaken, reasons });
            }
            
            // Log to DB
            await FraudLog.create({
                userId,
                mobile,
                riskScore,
                actionTaken,
                reasons,
                txnData: { amount, mobile }
            });
            
            if (actionTaken === "BLOCKED") {
                return res.status(statusCode).json({ 
                    success: false, 
                    message: "Security Alert: Transaction blocked due to suspicious patterns.",
                    reasons: reasons
                });
            }
        }
        
        next();
    } catch (err) {
        console.error("Fraud Detection Error:", err);
        next();
    }
};
