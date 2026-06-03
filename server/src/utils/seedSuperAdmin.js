import prisma from "../config/prisma.js";
import bcrypt from "bcryptjs";

export async function seedSuperAdminAndRbac() {
  try {
    console.log("[SEEDING] Starting DiziPay SuperAdmin and RBAC config checks...");

    // 1. Seed SUPER_ADMIN account
    const superAdminEmail = "superadmin@dizipay.in";
    const hashedPassword = await bcrypt.hash("Dizipay@121189", 10);

    const existingSuper = await prisma.user.findUnique({
      where: { email: superAdminEmail }
    });

    if (existingSuper) {
      console.log(`[SEEDING] SuperAdmin already exists (ID: ${existingSuper.id}). Updating profile & role safely...`);
      await prisma.user.update({
        where: { email: superAdminEmail },
        data: {
          role: "SUPER_ADMIN",
          password: hashedPassword,
          isActive: true
        }
      });
    } else {
      console.log("[SEEDING] Creating new SUPER_ADMIN user...");
      const newUser = await prisma.user.create({
        data: {
          email: superAdminEmail,
          password: hashedPassword,
          role: "SUPER_ADMIN",
          name: "Super Admin",
          isActive: true,
          authType: "email",
          isEmailVerified: true
        }
      });

      // Ensure super admin has a wallet
      const existingWallet = await prisma.wallet.findUnique({ where: { userId: newUser.id } });
      if (!existingWallet) {
        await prisma.wallet.create({
          data: {
            userId: newUser.id,
            balance: 100000.00, // Pre-fund superadmin vault cleanly
            currency: "INR"
          }
        });
      }
    }

    // 2. Seed Default Role Permissions
    const roles = ["SUPER_ADMIN", "ADMIN", "USER", "API_USER"];
    const modules = ["users", "wallets", "outlets", "employees", "audit", "operations"];

    const rbacDefaults = {
      SUPER_ADMIN: { read: true, write: true, delete: true, approve: true, adjust: true },
      ADMIN: { read: true, write: true, delete: false, approve: true, adjust: false },
      USER: { read: false, write: false, delete: false, approve: false, adjust: false },
      API_USER: { read: false, write: false, delete: false, approve: false, adjust: false }
    };

    let seededCount = 0;
    for (const role of roles) {
      const defaults = rbacDefaults[role];
      for (const moduleName of modules) {
        const existingPerm = await prisma.rolePermission.findUnique({
          where: {
            role_module: {
              role,
              module: moduleName
            }
          }
        });

        if (!existingPerm) {
          await prisma.rolePermission.create({
            data: {
              role,
              module: moduleName,
              canRead: defaults.read,
              canWrite: defaults.write,
              canDelete: defaults.delete,
              canApprove: defaults.approve,
              canAdjust: defaults.adjust
            }
          });
          seededCount++;
        }
      }
    }

    if (seededCount > 0) {
      console.log(`[SEEDING] Seeded ${seededCount} role-permission matrix mappings cleanly.`);
    } else {
      console.log("[SEEDING] RBAC permissions matrix check completed successfully.");
    }

    // 3. Ensure default RoutingConfig exists
    const existingRoutingConfig = await prisma.routingConfig.findUnique({
      where: { id: 1 }
    });
    if (!existingRoutingConfig) {
      await prisma.routingConfig.create({
        data: {
          id: 1,
          currentVersion: 1,
          lastModifiedBy: "SYSTEM"
        }
      });
      console.log("[SEEDING] Seeded default RoutingConfig successfully.");
    }

  } catch (err) {
    console.error("[SEEDING ERROR]:", err.message);
  }
}
