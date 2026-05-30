# 設計文件

## 概述

本設計文件描述了 V50.1.1 配置修正版的技術實作方案。主要目標是修正 V50.1.0 中發現的嚴重配置錯誤，確保 Google Drive 資料夾 ID 配置正確運作，同時提升系統安全性並統一版本號。

## 架構

### 系統架構概覽

```
智慧記帳 GEM V50.1.1
├── CONFIG 物件 (修正後)
│   ├── 正確的屬性讀取方式
│   ├── 移除硬式編碼備用值
│   └── 增強的驗證機制
├── Google Drive 整合
│   ├── 圖片存檔功能
│   ├── 檔案歸檔處理
│   └── 重複檔案管理
├── Bot 整合功能 (保留)
│   ├── Telegram Bot 支援
│   ├── 狀態管理
│   └── AI 處理邏輯
└── 現有功能 (完整保留)
    ├── 語音記帳
    ├── 圖片記帳
    ├── PDF 處理
    └── 電子郵件自動化
```

### 修正重點

1. **配置讀取修正**：將錯誤的 `getProperty('資料夾ID值')` 修正為 `getProperty('屬性名稱')`
2. **安全性強化**：移除所有硬式編碼的 ID 和 Token
3. **版本統一**：所有檔案版本號統一為 V50.1.1
4. **功能保留**：完整保留 V50.1.0 的所有 Bot 整合功能

## 元件和介面

### CONFIG 物件重新設計

#### 修正前 (V50.1.0 錯誤版本)
```javascript
// 錯誤的寫法 - 將資料夾 ID 值當作屬性名稱
FOLDER_ID_TO_PROCESS: PropertiesService.getScriptProperties().getProperty('1oRT8W9kzi6j1OBy27ybAZWOlGX1232lp') || '',
FOLDER_ID_ARCHIVE: PropertiesService.getScriptProperties().getProperty('1rdoKVgACLAR5fQ90ucLedCOyvNr4thqz') || '',
FOLDER_ID_DUPLICATES: PropertiesService.getScriptProperties().getProperty('1LTP2IRZto77bxTs8xLUwfpGY3B32S0Nu') || '',
```

#### 修正後 (V50.1.1 正確版本)
```javascript
// 正確的寫法 - 使用屬性名稱讀取屬性值
FOLDER_ID_TO_PROCESS: PropertiesService.getScriptProperties().getProperty('FOLDER_ID_TO_PROCESS'),
FOLDER_ID_ARCHIVE: PropertiesService.getScriptProperties().getProperty('FOLDER_ID_ARCHIVE'),
FOLDER_ID_DUPLICATES: PropertiesService.getScriptProperties().getProperty('FOLDER_ID_DUPLICATES'),
```

### 安全性強化設計

#### 移除硬式編碼備用值
```javascript
// V50.1.1 修正：移除硬式編碼，完全依賴指令碼屬性
MAIN_LEDGER_ID: PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID') || 'YOUR_GOOGLE_SHEET_ID_HERE',
GEMINI_API_KEY: PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || 'YOUR_GEMINI_API_KEY_HERE',
TELEGRAM_BOT_TOKEN: PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN') || 'YOUR_TELEGRAM_BOT_TOKEN_HERE',
```

#### 增強的驗證機制
```javascript
validate() {
  const errors = [];
  if (!this.MAIN_LEDGER_ID || this.MAIN_LEDGER_ID === 'YOUR_GOOGLE_SHEET_ID_HERE') { 
    errors.push('MAIN_LEDGER_ID 未設定'); 
  }
  if (!this.GEMINI_API_KEY || this.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') { 
    errors.push('GEMINI_API_KEY 未設定'); 
  }
  if (!this.TELEGRAM_BOT_TOKEN || this.TELEGRAM_BOT_TOKEN === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
    errors.push('TELEGRAM_BOT_TOKEN 未設定');
  }
  return errors;
},

validateForImageSaving() {
  if (!this.FOLDER_ID_ARCHIVE) {
    return 'FOLDER_ID_ARCHIVE 未在指令碼屬性中設定，無法存檔圖片。';
  }
  return null;
}
```

### 版本資訊統一

#### 檔案標頭更新
```javascript
// =================================================================================================
// 智慧記帳 GEM - Google Apps Script (V50.1.1 - 配置修正版)
// =================================================================================================
// 版本：V50.1.1
// 更新日期：2025-10-14
// 主要更新：修正 V50.1.0 中 CONFIG 物件讀取指令碼屬性的嚴重錯誤。
// 1. 【配置修正】修正 getProperty() 函數，使其使用正確的屬性名稱 (Key) 而非屬性值 (Value)。
// 2. 【安全強化】移除 CONFIG 物件中所有硬式編碼的 ID 和 Token 作為備用值。
// 3. 【版本校準】統一所有版本號為 V50.1.1。
// 4. 【功能保留】完整保留 V50.1.0 的所有 Bot 整合功能。
// =================================================================================================
```

