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
    create: { id: "seed-therapist-a", name: "測試心理師A" },
  });
  await prisma.therapist.upsert({
    where: { id: "seed-therapist-b" },
    update: {},
    create: { id: "seed-therapist-b", name: "測試心理師B" },
  });

  await prisma.template.upsert({
    where: { id: "seed-template-matching" },
    update: {},
    create: {
      id: "seed-template-matching",
      category: "媒合信",
      variant: "一般",
      body:
        "親愛的 {{caseRef}} 您好：\n\n" +
        "很高興通知您，已為您媒合心理師 {{therapistName}}，" +
        "首次晤談時間為 {{sessionDate}}。\n\n" +
        '{{#if (eq variant "EAP")}}本次服務由貴公司 EAP 方案支付費用。{{else}}期待與您見面。{{/if}}',
      requiredFields: JSON.stringify(["caseRef", "therapistName", "sessionDate"]),
      updatedById: user.id,
    },
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
