import nodemailer from "nodemailer";
import { connection as redis } from "../config/redis.js";

const COOLDOWN_TTL = 300; // 5 minutes

// Placeholder configuration, user should set these in .env
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.mailtrap.io",
  port: process.env.SMTP_PORT || 2525,
  auth: {
    user: process.env.SMTP_USER || "user",
    pass: process.env.SMTP_PASS || "pass",
  },
});

export const sendAlert = async (type, title, message) => {
  const alertKey = `alert:${type}`;
  
  try {
    // Check if alert is in cooldown
    const isInCooldown = await redis.get(alertKey);
    if (isInCooldown) {
      console.log(`[ALERT SKIPPED] ${type} is in cooldown. Msg: ${title}`);
      return;
    }

    const mailOptions = {
      from: '"Dizipay Alerts" <alerts@dizipay.com>',
      to: process.env.ADMIN_EMAIL || "admin@dizipay.com",
      subject: `[${type}] ${title}`,
      text: message,
    };

    await transporter.sendMail(mailOptions);
    console.log(`[ALERT SENT] ${type}: ${title}`);

    // Set cooldown
    await redis.set(alertKey, "1", "EX", COOLDOWN_TTL);
  } catch (error) {
    console.error("Failed to send alert via Nodemailer:", error);
  }
};
