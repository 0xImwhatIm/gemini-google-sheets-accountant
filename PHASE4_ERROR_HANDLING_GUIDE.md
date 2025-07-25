# Phase 4 錯誤處理框架使用指南

## 概述

Phase 4 錯誤處理框架是專門為智慧記帳 GEM 的「帳本關聯與支出真實化」功能設計的完整錯誤處理系統。它提供了自動錯誤檢測、智慧處理、事務管理、一致性檢查和恢復機制。

## 核心組件

### 1. Phase4ErrorHandler - 核心錯誤處理器
負責錯誤分類、處理策略選擇和執行。

```javascript
// 基本使用
const result = await phase4ErrorHandler.handleError(error, context, operation);

// 檢查處理結果
if (result.success) {
  console.log('錯誤已成功處理');
} else if (result.requiresManualIntervention) {
  console.log('需要人工介入處理');
}
```

### 2. Phase4TransactionManager - 事務管理器
確保操作的原子性和資料一致性。

```javascript
// 開始事務
const transactionId = transactionManager.beginTransaction('LEDGER_LINKING', context);

// 記錄操作
transactionManager.recordOperation(transactionId, 'WRITE_TO_SHEET', data, snapshot);

// 提交或回滾
const commitResult = await transactionManager.commitTransaction(transactionId);
// 或
const rollbackResult = await transactionManager.rollbackTransaction(transactionId);
```

### 3. Phase4ConsistencyChecker - 一致性檢查器
檢查 IOU 帳本與主帳本之間的資料一致性。

```javascript
// 執行完整一致性檢查
const checkResult = await consistencyChecker.performFullConsistencyCheck();

// 檢查結果
console.log(`發現 ${checkResult.summary.totalInconsistencies} 個不一致問題`);
```

### 4. Phase4LedgerLinkDetector - 帳本關聯錯誤檢測器
檢測帳本關聯過程中的各種錯誤。

```javascript
// 檢測關聯錯誤
const detectionResult = await linkDetector.detectLinkErrors(iouData, mainLedgerData);

// 處理檢測到的錯誤
for (const error of detectionResult.errors) {
  console.log(`發現錯誤: ${error.type} - ${error.message}`);
}
```

### 5. Phase4ExpenseRealizationHandler - 支出真實化錯誤處理器
處理代墊支出記錄到主帳本時的錯誤。

```javascript
// 處理支出真實化錯誤
const result = await expenseHandler.handleExpenseRealizationErrors(expenseData, context);

// 檢查處理結果
if (result.summary.requiresManualReview) {
  console.log('需要人工審查');
}
```

### 6. Phase4LinkRecoveryManager - 關聯操作恢復管理器
處理操作中斷和恢復。

```javascript
// 開始可恢復的操作
const recoveryId = await recoveryManager.startLinkOperation(operationId, operationData);

// 建立檢查點
await recoveryManager.createCheckpoint(recoveryId, 'STEP_COMPLETE', stepData);

// 從中斷恢復
const recoveryResult = await recoveryManager.recoverFromInterruption(recoveryId);
```

## 完整使用流程

### 1. 基本的帳本關聯處理

```javascript
async function processLedgerLinking(iouData, mainLedgerData) {
  const integration = new Phase4ErrorHandlingIntegration();
  
  try {
    const result = await integration.processLedgerLinking(iouData, mainLedgerData, {
      realizeExpenses: true,
      continueOnExpenseError: false,
      ignoreConsistencyErrors: false
    });
    
    if (result.success) {
      console.log('帳本關聯處理成功');
      return result;
    } else {
      console.log('帳本關聯處理失敗:', result.error);
      // 檢查各步驟的詳細結果
      result.steps.forEach(step => {
        console.log(`${step.step}: ${step.success ? '成功' : '失敗'}`);
      });
    }
  } catch (error) {
    console.error('處理過程發生異常:', error);
  }
}
```

### 2. 手動錯誤處理

```javascript
async function handleSpecificError(error, context) {
  try {
    const result = await phase4ErrorHandler.handleError(error, context, 'MANUAL_OPERATION');
    
    switch (result.strategy) {
      case 'AUTO_RETRY':
        console.log('系統已自動重試');
        break;
      case 'AUTO_ROLLBACK':
        console.log('系統已自動回滾');
        break;
      case 'MANUAL_REVIEW':
        console.log('需要人工審查:', result.resolution.reviewInstructions);
        break;
    }
    
    return result;
  } catch (handlingError) {
    console.error('錯誤處理失敗:', handlingError);
  }
}
```

### 3. 定期一致性檢查

```javascript
async function performRoutineConsistencyCheck() {
  const checker = new Phase4ConsistencyChecker();
  
  try {
    const result = await checker.performFullConsistencyCheck();
    
    if (result.summary.failedChecks > 0) {
      console.log(`發現 ${result.summary.totalInconsistencies} 個一致性問題`);
      
      // 生成修復建議
      const report = checker.generateConsistencyReport(result);
      
      console.log('自動修復項目:', report.autoFixable.length);
      console.log('需要人工審查項目:', report.manualReview.length);
      
      // 可以選擇自動執行修復
      // await executeAutoFixes(report.autoFixable);
    } else {
      console.log('一致性檢查通過');
    }
  } catch (error) {
    console.error('一致性檢查失敗:', error);
  }
}
```

