import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../src/models/User.js";
import Wallet from "../src/models/Wallet.js";

dotenv.config();

const migrateWallets = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/recharge-platform");
    console.log("📦 Connected to MongoDB for Migration");

    // We can't use the User model cleanly if we just removed walletBalance, 
    // so we use the raw collection to get the old fields.
    const usersCollection = mongoose.connection.collection("users");
    const users = await usersCollection.find({}).toArray();

    console.log(`Found ${users.length} users. Migrating to Wallet collection...`);

    let migrated = 0;
    for (const user of users) {
      const balance = user.walletBalance || 0;
      const cashbackBalance = user.cashbackBalance || 0;

      await Wallet.findOneAndUpdate(
        { userId: user._id },
        { 
          $set: { 
            balance: balance,
            cashbackBalance: cashbackBalance
          } 
        },
        { upsert: true, new: true }
      );
      migrated++;
    }

    console.log(`✅ Successfully migrated ${migrated} wallets!`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
};

migrateWallets();
