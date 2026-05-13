import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function check() {
  const user = await prisma.user.findUnique({
    where: { email: "admin@dizipay.com" }
  });
  
  if (user) {
    console.log("USER FOUND:");
    console.log("ID:", user.id);
    console.log("Email:", user.email);
    console.log("Role:", user.role);
    console.log("Password Hash Exists:", !!user.password);
  } else {
    console.log("USER NOT FOUND");
  }
  process.exit(0);
}

check();
