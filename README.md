# 智慧記帳 GEM (Gemini AI Accountant)

**[中文]**
一個可自託管的、由 AI 驅動的個人生活數據自動化框架。

**[English]**
An AI-driven, self-hostable framework for personal life-data automation.

---

### 這是什麼？ / What is this?

**[中文]**
這不是一個傳統的記帳 App。這是一個強大的後端引擎，您可以將其部署在您自己的 Google 帳戶中。它能接收來自各種來源（照片、語音、PDF、Email）的非結構化數據，利用 Google Gemini AI 將其轉化為結構化的財務或生活紀錄，並儲存在您的 Google Sheet 中。

**[English]**
This is not a traditional accounting app. It's a powerful backend engine that you deploy in your own Google Account. It's designed to receive unstructured data from various sources (photos, voice, PDFs, emails), process it using Google Gemini AI into structured financial or life records, and save it to your Google Sheet.

### 核心功能 / Core Features

* **🧠 兩段式 AI 引擎 (Two-Pass AI Engine):** 採用革命性的「提取-正規化」架構，第一層 AI 負責最大化提取資訊，第二層 AI 負責將其轉換為標準格式，極大提升了對複雜單據的辨識成功率與穩定性。
* **✨ 智慧合併引擎 (Smart Reconciliation Engine):** 獨家的 `processNewRecord` 邏輯，能自動合併關聯紀錄、補充缺失資訊，徹底解決重複記帳問題。
* **⚙️ 動態規則引擎 (Dynamic Rule Engine):** 所有郵件處理規則都在 Google Sheets 中進行設定，無需修改程式碼。
* **🔔 彈性通報中心 (Flexible Notification Hub):** 可在 Google Sheets 中自訂錯誤通知渠道 (Email, Webhook for Slack/Discord) 和等級。
* **🔐 數據主權 (Data Sovereignty):** 所有數據與程式碼 100% 儲存在您自己的 Google 帳戶中。

### 架構 / Architecture

* **後端 (Backend):** Google Apps Script (GAS)
* **數據庫 (Database):** Google Sheets
* **智慧核心 (AI Core):** Google Gemini & Document AI

### 開始使用 / Getting Started

**[中文]**
詳細的部署步驟，請參考我們的 `DEPLOYMENT_GUIDE.md`（即將推出）。您需要具備一些基礎的技術能力，例如：

1.  擁有一個 Google 帳戶。
2.  知道如何複製 Google Sheet 並打開 Apps Script 編輯器。
3.  能夠申請並設定您的 Google Gemini API 金鑰。
4.  知道如何在 Apps Script 中部署網路應用程式及設定時間觸發器。

**[English]**
For detailed deployment steps, please refer to our `DEPLOYMENT_GUIDE.md` (coming soon). You will need some basic technical skills, such as:

1.  Having a Google account.
2.  Knowing how to copy a Google Sheet and open the Apps Script editor.
3.  Being able to obtain and set up your Google Gemini API key.
4.  Knowing how to deploy a web app and set up time-driven triggers in Apps Script.

### 如何貢獻 / How to Contribute

**[中文]**
我們非常歡迎來自社群的貢獻！在您提交 Pull Request 之前，請務必閱讀我們的 `CONTRIBUTING.md`（貢獻指南）與 `CODE_OF_CONDUCT.md`（行為準則）。

**[English]**
We warmly welcome contributions from the community! Before submitting a Pull Request, please make sure to read our `CONTRIBUTING.md` (Contribution Guide) and `CODE_OF_CONDUCT.md` (Code of Conduct).

### 授權條款 / License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.
本專案採用 **AGPL-3.0** 授權條款。
