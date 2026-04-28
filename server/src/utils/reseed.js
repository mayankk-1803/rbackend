import prisma from "../config/prisma.js";
import { seedProviders } from "./seedProviders.js";

const run = async () => {
  try {
    console.log("Resetting providers...");
    await prisma.provider.deleteMany({});
    
    await seedProviders();
    
    const count = await prisma.provider.count();
    console.log("Providers length:", count);
    process.exit(0);
  } catch (error) {
    console.error("Reseed failed:", error);
    process.exit(1);
  }
};

run();
