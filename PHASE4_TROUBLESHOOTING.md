# Phase 4 錯誤處理框架故障排除指南

## 概述

本指南提供 Phase 4 錯誤處理框架的常見問題診斷和解決方案。當您遇到錯誤處理相關問題時，請按照本指南進行排查。

---

## 🚨 緊急故障排除

### 系統完全無回應
**症狀：** 錯誤處理框架完全停止工作，沒有任何錯誤日誌

**立即行動：**
1. 檢查 Google Apps Script 執行時間限制
2. 查看 Apps Script 執行記錄是否有超時錯誤
3. 執行基本測試：`manualErrorHandlingTest()`

**解決步驟：**
```javascript
// 1. 檢查系統狀態
function checkSystemHealth() {
  try {
    Logger.log('Phase4ErrorHandler 狀態:', typeof phase4ErrorHandler);
    Logger.log('Phase4Integration 狀態:', typeof phase4Integration);
    return true;
  } catch (error) {
    Logger.log('系統檢查失敗:', error.toString());
    return false;
  }
}

// 2. 重新初始化系統
function reinitializePhase4System() {
  try {
    // 清理現有實例
    delete globalThis.phase4ErrorHandler;
    delete globalThis.phase4Integration;
    
    // 重新建立實例
    globalThis.phase4ErrorHandler = new Phase4ErrorHandler();
    globalThis.phase4Integration = new Phase4ErrorHandlingIntegration();
    
    Logger.log('系統重新初始化完成');
    return true;
  } catch (error) {
    Logger.log('重新初始化失敗:', error.toString());
    return false;
  }
}
```

---

## 🔍 常見問題診斷

### 1. 錯誤檢測不工作

**症狀：** 明顯的錯誤沒有被檢測到

**診斷步驟：**
```javascript
// 測試錯誤檢測功能
function diagnoseErrorDetection() {
  const testError = new Error('測試錯誤');
  
  try {
    const result = phase4ErrorHandler.classifyError(testError);
    Logger.log('錯誤分類結果:', result);
    
    if (!result) {
      Logger.log('❌ 錯誤分類功能異常');
      return false;
    }
    
    Logger.log('✅ 錯誤檢測功能正常');
    return true;
  } catch (error) {
    Logger.log('❌ 錯誤檢測診斷失敗:', error.toString());
    return false;
  }
}
```

**可能原因和解決方案：**
- **原因 1：** 錯誤類型不在預定義列表中
  - **解決：** 檢查 `PHASE4_ERROR_TYPES` 常數定義
  - **修復：** 添加新的錯誤類型或調整分類邏輯

- **原因 2：** 錯誤訊息格式不符合預期
  - **解決：** 檢查 `classifyError` 方法的匹配邏輯
  - **修復：** 更新關鍵字匹配規則

### 2. 事務回滾失敗

**症狀：** 錯誤發生後資料沒有正確回滾

**診斷步驟：**
```javascript
// 測試事務管理功能
function diagnoseTransactionManagement() {
  const transactionManager = new Phase4TransactionManager();
  
  try {
    // 開始測試事務
    const transactionId = transactionManager.beginTransaction('TEST_TRANSACTION');
    Logger.log('事務開始:', transactionId);
    
    // 檢查事務狀態
    const activeTransactions = transactionManager.getActiveTransactions();
    Logger.log('活動事務數量:', activeTransactions.length);
    
    // 測試回滾
    const rollbackResult = transactionManager.rollbackTransaction(transactionId);
    Logger.log('回滾結果:', rollbackResult);
    
    return rollbackResult.success;
  } catch (error) {
    Logger.log('❌ 事務管理診斷失敗:', error.toString());
    return false;
  }
}
```

**可能原因和解決方案：**
- **原因 1：** 快照資料不完整
  - **解決：** 檢查 `createSnapshot` 方法
  - **修復：** 確保所有相關資料都被正確快照

- **原因 2：** 工作表結構變化
  - **解決：** 驗證工作表欄位結構
  - **修復：** 更新快照和回滾邏輯以適應新結構

- **原因 3：** 權限問題
  - **解決：** 檢查工作表寫入權限
  - **修復：** 確保 Apps Script 有足夠權限

