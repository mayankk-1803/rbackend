import prisma from "../config/prisma.js";

const realProviders = [
  {
    name: "APIBOX",
    code: "APIBOX",
    baseUrl: "https://api.apibox.in",
    apiKey: process.env.APIBOX_TOKEN || "test_key",
    priority: 100,
    isActive: true,
    inSwitch: true,
    routeType: "Both",
    successRate: 100,
    avgResponseTime: 41,
    apiUrl: "https://api.apibox.in",
    statusCheckUrl: null,
    balanceUrl: null,
    disputeUrl: null,
    maintenanceMode: false
  },
  {
    name: "MPLAN",
    code: "MPLAN",
    baseUrl: "https://www.mplan.in",
    apiKey: process.env.MPLAN_API_KEY || "test_key",
    priority: 90,
    isActive: true,
    inSwitch: true,
    routeType: "Both",
    successRate: 100,
    avgResponseTime: 50,
    apiUrl: "https://www.mplan.in",
    statusCheckUrl: null,
    balanceUrl: null,
    disputeUrl: null,
    maintenanceMode: false
  },
  {
    name: "EZYTM",
    code: "EZYTM",
    baseUrl: "https://ezytm.net",
    apiKey: process.env.EZYTM_API_PASSWORD || "test_key",
    priority: 80,
    isActive: true,
    inSwitch: true,
    routeType: "Both",
    successRate: 100,
    avgResponseTime: 60,
    apiUrl: "https://ezytm.net",
    statusCheckUrl: null,
    balanceUrl: null,
    disputeUrl: null,
    maintenanceMode: false
  }
];

export const seedProviders = async () => {
  try {
    console.log("Resetting providers to real integrations...");
    await prisma.provider.deleteMany({});
    
    await prisma.provider.createMany({
      data: realProviders
    });
    console.log("Production integration providers seeded successfully.");
  } catch (error) {
    console.error("Error seeding providers:", error);
  }
};

