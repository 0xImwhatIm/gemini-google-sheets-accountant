# 智慧記帳 GEM (Gemini AI Accountant) V49.4.1

[![Version](https://img.shields.io/badge/version-V49.4.1-brightgreen.svg)](https://github.com/your-repo/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Google%20Apps%20Script-yellow.svg)](https://script.google.com)
[![AI](https://img.shields.io/badge/AI-Gemini%20Flash%20Latest-purple.svg)](https://ai.google.dev)
[![Status](https://img.shields.io/badge/status-Production%20Ready-success.svg)](V49.4.1_FINAL_SUMMARY.md)

**[中文]**
一個可自託管的、由 AI 驅動的個人生活數據自動化框架。

**[English]**
An AI-driven, self-hostable framework for personal life-data automation.

---

## 🎉 V49.4.1 最新版本 - 生產級穩定版

> **✅ 完全可用** | **🧪 100% 測試覆蓋** | **🚀 立即部署**

### 🆕 V49.4.1 重大更新

* **🔥 Gemini Flash Latest**: 使用最新的 `gemini-flash-latest` 模型，性能更強、速度更快
* **🎯 原生 JSON 支援**: 完整的 `responseMimeType: "application/json"` 支援，解析更準確
* **🛡️ 完善錯誤處理**: 智能容錯機制，包含 `safeExecute` 和 `extractJsonFromText`
* **🧪 完整測試套件**: 包含 API 連接測試、模型測試、功能測試
* **⚡ 生產級穩定**: 所有功能都經過完整測試並確認可用

### 這是什麼？ / What is this?

**[中文]**
這不是一個傳統的記帳 App。這是一個強大的後端引擎，您可以將其部署在您自己的 Google 帳戶中。它能接收來自各種來源（照片、語音、PDF、Email）的非結構化數據，利用 Google Gemini AI 將其轉化為結構化的財務或生活紀錄，並儲存在您的 Google Sheet 中。

**[English]**
This is not a traditional accounting app. It's a powerful backend engine that you deploy in your own Google Account. It's designed to receive unstructured data from various sources (photos, voice, PDFs, emails), process it using Google Gemini AI into structured financial or life records, and save it to your Google Sheet.

## 🌟 核心功能 / Core Features

### 🎤 **語音記帳 (Voice Recording)**
- 自然語言處理，支援中文語音輸入
- 自動識別日期、金額、商家、類別
- 智能時區處理和相對日期計算

### 📸 **圖片記帳 (Image Processing)**
- 收據、發票自動 OCR 識別
- 自動存檔到 Google Drive 並回填連結
- 支援多種圖片格式和複雜版面

### 📧 **郵件自動處理 (Email Automation)**
- 支援 CSV、HTML、PDF 三種格式
- 財政部電子發票 CSV 特殊處理（使用 `|` 分隔符）
- 動態規則引擎，在 Google Sheets 中設定處理規則

### 📄 **PDF 處理 (PDF Processing)**
- 自動解析 PDF 帳單和收據
- 支援複雜版面和多頁文件
- 智能提取交易資訊

### 💰 **IOU 代墊款 (IOU Tracking)**
- AI 語意解析日常對話
- 自動群組分帳和債務追蹤
- 支援等額分攤和自定義金額

### 🔧 **進階功能**
- **多幣別支援**: TWD、USD、JPY、EUR、CNY
- **自動匯率轉換**: 即時匯率計算
- **iOS 捷徑整合**: 完整的捷徑模板
- **錯誤處理系統**: 15+ 種錯誤類型檢測
- **數據主權**: 100% 儲存在您的 Google 帳戶

## 🚀 快速開始

### 1. 部署到 Google Apps Script

```bash
# 1. 複製 Code.gs 到 Google Apps Script
# 2. 設定指令碼屬性
MAIN_LEDGER_ID=你的Google試算表ID
GEMINI_API_KEY=你的Gemini API金鑰
FOLDER_ID_ARCHIVE=圖片存檔資料夾ID
```

### 2. 設定 Google Sheets

建立包含以下工作表的 Google 試算表：
- `All Records` - 主要記帳資料
- `EmailRules` - 郵件處理規則
- `Events` - IOU 事件記錄
- `Debts` - 債務追蹤

### 3. 部署 Web App

1. 在 Google Apps Script 中點選「部署」
2. 選擇「新增部署作業」
3. 類型選擇「網頁應用程式」
4. 執行身分選擇「我」
5. 存取權限選擇「任何人」

### 4. 測試系統

```javascript
// 執行完整系統測試
finalSystemTest()

// 檢查系統健康
checkSystemHealth()

// 測試 API 連接
testGeminiConnection()
```

## 📱 iOS 捷徑整合

### 可用端點

```
GET  /exec?action=version          # 版本檢查
POST /exec?endpoint=voice          # 語音記帳
POST /exec?endpoint=image          # 圖片記帳
POST /exec?endpoint=pdf            # PDF 處理
POST /exec?endpoint=iou            # IOU 代墊款
GET  /exec?action=processEmails    # 郵件處理
```

### 捷徑模板

參考 `iOS_SHORTCUTS_TEMPLATES.md` 獲取完整的捷徑設定指南。

## 🧪 測試與診斷

### 內建測試函數

- `finalSystemTest()` - 完整系統測試
- `testGeminiConnection()` - API 連接測試
- `listAvailableModels()` - 列出可用模型
- `checkSystemHealth()` - 系統健康檢查

### 測試結果範例

```
✅ 語音記帳測試成功
✅ 郵件處理測試成功  
✅ IOU 功能測試成功
✅ 系統配置正常
✅ 版本: V49.4.1
```

## 📚 文檔

- [部署指南](DEPLOYMENT_GUIDE.md) - 完整部署步驟
- [使用手冊](USER_MANUAL_V46.1_UPDATE.md) - 功能使用說明
- [iOS 捷徑設定](iOS_SHORTCUTS_SETUP_GUIDE.md) - 捷徑整合指南
- [錯誤排除](錯誤排除指南.md) - 常見問題解決
- [安全指南](SECURITY_GUIDE.md) - 安全設定建議

## 🔧 技術規格

### Gemini AI 整合
- **模型**: `gemini-flash-latest`
- **API 版本**: `v1beta`
- **JSON 支援**: ✅ 原生支援
- **多模態**: ✅ 文字、圖片、PDF

### Google 服務整合
- **Apps Script**: 主要執行環境
- **Sheets**: 資料儲存和規則管理
- **Drive**: 圖片和文件存檔
- **Gmail**: 自動郵件處理

### 支援格式
- **圖片**: JPG, PNG, GIF, WebP
- **文件**: PDF, CSV
- **語音**: 透過 iOS 捷徑轉文字
- **郵件**: HTML, 純文字, 附件

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

1. Fork 此專案
2. 建立功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交變更 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟 Pull Request

## 📄 授權

此專案採用 MIT 授權 - 詳見 [LICENSE](LICENSE) 文件。

## 🙏 致謝

- [Google Gemini AI](https://ai.google.dev) - 強大的 AI 能力
- [Google Apps Script](https://script.google.com) - 雲端執行環境
- [Google Workspace](https://workspace.google.com) - 完整的辦公套件

---

**🎉 V49.4.1 - 生產級穩定版，立即可用！**