## 資料模型

### 指令碼屬性配置模型

```javascript
// 必要的指令碼屬性設定
const REQUIRED_PROPERTIES = {
  'MAIN_LEDGER_ID': '主要試算表 ID',
  'GEMINI_API_KEY': 'Gemini AI API 金鑰',
  'TELEGRAM_BOT_TOKEN': 'Telegram Bot Token',
  'FOLDER_ID_TO_PROCESS': '待處理檔案資料夾 ID',
  'FOLDER_ID_ARCHIVE': '歸檔資料夾 ID',
  'FOLDER_ID_DUPLICATES': '重複檔案資料夾 ID'
};
```

### 配置驗證流程

```mermaid
flowchart TD
    A[系統啟動] --> B[載入 CONFIG 物件]
    B --> C[執行 validate()]
    C --> D{所有必要屬性都已設定?}
    D -->|是| E[✅ 配置檢查通過]
    D -->|否| F[❌ 記錄配置警告]
    F --> G[繼續執行但功能受限]
    E --> H[正常執行所有功能]
    
    H --> I[圖片存檔需求]
    I --> J[執行 validateForImageSaving()]
    J --> K{FOLDER_ID_ARCHIVE 已設定?}
    K -->|是| L[✅ 允許圖片存檔]
    K -->|否| M[❌ 禁止圖片存檔]
```

## 錯誤處理

### 配置錯誤處理策略

1. **啟動時檢查**
   - 系統啟動時自動執行配置驗證
   - 記錄所有配置錯誤到 Logger
   - 提供清楚的錯誤訊息指導使用者

2. **運行時檢查**
   - 每個 API 呼叫前都會執行 `safeExecute()` 包裝
   - 自動檢查相關配置是否正確
   - 提供具體的錯誤回應

3. **功能特定檢查**
   - 圖片存檔前檢查 `FOLDER_ID_ARCHIVE`
   - Bot 功能前檢查 `TELEGRAM_BOT_TOKEN`
   - AI 處理前檢查 `GEMINI_API_KEY`

### 錯誤回應格式

```javascript
// 標準錯誤回應格式
{
  "status": "error",
  "message": "具體錯誤訊息",
  "timestamp": "2025-10-14T10:30:00.000Z",
  "context": {
    "name": "函數名稱",
    "operation": "操作類型"
  }
}
```

## 測試策略

### 單元測試重點

1. **配置讀取測試**
   - 驗證 `getProperty()` 使用正確的屬性名稱
   - 測試各種配置情境（已設定、未設定、錯誤值）
   - 確認驗證函數正確運作

2. **Google Drive 整合測試**
   - 測試圖片存檔功能
   - 驗證資料夾存取權限
   - 確認檔案命名和存檔邏輯

3. **向下相容性測試**
   - 確認所有 V50.1.0 功能正常運作
   - 測試 Bot 整合功能
   - 驗證 AI 處理邏輯

### 整合測試計劃

1. **端到端測試**
   - 完整的記帳流程測試
   - Bot 互動測試
   - 圖片處理和存檔測試

2. **配置情境測試**
   - 正確配置情境
   - 部分配置缺失情境
   - 完全未配置情境

3. **錯誤恢復測試**
   - 網路錯誤處理
   - API 限制處理
   - 權限錯誤處理

## 部署考量

### 部署前檢查清單

1. **配置準備**
   - 確認所有指令碼屬性已正確設定
   - 驗證 Google Drive 資料夾權限
   - 測試 API 金鑰有效性

2. **版本更新**
   - 備份現有程式碼
   - 更新所有檔案版本號
   - 確認註解和文件一致性

3. **功能驗證**
   - 執行完整測試套件
   - 驗證關鍵功能正常運作
   - 確認錯誤處理機制

### 回滾計劃

如果 V50.1.1 部署後發現問題：

1. **立即回滾**
   - 恢復 V50.1.0 程式碼（但修正配置錯誤）
   - 保留指令碼屬性設定
   - 通知使用者暫時性問題

2. **問題診斷**
   - 檢查 Logger 記錄
   - 分析錯誤模式
   - 識別根本原因

3. **修正和重新部署**
   - 修正識別的問題
   - 重新測試
   - 謹慎重新部署