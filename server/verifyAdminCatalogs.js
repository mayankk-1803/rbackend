import { getCommissionOperators, getServiceCategories, getCommissionRoles } from "./src/controllers/commissionAdminController.js";
import prisma from "./src/config/prisma.js";

const mockRes = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.jsonData = data;
    return res;
  };
  return res;
};

async function main() {
  console.log("=== EXECUTING COMMISSION ADMIN CATALOGS DIRECTLY ===");

  try {
    const resOps = mockRes();
    await getCommissionOperators({}, resOps);
    console.log("Operators response status:", resOps.statusCode || 200);
    console.log("Operators response JSON:", JSON.stringify(resOps.jsonData, null, 2));

    const resCats = mockRes();
    await getServiceCategories({}, resCats);
    console.log("Categories response status:", resCats.statusCode || 200);
    console.log("Categories response JSON:", JSON.stringify(resCats.jsonData, null, 2));

    const resRoles = mockRes();
    await getCommissionRoles({}, resRoles);
    console.log("Roles response status:", resRoles.statusCode || 200);
    console.log("Roles response JSON:", JSON.stringify(resRoles.jsonData, null, 2));

  } catch (err) {
    console.error("Direct controller invocation failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
