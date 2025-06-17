智慧記帳 GEM (Gemini AI Accountant)一個基於 Google Apps Script 和 Gemini API 打造的 AI 智慧記帳系統。
使用者可以透過 iPhone 捷徑，用拍照或語音的方式，快速、智慧地將消費記錄存入 Google Sheets。

✨ 主要特色多模式輸入: 支援純語音、純拍照、以及「照片 + 語音備註」的混合模式。
AI 智慧解析: 使用 Google Gemini 1.5 Flash 模型，能從複雜的收據圖片與口語化的描述中，自動提取結構化資訊（如金額、商家、類別、發票號碼等）。
即時匯率換算: 自動偵測外幣消費，並透過 API 獲取即時匯率，換算為台幣金額。強健的查重機制: 除了比對發票號碼，還能根據「日期、金額、OCR 原文相似度」來防止重複記帳。高度客製化: 可在 AI 指令中，輕鬆加入個人化的判斷規則（例如，將特定費用自動歸類為工作開銷）。

🛠️ 技術棧後端: Google Apps Script (JavaScript)

前端: Apple iPhone Shortcuts (捷徑)
AI 模型: Google Gemini API (gemini-1.5-flash-latest)
資料庫: Google Sheets🚀 

如何設定Google Sheet: 建立一個新的 Google Sheet，並在其中建立一個名為 All Records 的工作表分頁。

Google Apps Script:將 Code.gs 中的程式碼，完整貼到您的 Google Sheet 專案指令碼編輯器中。在程式碼最上方的「使用者設定區」，填入您自己的 SPREADSHEET_ID, GEMINI_API_KEY, 以及三個 Google Drive 資料夾的 ID。部署您的專案為「網頁應用程式」，並取得唯一的 URL。

iPhone 捷徑:參考相關教學文件，設定您的 iPhone 捷徑。將您在步驟 2 中取得的 URL，貼到捷徑的「取得 URL 的內容」動作中。Google Apps Script 觸發器:為 checkReceiptsFolder 函式，設定一個時間驅動的觸發器（例如，每 15 分鐘），以自動處理上傳的收據。

授權條款本專案採用 MIT License 授權。