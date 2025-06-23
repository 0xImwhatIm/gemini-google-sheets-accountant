智慧記帳 GEM (Gemini AI Accountant)
一個基於 Google Apps Script 和 Gemini 1.5 Flash API 打造的 AI 智慧記帳系統。本專案的核心是全自動化，它能每日自動掃描您的 Gmail，主動將來自財政部的官方電子發票，以及各大廠商（如 Uber, Agoda, PChome）的 PDF 電子收據，在雲端進行 AI 分析、查重後，無感地、準確地記錄到您的 Google Sheets 帳本中。
同時，它也保留了高效率的手動輸入方式，支援語音、拍照、以及從手機相簿選取照片進行記帳。
✨ 主要特色
雙軌全自動化 (Dual-Track Full Automation): 這是本專案的靈魂。
官方發票管道: 每日自動同步財政部的官方電子發票郵件，作為記帳的「絕對真相來源」。
廠商收據管道: 定期自動從 Gmail 中抓取指定廠商（如 Uber, Apple, 中華電信）的 PDF 附件，交由 AI 處理，實現即時記帳與補漏。
多模態視覺 AI 引擎 (Multi-modal Vision AI):
PDF 視覺增強: 我們不再使用傳統的、易出錯的 PDF 文字提取。系統現在讓 AI 直接「看見」PDF 檔案，如同看見圖片一樣，大幅提升了對複雜格式（如 Agoda 行程單、海關稅單）的辨識準確性。
泛用性辨識: AI 指令經過特殊設計，使其不僅限於制式發票，更能應對醫療收據、手寫單據等各式複雜文件。
全文 OCR & 自動翻譯: 能完整記錄收據上的所有原始文字 (Raw Text)，並可自動將外文收據翻譯成繁體中文。
高效率手動輸入: 保留了純語音、純拍照、「照片 + 語音備註」以及從手機相簿選取照片等多種捷徑，滿足各種即時記帳與事後補登的需求。
階級式查重機制 (Hierarchical De-duplication): 為了應對多種數據來源，系統採用了先進的查重邏輯，優先比對「統一發票號碼」，其次比對「參考編號」，最後才使用「日期+金額+原文相似度」進行模糊比對，徹底杜絕重複記帳。
🛠️ 技術棧
後端: Google Apps Script (JavaScript)
前端: Apple iPhone Shortcuts (捷徑)
AI 模型: Google Gemini 1.5 Flash API
資料庫: Google Sheets
自動化核心: GmailApp Service, Time-driven Triggers
🚀 如何設定
請依照以下五個步驟，完成您的個人 AI 記帳系統設定。
步驟一：設定 Google Sheet
建立一個新的 Google Sheet。
在其中建立一個名為 All Records 的工作表分頁。
將這個 Google Sheet 的 ID (網址中 .../d/ 和 /edit 之間的一長串亂碼) 記錄下來。
步驟二：設定 Google Drive 資料夾
在您的 Google Drive 中，建立三個新的資料夾，例如：
Receipts_to_Process (待處理資料夾)
Receipts_Archived (已歸檔資料夾)
Receipts_Duplicates (重複項資料夾)
分別取得這三個資料夾的 ID (同樣在網址中可以找到)。
步驟三：設定 Google Apps Script
打開您在步驟一建立的 Google Sheet，點擊頂部選單的「擴充功能」->「Apps Script」。
將本專案提供的 Code.gs 檔案中的程式碼，完整貼到您的專案指令碼編輯器中。
在程式碼最上方的「使用者設定區」，填入您自己的 SPREADSHEET_ID, GEMINI_API_KEY, 以及三個 FOLDER_ID。
客製化您的廠商列表： 在 VENDOR_QUERIES 這個陣列中，加入或修改您想自動處理的廠商郵件搜尋條件。
點擊「儲存專案」。
點擊右上角的「部署」->「新增部署作業」。
在「選取類型」處選擇「網頁應用程式」。
在「誰可以存取」的下拉選單中，選擇「知道連結的任何人」。
點擊「部署」，並複製產生的「網頁應用程式網址」，我們在下一步會用到。
首次授權： 在編輯器中，手動執行一次 syncInvoicesFromGmail 函式，並依照畫面指示，完成 Gmail 的授權。
步驟四：設定前端 iPhone 捷徑
參考本專案提供的四份捷徑設定說明書，建立您需要的捷徑（語音、拍照、旅行、選取）。
在每一個捷徑的「取得 URL 的內容」動作中，都貼上您在步驟三取得的「網頁應用程式網址」。
步驟五：設定自動化觸發器 (最關鍵的一步)
在 Apps Script 編輯器的左側選單中，點擊「觸發條件」(鬧鐘圖示)。
點擊「+ 新增觸發條件」，並建立三個觸發器：
觸發器 1 (官方發票同步):
要執行的功能選擇：syncInvoicesFromGmail
選取活動來源：時間驅動
類型：日計時器
時間：凌晨 3 點至 4 點
觸發器 2 (廠商收據同步):
要執行的功能選擇：syncPdfsFromGmail
選取活動來源：時間驅動
類型：小時計時器
時間間隔：每小時
觸發器 3 (背景檔案處理):
要執行的功能選擇：checkReceiptsFolder
選取活動來源：時間驅動
類型：分鐘計時器
時間間隔：每 15 分鐘
至此，您的全自動 AI 記帳系統已全部設定完畢！
📄 授權條款
本專案採用 MIT License 授權。

