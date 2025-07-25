# Phase 4 錯誤處理框架配置參考手冊

## 概述

本文件提供 Phase 4 錯誤處理框架的完整配置參考，包括所有可調整的參數、配置方法和最佳實踐建議。

---

## 🔧 核心配置參數

### 錯誤處理策略配置

```javascript
// 在 ConfigManager 中設定錯誤處理相關參數
const PHASE4_ERROR_CONFIG = {
  // 基本設定
  'phase4.error.enabled': true,                    // 啟用錯誤處理框架
  'phase4.error.logLevel': 'INFO',                // 日誌等級: DEBUG, INFO, WARN, ERROR
  'phase4.error.maxRetries': 3,                   // 最大重試次數
  'phase4.error.retryDelay': 1000,                // 重試延遲 (毫秒)
  'phase4.error.backoffMultiplier': 2,            // 退避倍數
  
  // 嚴重程度閾值
  'phase4.error.criticalThreshold': 'CRITICAL',   // 關鍵錯誤閾值
  'phase4.error.highThreshold': 'HIGH',           // 高嚴重程度閾值
  'phase4.error.mediumThreshold': 'MEDIUM',       // 中等嚴重程度閾值
  'phase4.error.lowThreshold': 'LOW',             // 低嚴重程度閾值
  
  // 處理策略偏好
  'phase4.error.preferAutoRetry': true,           // 偏好自動重試
  'phase4.error.preferAutoRollback': true,        // 偏好自動回滾
  'phase4.error.conservativeMode': false,         // 保守模式
  'phase4.error.allowPartialProcessing': true,    // 允許部分處理
};
```

### 事務管理配置

```javascript
const PHASE4_TRANSACTION_CONFIG = {
  // 事務超時設定
  'phase4.transaction.timeout': 300000,           // 事務超時 (5分鐘)
  'phase4.transaction.maxActive': 10,             // 最大並發事務數
  'phase4.transaction.cleanupInterval': 3600000,  // 清理間隔 (1小時)
  
  // 快照設定
  'phase4.transaction.enableSnapshots': true,     // 啟用快照
  'phase4.transaction.snapshotCompression': false, // 快照壓縮
  'phase4.transaction.maxSnapshotSize': 1000000,  // 最大快照大小 (1MB)
  
  // 回滾設定
  'phase4.transaction.enableAutoRollback': true,  // 啟用自動回滾
  'phase4.transaction.rollbackTimeout': 60000,    // 回滾超時 (1分鐘)
  'phase4.transaction.verifyRollback': true,       // 驗證回滾結果
};
```

### 一致性檢查配置

```javascript
const PHASE4_CONSISTENCY_CONFIG = {
  // 檢查頻率
  'phase4.consistency.autoCheckEnabled': true,    // 啟用自動檢查
  'phase4.consistency.checkInterval': 86400000,   // 檢查間隔 (24小時)
  'phase4.consistency.checkOnStartup': true,      // 啟動時檢查
  
  // 容錯設定
  'phase4.consistency.amountTolerance': 0.01,     // 金額容差
  'phase4.consistency.timestampTolerance': 86400000, // 時間戳容差 (24小時)
  'phase4.consistency.strictMode': false,         // 嚴格模式
  
  // 修復設定
  'phase4.consistency.enableAutoFix': true,       // 啟用自動修復
  'phase4.consistency.maxAutoFixes': 10,          // 最大自動修復數量
  'phase4.consistency.requireConfirmation': false, // 需要確認修復
};
```

### 通知系統配置

