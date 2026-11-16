# 靜態版信件系統（Cloudflare Pages）部署說明

**這是過渡方案**（2026-11 起）：在 NAS 或其他正式主機到位之前，先把「產生信件」功能以無資料庫的靜態網站放上 Cloudflare Pages，讓行政可以馬上使用。正式主機到位後改用完整版（`docs/NAS_SETUP.md`），這個靜態版就可以收掉。

## 跟完整版的差別

| | 完整版（`npm run dev` / Docker） | 靜態版（`static/`） |
|---|---|---|
| 產生信件 | ✓ | ✓（同一份 `GenerateLetterForm` 元件與 `generateLetter()` 邏輯） |
| 編輯模板／心理師／操作者 | ✓ | ✗ ——只能在你自己電腦上的完整版改，改完重新發布 |
| 資料來源 | SQLite（`prisma/dev.db`） | 建置時從 `dev.db` 匯出的快照（`static/src/letters-data.json`，不進 git） |
| 操作者身分 | iron-session cookie | 記在各自瀏覽器的 localStorage |
| 存取保護 | 僅限內網 | 全診所共用一組密碼（HTTP Basic Auth，由 `static/functions/_middleware.ts` 在 Cloudflare 端檢查，網頁與資料檔都擋） |

為什麼不讓靜態版也能編輯、為什麼不用 Cloudflare 的資料庫（D1）：見 2026-11 的討論結論——Prisma 對 D1 仍是預覽版、執行環境與 NAS 不同，為過渡方案改寫資料層不划算，且個案資料庫（V1）一定要自架，遲早要回到同一台主機。

## 一次性設定（只做一次）

以下指令都在專案根目錄執行。

> **`pages project create` 和 `pages deploy` 一定要加 `--force`**（`pages secret`、`pages dev` 不會被轉交，也不接受這個選項）。 wrangler 4.x 新版會把 Pages 指令自動「轉交」給 Cloudflare Workers，並在偵測到 Next.js 時擅自對專案執行 OpenNext 轉換（改寫 `package.json`、`next.config.mjs`，新增 `wrangler.jsonc` 等）並嘗試部署整個完整版。`--force` 會讓它照傳統 Pages 方式執行。2026-11-16 實際踩過一次，已還原。

1. 登入 Cloudflare（會開瀏覽器授權）：
   ```bash
   npx wrangler@4.162.0 login
   ```
2. 建立 Pages 專案：
   ```bash
   npx wrangler@4.162.0 pages project create framing-letters --production-branch main --force
   ```
3. 設定全診所共用密碼（會提示你輸入，輸入內容不會顯示）：
   ```bash
   npx wrangler@4.162.0 pages secret put SITE_PASSWORD --project-name framing-letters
   ```
   - 建議只用英文字母、數字、符號，避免中文（部分瀏覽器對非英文的帳密視窗輸入處理不一致）。
   - **沒設定這個值時，任何人都進不去**（刻意設計成預設拒絕）。

## 發布（第一次，以及每次改完模板後）

```bash
npm run deploy:static
```

這一個指令會依序：從 `dev.db` 匯出最新的模板／心理師／操作者 → 型別檢查 → 建置 → 上傳到 Cloudflare。完成後會印出網址（`https://framing-letters.pages.dev`）。

頁面最下方會顯示「模板資料更新時間」，可用來確認同事看到的是不是最新版。

## 同事怎麼用

1. 打開網址，瀏覽器跳出帳號密碼視窗：**帳號隨便填（或留空）**，密碼填共用密碼。瀏覽器會記住，之後不用每次輸入。
2. 選自己的名字（這台電腦的這個瀏覽器會記住，可以從右上角「切換操作者」更換）。
3. 照常產生信件。

## 換密碼（例如有人離職）

```bash
npx wrangler@4.162.0 pages secret put SITE_PASSWORD --project-name framing-letters
npm run deploy:static
```

密碼設定只會套用在之後的新部署，所以換完要重新發布一次。

## 已知限制

- 網頁上的密碼保護只有一組共用密碼，沒有個人帳號、沒有登入紀錄。適用於目前資料內容（模板、心理師姓名與 email、行政姓名與簽名代號，無個案資料）；**之後如果要放個案資料，不能沿用這個方式。**
- 心理師 email 會存在 Cloudflare 的伺服器上（不保證在台灣），應讓主管知情。
- 本機測試：`npm run build:static && cd static && npx wrangler@4.162.0 pages dev dist --binding SITE_PASSWORD=<測試密碼>`。
