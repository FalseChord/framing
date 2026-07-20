# 設計文件：範本變體獨立儲存與稽核紀錄移除

**日期**：2026-07-19
**狀態**：待使用者審閱

## 背景與動機

目前 `Template` 資料表以 `category`（類別）為單位儲存一筆紀錄，同一類別下的多個「方案／變體」（例如媒合信的「一般／伴侶／青壯／重大災害／EAP／公益」）共用同一個 `subject`／`body` 字串，靠 `[只有 A、B]...[/只有]`／`[除外 A、B]...[/除外]` 這組括號式 mini-language 在渲染時篩選文字（`src/lib/letters/variantBlocks.ts`）。

這個設計帶來兩個實際問題：

1. **編輯困難**：一個類別的 body 字串把所有變體的內文都串在一起（媒合信的 body 目前一次串了 6 個變體、超過 150 行），操作者要在同一個大文字框裡找到自己要改的那一段，容易改錯地方或漏掉巢狀括號。
2. **必填欄位不精確**：`requiredFields` 是整個類別共用一份，例如媒合信的 `eapPlanName` 只有 EAP 變體用得到，但操作者選「一般」方案時，產生信件頁面仍會要求填這個欄位。

同時，稽核紀錄（`letters_log`）目前只記錄「誰、何時、用了哪個模板」，但：
- 系統本身無密碼登入，多位操作者共用同一個機器與同一個 Gmail 帳號寄信，Gmail 寄件備份看不出「哪一位操作者」處理的
- 但信件內文結尾的簽名區塊（`signature.ts`）已經內嵌操作者的簽名代號，寄出的信件本身就帶有「誰」的資訊
- 因此 `letters_log` 對「誰、何時」的稽核目的已經被信件內容本身取代，變成多餘的機制

本次調整的範圍：**(1)** 把「變體」從共用一個 body 字串的括號語法，改成每個變體獨立儲存與編輯；**(2)** 移除 `letters_log` 稽核紀錄整套機制。不涉及視覺設計調整（版面風格調整將於本 spec 確認後另外用 `ecc:frontend-design-direction` 處理）。

## 範圍外（Out of Scope）

- `[單一時段]/[多個時段]` 語法（依操作者當下輸入的候選時段數量動態切換文字）**保留不動**——這是執行期行為，不是變體差異，跟本次調整的問題不同源。
- `**text**` 粗體＋反白語法不變。
- 身份選擇（`/select`）、session、簽名機制不變。
- 視覺風格／CSS 設計不在本 spec 範圍內。

## 資料模型

```prisma
model User {
  id        String     @id @default(uuid())
  name      String
  signature String
  createdAt DateTime   @default(now())
  templates Template[]

  @@map("users")
}

model Therapist {
  id       String  @id @default(uuid())
  name     String
  isActive Boolean @default(true)
  email    String?
  note     String?

  @@map("therapists")
}

model Template {
  id             String   @id @default(uuid())
  category       String
  variantLabel   String   @default("不適用")
  subject        String
  body           String
  requiredFields String   @default("[]")
  updatedAt      DateTime @updatedAt
  updatedById    String
  updatedBy      User     @relation(fields: [updatedById], references: [id])

  @@unique([category, variantLabel])
  @@map("templates")
}
```

變更重點：
- `variants`（JSON 陣列，跨變體共用）欄位移除，改成 `variantLabel`（單一字串，一列一個變體）。無變體差異的類別維持用 `"不適用"` 作為預設值，與現有慣例一致。
- `requiredFields` 語意從「同類別全變體共用」改成「每個變體各自宣告」。
- `(category, variantLabel)` 加唯一限制，避免同類別下建立重複名稱的變體。
- `LetterLog` model 整個移除，`letters_log` 資料表不再存在；`User.letters`／`Template.letters` 反向關聯欄位一併移除。

## 核心邏輯調整（`src/lib/letters/`）

