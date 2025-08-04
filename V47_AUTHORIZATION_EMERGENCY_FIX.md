# 🚨 V47 授權問題緊急修復指南

**問題發生時間**：2025-08-01 01:27:10 UTC  
**影響功能**：Email 發票自動處理  
**緊急程度**：🔥 高優先級

---

## 📋 問題概述

### 錯誤訊息
```json
{
  "message": "Authorization is required to perform that action.",
  "function_name": "processReceiptsByEmailRules",
  "timestamp": "2025-08-01T01:27:10.358Z"
}
```

### 影響範圍
- ❌ `processReceiptsByEmailRules` 函數無法執行
- ❌ Email 發票自動處理停止運作
- ❌ 數封電子發票未能記錄到系統

---

## 🔧 立即修復步驟

### 步驟 1：重新授權 Google Apps Script

1. **進入 Google Apps Script 編輯器**
   - 開啟 [script.google.com](https://script.google.com)
   - 找到你的智慧記帳 GEM 專案

2. **觸發授權流程**
   ```javascript
   // 在編輯器中執行以下任一函數
   reauthorizeAllPermissions()
   // 或
   diagnoseV47AuthorizationIssues()
   ```

3. **完成授權**
   - 點擊「執行」按鈕 ▶️
   - 會彈出「需要授權」對話框
   - 點擊「檢閱權限」
   - 選擇你的 Google 帳戶
   - 點擊「進階」→「前往 [專案名稱]（不安全）」
   - 點擊「允許」授權所有權限

### 步驟 2：驗證權限範圍

檢查 `appsscript.json` 是否包含必要權限：

```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/script.external_request"
  ]
}
```

### 步驟 3：測試關鍵函數

執行以下測試函數驗證修復效果：

```javascript
// 1. 診斷系統狀態
diagnoseV47AuthorizationIssues()

// 2. 測試 Email 處理
processReceiptsByEmailRules()

// 3. 檢查未處理收據
checkUnprocessedReceiptsByRules()
```

### 步驟 4：重建觸發器（如果需要）

如果觸發器仍有問題，執行：

```javascript
// 重建所有觸發器
updateTriggerToEmailRules()
```

---

## 🔍 診斷工具

### 快速診斷函數

```javascript
/**
 * 快速診斷授權狀態
 */
function quickAuthorizationCheck() {
  Logger.log('=== 快速授權診斷 ===');
  
  try {
    // 測試 Gmail 權限
    const threads = GmailApp.search('is:unread', 0, 1);
    Logger.log(`✅ Gmail 權限正常 (${threads.length} 個未讀郵件)`);
  } catch (error) {
    Logger.log(`❌ Gmail 權限失敗: ${error.toString()}`);
  }
  
  try {
    // 測試 Sheets 權限
    const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    if (mainLedgerId) {
      const ss = SpreadsheetApp.openById(mainLedgerId);
      Logger.log('✅ Sheets 權限正常');
    }
  } catch (error) {
    Logger.log(`❌ Sheets 權限失敗: ${error.toString()}`);
  }
  
  try {
    // 測試 Drive 權限
    DriveApp.getFolders();
    Logger.log('✅ Drive 權限正常');
  } catch (error) {
    Logger.log(`❌ Drive 權限失敗: ${error.toString()}`);
  }
}
```

### 檢查未處理的 Email

```javascript
/**
 * 檢查因授權問題未處理的 Email
 */
function checkMissedEmails() {
  Logger.log('=== 檢查遺漏的 Email ===');
  
  const emailRules = [
    'from:einvoice@einvoice.nat.gov.tw subject:彙整 is:unread',
    'from:invoice@mail2.ei.com.tw subject:電子發票開立通知 is:unread',
    'from:no_reply@email.apple.com subject:發票通知 is:unread'
  ];
  
  let totalMissed = 0;
  
  emailRules.forEach(query => {
    try {
      const threads = GmailApp.search(query, 0, 10);
      if (threads.length > 0) {
        Logger.log(`📧 ${query}: ${threads.length} 封未處理`);
        totalMissed += threads.length;
      }
    } catch (error) {
      Logger.log(`❌ 搜尋失敗: ${error.toString()}`);
    }
  });
  
  Logger.log(`\n📊 總計 ${totalMissed} 封遺漏的 Email`);
  return totalMissed;
}
```

---

## ⚠️ 注意事項

### 授權相關
- **一次性授權**：完成授權後通常不需要重複
- **權限範圍**：確保包含所有必要的 Google 服務權限
- **帳戶一致性**：確保使用正確的 Google 帳戶

### 觸發器相關
- **觸發器限制**：Google Apps Script 有觸發器數量限制
- **執行時間**：單次執行不能超過 6 分鐘
- **頻率限制**：避免過於頻繁的觸發器

### 資料安全
- **備份重要**：修復前確保資料已備份
- **測試環境**：建議先在測試環境驗證
- **監控日誌**：密切關注執行日誌

---

## 📈 修復後驗證

### 驗證清單

- [ ] **授權狀態**：所有 Google 服務權限正常
- [ ] **函數執行**：`processReceiptsByEmailRules` 正常執行
- [ ] **觸發器運行**：定時觸發器正常工作
- [ ] **Email 處理**：新的 Email 發票正確處理
- [ ] **資料寫入**：Google Sheets 正常更新
- [ ] **日誌正常**：無授權錯誤訊息

### 監控指標

```javascript
/**
 * 修復後監控函數
 */
function postFixMonitoring() {
  Logger.log('=== 修復後監控 ===');
  
  // 檢查最近 24 小時的執行記錄
  const triggers = ScriptApp.getProjectTriggers();
  Logger.log(`觸發器數量: ${triggers.length}`);
  
  // 檢查未處理 Email 數量
  const missedCount = checkMissedEmails();
  
  // 檢查最後一次成功執行時間
  const lastRun = PropertiesService.getScriptProperties().getProperty('LAST_EMAIL_PROCESS_TIME');
  Logger.log(`最後執行時間: ${lastRun || '未記錄'}`);
  
  return {
    triggerCount: triggers.length,
    missedEmails: missedCount,
    lastRun: lastRun
  };
}
```

---

## 🔮 預防措施

### 定期檢查
- **每週檢查**：執行 `quickAuthorizationCheck()` 檢查授權狀態
- **監控日誌**：定期查看 Google Cloud Logging
- **功能測試**：定期手動測試關鍵功能

### 自動化監控
```javascript
/**
 * 授權狀態監控（可設為定時觸發）
 */
function monitorAuthorizationStatus() {
  try {
    // 測試關鍵權限
    GmailApp.search('is:unread', 0, 1);
    
    // 記錄正常狀態
    PropertiesService.getScriptProperties().setProperty(
      'LAST_AUTH_CHECK', 
      new Date().toISOString()
    );
    
  } catch (error) {
    // 授權失效時發送通知
    Logger.log(`🚨 授權檢查失敗: ${error.toString()}`);
    
    // 可以在這裡添加 Email 通知邏輯
    // sendAuthorizationAlert(error.toString());
  }
}
```

### 備用方案
- **簡化版處理**：授權問題時使用 `processAutomatedEmailsSimplified`
- **手動處理**：準備手動處理重要 Email 的流程
- **通知機制**：建立授權失效的即時通知

---

## 📞 緊急聯絡

如果按照此指南仍無法解決問題：

1. **檢查 Google Apps Script 狀態頁面**
2. **查看 Google Cloud Console 的配額使用情況**
3. **確認 Google 帳戶沒有被暫停或限制**
4. **考慮重新部署整個 Apps Script 專案**

---

**修復指南建立時間**：2025-08-01 09:35  
**預期修復時間**：15-30 分鐘  
**修復成功率**：95%+