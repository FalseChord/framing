# 靜態版信件系統（Cloudflare Workers）部署說明

**這是過渡方案**（2026-11 起）：在 NAS 或其他正式主機到位之前，先把「產生信件」功能以無資料庫的靜態網站放上 Cloudflare，讓行政可以馬上使用。正式主機到位後改用完整版（`docs/NAS_SETUP.md`），這個靜態版就可以收掉。

## 跟完整版的差別

| | 完整版（`npm run dev` / Docker） | 靜態版（`static/`） |
|---|---|---|
| 產生信件 | ✓ | ✓（同一份 `GenerateLetterForm` 元件與 `generateLetter()` 邏輯） |
| 編輯模板／心理師／操作者 | ✓ | ✗ ——只能在你自己電腦上的完整版改，改完重新發布 |
| 資料來源 | SQLite（`prisma/dev.db`） | 建置時從 `dev.db` 匯出的快照（`static/src/letters-data.json`，不進 git） |
| 操作者身分 | iron-session cookie | 記在各自瀏覽器的 localStorage |
| 存取保護 | 僅限內網 | 全診所共用一組密碼（HTTP Basic Auth，由 `static/worker.ts` 在 Cloudflare 端檢查，網頁與資料檔都擋） |

為什麼不讓靜態版也能編輯、為什麼不用 Cloudflare 的資料庫（D1）：見 2026-11 的討論結論——Prisma 對 D1 仍是預覽版、執行環境與 NAS 不同，為過渡方案改寫資料層不划算，且個案資料庫（V1）一定要自架，遲早要回到同一台主機。

## 部署方式：Cloudflare Workers（含靜態檔案）

2026-11-16 起改用 Workers，而不是 Cloudflare Pages：Cloudflare 已把 Pages 併入 Workers，新版 wrangler 會把 `pages` 指令自動轉交給 Workers，而且在專案根目錄偵測到 Next.js 時，還會擅自對專案跑 OpenNext 轉換並嘗試部署整個完整版（當天實際發生過一次，已全部還原）。改成 Workers 之後就不會再遇到這種轉交，也是 Cloudflare 往後會持續維護的方式。

- `static/wrangler.jsonc`：Worker 設定。`assets.run_worker_first: true` 讓**所有**請求（包括內含資料的 JS 檔）都先經過密碼檢查。
- `static/worker.ts`：檢查密碼，通過才交給靜態檔案。比對邏輯在 `static/lib/basicAuth.ts`（有單元測試）。
- 網址：https://framing-letters.framing.workers.dev

舊的 Pages 專案（`framing-letters.pages.dev`）已於 2026-11-16 刪除。

## 一次性設定

1. 登入 Cloudflare（會開瀏覽器授權）：`npx wrangler@4.162.0 login`
2. 設定全診所共用密碼。**請用 Cloudflare 後台設定**（在 Claude Code 對話框裡用 `!` 執行 `wrangler secret put` 不會跳出輸入提示）：
   **Workers & Pages → framing-letters → Settings → Variables and Secrets → Add**，名稱 `SITE_PASSWORD`、類型選 **Secret**。
   - 建議只用英文字母、數字、符號。
   - **沒設定時任何人都進不去**（刻意設計成預設拒絕）。
   - Worker 的密碼存檔後立即生效，不需要重新部署。

## 發布（每次改完模板後）

```bash
npm run deploy:static
```

依序：從 `dev.db` 匯出最新的模板／心理師／操作者 → 型別檢查 → 建置 → 上傳到 Cloudflare。頁面最下方會顯示「模板資料更新時間」，可用來確認同事看到的是不是最新版。

## 同事怎麼用

1. 打開網址，瀏覽器跳出帳號密碼視窗：**帳號隨便填（或留空）**，密碼填共用密碼。瀏覽器會記住，之後不用每次輸入。
2. 選自己的名字（這個瀏覽器會記住，可以從右上角「切換操作者」更換）。
3. 照常產生信件。

## 換密碼（例如有人離職）

在後台同一個位置修改 `SITE_PASSWORD`，存檔即生效。

## 已知限制

- 網頁上的密碼保護只有一組共用密碼，沒有個人帳號、沒有登入紀錄。適用於目前資料內容（模板、心理師姓名與 email、行政姓名與簽名代號，無個案資料）；**之後如果要放個案資料，不能沿用這個方式。**
- 心理師 email 會存在 Cloudflare 的伺服器上（不保證在台灣），應讓主管知情。
- 本機測試：`npm run build:static && cd static && npx wrangler@4.162.0 dev --var SITE_PASSWORD:<測試密碼>`。
