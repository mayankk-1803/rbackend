import { autoSeedIMart } from "../src/controllers/imartController.js";
import prisma from "../src/config/prisma.js";

async function runSeeder() {
  try {
    console.log("Calling autoSeedIMart()...");
    await autoSeedIMart();
    console.log("autoSeedIMart() call finished.");

    const categories = await prisma.category.findMany({
      include: {
        _count: {
          select: { products: true }
        }
      }
    });
    console.log("Categories in DB now:", categories.map(c => ({ name: c.name, slug: c.slug, productsCount: c._count.products })));

    const productsCount = await prisma.product.count();
    console.log("Total Products in DB now:", productsCount);
  } catch (err) {
    console.error("Error running seeder:", err);
  } finally {
    await prisma.$disconnect();
  }
}

runSeeder();
