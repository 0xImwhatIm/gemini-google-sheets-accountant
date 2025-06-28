### 版本 V38.3 更新說明 | Release Notes for Version V38.3

**版本標題：** `智慧通報中心與動態規則引擎 (Intelligent Notification Hub & Dynamic Rule Engine)`

這是一個重大的架構升級版本，將系統的靈活性與可維護性提升到了一個全新的水平。我們強烈建議所有使用者更新。

#### ✨ 主要功能 / Major Features

* **[新功能] 動態郵件處理規則 (Dynamic Email Processing Rules):**
    * 徹底移除了寫死在程式碼中的 `EMAIL_PROCESSING_RULES` 陣列。
    * 現在，系統會從您的主帳本 Google Sheet 中一個名為 `Settings` 的新工作表，動態讀取所有郵件處理規則。
    * 您可以直接在試算表中新增、修改、刪除規則，無需再重新部署程式碼！

* **[新功能] 智慧通報中心 (Intelligent Notification Hub):**
    * 新增了一個統一的 `sendNotification()` 函式，作為所有錯誤與事件的通報入口。
    * 您可以同樣在 `Settings` 工作表中，設定您偏好的通知方式。
    * 目前支援 `EMAIL` 和 `WEBHOOK` (可用於 Slack, Discord, Telegram 等) 兩種渠道。
    * 支援設定通知等級 (`ERROR` 或 `ALL`)，讓您可以只接收最重要的警報。

#### 🚀 改善 / Improvements

* **強化錯誤處理:** 在多個關鍵的錯誤處理流程中（如檔案處理失敗、API 金鑰失效），加入了主動通報機制。現在，系統會依據您的設定，在出錯時第一時間通知您。
* **提升可維護性:** 將「設定」從「程式碼」中分離，是向更成熟、更專業的架構邁出的重要一步。

#### ⚠️ 重大變更 / Breaking Changes

* **[必要操作] 觸發器更新:** 如果您是從舊版本升級，請務必將您設定的 Gmail 自動化時間觸發器，從執行舊的 `syncInvoicesFromGmail` 函式，**更改為執行新的 `processAutomatedEmails` 函式**。
* **[必要操作] `Settings` 工作表:** 您**必須**在您的主帳本 Google Sheet 中，手動新增一個名為 `Settings` 的工作表，並依照說明文件設定相關欄位 (`Query`, `Type`, `Channel`, `Target`, `Level`)，否則郵件處理與通知功能將無法運作。