```javascript
const PHASE4_NOTIFICATION_CONFIG = {
  // 基本通知設定
  'phase4.notification.enabled': true,            // 啟用通知
  'phase4.notification.channels': ['email'],      // 通知渠道
  'phase4.notification.language': 'zh-TW',        // 通知語言
  
  // 頻率控制
  'phase4.notification.rateLimit.critical': 0,    // 關鍵錯誤無限制
  'phase4.notification.rateLimit.high': 300000,   // 高嚴重程度 5分鐘
  'phase4.notification.rateLimit.medium': 900000, // 中等嚴重程度 15分鐘
  'phase4.notification.rateLimit.low': 3600000,   // 低嚴重程度 1小時
  
  // 通知內容
  'phase4.notification.includeStackTrace': false, // 包含堆疊追蹤
  'phase4.notification.includeContext': true,     // 包含上下文
  'phase4.notification.maxMessageLength': 2000,   // 最大訊息長度
  
  // 特殊通知
  'phase4.notification.criticalImmediate': true,  // 關鍵錯誤立即通知
  'phase4.notification.summaryEnabled': true,     // 啟用摘要通知
  'phase4.notification.summaryInterval': 86400000, // 摘要間隔 (24小時)
};
```

### 恢復機制配置

```javascript
const PHASE4_RECOVERY_CONFIG = {
  // 檢查點設定
  'phase4.recovery.checkpointEnabled': true,      // 啟用檢查點
  'phase4.recovery.checkpointInterval': 30000,    // 檢查點間隔 (30秒)
  'phase4.recovery.maxCheckpoints': 10,           // 最大檢查點數量
  
  // 恢復設定
  'phase4.recovery.maxAttempts': 3,               // 最大恢復嘗試次數
  'phase4.recovery.attemptDelay': 5000,           // 恢復嘗試延遲 (5秒)
  'phase4.recovery.enableAutoRecovery': true,     // 啟用自動恢復
  
  // 持久化設定
  'phase4.recovery.persistenceEnabled': true,     // 啟用持久化
  'phase4.recovery.cleanupAge': 604800000,        // 清理年齡 (7天)
  'phase4.recovery.compressionEnabled': false,    // 啟用壓縮
};
```

### 日誌系統配置

```javascript
const PHASE4_LOGGING_CONFIG = {
  // 日誌等級
  'phase4.logging.level': 'INFO',                 // DEBUG, INFO, WARN, ERROR
  'phase4.logging.enableConsole': true,           // 啟用控制台日誌
  'phase4.logging.enableSheet': true,             // 啟用工作表日誌
  
  // 日誌輪轉
  'phase4.logging.maxLogEntries': 10000,          // 最大日誌條目數
  'phase4.logging.rotationEnabled': true,         // 啟用日誌輪轉
  'phase4.logging.rotationSize': 5000,            // 輪轉大小
  
  // 日誌格式
  'phase4.logging.includeTimestamp': true,        // 包含時間戳
  'phase4.logging.includeLevel': true,            // 包含等級
  'phase4.logging.includeSource': true,           // 包含來源
  'phase4.logging.dateFormat': 'yyyy-MM-dd HH:mm:ss', // 日期格式
  
  // 效能設定
  'phase4.logging.batchSize': 100,                // 批次大小
  'phase4.logging.flushInterval': 30000,          // 刷新間隔 (30秒)
  'phase4.logging.asyncEnabled': true,            // 啟用非同步
};
```

---

## 🛠️ 配置方法

### 方法 1：使用 ConfigManager

```javascript
// 設定單個配置項
function setPhase4Config(key, value) {
  const configManager = new ConfigManager();
  configManager.set(key, value);
  Logger.log(`配置已更新: ${key} = ${value}`);
}

// 批次設定配置
function setPhase4ConfigBatch(configs) {
  const configManager = new ConfigManager();
  
  Object.entries(configs).forEach(([key, value]) => {
    configManager.set(key, value);
  });
  
  Logger.log('批次配置更新完成');
}

// 使用範例
setPhase4Config('phase4.error.maxRetries', 5);
setPhase4ConfigBatch({
  'phase4.error.maxRetries': 5,
  'phase4.notification.enabled': true,
  'phase4.consistency.autoCheckEnabled': true
});
```

### 方法 2：直接修改配置物件

