# 智慧記帳 GEM 使用說明書 (V41.1)
**版本：** 13.0 | **最後更新：** 2025-07-08

---

### Part 1: 產品說明 (For Human Users)
**[中文]**
「智慧記帳 GEM」是一個屬於您個人的、高度智慧化的「AI 生活數據處理中樞」。它的核心任務是將您生活中所有零碎的資訊（收據照片、語音備註、電子郵件帳單），透過強大的 AI 引擎，自動轉化為結構化、有意義的紀錄，儲存在您自己的 Google Sheet 中。

* **[V41.0 新功能] 逐行處理引擎：** 系統現在能以更穩健的方式處理包含大量交易的郵件附件（如財政部的 CSV 發票明細）。它會將文件逐行拆解，並對每一筆交易單獨進行 AI 分析，大幅提升了處理超長列表時的成功率與穩定性。
* **批量智慧處理 (V40.3)：** 能理解並處理像 IC 卡消費紀錄這樣的「交易列表」截圖，自動拆分多筆交易。
* **智慧合併：** 會智慧地將新的資訊（如電子發票）與您先前不完整的紀錄（如照片）進行合併，避免重複。
* **使用者自訂規則：** 您可以在 Google Sheets 的 `EmailRules` 工作表中，簡單地新增郵件處理規則，無需修改任何程式碼。

**[English]**
"GEM (Gemini AI Accountant)" is your personal, highly intelligent "AI Life Data-Processing Hub". Its core mission is to automatically transform fragmented information (receipts, voice memos, email bills) into structured records in your own Google Sheet.

* **[New in V41.0] Line-by-Line Processing Engine:** The system now processes email attachments with numerous transactions (like government e-invoice CSVs) more robustly. It breaks down the file line by line, sending each transaction for individual AI analysis, significantly improving success rates and stability for very long lists.
* **Intelligent Batch Processing (V40.3):** Can understand and process "transaction list" screenshots, like IC card statements, auto-splitting multiple transactions.
* **Smart Reconciliation:** Avoids duplicate entries by intelligently merging new information with previous, incomplete records.
* **User-Defined Rules:** You can easily add new email processing rules in the `EmailRules` sheet in your Google Sheets without any code changes.

---

### Part 2: AI Agent 專案交接說明 (For AI Agents)
* **當前穩定版本:** V41.1 - 最終優化版。
* **核心架構變更 (V41.0):**
    * **策略轉變:** 放棄了讓 AI 一次性處理完整 CSV 內容的策略，改為更穩健的「化整為零」架構。
    * **`processAutomatedEmails` 改造:** 此函式現在會將 CSV 內容按行拆分，並只遍歷 `M|` 開頭的主紀錄行。對於每一行，都會**單獨**呼叫 `callGeminiForNormalization`。
    * **`callGeminiForNormalization` Prompt 簡化:** AI 的任務被大幅簡化，現在專注於將**單行**的、由 `|` 分隔的文字，轉換為**一個**標準的 JSON 物件，極大地提升了穩定性與容錯率。
* **最終優化 (V41.1):**
    * **Prompt 強化:** 對 `callGeminiForNormalization` 的 Prompt 進行了最後的強化，為 `notes` 欄位增加了嚴格的排他性規則，防止 AI 將非備註資訊寫入此欄位。
    * **資料流統一:** 統一了所有處理流程（CSV, HTML, PDF, OCR）中傳遞給 `processNewRecord` 的 `metaData` 格式，確保了系統內部邏輯的一致性。

---
### Part 3, 4, 5 (Quick Start, Detailed Settings, FAQ)
*(內容與前一版本相同，此處不再重複。)*
