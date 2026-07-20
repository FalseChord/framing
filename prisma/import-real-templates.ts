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
      requiredFields: JSON.stringify(["caseRef", "therapistName", "sessionDate", "fee", "meetLink"]),
      updatedById: admin.id,
    },
  });

  await prisma.template.upsert({
    where: { id: "real-template-matching-general" },
    update: {},
    create: {
      id: "real-template-matching-general",
      category: "媒合信",
      variantLabel: "一般",
      subject: "[加惠心理諮商]諮商媒合信",
      body: "{{caseRef}}，您好：\n\n感謝您填寫線上預約表單，加惠已依照您的需求媒合上 **{{therapistName}}** 心理師，\n心理師想詢問您：**{{sessionSlots}}**，是否方便進行第一次諮商呢？\n若不方便，再麻煩您提供幾個方便的時段給我們，我們會再為您與心理師確認。\n\n同時也讓您知道，**{{therapistName}}**心理師的諮商晤談費用為：**{{fee}}**元 / 50分鐘\n再麻煩您回信或來電確認諮商時間。",
      requiredFields: JSON.stringify(["caseRef","therapistName","sessionSlots","fee"]),
      updatedById: admin.id,
    },
  });

  await prisma.template.upsert({
    where: { id: "real-template-matching-couple" },
    update: {},
    create: {
      id: "real-template-matching-couple",
      category: "媒合信",
      variantLabel: "伴侶",
      subject: "[加惠心理諮商]諮商媒合信",
      body: "{{caseRef}}，您好：\n\n感謝您填寫線上預約表單，加惠已依照您的需求媒合上 **{{therapistName}}** 心理師，\n心理師想詢問您：**{{sessionSlots}}**，是否方便進行第一次伴侶諮商呢？\n若不方便，再麻煩您提供幾個方便的時段給我們，我們會再為您與心理師確認。\n\n同時也讓您知道，**{{therapistName}}**心理師的諮商晤談費用為：**{{fee}}**元 / 80分鐘\n再麻煩您回信或來電確認諮商時間。",
      requiredFields: JSON.stringify(["caseRef","therapistName","sessionSlots","fee"]),
      updatedById: admin.id,
    },
  });

  await prisma.template.upsert({
    where: { id: "real-template-matching-youth" },
    update: {},
    create: {
      id: "real-template-matching-youth",
      category: "媒合信",
      variantLabel: "青壯",
      subject: "[加惠心理諮商]諮商媒合信 (青壯方案)",
      body: "{{caseRef}}，您好：\n\n感謝您填寫青壯方案申請表單，經過電話初談評估，確認可提供諮商服務。\n本次諮商費用（3次）由衛福部補助，加惠將會酌收500元掛號費。\n\n加惠已依照您的需求媒合 **{{therapistName}}** 心理師，\n\n[單一時段]第一次諮商時間預計安排在 **{{sessionSlots}}**\n請問您是否方便前來？再麻煩您撥冗回覆。[/單一時段][多個時段]需要和您確認第一次諮商時間，想詢問您以下時間是否方便，\n{{sessionSlots}}[/多個時段]",
      requiredFields: JSON.stringify(["caseRef","therapistName","sessionSlots"]),
      updatedById: admin.id,
    },
  });

  await prisma.template.upsert({
    where: { id: "real-template-matching-disaster" },
    update: {},
    create: {
      id: "real-template-matching-disaster",
      category: "媒合信",
      variantLabel: "重大災害",
      subject: "[加惠心理諮商]諮商媒合信 (重大災害心理支持方案)",
      body: "{{caseRef}}，您好：\n\n感謝您填寫重大災害方案申請表單，經過電話初談評估，確認可提供諮商服務。\n本次諮商費用（3次）由衛福部補助，並將會酌收500元掛號費。\n\n加惠已依照您的需求媒合 **{{therapistName}}** 心理師，\n\n第一次諮商時間預計安排在 **{{sessionSlots}}**\n\n請問您是否方便前來？再麻煩您撥冗回覆。",
      requiredFields: JSON.stringify(["caseRef","therapistName","sessionSlots"]),
      updatedById: admin.id,
    },
  });

  await prisma.template.upsert({
    where: { id: "real-template-matching-eap" },
    update: {},
    create: {
      id: "real-template-matching-eap",
      category: "媒合信",
      variantLabel: "EAP",
      subject: "[加惠心理諮商]EAP諮商媒合信",
      body: "{{caseRef}}，您好：\n\n歡迎使用{{eapPlanName}}EAP員工協助方案，\n加惠依照您的需求媒合 **{{therapistName}}** 心理師，\n\n心理師想詢問您：**{{sessionSlots}}**\n以上時段您是否方便進行第一次晤談呢？\n若以上時段不方便，請您再提供盡量多幾個方便的時段給我們，\n我們會再為您安排！",
      requiredFields: JSON.stringify(["caseRef","therapistName","sessionSlots","eapPlanName"]),
      updatedById: admin.id,
    },
  });

  await prisma.template.upsert({
    where: { id: "real-template-matching-charity" },
    update: {},
    create: {
      id: "real-template-matching-charity",
      category: "媒合信",
      variantLabel: "公益",
      subject: "[加惠心理諮商]公益諮商媒合信",
      body: "{{caseRef}}，您好：\n\n感謝您填寫線上預約表單，加惠已依照您的需求媒合上 **{{therapistName}}** 實習心理師。\n實習心理師想與您詢問**{{sessionSlots}}**，是否方便進行第一次的晤談，\n再煩請您確認後回覆。\n\n若以上時間皆不方便，再麻煩您提供兩個以上方便的時段，\n我們將再協助您與實習心理師確認。\n\n此方案每次晤談50min，須支付**{{fee}}**。\n為確保資源能有效運用，參與者將以能連續晤談六次者為優先。\n若您在晤談次數上有任何考量，也歡迎與我們討論。\n\n另外，第一次晤談為「初談評估會談」，\n在評估後，若需要轉介至其他專業心理師或醫療資源，我們會事先與您充分說明並確認，\n以確保您能獲得最合適的支持與協助，\n再麻煩請您回信或來電確認晤談時間。",
      requiredFields: JSON.stringify(["caseRef","therapistName","sessionSlots","fee"]),
      updatedById: admin.id,
    },
  });

  await prisma.template.upsert({
    where: { id: "real-template-preparation-general" },
    update: {},
    create: {
      id: "real-template-preparation-general",
      category: "準備信",
      variantLabel: "一般",
      subject: "[加惠心理諮商]諮商準備信",
      body: "{{caseRef}}，您好：\n\n我們已幫您與 **{{therapistName}}** 心理師 完成諮商預約，\n將於 **{{sessionSlots}}** 進行第一次諮商。\n\n當天請您盡可能 **提前 5~10分鐘** 抵達加惠諮商所（臺北市復興北路181號7樓之五），\n值班人員會為您介紹加惠空間，並且請您填寫資料表。\n\n此外，加惠提供您諮商前可以做的參考與準備：\n\n◉ 初次諮商前盡可能預留一些時間沉澱心思，思考在會談中該如何講您想處理的困擾。\n◉ 每個人初次諮商後的反應不同，有些人初次諮商後情緒張力可能會很大，會談結束後您不一定能馬上回到平常生活狀態，盡可能在初次諮商結束後不要安排其他行程，給自己預留時間調適。\n◉ 初次諮商前，您可能感到緊張，擔心在諮商時間內講不清楚自己的困擾，這是難免的。不過心理師將帶您一起釐清您的困擾，不必太擔心。\n◉ 初次諮商的前一刻，您可能感到某種抗拒，這是正常的，因為要向人敞開心房，難免想要自我保護。邀請您謝謝這個自我保護以及背後的善意，同時看見心底想要有所不同的渴望，允許自己帶著一些不舒服的感覺前來會談。\n◉ 由於諮商對生活會造成某些影響，初次諮商後您可以想想什麼時段進行會談對您最有幫助，並再與您的心理師調整諮商時段。\n◉ 初次諮商後，與心理師會談的感受與原先期待可能有所不同，即使第一次諮商有不舒服或不如預期的感覺，加惠也建議您至少再見一次心理師，並當面向心理師表達您的真實感受，每一次您與心理師開放地討論，都有可能為您自己帶來新的洞見。",
      requiredFields: JSON.stringify(["caseRef","therapistName","sessionSlots"]),
      updatedById: admin.id,
    },
  });

  await prisma.template.upsert({
    where: { id: "real-template-preparation-couple" },
    update: {},
    create: {
      id: "real-template-preparation-couple",
      category: "準備信",
      variantLabel: "伴侶",
      subject: "[加惠心理諮商]諮商準備信",
      body: "{{caseRef}}，您好：\n\n我們已幫您與 **{{therapistName}}** 心理師 完成諮商預約，\n將於 **{{sessionSlots}}** 進行第一次伴侶諮商。\n\n當天請您們盡可能 **提前 5~10分鐘** 抵達加惠諮商所（臺北市復興北路181號7樓之五），值班人員會為您介紹加惠空間，並且請您填寫資料表。\n\n此外，加惠提供您諮商前可以做的參考與準備：\n\n◉ 初次諮商前盡可能預留一些時間沉澱心思，思考在會談中該如何講您想處理的困擾。\n◉ 每個人初次諮商後的反應不同，有些人初次諮商後情緒張力可能會很大，會談結束後您不一定能馬上回到平常生活狀態，盡可能在初次諮商結束後不要安排其他行程，給自己預留時間調適。\n◉ 初次諮商前，您可能感到緊張，擔心在諮商時間內講不清楚自己的困擾，這是難免的。不過心理師將帶您一起釐清您的困擾，不必太擔心。\n◉ 初次諮商的前一刻，您可能感到某種抗拒，這是正常的，因為要向人敞開心房，難免想要自我保護。邀請您謝謝這個自我保護以及背後的善意，同時看見心底想要有所不同的渴望，允許自己帶著一些不舒服的感覺前來會談。\n◉ 由於諮商對生活會造成某些影響，初次諮商後您可以想想什麼時段進行會談對您最有幫助，並再與您的心理師調整諮商時段。\n◉ 初次諮商後，與心理師會談的感受與原先期待可能有所不同，即使第一次諮商有不舒服或不如預期的感覺，加惠也建議您至少再見一次心理師，並當面向心理師表達您的真實感受，每一次您與心理師開放地討論，都有可能為您自己帶來新的洞見。",
      requiredFields: JSON.stringify(["caseRef","therapistName","sessionSlots"]),
      updatedById: admin.id,
    },
  });

  await prisma.template.upsert({
    where: { id: "real-template-preparation-youth" },
    update: {},
    create: {
      id: "real-template-preparation-youth",
      category: "準備信",
      variantLabel: "青壯",
      subject: "[加惠心理諮商]諮商準備信 (青壯方案)",
      body: "{{caseRef}}，您好：\n\n感謝您填寫青壯方案申請表單，\n我們已幫您與 **{{therapistName}}** 心理師 完成青壯方案諮商預約，\n於 **{{sessionSlots}}** 進行第一次個別諮商。\n\n當天請您攜帶身分證以驗證使用資格，並盡可能 **提前10~15分鐘** 抵達加惠諮商所（臺北市復興北路181號7樓之5，近捷運南京復興站七號出口），值班人員將請您填寫青壯方案表單資料。\n\n此外，加惠提供您諮商前可以做的參考與準備：\n\n◉ 初次諮商前盡可能預留一些時間沉澱心思，思考在會談中該如何講您想處理的困擾。\n◉ 每個人初次諮商後的反應不同，有些人初次諮商後情緒張力可能會很大，會談結束後您不一定能馬上回到平常生活狀態，盡可能在初次諮商結束後不要安排其他行程，給自己預留時間調適。\n◉ 初次諮商前，您可能感到緊張，擔心在諮商時間內講不清楚自己的困擾，這是難免的。不過心理師將帶您一起釐清您的困擾，不必太擔心。\n◉ 初次諮商的前一刻，您可能感到某種抗拒，這是正常的，因為要向人敞開心房，難免想要自我保護。邀請您謝謝這個自我保護以及背後的善意，同時看見心底想要有所不同的渴望，允許自己帶著一些不舒服的感覺前來會談。\n◉ 由於諮商對生活會造成某些影響，初次諮商後您可以想想什麼時段進行會談對您最有幫助，並再與您的心理師調整諮商時段。\n◉ 初次諮商後，與心理師會談的感受與原先期待可能有所不同，即使第一次諮商有不舒服或不如預期的感覺，加惠也建議您至少再見一次心理師，並當面向心理師表達您的真實感受，每一次您與心理師開放地討論，都有可能為您自己帶來新的洞見。",
      requiredFields: JSON.stringify(["caseRef","therapistName","sessionSlots"]),
      updatedById: admin.id,
    },
  });

  await prisma.template.upsert({
    where: { id: "real-template-preparation-disaster" },
    update: {},
    create: {
      id: "real-template-preparation-disaster",
      category: "準備信",
      variantLabel: "重大災害",
      subject: "[加惠心理諮商]諮商準備信(重大災害心理支持方案)",
      body: "{{caseRef}}，您好：\n\n感謝您填寫預約表單，\n我們已幫您與 **{{therapistName}}** 心理師 完成預約，\n於 **{{sessionSlots}}** 進行第一次諮商。\n\n當天請您攜帶身分證以驗證使用資格，並盡可能 **提前10~15分鐘** 抵達加惠諮商所（臺北市復興北路181號7樓之5，近捷運南京復興站七號出口），值班人員將協助您完成表單的填寫。\n\n此外，加惠提供您諮商前可以做的參考與準備：\n\n◉ 初次諮商前盡可能預留一些時間沉澱心思，思考在會談中該如何講您想處理的困擾。\n◉ 每個人初次諮商後的反應不同，有些人初次諮商後情緒張力可能會很大，會談結束後您不一定能馬上回到平常生活狀態，盡可能在初次諮商結束後不要安排其他行程，給自己預留時間調適。\n◉ 初次諮商前，您可能感到緊張，擔心在諮商時間內講不清楚自己的困擾，這是難免的。不過心理師將帶您一起釐清您的困擾，不必太擔心。\n◉ 初次諮商的前一刻，您可能感到某種抗拒，這是正常的，因為要向人敞開心房，難免想要自我保護。邀請您謝謝這個自我保護以及背後的善意，同時看見心底想要有所不同的渴望，允許自己帶著一些不舒服的感覺前來會談。\n◉ 由於諮商對生活會造成某些影響，初次諮商後您可以想想什麼時段進行會談對您最有幫助，並再與您的心理師調整諮商時段。\n◉ 初次諮商後，與心理師會談的感受與原先期待可能有所不同，即使第一次諮商有不舒服或不如預期的感覺，加惠也建議您至少再見一次心理師，並當面向心理師表達您的真實感受，每一次您與心理師開放地討論，都有可能為您自己帶來新的洞見。",
      requiredFields: JSON.stringify(["caseRef","therapistName","sessionSlots"]),
      updatedById: admin.id,
    },
  });

  await prisma.template.upsert({
    where: { id: "real-template-preparation-eap" },
    update: {},
    create: {
      id: "real-template-preparation-eap",
      category: "準備信",
      variantLabel: "EAP",
      subject: "[加惠基金會]EAP諮商準備信",
      body: "{{caseRef}}，您好：\n\n我們已幫您完成與 **{{therapistName}}** 心理師 的諮商預約，\n於 **{{sessionSlots}}** 進行第一次諮商（本次為EAP方案-由公司支付）。\n\n===與{{eapPlanName}}合作事宜-煩請注意===\n1. 請攜帶員工證，櫃台人員會協助確認\n2. 諮商須簽到，櫃台人員會請您簽名\n\n當天請您盡可能 **提前 5-10分鐘** 抵達 加惠基金會（臺北市復興北路181號7樓之五），\n值班人員會為您介紹加惠空間，並且請您填寫諮商同意書與基本資料表。\n\n此外，加惠提供您諮商前可以做的參考與準備：\n\n◉ 初次諮商前盡可能預留一些時間沉澱心思，思考在會談中該如何講您想處理的困擾。\n◉ 每個人初次諮商後的反應不同，有些人初次諮商後情緒張力可能會很大，會談結束後您不一定能馬上回到平常生活狀態，盡可能在初次諮商結束後不要安排其他行程，給自己預留時間調適。\n◉ 初次諮商前，您可能感到緊張，擔心在諮商時間內講不清楚自己的困擾，這是難免的。不過心理師將帶您一起釐清您的困擾，不必太擔心。\n◉ 初次諮商的前一刻，您可能感到某種抗拒，這是正常的，因為要向人敞開心房，難免想要自我保護。邀請您謝謝這個自我保護以及背後的善意，同時看見心底想要有所不同的渴望，允許自己帶著一些不舒服的感覺前來會談。\n◉ 由於諮商對生活會造成某些影響，初次諮商後您可以想想什麼時段進行會談對您最有幫助，並再與您的心理師調整諮商時段。\n◉ 初次諮商後，與心理師會談的感受與原先期待可能有所不同，即使第一次諮商有不舒服或不如預期的感覺，加惠也建議您至少再見一次心理師，並當面向心理師表達您的真實感受，每一次您與心理師開放地討論，都有可能為您自己帶來新的洞見。",
      requiredFields: JSON.stringify(["caseRef","therapistName","sessionSlots","eapPlanName"]),
      updatedById: admin.id,
    },
  });

  await prisma.template.upsert({
    where: { id: "real-template-preparation-charity" },
    update: {},
    create: {
      id: "real-template-preparation-charity",
      category: "準備信",
      variantLabel: "公益",
      subject: "[加惠心理諮商]公益諮商準備信",
      body: "{{caseRef}}，您好：\n\n加惠諮商所已為您安排與 **{{therapistName}}** 實習心理師，\n於 **{{sessionSlots}}** 進行第一次晤談。\n\n當天請您盡可能 **提前 5-10分鐘** 抵達 加惠諮商所（臺北市復興北路181號7樓之5），值班人員將請您填寫公益方案之基本資料表與諮商同意書。\n\n第一次晤談為初談評估會談，經過初談評估後才會再確認是否以公益諮詢方案續談，或建議轉派其他專業心理師。\n\n此外，加惠提供您諮商前可以做的參考與準備：\n\n◉ 初次諮商前盡可能預留一些時間沉澱心思，思考在會談中該如何講您想處理的困擾。\n◉ 每個人初次諮商後的反應不同，有些人初次諮商後情緒張力可能會很大，會談結束後您不一定能馬上回到平常生活狀態，盡可能在初次諮商結束後不要安排其他行程，給自己預留時間調適。\n◉ 初次諮商前，您可能感到緊張，擔心在諮商時間內講不清楚自己的困擾，這是難免的。不過心理師將帶您一起釐清您的困擾，不必太擔心。\n◉ 初次諮商的前一刻，您可能感到某種抗拒，這是正常的，因為要向人敞開心房，難免想要自我保護。邀請您謝謝這個自我保護以及背後的善意，同時看見心底想要有所不同的渴望，允許自己帶著一些不舒服的感覺前來會談。\n◉ 由於諮商對生活會造成某些影響，初次諮商後您可以想想什麼時段進行會談對您最有幫助，並再與您的心理師調整諮商時段。\n◉ 初次諮商後，與心理師會談的感受與原先期待可能有所不同，即使第一次諮商有不舒服或不如預期的感覺，加惠也建議您至少再見一次心理師，並當面向心理師表達您的真實感受，每一次您與心理師開放地討論，都有可能為您自己帶來新的洞見。",
      requiredFields: JSON.stringify(["caseRef","therapistName","sessionSlots"]),
      updatedById: admin.id,
    },
  });

  console.log("Real template content imported (媒合信 x6, 準備信 x6, 線上諮詢預約確認信, 通訊諮商預約確認信).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
