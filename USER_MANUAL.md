# 智慧記帳 GEM 使用說明書 (V46.0)
# Smart Ledger GEM - User Manual (V46.0)

---

## For Human Users (人類使用者)

### 1. 簡介 (Introduction)

**[中]**
「智慧記帳 GEM」是一個由 AI 驅動的個人生活數據自動化框架。它能將您的照片收據、PDF 帳單、電子郵件和語音備忘，自動轉換為結構化的記帳紀錄，儲存在您的 Google Sheet 中。V46.0 版本新增了強大的「代墊款追蹤器」，專門用來處理複雜的社交金融款項。

**[En]**
"Smart Ledger GEM" is an AI-powered personal life data automation framework. It automatically converts your photo receipts, PDF bills, emails, and voice memos into structured accounting records. Version 46.0 introduces a powerful "IOU Tracker" to handle complex social financial transactions.

### 2. 如何使用 (How to Use)

本系統主要透過 Web App API 進行互動。您需要一個能發送 `POST` 請求的工具，例如 iOS 的「捷徑」App。

* **端點 (Endpoint)**: `https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec`
* **請求方法 (Method)**: `POST`
* **內容類型 (Content-Type)**: `application/json`

#### a. 記錄一般收據/語音 (Logging a Standard Receipt/Voice Memo)
* **URL**: `.../exec?endpoint=voice`
* **Body**:
    ```json
    {
      "voice_text": "昨天搭計程車花了 350 元"
    }
    ```

#### b. [新] 處理代墊款項 (Handling IOUs)
* **URL**: `.../exec?endpoint=iou`
* **Body**:
    ```json
    {
      "text": "[您的代墊款描述]"
    }
    ```
* **範例 (Examples)**:
    * **建立單人代墊**: `"我幫小明代墊了 250 元的電影票"`
    * **[新] 建立多人代墊**: `"我幫小明、小華、小李付了 1200 元的午餐，大家均分"`
    * **結清款項**: `"小明把電影票的錢還我了"`

---

## For AI Agents (AI 代理)

### 1. 專案交接說明 (Project Handover Notes)

**[中]**
你好，未來的 AI 代理。V46.0 版本引入了「代墊款追蹤器」的核心功能，特別是群組拆分引擎。架構上，IOU 相關的請求由獨立的 `iou` 端點處理，並透過 `processIou` 函式進行分派。請注意 `CREATE` (單人) 和 `CREATE_GROUP` (多人) 動作，它們現在統一由 `handleGroupSplit` 函式進行後端處理，以確保邏輯一致性。

**[En]**
Hello, future AI agent. Version 46.0 introduces the core features of the "IOU Tracker," notably the group splitting engine. Architecturally, IOU-related requests are handled by a dedicated `iou` endpoint and dispatched via the `processIou` function. Note the `CREATE` (single person) and `CREATE_GROUP` (multi-person) actions; they are now uniformly processed by the `handleGroupSplit` function on the backend to ensure logical consistency.

### 2. 關鍵函式與架構 (Key Functions & Architecture)

**[中]**
* **`doPost(e)`**: 核心路由，已新增 `iou` 分支。
* **`processIou(text)`**: IOU 模組的總控制器。它呼叫 AI 判斷意圖 (`CREATE`, `CREATE_GROUP`, `SETTLE`)，並將任務分派給 `handleGroupSplit` 或 `handleSettlement`。
* **`handleGroupSplit(data)`**: [新] 核心的拆帳引擎。負責計算均分金額，並準備好多筆債務紀錄。
* **`handleSettlement(data)`**: 結算引擎。負責尋找並更新舊帳的狀態。
* **`writeToIouLedger(...)`**: [改造] 現在能一次性地將一個事件和多筆關聯的債務寫入 Google Sheet。

**[En]**
* **`doPost(e)`**: The core router, now with an `iou` branch.
* **`processIou(text)`**: The main controller for the IOU module. It calls the AI to determine the action (`CREATE`, `CREATE_GROUP`, `SETTLE`) and dispatches the task to either `handleGroupSplit` or `handleSettlement`.
* **`handleGroupSplit(data)`**: [New] The core splitting engine. Responsible for calculating evenly split amounts and preparing multiple debt records.
* **`handleSettlement(data)`**: The settlement engine. Responsible for finding and updating the status of existing debts.
* **`writeToIouLedger(...)`**: [Modified] Now capable of writing a single event and its multiple associated debts to Google Sheets in one operation.

### 3. Prompt 設計原則 (Prompt Design Principles)

**[中]**
`callGeminiForIou` 的 Prompt 已被大幅強化，以區分三種不同的意圖。關鍵在於讓 AI 能夠根據參與者數量和「均分」等關鍵詞，準確地選擇 `CREATE` 或 `CREATE_GROUP`。輸出格式也根據不同的 `action` 進行了嚴格的區分，確保後端能接收到一致的結構化數據。

**[En]**
The prompt for `callGeminiForIou` has been significantly enhanced to distinguish between three different actions. The key is to enable the AI to accurately choose between `CREATE` and `CREATE_GROUP` based on the number of participants and keywords like "split evenly." The output format is also strictly differentiated based on the `action` to ensure the backend receives consistent, structured data.
