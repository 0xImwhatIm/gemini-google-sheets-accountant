# 智慧記帳 GEM 使用說明書 (V40.4.1)
**版本：** 12.1 | **最後更新：** 2025-07-06

---

### Part 1: 產品說明 (For Human Users)
**[中文]**
「智慧記帳 GEM」不是一個傳統的記帳 App，而是一個屬於您個人的、高度智慧化的「AI 生活數據處理中樞」。它的核心任務是將您生活中所有零碎的資訊（收據照片、語音備註、電子郵件帳單），透過強大的 AI 引擎，自動轉化為結構化、有意義的紀錄，儲存在您自己的 Google Sheet 中，讓您對數據擁有 100% 的控制權。

* **批量智慧處理 (V40.3)：** GEM 能理解並處理像 IC 卡消費紀錄這樣的「交易列表」。您只需一張螢幕截圖，它就能自動將裡面的多筆消費逐一拆分記錄，並能智慧地區分出哪些是「費用支出」，哪些是「儲值」。
* **國際化支援：** 系統能夠準確地識別不同國家的貨幣（如日幣 ¥），並從收據中提取確切的交易時間。
* **智慧合併：** GEM 會智慧地將新的資訊（如電子發票）與您先前不完整的紀錄（如照片）進行合併，避免重複紀錄。
* **使用者自訂規則：** 您可以在 Google Sheets 中，像填表格一樣簡單地新增郵件處理規則與錯誤通知方式。

**[English]**
"GEM (Gemini AI Accountant)" is not a traditional accounting app. It is your personal, highly intelligent "AI Life Data-Processing Hub". Its core mission is to automatically transform fragmented information (receipt photos, voice memos, email bills) into structured records using a powerful AI engine. All data is stored in your own Google Sheet, giving you 100% control.

* **Intelligent Batch Processing (V40.3):** GEM can now understand and process "transaction lists," such as IC card statements. With just one screenshot, it automatically breaks down multiple transactions and intelligently distinguishes between "expenses" and "top-ups (transfers)".
* **Internationalization Support:** The system accurately identifies different currencies (e.g., Japanese Yen ¥) and extracts the exact transaction time from receipts.
* **Smart Reconciliation:** GEM avoids duplicate entries by intelligently merging new information (e.g., an e-invoice) with previous, incomplete records (e.g., a photo).
* **User-Defined Rules:** You can easily add new email processing rules and configure notification preferences directly in Google Sheets.

---

### Part 2: AI Agent 專案交接說明 (For AI Agents)
**[中文]**
* **當前專案狀態:** 穩定版本 V40.4。此版本擴充了對 PDF 繳費單的辨識能力，並修正了權限宣告檔。
* **核心架構:**
    * **智慧分流器 (processImage):** 穩定運作，能準確分派單筆收據與交易列表。
    * **交易列表處理器 (processImageAsTransactionList):** 數據流穩定，能將 OCR 文字存入 `rawText`，交易 JSON 物件存入 `metaData`。
    * **升級版正規化 AI (callGeminiForNormalization Prompt):** Prompt 經過強化，具備明確的幣別判斷與時間戳合併規則。
* **關鍵教訓 (V40.4.1 新增):**
    * **授權失效問題:** 在更新程式碼或新增需要新權限的功能後，時間觸發器可能會因 `Authorization is required` 錯誤而失敗。
    * **解決方案:** 必須通過手動執行一個呼叫所有必要服務（`DriveApp`, `GmailApp`, `SpreadsheetApp`）的臨時函式，來強制觸發 Google 的重新授權流程。

**[English]**
* **Current Project Status:** Stable version V40.4. This version enhances PDF bill recognition and fixes permission declarations.
* **Core Architecture:**
    * **Smart Dispatcher (processImage):** Stable and accurately dispatches single receipts and transaction lists.
    * **Transaction List Processor (processImageAsTransactionList):** Stable data flow, saving OCR text to `rawText` and transaction JSON objects to `metaData`.
    * **Upgraded Normalization AI (callGeminiForNormalization Prompt):** The prompt is enhanced with explicit rules for currency detection and timestamp merging.
* **Key Learnings (New in V40.4.1):**
    * **Authorization Failure Issue:** After updating code or adding features requiring new permissions, time-driven triggers may fail with an `Authorization is required` error.
    * **Solution:** The fix is to manually execute a temporary function that calls all necessary services (`DriveApp`, `GmailApp`, `SpreadsheetApp`) to force Google's re-authorization flow.

---

### Part 3 & 4: (快速入門 / Quick Start, 設定詳解 / Detailed Settings)
*(內容與前一版本相同，此處不再重複。)*

---

### Part 5: 常見問題與解決方案 (FAQ & Troubleshooting) (V40.4.1 新增)

**[中文]**
**Q: 我的郵件/照片自動記帳功能沒有反應，但我收到了標題為 "Summary of failures" 的錯誤報告信，裡面寫著 `Authorization is required to perform that action.`，該怎麼辦？**

**A:** 這是最常見的問題，代表您的腳本沒有獲得在背景執行的權限。請依照以下步驟解決：

1.  **建立臨時函式：** 在您的 Apps Script 專案中，貼上本文檔附錄中的 `forceReAuthorization_v2` 函式。
2.  **執行並授權：** 從編輯器中手動執行 `forceReAuthorization_v2` 函式。在彈出的視窗中，完成完整的授權流程（點擊「審查權限」->「進階」->「前往...」->「允許」）。
3.  **檢查日誌：** 在「執行紀錄」中確認看到成功訊息。
4.  **清理：** 成功後，即可刪除 `forceReAuthorization_v2` 函式。

**[English]**
**Q: My automated email/photo accounting isn't working, and I received a failure report email with the error `Authorization is required to perform that action.`. What should I do?**

**A:** This is the most common issue. It means your script lacks the necessary permissions to run in the background. Follow these steps to fix it:

1.  **Create a Temporary Function:** In your Apps Script project, paste the `forceReAuthorization_v2` function from the appendix of this document.
2.  **Run and Authorize:** Manually run the `forceReAuthorization_v2` function from the editor. Complete the full authorization flow in the pop-up window (Click "Review Permissions" -> "Advanced" -> "Go to..." -> "Allow").
3.  **Check Logs:** Verify you see success messages in the "Executions" log.
4.  **Clean Up:** Once successful, you can delete the temporary `forceReAuthorization_v2` function.

---

### 附錄 (Appendix): 臨時授權函式
```javascript
// 請將此函式用於解決 "Authorization is required" 錯誤
function forceReAuthorization_v2() {
  try {
    Logger.log('開始強制重新授權流程...');
    DriveApp.getRootFolder();
    Logger.log('✅ DriveApp 權限已請求');
    GmailApp.getInboxUnreadCount();
    Logger.log('✅ GmailApp 權限已請求');
    SpreadsheetApp.getActiveSpreadsheet();
    Logger.log('✅ SpreadsheetApp 權限已請求');
    Logger.log('🎉 授權流程已成功觸發！');
  } catch (e) {
    Logger.log('❌ 觸發授權時發生錯誤: ' + e.toString());
  }
}
