# 智慧記帳 GEM V50.1.1 - 配置修正版 發布說明

## 版本資訊
- **版本號**: V50.1.1
- **發布日期**: 2025-10-14
- **版本類型**: 緊急修正版本

## 概述

V50.1.1 是針對 V50.1.0 中發現的嚴重配置錯誤的緊急修正版本。此版本修正了 Google Drive 資料夾 ID 配置問題，確保所有檔案操作功能正常運作，同時提升了系統安全性。

## 🔧 主要修正

### 1. 配置讀取錯誤修正
- **問題**: V50.1.0 中 CONFIG 物件錯誤地將資料夾 ID 值當作屬性名稱使用
- **修正**: 更正 `getProperty()` 函數調用，使用正確的屬性名稱
- **影響**: 修正後 Google Drive 圖片存檔、檔案歸檔等功能恢復正常

**修正前 (錯誤)**:
```javascript
FOLDER_ID_ARCHIVE: PropertiesService.getScriptProperties().getProperty('1rdoKVgACLAR5fQ90ucLedCOyvNr4thqz') || '',
```

**修正後 (正確)**:
```javascript
FOLDER_ID_ARCHIVE: PropertiesService.getScriptProperties().getProperty('FOLDER_ID_ARCHIVE'),
```

### 2. 安全性強化
- 移除 CONFIG 物件中所有硬式編碼的 ID 和 Token 作為備用值
- 系統完全依賴指令碼屬性中的設定
- 增強配置驗證機制，加入 TELEGRAM_BOT_TOKEN 檢查

### 3. 版本號統一校準
- 統一所有檔案標頭版本號為 V50.1.1
- 更新所有日誌訊息中的版本標識
- 修正 API 回應中的版本資訊

## ✅ 功能保留

### 完整保留 V50.1.0 所有功能
- **Telegram Bot 整合**: 完整的聊天機器人記帳體驗
- **狀態管理**: 用戶對話狀態管理和多輪互動
- **AI 處理**: Gemini AI 完整整合
- **多媒體支援**: 圖片、語音、文字記帳
- **自動化處理**: 電子郵件自動記帳
- **IOU 功能**: 群組分帳和結算

### 向下相容性
- 完整保留 V49.5.1 的所有功能和修復
- 所有現有 API 端點繼續正常運作
- 現有配置和資料完全相容

## 🚨 重要升級說明

### 必要的配置檢查
升級到 V50.1.1 後，請確認以下指令碼屬性已正確設定：

1. **必要屬性**:
   - `MAIN_LEDGER_ID`: 主要試算表 ID
   - `GEMINI_API_KEY`: Gemini AI API 金鑰
   - `TELEGRAM_BOT_TOKEN`: Telegram Bot Token

2. **Google Drive 相關屬性** (如需使用圖片存檔功能):
   - `FOLDER_ID_TO_PROCESS`: 待處理檔案資料夾 ID
   - `FOLDER_ID_ARCHIVE`: 歸檔資料夾 ID
   - `FOLDER_ID_DUPLICATES`: 重複檔案資料夾 ID

### 配置驗證
系統啟動時會自動檢查配置：
- ✅ 配置正確: 顯示 "V50.1.1 配置檢查通過"
- ⚠️ 配置缺失: 顯示具體的缺失項目

## 🔍 技術細節

### 修正的檔案
- `Code.gs`: 主程式檔案，修正 CONFIG 物件和版本資訊

### 新增的驗證機制
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
}
```

## 📋 升級檢查清單

### 升級前
- [ ] 備份現有程式碼
- [ ] 記錄當前指令碼屬性設定
- [ ] 確認 Google Drive 資料夾權限

### 升級後
- [ ] 檢查系統日誌確認配置正確
- [ ] 測試圖片上傳和存檔功能
- [ ] 驗證 Bot 功能正常運作
- [ ] 確認 API 版本回應為 V50.1.1

### 測試建議
1. **圖片記帳測試**: 上傳收據圖片，確認能正常存檔到 Google Drive
2. **Bot 互動測試**: 發送 `/start` 指令確認 Bot 回應正常
3. **配置檢查**: 查看執行日誌確認無配置警告

## 🐛 已知問題

無已知問題。此版本專注於修正配置錯誤，所有功能經過驗證。

## 📞 支援

如遇到升級問題：
1. 檢查指令碼屬性是否正確設定
2. 查看執行日誌中的錯誤訊息
3. 確認 Google Drive 資料夾權限

## 📈 下一版本預告

V50.2.0 計劃功能：
- 增強的錯誤處理機制
- 更多 Bot 互動功能
- 效能優化改進

---

**重要提醒**: 此版本修正了影響 Google Drive 功能的嚴重錯誤，建議立即升級。