### 3. 一致性檢查報告錯誤

**症狀：** 一致性檢查結果不準確或檢查失敗

**診斷步驟：**
```javascript
// 測試一致性檢查功能
function diagnoseConsistencyCheck() {
  const checker = new Phase4ConsistencyChecker();
  
  try {
    // 執行單項檢查
    const amountCheck = checker.checkAmountConsistency();
    Logger.log('金額一致性檢查:', amountCheck.passed);
    
    const linkCheck = checker.checkLinkIntegrity();
    Logger.log('關聯完整性檢查:', linkCheck.passed);
    
    const formatCheck = checker.checkFormatConsistency();
    Logger.log('格式一致性檢查:', formatCheck.passed);
    
    return true;
  } catch (error) {
    Logger.log('❌ 一致性檢查診斷失敗:', error.toString());
    return false;
  }
}
```

**可能原因和解決方案：**
- **原因 1：** 工作表資料格式變化
  - **解決：** 檢查工作表標題列和資料格式
  - **修復：** 更新檢查邏輯以適應新格式

- **原因 2：** 檢查邏輯過於嚴格
  - **解決：** 檢查容錯範圍設定
  - **修復：** 調整檢查閾值（如金額容差）

### 4. 通知系統不工作

**症狀：** 錯誤發生但沒有收到通知

**診斷步驟：**
```javascript
// 測試通知系統
function diagnoseNotificationSystem() {
  const notificationManager = new Phase4NotificationManager();
  
  try {
    // 建立測試錯誤記錄
    const testErrorRecord = {
      errorId: 'TEST-ERROR-001',
      timestamp: new Date(),
      errorType: 'TEST_ERROR',
      severity: 'HIGH',
      message: '測試通知系統'
    };
    
    // 測試通知發送
    const result = notificationManager.sendErrorNotification(testErrorRecord);
    Logger.log('通知發送結果:', result);
    
    return result.sent;
  } catch (error) {
    Logger.log('❌ 通知系統診斷失敗:', error.toString());
    return false;
  }
}
```

**可能原因和解決方案：**
- **原因 1：** 通知配置錯誤
  - **解決：** 檢查 `sendNotification` 函數是否存在
  - **修復：** 確保通知函數正確配置

- **原因 2：** 頻率限制觸發
  - **解決：** 檢查 `rateLimiter` 狀態
  - **修復：** 清理頻率限制或調整限制參數

- **原因 3：** 嚴重程度不符合通知條件
  - **解決：** 檢查 `shouldNotify` 邏輯
  - **修復：** 調整通知觸發條件

### 5. 恢復機制失效

**症狀：** 操作中斷後無法自動恢復

**診斷步驟：**
```javascript
// 測試恢復機制
function diagnoseRecoveryMechanism() {
  const recoveryManager = new Phase4LinkRecoveryManager();
  
  try {
    // 檢查活動恢復操作
    const activeRecoveries = recoveryManager.getActiveRecoveries();
    Logger.log('活動恢復操作:', activeRecoveries.length);
    
    // 檢查恢復統計
    const stats = recoveryManager.getRecoveryStats();
    Logger.log('恢復統計:', stats);
    
    return true;
  } catch (error) {
    Logger.log('❌ 恢復機制診斷失敗:', error.toString());
    return false;
  }
}
```

**可能原因和解決方案：**
- **原因 1：** 檢查點資料損壞
  - **解決：** 檢查 Properties Service 中的檢查點資料
  - **修復：** 清理損壞的檢查點資料

- **原因 2：** 恢復邏輯錯誤
  - **解決：** 檢查 `continueFromCheckpoint` 方法
  - **修復：** 更新恢復邏輯以處理新的業務場景

---

## 🔧 系統維護工具

### 清理和重置工具

