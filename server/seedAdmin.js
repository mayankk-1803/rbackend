import bcrypt from "bcryptjs";
import prisma from "./src/config/prisma.js";

const run = async () => {
  try {
    console.log("Preparing fresh admin user...");
    const hashedPassword = await bcrypt.hash("123456", 10);
    const email = "admin@dizipay.com";

    // Use upsert to avoid foreign key constraint errors while ensuring fresh credentials
    const admin = await prisma.user.upsert({
      where: { email: email },
      update: {
        password: hashedPassword,
        role: "admin",
        name: "Admin"
      },
      create: {
        name: "Admin",
        email: email,
        password: hashedPassword,
        role: "admin"
      }
    });

    console.log("ADMIN CREATED/UPDATED SUCCESSFULLY");
    console.log({ id: admin.id, email: admin.email, role: admin.role });

    process.exit(0);
  } catch (err) {
    console.error("SEED ERROR:", err);
    process.exit(1);
  }
};

run();
