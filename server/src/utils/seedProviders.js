import mongoose from "mongoose";
import Provider from "../models/Provider.js";

const dummyProviders = [
  { name: "Primary API", code: "P1", baseUrl: "https://api.p1.com", apiKey: "key_p1", priority: 10, isActive: true, successRate: 98, avgResponseTime: 200, costPerTxn: 1 },
  { name: "Speedy API", code: "P2", baseUrl: "https://api.p2.com", apiKey: "key_p2", priority: 9, isActive: true, successRate: 95, avgResponseTime: 120, costPerTxn: 1.5 },
  { name: "Backup API", code: "P3", baseUrl: "https://api.p3.com", apiKey: "key_p3", priority: 8, isActive: true, successRate: 90, avgResponseTime: 300, costPerTxn: 0.8 },
  { name: "Economy API", code: "P4", baseUrl: "https://api.p4.com", apiKey: "key_p4", priority: 7, isActive: true, successRate: 85, avgResponseTime: 400, costPerTxn: 0.5 },
  { name: "Global Recharge", code: "P5", baseUrl: "https://api.p5.com", apiKey: "key_p5", priority: 6, isActive: true, successRate: 92, avgResponseTime: 250, costPerTxn: 1.2 },
  { name: "FastPay API", code: "P6", baseUrl: "https://api.p6.com", apiKey: "key_p6", priority: 5, isActive: true, successRate: 88, avgResponseTime: 180, costPerTxn: 1.1 },
  { name: "SecureCharge", code: "P7", baseUrl: "https://api.p7.com", apiKey: "key_p7", priority: 4, isActive: true, successRate: 94, avgResponseTime: 220, costPerTxn: 1.3 },
  { name: "Local Provider", code: "P8", baseUrl: "https://api.p8.com", apiKey: "key_p8", priority: 3, isActive: true, successRate: 80, avgResponseTime: 500, costPerTxn: 0.4 },
  { name: "Ultra API", code: "P9", baseUrl: "https://api.p9.com", apiKey: "key_p9", priority: 2, isActive: false, successRate: 99, avgResponseTime: 100, costPerTxn: 2.0 },
  { name: "Legacy API", code: "P10", baseUrl: "https://api.p10.com", apiKey: "key_p10", priority: 1, isActive: false, successRate: 70, avgResponseTime: 800, costPerTxn: 0.3 }
];

export const seedProviders = async () => {
  try {
    console.log("Resetting providers...");
    await Provider.deleteMany({}); // 🔥 FORCE RESET
    
    await Provider.insertMany(dummyProviders);
    console.log("✅ 10 Providers seeded successfully");
  } catch (error) {
    console.error("Error seeding providers:", error);
  }
};
