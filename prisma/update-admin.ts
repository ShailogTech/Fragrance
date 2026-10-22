import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@shri.com";
  const password = "admin@1234";
  const hash = await bcrypt.hash(password, 12);

  await prisma.user.deleteMany({ where: { email: "admin@shri.local" } });

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash: hash, role: "Admin", name: "Shri Admin" },
    create: { email, passwordHash: hash, role: "Admin", name: "Shri Admin" },
  });
  console.log("Admin ready:", user.email, "role:", user.role);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