- **刪除** `variantBlocks.ts` 與 `variantBlocks.test.ts`：不再需要在渲染時依變體篩選文字，因為每一列 `Template` 本身就已經是單一變體的完整內文。
- `render.ts`：`RenderInput` 拿掉 `variant` 參數；`renderLetter` 不再呼叫 `resolveVariantBlocks`，也不再把 `variant` 塞進 Handlebars context。渲染流程簡化為：必填欄位檢查 → `resolveSlotBlocks` → Handlebars compile。
- `slotBlocks.ts`（`[單一時段]/[多個時段]`）**不變**，仍在各變體各自的 body 內使用（例如媒合信「青壯」變體目前就巢狀使用這組語法，遷移後原樣保留在該變體的獨立 body 裡）。
- `templateFields.ts`：`STANDARD_FIELDS` 拿掉 `"variant"`（該機制已不存在；確認過目前真實內容沒有任何模板引用過 `{{variant}}`）。
- `signature.ts`、`highlightMarkup.ts`、`dateFormat.ts`、`gmailUrl.ts`、`requiredFields.ts` 不變。

## API 路由調整

- `POST /api/templates`、`PUT /api/templates/[id]`（`src/app/api/templates/route.ts`、`src/app/api/templates/[id]/route.ts`）：
  - 請求 payload 從 `{ category, subject, body, variants, requiredFields }` 改成 `{ category, variantLabel, subject, body, requiredFields }`（`variantLabel` 空白時預設 `"不適用"`）。
  - 若違反 `(category, variantLabel)` 唯一限制，回傳 400（與現有路由的驗證錯誤狀態碼一致）與清楚錯誤訊息（例如「這個類別已經有同名的變體了，請換個名稱或改用編輯」）。
- `POST /api/letters/generate`（`src/app/api/letters/generate/route.ts`）：
  - 請求 payload 拿掉 `variant`。
  - `renderLetter(...)` 呼叫不再傳 `variant`。
  - 移除 `prisma.letterLog.create(...)` 那段稽核寫入與其上方註解。

## UI 調整

### 範本管理頁面（`src/app/templates/page.tsx`）

- 版面改成兩層結構：
  - 依 `category` 分組，每個類別是可展開/收合的區塊，標題顯示類別名稱＋變體數量。
  - 展開後列出該類別下的每個變體（`variantLabel` ＋標題預覽），各自有「編輯」按鈕；區塊底部有「＋ 新增變體」（`category` 沿用不可改，只填該變體的其他欄位）。
  - 頁面最上方有「＋ 新增類別」按鈕，開全新表單（`category`、`variantLabel` 皆可填），用來建立全新信件類別（首個變體）。
- 編輯表單拿掉原本「適用方案（逗號分隔）」輸入框，改成單一 `variantLabel` 文字輸入。
- 語法提示文字拿掉 `[只有]/[除外]` 那兩行說明，保留 `[單一時段]/[多個時段]` 與 `**文字**` 說明。
- 內文編輯框放大：`rows` 從 14 提高到約 26；加上 `width: 100%`、`fontFamily: monospace`（等寬字體讓 `[單一時段]`、`{{sessionSlots}}` 這類標籤更容易對齊辨識）；頁面外層加 `max-width`（約 900px）置中容器，避免超寬螢幕上單行文字過長難以編輯。

### 產生信件頁面（`src/app/generate/page.tsx`）

- 第一個下拉選單（類別）：從所有 templates 依 `category` 去重取得，行為與現在相同。
- 選定類別後，若該類別下變體數 >1，才顯示第二個「方案」下拉選單（選項為各變體的 `variantLabel`）；選定後直接對應到該變體那一筆的 `id`，設為 `templateId`。變體數 =1 時跟現在一樣不顯示方案選單，直接使用該筆 id。
- 必填欄位改讀選定變體那一列自己的 `requiredFields`——操作者只會看到目前所選變體真正需要的欄位。
- 送出 `/api/letters/generate` 的 payload 拿掉 `variant`。

## 既有真實資料遷移

