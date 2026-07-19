import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { id: "seed-user-admin" },
    update: {},
    create: {
      id: "seed-user-admin",
      name: "測試人員",
      signature: "TA",
    },
  });

  await prisma.therapist.upsert({
    where: { id: "seed-therapist-a" },
    update: {},
    create: {
      id: "seed-therapist-a",
      name: "測試心理師A",
      email: "therapist-a@example.com",
      note: "測試備註",
    },
  });
  await prisma.therapist.upsert({
    where: { id: "seed-therapist-b" },
    update: {},
    create: { id: "seed-therapist-b", name: "測試心理師B" },
  });

  console.log("Seed complete (synthetic data only).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