```javascript
// 在 Phase4ErrorHandler.gs 中修改預設配置
const PHASE4_RETRY_STRATEGIES = {
  [PHASE4_ERROR_TYPES.NETWORK_ERROR]: {
    maxRetries: 5,        // 從 3 改為 5
    backoffMultiplier: 3, // 從 2 改為 3
    initialDelay: 2000    // 從 1000 改為 2000
  },
  // ... 其他配置
};
```

### 方法 3：環境變數配置

```javascript
// 在 .env 文件中設定（如果使用環境變數）
PHASE4_ERROR_MAX_RETRIES=5
PHASE4_NOTIFICATION_ENABLED=true
PHASE4_CONSISTENCY_AUTO_CHECK=true
```

---

## 📋 配置模板

### 開發環境配置

```javascript
const DEVELOPMENT_CONFIG = {
  'phase4.error.logLevel': 'DEBUG',
  'phase4.error.maxRetries': 2,
  'phase4.notification.enabled': false,
  'phase4.consistency.checkInterval': 300000,     // 5分鐘
  'phase4.logging.enableConsole': true,
  'phase4.recovery.checkpointInterval': 10000,    // 10秒
};
```

### 生產環境配置

```javascript
const PRODUCTION_CONFIG = {
  'phase4.error.logLevel': 'WARN',
  'phase4.error.maxRetries': 3,
  'phase4.notification.enabled': true,
  'phase4.consistency.checkInterval': 86400000,   // 24小時
  'phase4.logging.enableConsole': false,
  'phase4.recovery.checkpointInterval': 30000,    // 30秒
};
```

### 高可用性配置

```javascript
const HIGH_AVAILABILITY_CONFIG = {
  'phase4.error.maxRetries': 5,
  'phase4.transaction.timeout': 600000,           // 10分鐘
  'phase4.recovery.maxAttempts': 5,
  'phase4.consistency.autoCheckEnabled': true,
  'phase4.consistency.checkInterval': 3600000,    // 1小時
  'phase4.notification.criticalImmediate': true,
};
```

### 效能優化配置

```javascript
const PERFORMANCE_CONFIG = {
  'phase4.logging.batchSize': 200,
  'phase4.logging.flushInterval': 60000,          // 1分鐘
  'phase4.transaction.enableSnapshots': false,    // 關閉快照以提升效能
  'phase4.consistency.strictMode': false,
  'phase4.recovery.compressionEnabled': true,
};
```

---

## 🎯 配置最佳實踐

### 1. 錯誤處理策略選擇

**保守策略（推薦新用戶）：**
```javascript
{
  'phase4.error.maxRetries': 2,
  'phase4.error.conservativeMode': true,
  'phase4.error.allowPartialProcessing': false,
  'phase4.consistency.strictMode': true
}
```

**積極策略（適合經驗用戶）：**
```javascript
{
  'phase4.error.maxRetries': 5,
  'phase4.error.conservativeMode': false,
  'phase4.error.allowPartialProcessing': true,
  'phase4.consistency.enableAutoFix': true
}
```

### 2. 通知配置建議

**最小通知（避免干擾）：**
```javascript
{
  'phase4.notification.rateLimit.high': 3600000,  // 1小時
  'phase4.notification.rateLimit.medium': 7200000, // 2小時
  'phase4.notification.summaryEnabled': true
}
```

**詳細通知（密切監控）：**
```javascript
{
  'phase4.notification.rateLimit.high': 300000,   // 5分鐘
  'phase4.notification.includeStackTrace': true,
  'phase4.notification.includeContext': true
}
```

### 3. 效能調優建議

**高頻使用場景：**
```javascript
{
  'phase4.logging.batchSize': 500,
  'phase4.logging.asyncEnabled': true,
  'phase4.transaction.enableSnapshots': false,
  'phase4.recovery.compressionEnabled': true
}
```

