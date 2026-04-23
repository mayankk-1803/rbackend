import mongoose from "mongoose";
import Provider from "../models/Provider.js";
import { seedProviders } from "./seedProviders.js";

const MONGO_URI = "mongodb://localhost:27017/dizipay";

const run = async () => {
  await mongoose.connect(MONGO_URI);
  console.log("Dropping providers...");
  await Provider.deleteMany({});
  
  await seedProviders();
  
  const p = await Provider.countDocuments();
  console.log("Providers length:", p);
  process.exit(0);
};

run();