目前 `prisma/dev.db` 已有 4 個類別的真實模板內容（`prisma/import-real-templates.ts` 匯入），其中：
- 「線上諮詢預約確認信」「通訊諮商預約確認信」：單一變體（`"不適用"`），遷移後只是欄位改名，內容不變。
- 「媒合信」「準備信」：各用 `[只有]/[除外]` 包了 6 個變體（一般／伴侶／青壯／重大災害／EAP／公益）在同一個 body/subject 字串裡，需要拆成獨立列。

遷移步驟：

1. **執行 schema migration 前，先備份 `prisma/dev.db`**（複製一份到 `prisma/dev.db.bak` 或類似位置），避免遷移腳本寫錯時真實內容遺失。
2. 寫一支一次性遷移腳本（例如 `prisma/migrate-split-variants.ts`），在 **刪除 `variantBlocks.ts` 之前**執行、並沿用其中的 `resolveVariantBlocks` 邏輯：
   - 讀出「媒合信」「準備信」目前的 6 個變體名稱（`["一般", "伴侶", "青壯", "重大災害", "EAP", "公益"]`）。
   - 對每個變體名稱，用 `resolveVariantBlocks(subject, variantName)` 與 `resolveVariantBlocks(body, variantName)` 烤出該變體的純文字 `subject`／`body`（巢狀的 `[單一時段]/[多個時段]` 語法不展開，原樣保留在烤出的文字裡）。
   - 依每個變體實際引用到的 `{{field}}` 欄位，重新列出該變體專屬的 `requiredFields`（例如「EAP」變體才保留 `eapPlanName`；「一般」「伴侶」等不需要 `fee` 以外的其他變體專屬欄位者不列入）。
   - 寫入 6 筆新的 `Template` 列（`category` 相同、`variantLabel` 為變體名稱），並刪除原本那 1 筆合併版本。
3. 遷移完成後，**人工覆核**這 12 筆變體內容（媒合信 6 筆＋準備信 6 筆），逐筆比對跟遷移前用 `renderLetter` 實際渲染出來的結果是否一致（尤其是「青壯」變體裡巢狀的時段語法）。
4. 確認無誤後，刪除 `variantBlocks.ts`、`variantBlocks.test.ts`，以及遷移腳本本身（一次性用途，不需要留在專案裡）。

## 測試計畫

- 刪除 `src/lib/letters/variantBlocks.test.ts`。
- `render.test.ts`：移除所有跟 `variant` 篩選相關的測試案例，改為驗證「不再需要 variant 參數也能正確渲染」。
- `templateFields.test.ts`：更新 `STANDARD_FIELDS` 相關案例，確認 `{{variant}}` 若被使用會被標記為未宣告欄位（因為機制已移除）。
- 新增 `POST /api/templates` 違反 `(category, variantLabel)` 唯一限制時回傳正確錯誤訊息的測試。
- 新增／更新 `renderLetter` 不再接受 `variant` 參數後，既有必填欄位檢查、slot block 解析行為仍正確的回歸測試。
- 遷移腳本本身建議寫一次性驗證（例如跑完後逐筆用新資料 render，跟遷移前用舊 `resolveVariantBlocks` 邏輯 render 出的結果做字串比對），但這支腳本本身不需要留存到專案的 vitest 測試套件中。

## 已知取捨與風險

- 移除 `letters_log` 之後，系統將完全沒有任何「誰在何時處理了哪個案子」的內部紀錄，唯一的追溯依據是信件內文裡的簽名代號＋操作者自己 Gmail 帳號的寄件備份。若未來稽核需求改變（例如需要離開 Gmail 單一帳號、改成每位操作者各自帳號寄信），屆時「簽名代號＝寄件者」這個假設會失效，需要重新評估是否要恢復稽核紀錄。
- `(category, variantLabel)` 唯一限制代表操作者若打錯字新增了拼字不同但語意重複的變體名稱（例如「EAP」跟「eap」），系統不會擋下來，因為 SQLite 預設是大小寫敏感比對；這不是本次設計要解決的問題，先維持現狀。
- 遷移腳本手動覆核 12 筆變體內容有一定人工成本，但這是一次性的，且是為了避免自動化拆分過程中出錯而刻意保留的檢查點。
