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

  await prisma.template.upsert({
    where: { id: "seed-template-matching" },
    update: {},
    create: {
      id: "seed-template-matching",
      category: "媒合信（測試）",
      subject: "【測試】諮商媒合信",
      body:
        "親愛的 {{caseRef}} 您好：\n\n" +
        "已為您媒合心理師 **{{therapistName}}**，首次晤談時間為 **{{sessionDate}}**。\n\n" +
        "[只有 EAP]\n本次服務由貴公司 EAP 方案支付費用。\n[/只有]\n" +
        "[除外 EAP]\n期待與您見面。\n[/除外]",
      variants: JSON.stringify(["一般", "EAP"]),
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
