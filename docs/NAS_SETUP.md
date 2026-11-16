# NAS（Docker）部署與開發說明

本文件說明如何把這個專案用 Docker 部署到一台 x86 架構、支援 Container Manager（Synology）或 Container Station（QNAP）的 NAS 上，以及往後的開發／更新流程。

**這是目前唯一的正式部署方案**（2026-09-15 起）。原本規劃的單機 Windows 部署（`docs/WINDOWS_SETUP.md`）已正式放棄並移除，改採 NAS／Docker 方案，原因：NAS 通常本來就 24/7 開機、可用性比可能被關機的櫃檯電腦更好；NAS 的快照功能能取代原本手動排程複製 `.db` 檔案的備份方式，異地備份也更容易做到。

## 核心概念

- 開發（`npm run dev`）完全在你自己的電腦上進行，跟 NAS 無關，不受本文件影響。
- 「部署」= 把程式碼打包成一個 Docker image，丟到 NAS 上用 Container Manager/`docker compose` 執行。
- SQLite 資料庫檔案存在 NAS 上一個獨立的 volume（`framing_data`），跟 image 本身分開──之後升級程式版本，重建 image 完全不會動到既有資料。
- Container 啟動時會自動執行 `prisma migrate deploy`（見 `docker-entrypoint.sh`），不需要手動下指令建表。

## 專案裡新增的檔案

- `Dockerfile`：三階段建置（安裝依賴 → build → 最終執行環境），已在本機驗證過建置、啟動、重啟後資料持久性、migration 冪等性均正常。
- `docker-entrypoint.sh`：container 啟動時先跑 `prisma migrate deploy`，成功後才啟動 Next.js server。
- `docker-compose.yml`：定義 service、port、環境變數、資料 volume。
- `.dockerignore`：避免把 `node_modules`、`.env`、`.git`、資料庫檔案等打包進 image。

## 一次性準備：把程式碼放上 NAS

推薦用 `git clone` 而不是用 File Station 手動上傳整個資料夾，這樣以後更新只要 `git pull`：

1. 在 NAS 上開一個共用資料夾（例如 `docker/framing`）。
2. 透過 SSH 連進 NAS（Synology：控制台 → 終端機和 SNMP → 啟用 SSH），在該資料夾執行：
   ```bash
   git clone <你的 repo 網址> .
   ```
3. 複製一份 `.env.example` 為 `.env`，只需要填 `SESSION_SECRET`（`DATABASE_URL` 由 `docker-compose.yml` 直接指定，不用改）：
   ```bash
   cp .env.example .env
   ```
   打開 `.env`，把 `SESSION_SECRET` 換成自己想的隨機英數字串（至少 32 字元）。`docker compose` 會自動讀取同目錄下的 `.env` 檔案來替換 `docker-compose.yml` 裡的 `${SESSION_SECRET}`。

## 建置與啟動

**方式一：透過 Container Manager 圖形介面（推薦，非工程師操作較直覺）**

1. 開啟 Container Manager → 專案（Project）→ 新增。
2. 路徑指向剛剛 clone 的資料夾（NAS 會自動偵測到裡面的 `docker-compose.yml`）。
3. 點擊「建置」。因為建置直接發生在 NAS 自己的 x86 CPU 上，不需要處理跨架構模擬問題。
4. 建置完成後啟動專案，等待約 1 分鐘（首次啟動要跑資料庫遷移）。

**方式二：SSH 指令列**

```bash
cd docker/framing
docker compose up -d --build
docker compose logs -f
```

看到 log 出現 `✓ Ready in ...ms` 代表啟動成功。

## 驗證

在瀏覽器輸入 `http://<NAS 的內網 IP>:3000/select`，應該會看到操作者選擇頁面。

## 更新流程（之後每次要發布新版本時）

1. 在自己電腦上開發、測試、commit、push 到 GitHub（跟現在流程一樣）。
2. 到 NAS 上（SSH 或 Container Manager 的終端機功能）：
   ```bash
   cd docker/framing
   git pull
   docker compose up -d --build
   ```
3. 如果這次更新有新增 Prisma migration，`docker-entrypoint.sh` 會在 container 重啟時自動套用，不需要額外操作。
4. 舊版本的 container 會被取代，但 `framing_data` volume（SQLite 檔案）不受影響，資料不會遺失。

## 網路與安全設定

- **不要**在路由器上對這個 port 做任何 port forwarding——只要 NAS 跟員工的電腦在同一個內網（LAN），直接用 NAS 的內網 IP 加 port 就能連線，完全不對外曝露。
- 建議在 DSM 的「安全性 → 防火規則」設定：只允許診所內網網段（例如 `192.168.1.0/24`）連到 3000 port，其餘一律拒絕，做多一層保險。
- DSM/QTS 本身的管理介面（5000/5001 port）維持原廠預設值即可，跟這個 3000 port 的服務互不影響。

## 備份

`framing_data` volume 在 NAS 檔案系統上有實際對應的資料夾（可用 `docker volume inspect framing_data` 查詢實際路徑）。建議：

1. 找到該路徑後，在 Synology 的「儲存空間管理員 → 快照」對它所在的共用資料夾設定排程快照（例如每天一次，保留最近 14 份）。
2. 額外用 Hyper Backup 或 USB Copy，把快照定期備份到另一台 NAS 或外接硬碟，維持異地備份，避免單一硬體故障造成資料全失。

## 目前刻意不做的事

- 沒有設定 HTTPS（跟 Windows 方案一樣，僅限內網使用，見設計文件的取捨說明）。
- 沒有對外開放連線。
- image 沒有做極致瘦身（例如用 Alpine 版 Node）——刻意選擇除錯路徑較單純、相容性風險較低的 `node:20-bookworm-slim`，這個專案規模下影像大小不是問題，穩定性優先。