## 錯誤類型和處理策略

### 系統級錯誤
- **NetworkError**: 自動重試
- **APILimitError**: 延遲重試
- **PermissionError**: 人工介入
- **ServiceUnavailableError**: 升級處理

### 資料級錯誤
- **DataInconsistencyError**: 自動回滾
- **DataFormatError**: 部分處理
- **DataConflictError**: 自動回滾
- **DataIntegrityError**: 升級處理

### 業務級錯誤
- **LedgerLinkError**: 人工審查
- **ExpenseRealizationError**: 人工審查
- **AmountCalculationError**: 保守模式
- **DuplicateDetectionError**: 保守模式

## 配置選項

### 錯誤處理配置
```javascript
// 在 ConfigManager 中設定
const errorConfig = {
  'phase4.error.maxRetries': 3,
  'phase4.error.retryDelay': 1000,
  'phase4.error.enableNotifications': true,
  'phase4.error.notificationLevel': 'HIGH'
};
```

### 通知配置
```javascript
const notificationConfig = {
  'phase4.notification.email': true,
  'phase4.notification.rateLimit': 300000, // 5分鐘
  'phase4.notification.criticalImmediate': true
};
```

## 監控和日誌

### 查看錯誤統計
```javascript
// 獲取錯誤統計
const stats = phase4ErrorHandler.getErrorStats();
console.log('24小時內錯誤統計:', stats);

// 獲取通知統計
const notificationStats = phase4ErrorHandler.notificationManager.getNotificationStats();
console.log('通知統計:', notificationStats);
```

### 查看恢復統計
```javascript
// 獲取恢復統計
const recoveryStats = phase4LinkRecoveryManager.getRecoveryStats();
console.log('恢復操作統計:', recoveryStats);

// 查看活動中的恢復操作
const activeRecoveries = phase4LinkRecoveryManager.getActiveRecoveries();
console.log('活動中的恢復操作:', activeRecoveries.length);
```

## 測試和驗證

### 執行完整測試
```javascript
// 在 Google Apps Script 編輯器中執行
function runPhase4Tests() {
  // 測試錯誤處理
  manualErrorHandlingTest();
  
  // 測試錯誤檢測
  manualErrorDetectionTest();
  
  // 測試一致性檢查
  manualConsistencyCheckTest();
}
```

### 模擬錯誤情況
```javascript
// 模擬網路錯誤
function simulateNetworkError() {
  const error = new Error('Network timeout');
  return phase4ErrorHandler.handleError(error, {}, 'TEST_OPERATION');
}

// 模擬資料不一致
function simulateDataInconsistency() {
  const error = new Error('Data inconsistency detected');
  return phase4ErrorHandler.handleError(error, {
    errorType: 'DATA_INCONSISTENCY_ERROR'
  }, 'TEST_OPERATION');
}
```

## 最佳實踐

### 1. 錯誤處理
- 總是使用 try-catch 包裝關鍵操作
- 提供足夠的上下文資訊
- 記錄錯誤處理的結果

### 2. 事務管理
- 對於多步驟操作使用事務
- 及時記錄操作快照
- 確保事務的及時提交或回滾

### 3. 一致性檢查
- 定期執行一致性檢查
- 及時處理發現的不一致問題
- 監控一致性趨勢

### 4. 恢復管理
- 為長時間運行的操作建立檢查點
- 測試恢復機制的有效性
- 監控恢復操作的成功率

## 故障排除

### 常見問題

1. **錯誤處理器無回應**
   - 檢查 Google Apps Script 的執行時間限制
   - 確認相關工作表的存取權限
   - 查看執行日誌中的錯誤訊息

2. **事務回滾失敗**
   - 檢查快照資料的完整性
   - 確認工作表結構沒有變化
   - 驗證回滾邏輯的正確性

3. **一致性檢查報告錯誤**
   - 確認資料格式的正確性
   - 檢查工作表之間的關聯關係
   - 驗證檢查邏輯的準確性

4. **恢復操作失敗**
   - 檢查檢查點資料的有效性
   - 確認系統狀態的一致性
   - 驗證恢復邏輯的正確性

### 調試技巧

1. **啟用詳細日誌**
```javascript
// 在操作前設定
Logger.log('[DEBUG] 開始詳細日誌記錄');
```

2. **檢查錯誤日誌工作表**
- 查看 Phase4ErrorLog 工作表
- 分析錯誤模式和趨勢
- 識別重複出現的問題

3. **使用測試模式**
```javascript
// 使用測試資料進行驗證
const testResult = await phase4Integration.processLedgerLinking(
  testIOUData, 
  testMainLedgerData, 
  { testMode: true }
);
```

## 更新和維護

### 定期維護任務
1. 清理過期的錯誤日誌
2. 更新錯誤處理規則
3. 檢查通知配置的有效性
4. 驗證恢復機制的可靠性

### 版本更新
- 在更新前備份現有配置
- 測試新版本的相容性
- 逐步部署新功能
- 監控更新後的系統穩定性

---

如需更多協助或遇到問題，請查看相關的程式碼註解或聯繫系統管理員。