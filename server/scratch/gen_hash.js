import bcrypt from 'bcryptjs';

async function main() {
  const hash = await bcrypt.hash('123456', 10);
  console.log(hash);
}

main();
