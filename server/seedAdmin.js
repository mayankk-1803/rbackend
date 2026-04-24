import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from './src/models/User.js';
import Wallet from './src/models/Wallet.js';

dotenv.config();

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        const adminEmail = process.env.ADMIN_EMAIL || 'admin@dizipay.com';
        const adminPass = process.env.ADMIN_PASSWORD || '123456';

        // Check if admin already exists
        const existingAdmin = await User.findOne({ email: adminEmail });
        if (existingAdmin) {
            console.log("Admin user already exists. Updating role...");
            existingAdmin.role = 'admin';
            await existingAdmin.save();
            console.log("Admin role updated.");
        } else {
            const hash = await bcrypt.hash(adminPass, 10);
            const admin = await User.create({
                name: "System Admin",
                email: adminEmail,
                password: hash,
                role: 'admin',
                referralCode: 'ADMIN'
            });

            console.log("Admin user created:", admin._id);

            // Create wallet for admin
            await Wallet.findOneAndUpdate(
                { userId: admin._id },
                { $setOnInsert: { balance: 10000, cashbackBalance: 0 } },
                { upsert: true, new: true }
            );
            console.log("Admin wallet initialized with ₹10,000");
        }

        console.log("Seeding completed successfully.");
        process.exit(0);
    } catch (err) {
        console.error("Seeding failed:", err);
        process.exit(1);
    }
};

seedAdmin();
