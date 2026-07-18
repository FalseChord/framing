import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({ where: { id: "seed-user-admin" } });
  if (!admin) {
    throw new Error("找不到 seed-user-admin，請先執行 npx prisma db seed");
  }

  await prisma.template.upsert({
    where: { id: "real-template-online-consult-confirm" },
    update: {},
    create: {
      id: "real-template-online-consult-confirm",
      category: "線上諮詢預約確認信",
      subject: "[加惠心理諮商]預約{{sessionDate}} {{therapistName}}心理師線上諮詢，收到信件煩請回覆確認(諮詢結束後請於24小時內完成付款)",
      body:
        "{{caseRef}}您好：\n\n" +
        "加惠行政團隊為您預約 **{{sessionDate}}(台灣時間)** 與 **{{therapistName}}** 諮商心理師的線上諮詢，\n" +
        "**收到信件請回信告知，以確認預約。**\n\n" +
        "諮詢結束後，**麻煩您完成匯款後，將匯款資訊回覆到這個信箱(請提供完整收據或是手機轉帳成功的畫面)**。\n\n" +
        "以下是您此次的預約資訊：\n" +
        "預約心理師：**{{therapistName}}**心理師\n" +
        "預約時間：**{{sessionDate}}**\n" +
        "諮詢收費：**{{fee}}**元\n" +
        "諮詢連結：{{meetLink}}\n\n" +
        "【付款方式】\n" +
        "匯款帳號： 266-03-500923-0\n" +
        "國泰世華 （銀行代號013）\n" +
        "戶名: 財團法人加惠文教基金會附設心理諮商所張卉湄\n\n" +
        "麻煩您完成匯款後，將匯款資訊回覆到這個信箱（請提供完整收據或是手機轉帳成功的畫面）\n\n" +
        "【注意事項】\n" +
        "會談前準備：\n" +
        "1. 請先確認您的電腦或行動裝置已安裝Google Meet，您已註冊且能順利使用。\n" +
        "2. 在會談時間前先行備妥您的身分證明文件，並檢查您的電腦或行動裝置的耳機（或喇叭）、麥克風和網路攝影機設備可用性，以免耽誤您的寶貴諮詢時間。\n\n" +
        "線上會談須知：\n" +
        "1. 線上諮詢有潛在的優勢與風險（如：當事人保密的限制）而與面對面有所不同。保密原則仍適用於線上諮詢，雙方不得在未經對方知情同意之情況下對諮詢內容進行截圖、錄影、錄音、或使他人從旁觀看、或進行網路直播等。如發生相關情形，經勸阻無效，機構將尋求法律途徑處理。\n" +
        "2. 若對此預約有任何疑問，您可以：\n" +
        "   A. E-mail至mail@jcf.org.tw通知我們\n" +
        "   B. 或歡迎來電02-2558-2771洽詢",
      variants: JSON.stringify(["不適用"]),
      requiredFields: JSON.stringify(["caseRef", "therapistName", "sessionDate", "fee", "meetLink"]),
      updatedById: admin.id,
    },
  });

  await prisma.template.upsert({
    where: { id: "real-template-remote-consult-confirm" },
    update: {},
    create: {
      id: "real-template-remote-consult-confirm",
      category: "通訊諮商預約確認信",
      subject: "[加惠心理諮商]預約{{sessionDate}}{{therapistName}}心理師通訊諮商，收到信件煩請回覆確認(諮商結束後請於24小時內完成付款)",
      body:
        "{{caseRef}}小姐 您好，\n\n" +
        "加惠行政團隊已為您預約 **{{sessionDate}}** 與**{{therapistName}}**心理師的通訊心理諮商。\n" +
        "**收到信件請回信告知，以確認預約**，\n" +
        "若未能收到您的回覆，諮商前將有人與您電話聯繫確認，如造成您的不便還請見諒。\n\n" +
        "諮商結束後，**麻煩您完成匯款後，將匯款資訊回覆到這個信箱(請提供完整收據或是手機轉帳成功的畫面)**。\n\n" +
        "以下是您此次的預約資訊：\n\n" +
        "預約心理師：**{{therapistName}}** 心理師\n" +
        "預約時間：**{{sessionDate}}**\n" +
        "諮商收費：**{{fee}}**元\n" +
        "諮商連結：{{meetLink}}\n\n" +
        "【付款方式】\n" +
        "匯款帳號：266-03-500923-0\n" +
        "國泰世華（銀行代號013），永平分行\n" +
        "戶名：財團法人加惠文教基金會附設心理諮商所張卉湄\n" +
        "麻煩您完成匯款後，將匯款資訊回覆到這個信箱(請提供完整收據或是手機轉帳成功的畫面)。\n\n" +
        "【注意事項】\n" +
        "諮商前準備：\n" +
        "1. 請先確認您的電腦或行動裝置已安裝Google Meet，您已註冊且能順利使用。\n" +
        "2. 在會談時間前先行備妥您的身分證明文件，並檢查您的電腦或行動裝置的耳機（或喇叭）、麥克風和網路攝影機設備可用性，以免耽誤您的寶貴諮商時間。\n\n" +
        "線上諮商須知：\n" +
        "1. 進入通訊諮商的線上會議室時，請準備好含照片的身分證明文件，並確認心理師的執業證明，核實雙方身分後方可開始進行心理諮商。\n" +
        "2. 通訊心理諮商有潛在的優勢與風險（如：當事人保密的限制）而與面對面有所不同。保密原則仍適用於通訊心理諮商服務，雙方不得在未經對方知情同意之情況下對諮商內容進行截圖、錄影、錄音、或使他人從旁觀看、或進行網路直播等。如發生相關情形，經勸阻無效，機構將尋求法律途徑處理。\n" +
        "3. 若對此預約有任何疑問，您可以：\n" +
        "   A. E-mail至mail@jcf.org.tw通知我們；\n" +
        "   B. 來電02-2558-2771洽詢。",
      variants: JSON.stringify(["不適用"]),
      requiredFields: JSON.stringify(["caseRef", "therapistName", "sessionDate", "fee", "meetLink"]),
      updatedById: admin.id,
    },
  });

  console.log("Real template content imported (線上諮詢預約確認信, 通訊諮商預約確認信).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
