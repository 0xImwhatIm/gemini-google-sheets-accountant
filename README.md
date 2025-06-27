# 智慧記帳 GEM (Gemini AI Accountant) V38.1

一個由 Google Apps Script 驅動的智慧記帳系統，透過強大的「AI 中央廚房」，能自動將生活中的非結構化資訊（如 PDF 收據、照片、語音、電子郵件）轉化為結構化的記帳資料，並具備智慧合併與資料擴充能力。

## ✨ 功能特色 (Features)

* **多入口記帳**: 支援透過上傳 **圖片**、**PDF**、或 **語音** 文字進行記帳。
* **多帳本支援**: 可透過前端傳遞 `target_sheet_id` 參數，將紀錄寫入不同的 Google Sheet 試算表（例如「主帳本」和「旅行帳本」）。
* **智慧合併與資料擴充**:
    * 系統不再只是單純地新增紀錄。當收到更詳細的新資訊時（如電子郵件），會自動尋找已存在的舊紀錄（如語音紀錄）。
    * 根據**資料來源信任評分**，智慧地合併兩筆紀錄，用更完整的資訊（如商家全名、發票號碼）去**補充**舊紀錄，最終只留下一筆最準確的資料。
* **雙引擎 PDF 解析**:
    * **主引擎**: 整合 **Google Cloud Document AI**，專業處理複雜的商業收據，提取高品質文字。
    * **備用引擎**: 內建多編碼文字解析，確保在任何情況下服務不中斷。
* **AI 教官級辨識**:
    * 採用 **Gemini Pro** 作為核心理解模型。
    * 透過 **範例學習 (Few-Shot Learning)** 和 **思維鏈 (Chain of Thought)** 機制，AI 能夠從真實範例中學習複雜的判斷邏輯，精準處理日期優先級、貨幣格式、相對時間等細節。
* **全自動化郵件處理**:
    * 採用統一的「規則書」`EMAIL_PROCESSING_RULES`，能智慧區分並處理內含 **PDF 附件**、**HTML 附件** 或 **HTML 內文** 的各類電子帳單。
* **高度容錯與穩定性**:
    * 具備完善的錯誤處理與智慧分流機制，能應對無效的 Sheet ID、API 權限問題、無效檔案格式等多種異常，並將問題檔案自動歸檔。

## 🛠️ 技術架構 (Tech Stack)

* **後端**: Google Apps Script (V8 Runtime)
* **核心 AI**:
    * Google Gemini API
    * Google Cloud Document AI API
* **資料庫**: Google Sheets

## 🚀 設定與部署 (Setup & Deployment)

請依照以下步驟完成專案的設定與部署：

1.  **填寫基本設定**:
    * 在 `程式碼.gs` 檔案的【使用者設定區】中，填入您的：
        * `MAIN_LEDGER_ID`: 您的**主帳本** Google Sheet ID。
        * `GEMINI_API_KEY`: 您的 Gemini API 金鑰。
        * `FOLDER_ID...`: 相關的 Google Drive 資料夾 ID。

2.  **設定 Google Cloud (啟用主引擎 - 推薦)**:
    * **連結專案**: 在 Apps Script 編輯器的「專案設定」中，將此腳本連結到一個 Google Cloud Platform (GCP) 專案。
    * **啟用 API**: 在該 GCP 專案中，啟用 **Document AI API**。
    * **建立處理器**: 在 Document AI 工作台中，建立一個「Receipt Parser」或「Invoice Parser」處理器。
    * **啟用結算**: 確保您的 GCP 專案已**啟用結算功能** (綁定付款方式)。Document AI 有免費額度，但此為使用進階服務的必要步驟。

3.  **填寫 GCP 設定**:
    * 回到 `程式碼.gs`，填入您剛剛取得的：
        * `GCP_PROJECT_ID`: 您的 GCP 專案 ID。
        * `DOCUMENT_AI_PROCESSOR_ID`: 您的 Document AI 處理器 ID。

4.  **更新授權範圍**:
    * 在 Apps Script 編輯器的「專案設定」中，勾選「在編輯器中顯示 `appsscript.json` Manifest 檔案」。
    * 點開 `appsscript.json` 檔案，確保 `oauthScopes` 陣列中包含以下這行：
        ```json
        "[https://www.googleapis.com/auth/cloud-platform](https://www.googleapis.com/auth/cloud-platform)"
        ```

5.  **部署與授權**:
    * 點擊右上角的「部署」>「**新增部署作業**」。
    * 類型選擇「**網頁應用程式**」，並設定相關存取權限（通常為「**任何人都可，甚至是匿名使用者**」）。
    * 點擊「部署」後，複製產生的 Web App URL，用於您的前端應用（如 iOS 捷徑）。
    * **重要**: 在修改程式碼或 `appsscript.json` 後，您需要透過「**管理部署作業**」>「**編輯**」>「**版本：新版本**」來發布一個新的版本，以確保變更生效。

## 📝 產品藍圖 (Roadmap)

* **近期目標**:
    * **日本壓力測試**: 驗證系統在真實海外旅行場景下的表現。
    * **代墊款追蹤器**: 開發新功能，用於記錄人際間的借貸。
* **遠期目標**:
    * **架構遷移**: 將後端遷移至 Firebase Cloud Functions。
    * **App 開發**: 開發跨平台 App (React Native / Flutter)。
    * **產品線擴展**: 推出「差旅報帳」與「家庭理財」產品線。

