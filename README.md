# 智慧記帳 GEM (Gemini AI Accountant)

一個由 Google Apps Script 驅動的智慧記帳系統，透過強大的 AI 中央廚房，能自動將生活中的非結構化資訊（如 PDF 收據、照片、語音）轉化為結構化的記帳資料。

## ✨ 功能特色 (Features)

* **多入口記帳**: 支援透過上傳 **圖片**、**PDF**、或 **語音** 文字進行記帳。
* **雙引擎 PDF 解析**:
    * **主引擎**: 整合 **Google Cloud Document AI**，專業處理複雜的商業收據，提取高品質文字。
    * **備用引擎**: 內建多編碼文字解析，確保在任何情況下服務不中斷。
* **AI 教官級辨識**:
    * 採用 **Gemini Pro** 作為核心理解模型。
    * 透過 **範例學習 (Few-Shot Learning)** 機制，AI 能夠從真實範例中學習，精準判斷日期優先級、處理特定貨幣金額、並進行準確分類。
* **全自動化管道**:
    * 可自動監控 Gmail，抓取指定郵件中的 PDF 附件（如 Uber, Agoda, PChome）並進行處理。
    * 可自動處理財政部電子發票郵件。
* **高度穩定性**: 具備完善的錯誤處理與智慧分流機制，能應對無效檔案、API 錯誤、權限問題等多種狀況。

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
        * `MAIN_LEDGER_ID`: 您的 Google Sheet ID。
        * `GEMINI_API_KEY`: 您的 Gemini API 金鑰。
        * `FOLDER_ID...`: 相關的 Google Drive 資料夾 ID。

2.  **設定 Google Cloud (啟用主引擎)**:
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
    * 點擊右上角的「部署」>「新增部署作業」。
    * 類型選擇「網頁應用程式」，並設定相關存取權限。
    * 點擊「部署」後，複製產生的 Web App URL。
    * 執行一次需要新權限的操作（如上傳 PDF），並在跳出的視窗中**同意**所有權限請求。

## 📝 產品藍圖 (Roadmap)

* **近期目標**:
    * 實作「代墊款追蹤器」功能。
    * 建立「旅行回憶」帳本原型。
* **遠期目標**:
    * 遷移後端至 Firebase Cloud Functions。
    * 開發跨平台 App (React Native / Flutter)。
    * 推出「差旅報帳」與「家庭理財」產品線。


