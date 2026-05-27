import prisma from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import { recordFinancialEntry } from "../services/ledgerService.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";

/**
 * 1. Customer Care workspace (uses real production disputes table)
 */
export const getCustomerCareQueue = async (req, res) => {
  try {
    // Retrieve users holding admin/staff roles and general queue metrics
    const supportUsers = await prisma.user.findMany({
      where: {
        role: { in: ["ADMIN", "SUPER_ADMIN"] }
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true
      }
    });

    // Query real disputes (tickets) from the database
    const realDisputes = await prisma.dispute.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true
          }
        },
        admin: {
          select: {
            name: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 50
    });

    const activeTickets = realDisputes.map(d => ({
      id: `T-${1000 + d.id}`,
      user: d.user?.name || "Unknown User",
      issue: d.description || "No description provided",
      category: d.type || "Support",
      priority: d.status === "OPEN" ? "HIGH" : (d.status === "UNDER_REVIEW" ? "MEDIUM" : "LOW"),
      status: d.status,
      assignedTo: d.admin?.name || null,
      createdAt: d.createdAt
    }));

    // Group real disputes to build authentic department metrics
    const disputeGroups = await prisma.dispute.groupBy({
      by: ['type'],
      _count: {
        _all: true
      }
    });

    const departmentMetrics = {
      Support: 0,
      Finance: 0,
      Recharge: 0,
      Escalation: 0,
      Operations: 0
    };

    disputeGroups.forEach(g => {
      const typeKey = g.type || 'Support';
      departmentMetrics[typeKey] = g._count._all;
    });

    res.json({
      success: true,
      data: {
        supportUsers,
        activeTickets,
        departmentMetrics
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 2. Outlet Registry
 */
export const getOutlets = async (req, res) => {
  try {
    const { search, pincode, status } = req.query;

    const where = {};
    if (status) where.status = status;
    if (pincode) where.pincode = pincode;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { ownerName: { contains: search } },
        { city: { contains: search } }
      ];
    }

    const outlets = await prisma.outlet.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            wallet: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json({ success: true, data: outlets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 3. Approve/Reject Outlet Registration
 */
export const updateOutletStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // APPROVED, REJECTED, PENDING

    if (!["APPROVED", "REJECTED", "PENDING", "NOT_APPLIED"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status value" });
    }

    const outletCheck = await prisma.outlet.findUnique({
      where: { id: Number(id) },
      include: { user: { select: { role: true } } }
    });

    if (!outletCheck) {
      return res.status(404).json({ success: false, message: "Outlet not found" });
    }

    const roleLevels = { USER: 1, API_USER: 1, ADMIN: 2, SUPER_ADMIN: 3 };
    const actorLevel = roleLevels[req.user.role] || 0;
    const targetLevel = roleLevels[outletCheck.user.role] || 0;
    if (actorLevel <= targetLevel) {
      return res.status(403).json({ success: false, message: "Access Denied: Role hierarchy violation." });
    }

    const outlet = await prisma.outlet.update({
      where: { id: Number(id) },
      data: { status }
    });

    // Log in audit log
    await prisma.auditLog.create({
      data: {
        action: `OUTLET_STATUS_${status}`,
        adminId: req.user.id,
        entity: "outlet",
        entityId: outlet.id,
        details: { status }
      }
    });

    res.json({ success: true, message: `Outlet status updated to ${status} successfully`, data: outlet });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 4. Partner Manager
 */
export const getPartners = async (req, res) => {
  try {
    const partners = await prisma.user.findMany({
      where: {
        role: "API_USER"
      },
      include: {
        apiAccesses: true,
        wallet: true
      }
    });

    res.json({ success: true, data: partners });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 5. FOS directory & stats
 */
export const getFosAgents = async (req, res) => {
  try {
    const fosAgents = await prisma.fosAgent.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        retailers: {
          select: {
            id: true,
            name: true,
            phone: true,
            wallet: {
              select: {
                balance: true
              }
            }
          }
        }
      }
    });

    res.json({ success: true, data: fosAgents });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 6. Link retailer to FOS Agent
 */
export const assignFosRetailers = async (req, res) => {
  try {
    const { fosAgentId, retailerIds, action } = req.body; // action: 'assign' or 'unassign'

    if (!fosAgentId || !retailerIds || !Array.isArray(retailerIds)) {
      return res.status(400).json({ success: false, message: "Invalid payload parameters" });
    }

    const targets = await prisma.user.findMany({
      where: { id: { in: retailerIds.map(Number) } },
      select: { role: true }
    });
    const roleLevels = { USER: 1, API_USER: 1, ADMIN: 2, SUPER_ADMIN: 3 };
    const actorLevel = roleLevels[req.user.role] || 0;
    for (const t of targets) {
      const targetLevel = roleLevels[t.role] || 0;
      if (actorLevel <= targetLevel) {
        return res.status(403).json({ success: false, message: "Access Denied: Role hierarchy violation." });
      }
    }

    if (action === "assign") {
      await prisma.user.updateMany({
        where: { id: { in: retailerIds } },
        data: { fosAgentId: Number(fosAgentId) }
      });
      // Increment target FOS count
      await prisma.fosAgent.update({
        where: { id: Number(fosAgentId) },
        data: { currentOnboardings: { increment: retailerIds.length } }
      });
    } else {
      await prisma.user.updateMany({
        where: { id: { in: retailerIds } },
        data: { fosAgentId: null }
      });
      // Decrement target FOS count safely
      await prisma.fosAgent.update({
        where: { id: Number(fosAgentId) },
        data: { currentOnboardings: { decrement: retailerIds.length } }
      });
    }

    await prisma.auditLog.create({
      data: {
        action: `FOS_RETAILER_${action.toUpperCase()}`,
        adminId: req.user.id,
        details: { fosAgentId, retailerIds }
      }
    });

    res.json({ success: true, message: `Retailers successfully ${action}ed` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 7. Safe production-grade bulk actions engine
 */
export const executeBulkAction = async (req, res) => {
  const { userIds, actionType, actionPayload } = req.body;
  if (!userIds || !Array.isArray(userIds) || userIds.length === 0 || !actionType) {
    return res.status(400).json({ success: false, message: "Missing required bulk parameters" });
  }

  const results = {
    total: userIds.length,
    success: 0,
    failed: 0,
    errors: [],
    auditLogs: []
  };

  try {
    for (const userId of userIds) {
      try {
        await prisma.$transaction(async (tx) => {
          const targetUser = await tx.user.findUnique({
            where: { id: userId },
            select: { id: true, role: true }
          });
          if (!targetUser) {
            throw new Error("User not found");
          }
          const roleLevels = { USER: 1, API_USER: 1, ADMIN: 2, SUPER_ADMIN: 3 };
          const actorLevel = roleLevels[req.user.role] || 0;
          const targetLevel = roleLevels[targetUser.role] || 0;
          if (actorLevel <= targetLevel) {
            throw new Error("Access Denied: Role hierarchy violation.");
          }

          if (actionType === "activate") {
            await tx.user.update({ where: { id: userId }, data: { isActive: true } });
          } else if (actionType === "deactivate") {
            await tx.user.update({ where: { id: userId }, data: { isActive: false } });
          } else if (actionType === "enable_otp") {
            await tx.user.update({ where: { id: userId }, data: { isPhoneVerified: true } });
          } else if (actionType === "disable_otp") {
            await tx.user.update({ where: { id: userId }, data: { isPhoneVerified: false } });
          } else if (actionType === "assign_slab") {
            await tx.user.update({ where: { id: userId }, data: { tier: actionPayload.slabName } });
          } else if (actionType === "debit_credit") {
            const amount = parseFloat(actionPayload.amount);
            const direction = actionPayload.direction; // 'CREDIT' or 'DEBIT'
            
            if (isNaN(amount) || amount <= 0 || !["CREDIT", "DEBIT"].includes(direction)) {
              throw new Error("Invalid financial amount or direction");
            }

            const { balanceAfter, ledgerEntry } = await recordFinancialEntry({
              userId,
              amount: amount,
              type: direction === "CREDIT" ? "TOPUP_CREDIT" : "RECHARGE_DEBIT",
              transactionId: null,
              description: actionPayload.description || `Bulk adjustment (${direction}) by admin`,
              tx
            });

            const transaction = await tx.transaction.create({
              data: {
                userId,
                amount: amount,
                type: "WALLET",
                status: "SUCCESS",
                direction,
                balanceAfter,
                description: actionPayload.description || `Bulk adjustment (${direction}) by admin`,
                idempotencyKey: `bulk_wallet_${userId}_${Date.now()}`
              }
            });

            await tx.ledgerEntry.update({
              where: { id: ledgerEntry.id },
              data: { transactionId: transaction.id }
            });
          } else if (actionType === "broadcast_push" || actionType === "broadcast_sms") {
            await tx.notification.create({
              data: {
                userId,
                title: actionPayload.title || "Bulk Administrative Alert",
                message: actionPayload.message || "",
                type: actionType === "broadcast_push" ? "PUSH" : "SMS"
              }
            });
          }

          // Write operational log
          const log = await tx.auditLog.create({
            data: {
              action: `BULK_${actionType.toUpperCase()}`,
              adminId: req.user.id,
              userId: userId,
              details: { payload: actionPayload }
            }
          });
          results.auditLogs.push(log.id);
          results.success++;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (itemErr) {
        results.failed++;
        results.errors.push({ userId, error: itemErr.message });
      }
    }

    res.json({
      success: true,
      message: `Bulk operation completed with ${results.success} successes and ${results.failed} failures`,
      data: results
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 8. Agreement reviews
 */
export const getAgreements = async (req, res) => {
  try {
    const agreements = await prisma.agreement.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json({ success: true, data: agreements });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 9. Approve/reject Agreement with remarks
 */
export const updateAgreementStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body; // APPROVED, REJECTED

    if (!["APPROVED", "REJECTED", "PENDING"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status value" });
    }

    const agreementCheck = await prisma.agreement.findUnique({
      where: { id: Number(id) },
      include: { user: { select: { role: true } } }
    });

    if (!agreementCheck) {
      return res.status(404).json({ success: false, message: "Agreement not found" });
    }

    const roleLevels = { USER: 1, API_USER: 1, ADMIN: 2, SUPER_ADMIN: 3 };
    const actorLevel = roleLevels[req.user.role] || 0;
    const targetLevel = roleLevels[agreementCheck.user.role] || 0;
    if (actorLevel <= targetLevel) {
      return res.status(403).json({ success: false, message: "Access Denied: Role hierarchy violation." });
    }

    // Immutability check: Only SUPER_ADMIN can force-reopen / change status of an APPROVED agreement
    if (agreementCheck.status === "APPROVED" && status !== "APPROVED" && req.user.role !== "SUPER_ADMIN") {
      return res.status(400).json({ success: false, message: "Approved agreements are locked and immutable. Only SUPER_ADMIN can force-reopen." });
    }

    const agreement = await prisma.agreement.update({
      where: { id: Number(id) },
      data: {
        status,
        signedAt: status === "APPROVED" ? new Date() : null
      }
    });

    await prisma.auditLog.create({
      data: {
        action: `AGREEMENT_STATUS_${status}`,
        adminId: req.user.id,
        entity: "agreement",
        entityId: agreement.id,
        details: { status, remarks }
      }
    });

    res.json({ success: true, message: `Agreement status updated successfully`, data: agreement });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 10. Workforce CRM directory
 */
export const getEmployees = async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      orderBy: { id: "asc" }
    });
    res.json({ success: true, data: employees });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 11. Create workforce CRM employee
 */
export const createEmployee = async (req, res) => {
  try {
    const { name, email, phone, role } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, message: "Name and email are required" });
    }

    const employee = await prisma.employee.create({
      data: {
        name,
        email,
        phone,
        role: role || "STAFF",
        isActive: true
      }
    });

    await prisma.auditLog.create({
      data: {
        action: "EMPLOYEE_CREATE",
        adminId: req.user.id,
        details: { employeeId: employee.id, name, role }
      }
    });

    res.json({ success: true, message: "Employee registered successfully", data: employee });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 12. Attendance logs
 */
export const getAttendanceLogs = async (req, res) => {
  try {
    const attendance = await prisma.attendance.findMany({
      include: {
        employee: true
      },
      orderBy: { checkIn: "desc" },
      take: 100
    });

    res.json({ success: true, data: attendance });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 13. Attendance checkin
 */
export const checkInEmployee = async (req, res) => {
  try {
    const { employeeId, location } = req.body;
    if (!employeeId) {
      return res.status(400).json({ success: false, message: "Employee ID is required" });
    }

    // Check if already checked in today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const existingCheckin = await prisma.attendance.findFirst({
      where: {
        employeeId: Number(employeeId),
        checkIn: { gte: startOfDay },
        checkOut: null
      }
    });

    if (existingCheckin) {
      return res.status(400).json({ success: false, message: "Employee already checked in for today" });
    }

    const checkInRecord = await prisma.attendance.create({
      data: {
        employeeId: Number(employeeId),
        checkIn: new Date(),
        status: "PRESENT",
        location: location || "Remote / GPS verified"
      }
    });

    res.json({ success: true, message: "Clock-in successful", data: checkInRecord });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 14. Attendance checkout
 */
export const checkOutEmployee = async (req, res) => {
  try {
    const { employeeId } = req.body;
    if (!employeeId) {
      return res.status(400).json({ success: false, message: "Employee ID is required" });
    }

    const activeCheckin = await prisma.attendance.findFirst({
      where: {
        employeeId: Number(employeeId),
        checkOut: null
      },
      orderBy: { checkIn: "desc" }
    });

    if (!activeCheckin) {
      return res.status(400).json({ success: false, message: "No active check-in session found to clock out" });
    }

    const updatedRecord = await prisma.attendance.update({
      where: { id: activeCheckin.id },
      data: {
        checkOut: new Date()
      }
    });

    res.json({ success: true, message: "Clock-out successful", data: updatedRecord });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 15. Meeting schedules
 */
export const getMeetings = async (req, res) => {
  try {
    const meetings = await prisma.meeting.findMany({
      include: {
        attendees: {
          include: {
            employee: true
          }
        }
      },
      orderBy: { startTime: "desc" }
    });

    res.json({ success: true, data: meetings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 16. Schedule workplace meeting
 */
export const createMeeting = async (req, res) => {
  try {
    const { title, description, startTime, endTime, location, attendeeIds } = req.body;

    if (!title || !startTime || !endTime) {
      return res.status(400).json({ success: false, message: "Title, startTime, and endTime are required" });
    }

    const meeting = await prisma.meeting.create({
      data: {
        title,
        description,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        location: location || "Online Hub",
        attendees: attendeeIds && Array.isArray(attendeeIds) ? {
          create: attendeeIds.map(empId => ({
            employeeId: Number(empId)
          }))
        } : undefined
      }
    });

    res.json({ success: true, message: "Meeting scheduled successfully", data: meeting });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 17. Security audit logs
 */
export const getAuditLogs = async (req, res) => {
  try {
    const auditLogs = await prisma.auditLog.findMany({
      include: {
        admin: { select: { name: true, email: true } },
        user: { select: { name: true, phone: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    res.json({ success: true, data: auditLogs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 18. RBAC Access controls matrix grid (dynamic from DB)
 */
export const getRbacPermissions = async (req, res) => {
  try {
    let permissions = await prisma.rolePermission.findMany();
    
    // Auto-seed default permissions if the table is empty
    if (!permissions || permissions.length === 0) {
      const roles = ["SUPER_ADMIN", "ADMIN", "USER"];
      const modules = ["users", "wallets", "outlets", "employees", "audit"];
      
      const seedData = [];
      for (const role of roles) {
        for (const module of modules) {
          const isSuper = role === "SUPER_ADMIN";
          const isAdmin = role === "ADMIN";
          seedData.push({
            role,
            module,
            canRead: true,
            canWrite: isSuper || isAdmin,
            canDelete: isSuper,
            canApprove: isSuper || isAdmin,
            canAdjust: isSuper || isAdmin
          });
        }
      }
      
      await prisma.rolePermission.createMany({
        data: seedData,
        skipDuplicates: true
      });
      
      permissions = await prisma.rolePermission.findMany();
    }
    
    // Construct the nested role-module-action object expected by the frontend
    const rbacMatrix = {};
    
    permissions.forEach(p => {
      if (!rbacMatrix[p.role]) {
        rbacMatrix[p.role] = {};
      }
      rbacMatrix[p.role][p.module] = {
        read: p.canRead,
        write: p.canWrite,
        delete: p.canDelete,
        approve: p.canApprove,
        adjust: p.canAdjust
      };
    });
    
    res.json({ 
      success: true, 
      data: rbacMatrix,
      permissions: permissions || []
    });
  } catch (err) {
    console.error("RBAC PERMISSIONS ERROR:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to load RBAC permissions" 
    });
  }
};

const actionFieldMap = {
  read: "canRead",
  write: "canWrite",
  delete: "canDelete",
  approve: "canApprove",
  adjust: "canAdjust"
};

/**
 * 19. Update RBAC permission matrix (saved instantly to DB)
 */
export const updateRbacPermissions = async (req, res) => {
  try {
    const { role, module, action, granted } = req.body;
    
    if (!role || !module || !action) {
      return res.status(400).json({ success: false, message: "Missing required parameters" });
    }

    // Role hierarchy check
    const roleLevels = { USER: 1, API_USER: 1, ADMIN: 2, SUPER_ADMIN: 3 };
    const actorLevel = roleLevels[req.user.role] || 0;
    const targetLevel = roleLevels[role] || 0;
    if (actorLevel <= targetLevel) {
      return res.status(403).json({ success: false, message: "Access Denied: Role hierarchy violation." });
    }
    
    const fieldName = actionFieldMap[action];
    if (!fieldName) {
      return res.status(400).json({ success: false, message: "Invalid action name" });
    }
    
    // Find or create role-permission record
    const existing = await prisma.rolePermission.findFirst({
      where: { role, module }
    });
    
    let updatedPermission;
    if (existing) {
      updatedPermission = await prisma.rolePermission.update({
        where: { id: existing.id },
        data: {
          [fieldName]: granted,
          updatedBy: req.user.id
        }
      });
    } else {
      updatedPermission = await prisma.rolePermission.create({
        data: {
          role,
          module,
          [fieldName]: granted,
          updatedBy: req.user.id
        }
      });
    }
    
    await prisma.auditLog.create({
      data: {
        action: "RBAC_PERMISSION_CHANGE",
        adminId: req.user.id,
        details: { role, module, action, granted }
      }
    });

    res.json({ 
      success: true, 
      message: `Permission grid for ${role} updated successfully`,
      permission: updatedPermission
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 20. Register new outlet linked to an existing user
 */
export const createOutlet = async (req, res) => {
  try {
    const { userId, name, ownerName, address, city, state, pincode, latitude, longitude } = req.body;

    if (!userId || !name || !ownerName || !address || !city || !state || !pincode) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // 1. Verify user exists
    const userCheck = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: { id: true, role: true }
    });

    if (!userCheck) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Role hierarchy check: Actor role must be higher than target role
    const roleLevels = { USER: 1, API_USER: 1, ADMIN: 2, SUPER_ADMIN: 3 };
    const actorLevel = roleLevels[req.user.role] || 0;
    const targetLevel = roleLevels[userCheck.role] || 0;
    if (actorLevel <= targetLevel) {
      return res.status(403).json({ success: false, message: "Access Denied: Role hierarchy violation." });
    }

    // 2. Verify user has NO outlet already
    const existingOutlet = await prisma.outlet.findUnique({
      where: { userId: Number(userId) }
    });

    if (existingOutlet) {
      return res.status(400).json({ success: false, message: "User already has an outlet registered" });
    }

    // 3. Create outlet with default status = "PENDING"
    const outlet = await prisma.outlet.create({
      data: {
        userId: Number(userId),
        name,
        ownerName,
        address,
        city,
        state,
        pincode,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        status: "PENDING"
      }
    });

    // 4. Create Audit Log
    await prisma.auditLog.create({
      data: {
        action: "OUTLET_CREATE",
        adminId: req.user.id,
        entity: "outlet",
        entityId: outlet.id,
        details: { userId, name, ownerName, city, state }
      }
    });

    res.status(201).json({ success: true, message: "Outlet registered successfully in PENDING status", data: outlet });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 21. Fetch all manageable users who do not have an outlet registered
 */
export const getUsersWithoutOutlet = async (req, res) => {
  try {
    const roleLevels = { USER: 1, API_USER: 1, ADMIN: 2, SUPER_ADMIN: 3 };
    const actorLevel = roleLevels[req.user.role] || 0;

    const users = await prisma.user.findMany({
      where: {
        outlet: null
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true
      },
      orderBy: { name: "asc" }
    });

    // Filter manageable users based on role hierarchy
    const filteredUsers = users.filter(u => {
      const targetLevel = roleLevels[u.role] || 0;
      return actorLevel > targetLevel;
    });

    res.json({ success: true, data: filteredUsers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 22. Update existing outlet details
 */
export const updateOutlet = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, ownerName, address, city, state, pincode, latitude, longitude } = req.body;

    if (!name || !ownerName || !address || !city || !state || !pincode) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const outletCheck = await prisma.outlet.findUnique({
      where: { id: Number(id) },
      include: { user: { select: { role: true } } }
    });

    if (!outletCheck) {
      return res.status(404).json({ success: false, message: "Outlet not found" });
    }

    // Role hierarchy check: Actor role must be higher than target role
    const roleLevels = { USER: 1, API_USER: 1, ADMIN: 2, SUPER_ADMIN: 3 };
    const actorLevel = roleLevels[req.user.role] || 0;
    const targetLevel = roleLevels[outletCheck.user.role] || 0;
    if (actorLevel <= targetLevel) {
      return res.status(403).json({ success: false, message: "Access Denied: Role hierarchy violation." });
    }

    const updatedOutlet = await prisma.outlet.update({
      where: { id: Number(id) },
      data: {
        name,
        ownerName,
        address,
        city,
        state,
        pincode,
        latitude: (latitude !== undefined && latitude !== null && latitude !== "") ? parseFloat(latitude) : null,
        longitude: (longitude !== undefined && longitude !== null && longitude !== "") ? parseFloat(longitude) : null
      }
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        action: "OUTLET_EDIT",
        adminId: req.user.id,
        entity: "outlet",
        entityId: updatedOutlet.id,
        details: { 
          name, 
          ownerName, 
          city, 
          state,
          changedFields: {
            name: name !== outletCheck.name ? { old: outletCheck.name, new: name } : undefined,
            ownerName: ownerName !== outletCheck.ownerName ? { old: outletCheck.ownerName, new: ownerName } : undefined,
            address: address !== outletCheck.address ? { old: outletCheck.address, new: address } : undefined,
            city: city !== outletCheck.city ? { old: outletCheck.city, new: city } : undefined,
            state: state !== outletCheck.state ? { old: outletCheck.state, new: state } : undefined,
            pincode: pincode !== outletCheck.pincode ? { old: outletCheck.pincode, new: pincode } : undefined,
            latitude: outletCheck.latitude !== (latitude ? parseFloat(latitude) : null) ? { old: outletCheck.latitude, new: latitude } : undefined,
            longitude: outletCheck.longitude !== (longitude ? parseFloat(longitude) : null) ? { old: outletCheck.longitude, new: longitude } : undefined
          }
        }
      }
    });

    res.json({ success: true, message: "Outlet updated successfully", data: updatedOutlet });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 23. Fetch all users manageable by the actor admin
 */
export const getManageableUsers = async (req, res) => {
  try {
    const roleLevels = { USER: 1, API_USER: 1, ADMIN: 2, SUPER_ADMIN: 3 };
    const actorLevel = roleLevels[req.user.role] || 0;

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true
      },
      orderBy: { name: "asc" }
    });

    const filteredUsers = users.filter(u => {
      const targetLevel = roleLevels[u.role] || 0;
      return actorLevel > targetLevel;
    });

    res.json({ success: true, data: filteredUsers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 24. Promote User to API Partner
 */
export const convertPartner = async (req, res) => {
  const { userId, rateLimit, environment } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, message: "User ID is required" });
  }

  try {
    // 1. Fetch user
    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
      include: { apiAccesses: true }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // 2. Validate
    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
      return res.status(400).json({ success: false, message: "Cannot convert administrative accounts to API Partners" });
    }
    if (user.role === "API_USER" || user.apiAccesses.length > 0) {
      return res.status(400).json({ success: false, message: "User is already an API Partner" });
    }
    if (!user.isActive) {
      return res.status(400).json({ success: false, message: "Inactive users cannot be promoted to API Partners" });
    }

    // 3. Role hierarchy check
    const roleLevels = { USER: 1, API_USER: 1, ADMIN: 2, SUPER_ADMIN: 3 };
    const actorLevel = roleLevels[req.user.role] || 0;
    const targetLevel = roleLevels[user.role] || 0;
    if (actorLevel <= targetLevel) {
      return res.status(403).json({ success: false, message: "Access Denied: Role hierarchy violation." });
    }

    // 4. Generate keys securely
    const apiKey = `ak_live_${crypto.randomBytes(16).toString('hex')}`;
    const apiSecret = `sec_live_${crypto.randomBytes(32).toString('hex')}`;
    const salt = await bcrypt.genSalt(10);
    const apiSecretHash = await bcrypt.hash(apiSecret, salt);

    // 5. Transaction
    const result = await prisma.$transaction(async (tx) => {
      // Promote user role
      await tx.user.update({
        where: { id: user.id },
        data: { role: "API_USER" }
      });

      // Create ApiAccess
      const access = await tx.apiAccess.create({
        data: {
          userId: user.id,
          apiKey,
          apiSecretHash,
          isActive: true,
          rateLimit: rateLimit ? Number(rateLimit) : 100,
          environment: environment || "PRODUCTION"
        }
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          action: "PARTNER_CONVERT",
          adminId: req.user.id,
          entity: "ApiAccess",
          entityId: 0,
          ipAddress: req.ip || "127.0.0.1",
          userAgent: req.headers["user-agent"] || "unknown",
          details: {
            userId: user.id,
            actorRole: req.user.role,
            previousState: { role: user.role },
            nextState: { role: "API_USER", apiKey, rateLimit, environment }
          }
        }
      });

      return { access, apiSecret };
    });

    res.status(201).json({
      success: true,
      message: "User promoted to API Partner successfully",
      data: {
        id: result.access.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        apiKey: result.access.apiKey,
        apiSecret: result.apiSecret, // Return plain secret ONCE
        rateLimit: result.access.rateLimit,
        environment: result.access.environment,
        isActive: result.access.isActive
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 25. Rotate API Secret for a partner
 */
export const rotatePartnerSecret = async (req, res) => {
  const { id } = req.params;

  try {
    const access = await prisma.apiAccess.findUnique({
      where: { id },
      include: { user: { select: { role: true, id: true } } }
    });

    if (!access) {
      return res.status(404).json({ success: false, message: "API Partner credentials not found" });
    }

    // Role hierarchy check
    const roleLevels = { USER: 1, API_USER: 1, ADMIN: 2, SUPER_ADMIN: 3 };
    const actorLevel = roleLevels[req.user.role] || 0;
    const targetLevel = roleLevels[access.user.role] || 0;
    if (actorLevel <= targetLevel) {
      return res.status(403).json({ success: false, message: "Access Denied: Role hierarchy violation." });
    }

    const newSecret = `sec_live_${crypto.randomBytes(32).toString('hex')}`;
    const salt = await bcrypt.genSalt(10);
    const apiSecretHash = await bcrypt.hash(newSecret, salt);

    await prisma.$transaction(async (tx) => {
      await tx.apiAccess.update({
        where: { id },
        data: { apiSecretHash }
      });

      await tx.auditLog.create({
        data: {
          action: "PARTNER_SECRET_ROTATED",
          adminId: req.user.id,
          entity: "ApiAccess",
          entityId: 0,
          ipAddress: req.ip || "127.0.0.1",
          userAgent: req.headers["user-agent"] || "unknown",
          details: {
            userId: access.userId,
            actorRole: req.user.role,
            previousState: { apiSecretHash: "[hidden]" },
            nextState: { apiSecretHash: "[hidden]" }
          }
        }
      });
    });

    res.json({
      success: true,
      message: "API Secret rotated successfully. Please copy it now as it will not be shown again.",
      apiSecret: newSecret
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 26. Suspend/Resume API access
 */
export const togglePartnerStatus = async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  if (isActive === undefined) {
    return res.status(400).json({ success: false, message: "isActive parameter is required" });
  }

  try {
    const access = await prisma.apiAccess.findUnique({
      where: { id },
      include: { user: { select: { role: true, id: true } } }
    });

    if (!access) {
      return res.status(404).json({ success: false, message: "API Partner credentials not found" });
    }

    // Role hierarchy check
    const roleLevels = { USER: 1, API_USER: 1, ADMIN: 2, SUPER_ADMIN: 3 };
    const actorLevel = roleLevels[req.user.role] || 0;
    const targetLevel = roleLevels[access.user.role] || 0;
    if (actorLevel <= targetLevel) {
      return res.status(403).json({ success: false, message: "Access Denied: Role hierarchy violation." });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const up = await tx.apiAccess.update({
        where: { id },
        data: { isActive: Boolean(isActive) }
      });

      await tx.auditLog.create({
        data: {
          action: "PARTNER_STATUS_TOGGLED",
          adminId: req.user.id,
          entity: "ApiAccess",
          entityId: 0,
          ipAddress: req.ip || "127.0.0.1",
          userAgent: req.headers["user-agent"] || "unknown",
          details: {
            userId: access.userId,
            actorRole: req.user.role,
            previousState: { isActive: access.isActive },
            nextState: { isActive: up.isActive }
          }
        }
      });

      return up;
    });

    res.json({ success: true, message: `API Access status updated to ${updated.isActive ? 'Active' : 'Suspended'}`, data: updated });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 27. Toggle API Environment (Sandbox/Production)
 */
export const updatePartnerEnvironment = async (req, res) => {
  const { id } = req.params;
  const { environment } = req.body;

  if (!["PRODUCTION", "SANDBOX"].includes(environment)) {
    return res.status(400).json({ success: false, message: "Invalid environment value" });
  }

  try {
    const access = await prisma.apiAccess.findUnique({
      where: { id },
      include: { user: { select: { role: true, id: true } } }
    });

    if (!access) {
      return res.status(404).json({ success: false, message: "API Partner credentials not found" });
    }

    // Role hierarchy check
    const roleLevels = { USER: 1, API_USER: 1, ADMIN: 2, SUPER_ADMIN: 3 };
    const actorLevel = roleLevels[req.user.role] || 0;
    const targetLevel = roleLevels[access.user.role] || 0;
    if (actorLevel <= targetLevel) {
      return res.status(403).json({ success: false, message: "Access Denied: Role hierarchy violation." });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const up = await tx.apiAccess.update({
        where: { id },
        data: { environment }
      });

      await tx.auditLog.create({
        data: {
          action: "PARTNER_ENV_TOGGLED",
          adminId: req.user.id,
          entity: "ApiAccess",
          entityId: 0,
          ipAddress: req.ip || "127.0.0.1",
          userAgent: req.headers["user-agent"] || "unknown",
          details: {
            userId: access.userId,
            actorRole: req.user.role,
            previousState: { environment: access.environment },
            nextState: { environment: up.environment }
          }
        }
      });

      return up;
    });

    res.json({ success: true, message: `API Environment switched to ${updated.environment}`, data: updated });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 28. Set Partner API Rate Limit
 */
export const updatePartnerRateLimit = async (req, res) => {
  const { id } = req.params;
  const { rateLimit } = req.body;

  if (rateLimit === undefined || isNaN(rateLimit) || Number(rateLimit) <= 0) {
    return res.status(400).json({ success: false, message: "Invalid rateLimit value" });
  }

  try {
    const access = await prisma.apiAccess.findUnique({
      where: { id },
      include: { user: { select: { role: true, id: true } } }
    });

    if (!access) {
      return res.status(404).json({ success: false, message: "API Partner credentials not found" });
    }

    // Role hierarchy check
    const roleLevels = { USER: 1, API_USER: 1, ADMIN: 2, SUPER_ADMIN: 3 };
    const actorLevel = roleLevels[req.user.role] || 0;
    const targetLevel = roleLevels[access.user.role] || 0;
    if (actorLevel <= targetLevel) {
      return res.status(403).json({ success: false, message: "Access Denied: Role hierarchy violation." });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const up = await tx.apiAccess.update({
        where: { id },
        data: { rateLimit: Number(rateLimit) }
      });

      await tx.auditLog.create({
        data: {
          action: "PARTNER_RATELIMIT_UPDATED",
          adminId: req.user.id,
          entity: "ApiAccess",
          entityId: 0,
          ipAddress: req.ip || "127.0.0.1",
          userAgent: req.headers["user-agent"] || "unknown",
          details: {
            userId: access.userId,
            actorRole: req.user.role,
            previousState: { rateLimit: access.rateLimit },
            nextState: { rateLimit: up.rateLimit }
          }
        }
      });

      return up;
    });

    res.json({ success: true, message: `API Rate limit set to ${updated.rateLimit} req/min`, data: updated });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 29. Get Partner API usages
 */
export const getPartnerUsage = async (req, res) => {
  const { id } = req.params;

  try {
    const access = await prisma.apiAccess.findUnique({
      where: { id },
      include: { user: { select: { role: true } } }
    });

    if (!access) {
      return res.status(404).json({ success: false, message: "API Partner credentials not found" });
    }

    // Role hierarchy check
    const roleLevels = { USER: 1, API_USER: 1, ADMIN: 2, SUPER_ADMIN: 3 };
    const actorLevel = roleLevels[req.user.role] || 0;
    const targetLevel = roleLevels[access.user.role] || 0;
    if (actorLevel <= targetLevel) {
      return res.status(403).json({ success: false, message: "Access Denied: Role hierarchy violation." });
    }

    const usages = await prisma.apiUsage.findMany({
      where: { apiAccessId: id },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    res.json({ success: true, data: usages });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 30. Revoke API Partner privileges
 */
export const revokePartner = async (req, res) => {
  const { id } = req.params;

  try {
    const access = await prisma.apiAccess.findUnique({
      where: { id },
      include: { user: { select: { role: true, id: true, name: true } } }
    });

    if (!access) {
      return res.status(404).json({ success: false, message: "API Partner credentials not found" });
    }

    // Role hierarchy check
    const roleLevels = { USER: 1, API_USER: 1, ADMIN: 2, SUPER_ADMIN: 3 };
    const actorLevel = roleLevels[req.user.role] || 0;
    const targetLevel = roleLevels[access.user.role] || 0;
    if (actorLevel <= targetLevel) {
      return res.status(403).json({ success: false, message: "Access Denied: Role hierarchy violation." });
    }

    // SUPER_ADMIN protection
    if (access.user.role === "SUPER_ADMIN") {
      return res.status(403).json({ success: false, message: "SUPER_ADMIN accounts cannot be revoked or demoted." });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Delete all ApiUsages first to prevent foreign key errors
      await tx.apiUsage.deleteMany({
        where: { apiAccessId: id }
      });

      // 2. Delete ApiAccess record
      await tx.apiAccess.delete({
        where: { id }
      });

      // 3. Demote user's role back to USER
      await tx.user.update({
        where: { id: access.userId },
        data: { role: "USER" }
      });

      // 4. Create Audit Log
      await tx.auditLog.create({
        data: {
          action: "PARTNER_REVOKED",
          adminId: req.user.id,
          entity: "ApiAccess",
          entityId: 0,
          ipAddress: req.ip || "127.0.0.1",
          userAgent: req.headers["user-agent"] || "unknown",
          details: {
            userId: access.userId,
            actorRole: req.user.role,
            previousState: { role: "API_USER" },
            nextState: { role: "USER" }
          }
        }
      });
    });

    res.json({ success: true, message: `API Partner privileges revoked and demoted back to USER for ${access.user.name}` });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 31. Create merchant onboarding agreement directly
 */
export const createAgreement = async (req, res) => {
  const { userId, title, content } = req.body;

  if (!userId || !title || !content) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: { role: true, id: true }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Role hierarchy check
    const roleLevels = { USER: 1, API_USER: 1, ADMIN: 2, SUPER_ADMIN: 3 };
    const actorLevel = roleLevels[req.user.role] || 0;
    const targetLevel = roleLevels[user.role] || 0;
    if (actorLevel <= targetLevel) {
      return res.status(403).json({ success: false, message: "Access Denied: Role hierarchy violation." });
    }

    const agreement = await prisma.agreement.create({
      data: {
        userId: Number(userId),
        title,
        content,
        status: "PENDING",
        uploadedBy: req.user.id
      }
    });

    await prisma.auditLog.create({
      data: {
        action: "AGREEMENT_CREATE",
        adminId: req.user.id,
        entity: "agreement",
        entityId: agreement.id,
        ipAddress: req.ip || "127.0.0.1",
        userAgent: req.headers["user-agent"] || "unknown",
        details: {
          userId: Number(userId),
          title,
          actorRole: req.user.role,
          nextState: { title, status: "PENDING" }
        }
      }
    });

    res.status(201).json({ success: true, message: "Agreement created successfully in PENDING status", data: agreement });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 32. Edit agreement parameters while pending
 */
export const updateAgreement = async (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;

  if (!title || !content) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  try {
    const agreement = await prisma.agreement.findUnique({
      where: { id: Number(id) },
      include: { user: { select: { role: true } } }
    });

    if (!agreement) {
      return res.status(404).json({ success: false, message: "Agreement not found" });
    }

    // Immutability Check: Locked after approval, unless Super Admin
    if (agreement.status === "APPROVED" && req.user.role !== "SUPER_ADMIN") {
      return res.status(400).json({ success: false, message: "Approved agreements are locked and immutable. Only SUPER_ADMIN can edit." });
    }

    // Role hierarchy check
    const roleLevels = { USER: 1, API_USER: 1, ADMIN: 2, SUPER_ADMIN: 3 };
    const actorLevel = roleLevels[req.user.role] || 0;
    const targetLevel = roleLevels[agreement.user.role] || 0;
    if (actorLevel <= targetLevel) {
      return res.status(403).json({ success: false, message: "Access Denied: Role hierarchy violation." });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const up = await tx.agreement.update({
        where: { id: Number(id) },
        data: { title, content }
      });

      await tx.auditLog.create({
        data: {
          action: "AGREEMENT_EDIT",
          adminId: req.user.id,
          entity: "agreement",
          entityId: Number(id),
          ipAddress: req.ip || "127.0.0.1",
          userAgent: req.headers["user-agent"] || "unknown",
          details: {
            userId: agreement.userId,
            actorRole: req.user.role,
            previousState: { title: agreement.title, content: "[hidden]" },
            nextState: { title: up.title, content: "[hidden]" }
          }
        }
      });

      return up;
    });

    res.json({ success: true, message: "Agreement updated successfully", data: updated });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 33. Delete agreement
 */
export const deleteAgreement = async (req, res) => {
  const { id } = req.params;

  try {
    const agreement = await prisma.agreement.findUnique({
      where: { id: Number(id) },
      include: { user: { select: { role: true } } }
    });

    if (!agreement) {
      return res.status(404).json({ success: false, message: "Agreement not found" });
    }

    // Immutability Check: Locked after approval, unless Super Admin
    if (agreement.status === "APPROVED" && req.user.role !== "SUPER_ADMIN") {
      return res.status(400).json({ success: false, message: "Approved agreements are locked and immutable. Only SUPER_ADMIN can delete." });
    }

    // Role hierarchy check
    const roleLevels = { USER: 1, API_USER: 1, ADMIN: 2, SUPER_ADMIN: 3 };
    const actorLevel = roleLevels[req.user.role] || 0;
    const targetLevel = roleLevels[agreement.user.role] || 0;
    if (actorLevel <= targetLevel) {
      return res.status(403).json({ success: false, message: "Access Denied: Role hierarchy violation." });
    }

    await prisma.$transaction(async (tx) => {
      await tx.agreement.delete({
        where: { id: Number(id) }
      });

      await tx.auditLog.create({
        data: {
          action: "AGREEMENT_DELETE",
          adminId: req.user.id,
          entity: "agreement",
          entityId: Number(id),
          ipAddress: req.ip || "127.0.0.1",
          userAgent: req.headers["user-agent"] || "unknown",
          details: {
            userId: agreement.userId,
            actorRole: req.user.role,
            previousState: { title: agreement.title, status: agreement.status },
            nextState: null
          }
        }
      });
    });

    res.json({ success: true, message: "Agreement deleted successfully" });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