```javascript
// 清理所有錯誤日誌
function cleanupErrorLogs() {
  try {
    const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
    const errorLogSheet = ss.getSheetByName('Phase4ErrorLog');
    
    if (errorLogSheet) {
      // 保留標題列，清理資料
      const lastRow = errorLogSheet.getLastRow();
      if (lastRow > 1) {
        errorLogSheet.deleteRows(2, lastRow - 1);
      }
      Logger.log('✅ 錯誤日誌已清理');
    }
  } catch (error) {
    Logger.log('❌ 清理錯誤日誌失敗:', error.toString());
  }
}

// 重置所有 Properties Service 資料
function resetPropertiesData() {
  try {
    const properties = PropertiesService.getScriptProperties();
    const allProperties = properties.getProperties();
    
    // 清理 Phase 4 相關的屬性
    Object.keys(allProperties).forEach(key => {
      if (key.includes('phase4') || key.includes('P4') || key.includes('checkpoint') || key.includes('recovery')) {
        properties.deleteProperty(key);
      }
    });
    
    Logger.log('✅ Properties 資料已重置');
  } catch (error) {
    Logger.log('❌ 重置 Properties 資料失敗:', error.toString());
  }
}

// 系統健康檢查
function performSystemHealthCheck() {
  Logger.log('=== Phase 4 系統健康檢查 ===');
  
  const checks = [
    { name: '錯誤檢測', test: diagnoseErrorDetection },
    { name: '事務管理', test: diagnoseTransactionManagement },
    { name: '一致性檢查', test: diagnoseConsistencyCheck },
    { name: '通知系統', test: diagnoseNotificationSystem },
    { name: '恢復機制', test: diagnoseRecoveryMechanism }
  ];
  
  const results = [];
  
  checks.forEach(check => {
    try {
      const result = check.test();
      results.push({ name: check.name, passed: result });
      Logger.log(`${check.name}: ${result ? '✅ 通過' : '❌ 失敗'}`);
    } catch (error) {
      results.push({ name: check.name, passed: false, error: error.toString() });
      Logger.log(`${check.name}: ❌ 錯誤 - ${error.toString()}`);
    }
  });
  
  const passedCount = results.filter(r => r.passed).length;
  Logger.log(`=== 檢查完成: ${passedCount}/${results.length} 通過 ===`);
  
  return results;
}
```

---

## 📊 錯誤代碼對照表

### 系統級錯誤 (P4S-XXX)
- **P4S-001**: NetworkError - 網路連線問題
- **P4S-002**: APILimitError - API 調用限制
- **P4S-003**: PermissionError - 權限不足
- **P4S-004**: ServiceUnavailableError - 服務不可用

### 資料級錯誤 (P4D-XXX)
- **P4D-001**: DataInconsistencyError - 資料不一致
- **P4D-002**: DataFormatError - 資料格式錯誤
- **P4D-003**: DataConflictError - 資料衝突
- **P4D-004**: DataIntegrityError - 資料完整性錯誤

### 業務級錯誤 (P4B-XXX)
- **P4B-001**: LedgerLinkError - 帳本關聯錯誤
- **P4B-002**: ExpenseRealizationError - 支出真實化錯誤
- **P4B-003**: AmountCalculationError - 金額計算錯誤
- **P4B-004**: DuplicateDetectionError - 重複檢測錯誤

### 使用者級錯誤 (P4U-XXX)
- **P4U-001**: InputValidationError - 輸入驗證錯誤
- **P4U-002**: OperationSequenceError - 操作序列錯誤
- **P4U-003**: InsufficientPermissionError - 權限不足錯誤

---

## 🆘 緊急聯絡和支援

### 自助解決步驟
1. 執行系統健康檢查：`performSystemHealthCheck()`
2. 查看錯誤日誌：檢查 Phase4ErrorLog 工作表
3. 嘗試重新初始化：`reinitializePhase4System()`
4. 清理和重置：使用提供的清理工具

### 提交問題時請包含
- 錯誤發生的具體時間
- 相關的錯誤 ID 和日誌
- 系統健康檢查結果
- 您嘗試的解決步驟

### 預防措施
- 定期執行系統健康檢查
- 監控錯誤日誌的增長趨勢
- 及時清理過期的日誌和檢查點資料
- 保持 Google Apps Script 權限的完整性

---

**記住：** 大多數問題都可以通過重新初始化系統來解決。如果問題持續存在，請檢查 Google Apps Script 的基本權限和配置。