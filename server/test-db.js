import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  try {
    const otp = await prisma.oTP.create({
      data: {
        phone: '1234567890',
        code: '1234',
        expiresAt: new Date(Date.now() + 60000)
      }
    });
    console.log('Success:', otp);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
