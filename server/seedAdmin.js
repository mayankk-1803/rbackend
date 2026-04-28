import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import prisma from './src/config/prisma.js';

dotenv.config();

const seedAdmin = async () => {
    try {
        console.log("Connecting to MySQL via Prisma...");

        const adminEmail = process.env.ADMIN_EMAIL || 'admin@dizipay.com';
        const adminPass = process.env.ADMIN_PASSWORD || '123456';

        // Check if admin already exists
        const existingAdmin = await prisma.user.findUnique({
            where: { email: adminEmail }
        });

        if (existingAdmin) {
            console.log("Admin user already exists. Updating role...");
            await prisma.user.update({
                where: { email: adminEmail },
                data: { role: 'admin' }
            });
            console.log("Admin role updated.");
        } else {
            const hash = await bcrypt.hash(adminPass, 10);
            const admin = await prisma.user.create({
                data: {
                    name: "System Admin",
                    email: adminEmail,
                    password: hash,
                    role: 'admin',
                    referralCode: 'ADMIN',
                    wallet: {
                        create: {
                            balance: 10000,
                            cashbackBalance: 0
                        }
                    }
                }
            });

            console.log("Admin user created with ID:", admin.id);
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
