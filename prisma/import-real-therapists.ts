import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Names from https://www.jcf.org.tw/team-3 — licensed psychologists only
// (諮商心理師/臨床心理師), intern psychologists (實習心理師) excluded per request.
// email/note intentionally left blank, to be filled in later.
const THERAPIST_NAMES = [
  "張卉湄",
  "洪宗言",
  "胡可歆",
  "羅仁鴻",
  "胡丹毓",
  "鍾孟燕",
  "王嘉琳",
  "楊淑珠",
  "蘇北辰",
  "宋毓芬",
  "丁乙萱",
  "陳倩穎",
  "彭尉慈",
  "范衷慈",
  "林慈玥",
  "林毅",
  "楊靜芬",
  "陳致豪",
  "譚如萍",
  "林忻",
  "柳映竹",
  "陳宜君",
  "蔡承沛",
];

async function main() {
  for (const name of THERAPIST_NAMES) {
    const existing = await prisma.therapist.findFirst({ where: { name } });
    if (existing) {
      continue;
    }
    await prisma.therapist.create({ data: { name } });
  }
  console.log(`Real therapist roster imported (${THERAPIST_NAMES.length} names).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
