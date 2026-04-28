import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const phone = "1234567890";
    const code = "123456";
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const result = await prisma.oTP.create({
      data: { phone, code, expiresAt }
    });
    console.log("Success:", result);
  } catch (err) {
    console.error("Error Details:", err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