**低頻使用場景：**
```javascript
{
  'phase4.logging.batchSize': 50,
  'phase4.consistency.checkInterval': 86400000,   // 24小時
  'phase4.recovery.cleanupAge': 259200000         // 3天
}
```

---

## 🔍 配置驗證

### 配置驗證工具

```javascript
// 驗證配置的有效性
function validatePhase4Config() {
  const configManager = new ConfigManager();
  const errors = [];
  
  // 檢查必要配置
  const requiredConfigs = [
    'phase4.error.maxRetries',
    'phase4.transaction.timeout',
    'phase4.notification.enabled'
  ];
  
  requiredConfigs.forEach(key => {
    const value = configManager.get(key);
    if (value === null || value === undefined) {
      errors.push(`缺少必要配置: ${key}`);
    }
  });
  
  // 檢查數值範圍
  const maxRetries = configManager.get('phase4.error.maxRetries');
  if (maxRetries < 1 || maxRetries > 10) {
    errors.push('phase4.error.maxRetries 應該在 1-10 之間');
  }
  
  const timeout = configManager.get('phase4.transaction.timeout');
  if (timeout < 60000 || timeout > 1800000) { // 1分鐘到30分鐘
    errors.push('phase4.transaction.timeout 應該在 60000-1800000 之間');
  }
  
  if (errors.length > 0) {
    Logger.log('❌ 配置驗證失敗:');
    errors.forEach(error => Logger.log(`  - ${error}`));
    return false;
  } else {
    Logger.log('✅ 配置驗證通過');
    return true;
  }
}

// 顯示當前配置
function showCurrentPhase4Config() {
  const configManager = new ConfigManager();
  
  Logger.log('=== Phase 4 當前配置 ===');
  
  const configKeys = [
    'phase4.error.maxRetries',
    'phase4.error.retryDelay',
    'phase4.transaction.timeout',
    'phase4.notification.enabled',
    'phase4.consistency.autoCheckEnabled',
    'phase4.recovery.checkpointEnabled'
  ];
  
  configKeys.forEach(key => {
    const value = configManager.get(key);
    Logger.log(`${key}: ${value}`);
  });
}
```

---

## 🚀 快速配置腳本

### 一鍵配置腳本

```javascript
// 快速設定推薦配置
function quickSetupPhase4Config() {
  const configManager = new ConfigManager();
  
  const recommendedConfig = {
    // 錯誤處理
    'phase4.error.enabled': true,
    'phase4.error.maxRetries': 3,
    'phase4.error.retryDelay': 1000,
    'phase4.error.conservativeMode': false,
    
    // 事務管理
    'phase4.transaction.timeout': 300000,
    'phase4.transaction.enableSnapshots': true,
    'phase4.transaction.enableAutoRollback': true,
    
    // 一致性檢查
    'phase4.consistency.autoCheckEnabled': true,
    'phase4.consistency.checkInterval': 86400000,
    'phase4.consistency.enableAutoFix': true,
    
    // 通知系統
    'phase4.notification.enabled': true,
    'phase4.notification.criticalImmediate': true,
    'phase4.notification.summaryEnabled': true,
    
    // 恢復機制
    'phase4.recovery.checkpointEnabled': true,
    'phase4.recovery.enableAutoRecovery': true,
    'phase4.recovery.maxAttempts': 3,
    
    // 日誌系統
    'phase4.logging.level': 'INFO',
    'phase4.logging.enableSheet': true,
    'phase4.logging.rotationEnabled': true
  };
  
  Object.entries(recommendedConfig).forEach(([key, value]) => {
    configManager.set(key, value);
  });
  
  Logger.log('✅ Phase 4 推薦配置已套用');
  
  // 驗證配置
  return validatePhase4Config();
}
```

---

**注意事項：**
- 修改配置後建議執行 `validatePhase4Config()` 驗證
- 生產環境配置變更前請先在測試環境驗證
- 某些配置變更可能需要重新啟動系統才能生效
- 定期備份配置以防意外丟失