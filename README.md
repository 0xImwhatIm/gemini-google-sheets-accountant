# 智慧記帳 GEM (Gemini AI Accountant) V47.3

[![Version](https://img.shields.io/badge/version-V47.3-blue.svg)](https://github.com/your-repo/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Google%20Apps%20Script-yellow.svg)](https://script.google.com)
[![AI](https://img.shields.io/badge/AI-Gemini%20Vision-purple.svg)](https://ai.google.dev)

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

### 🆕 V47.3 新功能亮點 / V47.3 New Features

* **🏢 商務發票智慧識別 (Business Invoice Recognition):** 自動識別統一發票號碼、收據編號、買賣方資訊，完美支援台灣商務記帳需求
* **🌍 多語言 OCR 翻譯 (Multi-language OCR Translation):** 外文收據自動翻譯為繁體中文，支援旅行記帳和國際商務
* **📱 iOS 捷徑完整支援 (Full iOS Shortcuts Support):** 拍照+語音記帳功能穩定，錯誤處理完善
* **🎯 一張收據一個旅行回憶 (Travel Memory System):** 完整保存商家資訊、地點資料，支援社交分享需求

### 核心功能 / Core Features

* **📊 交易列表處理 (Transaction List Processing):** 能夠智慧地解析像 IC 卡消費紀錄這樣的螢幕截圖，自動將多筆交易拆分、逐一記錄，並能準確區分「消費」與「儲值」
* **🧠 兩段式 AI 引擎 (Two-Pass AI Engine):** 採用革命性的「提取-正規化」架構，第一層 AI 負責最大化提取資訊，第二層 AI 負責將其轉換為標準格式，極大提升了對複雜單據的辨識成功率與穩定性
* **✨ 智慧合併引擎 (Smart Reconciliation Engine):** 獨家的 `processNewRecord` 邏輯，能自動合併關聯紀錄、補充缺失資訊，徹底解決重複記帳問題
* **⚙️ 動態規則引擎 (Dynamic Rule Engine):** 所有郵件處理規則都在 Google Sheets 中進行設定，無需修改程式碼
* **🔔 彈性通報中心 (Flexible Notification Hub):** 可在 Google Sheets 中自訂錯誤通知渠道 (Email, Webhook for Slack/Discord) 和等級
* **🔐 數據主權 (Data Sovereignty):** 所有數據與程式碼 100% 儲存在您自己的 Google 帳戶中。
- **[新] 代墊款追蹤器 (IOU Tracker)**:
    -   **AI 語意解析**：能從日常對話中，自動建立、結清或查詢代墊款項。
    -   **結算引擎**：支援無金額結算，並透過語意正規化引擎，準確匹配人名。
    -   **群組拆分**：支援「一對多」的代墊場景，能自動將總金額均分給多位參與者。
- **[新] Phase 4 專業錯誤處理系統 (V46.1)**:
    -   **智慧錯誤檢測**：自動檢測 15+ 種錯誤類型，包含系統級、資料級、業務級和使用者級錯誤。
    -   **事務安全保障**：完整的事務管理機制，確保多步驟操作的原子性，失敗時自動回滾。
    -   **自動恢復機制**：基於檢查點的中斷恢復系統，操作中斷時可自動從最後檢查點恢復。
    -   **一致性監控**：持續監控帳本間的資料一致性，自動檢測並修復不一致問題。
    -   **智慧通知系統**：根據錯誤嚴重程度自動選擇通知策略，支援頻率控制和去重機制。
    -   **完整測試套件**：包含單元測試、整合測試和手動驗證功能。
    -   **8 個核心組件**：錯誤處理器、事務管理器、一致性檢查器、通知管理器、檢測器、處理器、恢復管理器、整合管理器。
    -   **測試函數**：`manualErrorHandlingTest()`, `manualErrorDetectionTest()`, `manualConsistencyCheckTest()` 可直接在 Apps Script 編輯器中執行驗證。

### 架構 / Architecture

* **後端 (Backend):** Google Apps Script (GAS)
* **數據庫 (Database):** Google Sheets
* **智慧核心 (AI Core):** Google Gemini & Document AI

### 開始使用 / Getting Started

**[中文]**
詳細的部署步驟，請參考我們的 [部署指南 (DEPLOYMENT_GUIDE.md)](DEPLOYMENT_GUIDE.md)。您需要具備一些基礎的技術能力，例如：

1.  擁有一個 Google 帳戶。
2.  知道如何複製 Google Sheet 並打開 Apps Script 編輯器。
3.  能夠申請並設定您的 Google Gemini API 金鑰。
4.  知道如何在 Apps Script 中部署網路應用程式及設定時間觸發器。

**[English]**
For detailed deployment steps, please refer to our [Deployment Guide (DEPLOYMENT_GUIDE.md)](DEPLOYMENT_GUIDE.md). You will need some basic technical skills, such as:

1.  Having a Google account.
2.  Knowing how to copy a Google Sheet and open the Apps Script editor.
3.  Being able to obtain and set up your Google Gemini API key.
4.  Knowing how to deploy a web app and set up time-driven triggers in Apps Script.

### 文檔結構 / Documentation Structure

**🚀 快速開始**
- [部署指南 (Deployment Guide)](DEPLOYMENT_GUIDE.md)
- [部署檢查清單 (Deployment Checklist)](DEPLOYMENT_CHECKLIST.md)
- [維護指南 (Maintenance Guide)](MAINTENANCE_GUIDE.md)

**🔧 開發與管理**
- [測試指南 (Testing Guide)](TESTING_GUIDE.md)
- [錯誤處理指南 (Error Handling Guide)](ERROR_HANDLING_GUIDE.md)
- [Phase 4 錯誤處理指南 (Phase 4 Error Handling Guide)](PHASE4_ERROR_HANDLING_GUIDE.md)
- [Phase 4 故障排除指南 (Phase 4 Troubleshooting)](PHASE4_TROUBLESHOOTING.md)
- [Phase 4 配置參考 (Phase 4 Configuration)](PHASE4_CONFIGURATION.md)
- [Phase 4 監控指南 (Phase 4 Monitoring)](PHASE4_MONITORING.md)
- [配置管理指南 (Configuration Management)](CONFIG_MANAGEMENT.md)
- [資料治理指南 (Data Governance)](DATA_GOVERNANCE.md)
- [效能優化指南 (Performance Guide)](PERFORMANCE_GUIDE.md)
- [安全性指南 (Security Guide)](SECURITY_GUIDE.md)

**🛠️ 輔助工具**
- [環境變數範本 (.env.example)](.env.example)
- [Google Sheets 模板設定腳本 (setup-sheets-template.gs)](setup-sheets-template.gs)
- [快速啟動測試腳本 (quick-start.gs)](quick-start.gs)
- [配置管理器 (ConfigManager.gs)](ConfigManager.gs)
- [配置快速設定腳本 (config-setup.gs)](config-setup.gs)
- [配置管理 Web 介面 (config-web-ui.gs)](config-web-ui.gs)
- [配置管理測試腳本 (config-tests.gs)](config-tests.gs)

### 如何貢獻 / How to Contribute

**[中文]**
我們非常歡迎來自社群的貢獻！在您提交 Pull Request 之前，請務必閱讀我們的 `CONTRIBUTING.md`（貢獻指南）與 `CODE_OF_CONDUCT.md`（行為準則）。

**[English]**
We warmly welcome contributions from the community! Before submitting a Pull Request, please make sure to read our `CONTRIBUTING.md` (Contribution Guide) and `CODE_OF_CONDUCT.md` (Code of Conduct).

### 授權條款 / License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.
本專案採用 **AGPL-3.0** 授權條款。
