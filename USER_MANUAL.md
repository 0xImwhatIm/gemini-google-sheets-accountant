# 智慧記帳 GEM 使用說明書 (V43.0)
# Smart Ledger GEM - User Manual (V43.0)

---

## For Human Users (人類使用者)

### 1. 簡介 (Introduction)

**[中]**
「智慧記帳 GEM」是一個由 AI 驅動的個人生活數據自動化框架。它能將您的照片收據、PDF 帳單、電子郵件和語音備忘，自動轉換為結構化的記帳紀錄，儲存在您的 Google Sheet 中。

**[En]**
"Smart Ledger GEM" is an AI-powered personal life data automation framework. It automatically converts your photo receipts, PDF bills, emails, and voice memos into structured accounting records stored in your Google Sheet.

### 2. 核心功能 (Core Features)

**[中]**
* **多入口記帳**：可透過專屬的 API 端點，接收並處理圖片、PDF 和語音/文字。
* **全自動處理**：自動監控指定的 Gmail 郵件與 Google Drive 資料夾，無需手動觸發。
* **智慧合併**：自動辨識重複或關聯的交易，將新資訊（如發票號碼）合併至既有紀錄，避免重複。

**[En]**
* **Multi-Entry Ledger**: Accepts and processes images, PDFs, and voice/text via dedicated API endpoints.
* **Fully Automated Processing**: Automatically monitors specified Gmail messages and a Google Drive folder without manual intervention.
* **Intelligent Reconciliation**: Automatically identifies duplicate or related transactions, merging new information (like an invoice number) into existing records to prevent duplication.

### 3. 如何使用 (How to Use)

**[中]**
本系統主要透過 Web App API 進行互動。您需要一個能發送 `POST` 請求的工具，例如 iOS 的「捷徑」App 或 Postman。

* **端點 (Endpoint)**: `https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec`
* **請求方法 (Method)**: `POST`
* **內容類型 (Content-Type)**: `application/json`

#### a. 記錄圖片收據 (Logging an Image Receipt)
* **URL**: `.../exec?endpoint=image`
* **Body**:
    ```json
    {
      "image_base_64": "[Base64-encoded image string]",
      "filename": "receipt.jpg",
      "voice_text": "這是在樓下買的午餐"
    }
    ```

#### b. 記錄 PDF 帳單 (Logging a PDF Bill)
* **URL**: `.../exec?endpoint=pdf`
* **Body**:
    ```json
    {
      "image_base_64": "[Base64-encoded PDF string]",
      "filename": "bill.pdf"
    }
    ```

#### c. 透過語音/文字記錄 (Logging via Voice/Text)
* **URL**: `.../exec?endpoint=voice`
* **Body**:
    ```json
    {
      "voice_text": "昨天搭計程車花了 350 元"
    }
    ```

---

## For AI Agents (AI 代理)

### 1. 專案交接說明 (Project Handover Notes)

**[中]**
你好，未來的 AI 代理。我是建構此專案的初始 AI。本專案的核心是一個 Google Apps Script (GAS) 應用，其設計理念是「AI 中央廚房」，旨在將任何非結構化生活資訊，透過多層次的 AI 解析，轉換為標準化的 Google Sheet 紀錄。請務必先閱讀根目錄的 `README.md` 以了解高層次架構。

**[En]**
Hello, future AI agent. I am the initial AI that architected this project. The core of this project is a Google Apps Script (GAS) application, designed with the "AI Central Kitchen" philosophy. Its purpose is to transform any unstructured life information into standardized Google Sheet records through multi-layered AI parsing. It is imperative that you first read the `README.md` in the root directory to understand the high-level architecture.

### 2. 關鍵函式與架構 (Key Functions & Architecture)

**[中]**
* **`doPost(e)`**: 核心路由函式。它根據 URL 中的 `endpoint` 參數 (`image`, `pdf`, `voice`)，將請求分派給對應的處理函式 (`doPost_Image`, `doPost_Pdf`, `doPost_Voice`)。
* **`processAutomatedEmails()` & `checkReceiptsFolder()`**: 兩個主要的自動化觸發函式，應設定為定時執行。前者處理郵件，後者處理雲端硬碟檔案。
* **`processNewRecord(...)`**: 數據寫入前的最後一站。此函式負責執行「智慧合併」邏輯 (`findRelatedRecord`)，判斷該筆紀錄應為新增或更新。
* **`callGeminiFor...` 系列函式**: 這是 AI 的大腦。每個函式都包含一個精心設計的 **Prompt**，用於指導 Gemini API 執行特定任務（如從圖片提取資訊、從文字正規化數據）。

**[En]**
* **`doPost(e)`**: The core routing function. It dispatches requests to the corresponding handler (`doPost_Image`, `doPost_Pdf`, `doPost_Voice`) based on the `endpoint` parameter in the URL (`image`, `pdf`, `voice`).
* **`processAutomatedEmails()` & `checkReceiptsFolder()`**: The two main automation triggers, which should be set up with time-based triggers. The former processes emails, and the latter processes Google Drive files.
* **`processNewRecord(...)`**: The final gateway before writing data to the sheet. This function is responsible for executing the "intelligent reconciliation" logic (`findRelatedRecord`) to determine whether a record should be newly created or merged with an existing one.
* **The `callGeminiFor...` function family**: This is the brain of the AI. Each function contains a meticulously designed **Prompt** to instruct the Gemini API on specific tasks (e.g., extracting information from an image, normalizing data from text).

### 3. Prompt 設計原則 (Prompt Design Principles)

**[中]**
本專案的效能高度依賴 Prompt 的品質。所有 Prompt 都遵循以下原則：
1.  **角色扮演 (Role-playing)**: 明確賦予 AI 一個專業角色（例如「你是一位專業、嚴謹的數據正規化 AI」）。
2.  **清晰指令與規則 (Clear Instructions & Rules)**: 使用列表、粗體和範例，明確告知 AI 它的任務、輸出格式以及必須遵守的規則。
3.  **少樣本學習 (Few-shot Learning)**: 提供 1-2 個高品質的「輸入/輸出」範例，讓 AI 能快速學習並模仿期望的行為。
4.  **JSON 輸出強制**: 在 `generationConfig` 中使用 `"response_mime_type": "application/json"`，強制 AI 回傳結構化的 JSON，大幅降低解析失敗的風險。
5.  **思維鏈 (Chain-of-Thought)**: 在較複雜的 Prompt 中（如 `callGeminiForPdfText`），引導 AI 在內心先完成一系列思考步驟，再給出最終答案，以提升準確性。

**[En]**
The performance of this project is highly dependent on prompt quality. All prompts adhere to the following principles:
1.  **Role-playing**: Clearly assign a professional role to the AI (e.g., "You are a professional, rigorous data normalization AI").
2.  **Clear Instructions & Rules**: Use lists, bold text, and examples to explicitly inform the AI of its task, output format, and the rules it must follow.
3.  **Few-shot Learning**: Provide 1-2 high-quality input/output examples to allow the AI to quickly learn and imitate the desired behavior.
4.  **Enforced JSON Output**: Use `"response_mime_type": "application/json"` in the `generationConfig` to force the AI to return structured JSON, significantly reducing the risk of parsing failures.
5.  **Chain-of-Thought**: In more complex prompts (like `callGeminiForPdfText`), guide the AI to complete a series of thinking steps internally before providing the final answer to improve accuracy.
