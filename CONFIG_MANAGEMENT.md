# 🔧 智慧記帳 GEM 配置管理指南

## 📋 配置概覽

智慧記帳 GEM 的配置管理採用多層次架構，確保系統的靈活性、安全性和可維護性。

### 配置來源優先級
1. **Google Sheets Settings 工作表**（最高優先級）
2. **Apps Script 指令碼屬性**
3. **程式碼中的預設值**（最低優先級）

---

## 🏗️ 配置分層架構

### 環境配置分類

#### 🔧 系統層配置（System Level）
控制系統運行的核心參數

```javascript
const SYSTEM_CONFIG = {
  // API 相關
  API_TIMEOUT: 30000,              // API 請求超時時間（毫秒）
  MAX_RETRY_ATTEMPTS: 3,           // 最大重試次數
  RETRY_DELAY_BASE: 1000,          // 重試延遲基數（毫秒）
  
  // 批次處理
  BATCH_SIZE: 5,                   // 批次處理大小
  MAX_CONCURRENT_REQUESTS: 3,      // 最大併發請求數
  
  // 日誌與監控
  LOG_LEVEL: 'INFO',               // 日誌等級：DEBUG, INFO, WARN, ERROR
  ENABLE_PERFORMANCE_LOGGING: true, // 啟用效能日誌
  
  // 快取設定
  CACHE_TTL: 3600,                 // 快取存活時間（秒）
  ENABLE_AI_CACHE: true            // 啟用 AI 結果快取
};
```

#### 💼 業務層配置（Business Level）
控制業務邏輯的參數

```javascript
const BUSINESS_CONFIG = {
  // 財務設定
  DEFAULT_CURRENCY: 'TWD',         // 預設幣別
  SUPPORTED_CURRENCIES: ['TWD', 'USD', 'JPY', 'EUR', 'CNY'],
  EXCHANGE_RATE_UPDATE_INTERVAL: 86400, // 匯率更新間隔（秒）
  
  // 資料處理
  DUPLICATE_THRESHOLD: 0.8,        // 重複記錄判定閾值（0-1）
  AUTO_MERGE_ENABLED: true,        // 啟用自動合併
  TEXT_SIMILARITY_THRESHOLD: 0.7,  // 文字相似度閾值
  
  // AI 處理
  AI_CONFIDENCE_THRESHOLD: 0.6,    // AI 信心度閾值
  ENABLE_TWO_PASS_AI: true,        // 啟用兩段式 AI 處理
  
  // IOU 功能
  IOU_AUTO_SETTLEMENT: false,      // 自動結算代墊款
  IOU_REMINDER_DAYS: 7             // 代墊款提醒天數
};
```

#### 👤 使用者層配置（User Level）
個人化設定參數

```javascript
const USER_CONFIG = {
  // 通知設定
  NOTIFICATION_CHANNELS: ['email'], // 通知管道
  NOTIFICATION_LEVEL: 'ERROR',      // 通知等級
  EMAIL_NOTIFICATION: true,         // 啟用郵件通知
  WEBHOOK_NOTIFICATION: false,      // 啟用 Webhook 通知
  
  // 地區化設定
  LANGUAGE_PREFERENCE: 'zh-TW',     // 語言偏好
  TIMEZONE: 'Asia/Taipei',          // 時區
  DATE_FORMAT: 'YYYY-MM-DD',        // 日期格式
  NUMBER_FORMAT: '#,##0.00',        // 數字格式
  
  // 使用者偏好
  AUTO_CATEGORIZE: true,            // 自動分類
  VOICE_LANGUAGE: 'zh-TW',          // 語音識別語言
  DEFAULT_CATEGORY: '其他'           // 預設分類
};
```

---

## ⚙️ 配置管理實作

### 1. 配置管理器類別
詳細實作請參考 [ConfigManager.gs](ConfigManager.gs)

### 2. 配置使用範例

#### 基本使用
```javascript
// 獲取配置值
const timeout = configManager.get('API_TIMEOUT', 30000);
const currency = configManager.get('DEFAULT_CURRENCY', 'TWD');

// 設定配置值
configManager.set('NOTIFICATION_LEVEL', 'INFO');
configManager.set('AUTO_MERGE_ENABLED', true);

// 批次獲取配置
const configs = configManager.getMultiple([
  'DEFAULT_CURRENCY',
  'DUPLICATE_THRESHOLD',
  'AUTO_MERGE_ENABLED'
]);
```

#### 在主要功能中使用
```javascript
function processVoice(voiceText, sheetId) {
  // 使用配置管理器獲取設定
  const timeout = configManager.get('API_TIMEOUT');
  const retryAttempts = configManager.get('MAX_RETRY_ATTEMPTS');
  const enableCache = configManager.get('ENABLE_AI_CACHE');
  
  // 使用配置值進行處理
  const options = {
    timeout: timeout,
    maxRetries: retryAttempts
  };
  
  // ... 其他處理邏輯
}
```

### 3. 配置初始化腳本

```javascript
/**
 * 初始化系統配置
 * 在首次部署時執行此函數
 */
function initializeConfigs() {
  const defaultConfigs = [
    // 系統配置
    ['API_TIMEOUT', 30000, 'API 請求超時時間（毫秒）'],
    ['MAX_RETRY_ATTEMPTS', 3, '最大重試次數'],
    ['BATCH_SIZE', 5, '批次處理大小'],
    ['LOG_LEVEL', 'INFO', '日誌等級'],
    
    // 業務配置
    ['DEFAULT_CURRENCY', 'TWD', '預設幣別'],
    ['DUPLICATE_THRESHOLD', 0.8, '重複記錄判定閾值'],
    ['AUTO_MERGE_ENABLED', true, '啟用自動合併'],
    ['AI_CONFIDENCE_THRESHOLD', 0.6, 'AI 信心度閾值'],
    
    // 使用者配置
    ['LANGUAGE_PREFERENCE', 'zh-TW', '語言偏好'],
    ['TIMEZONE', 'Asia/Taipei', '時區'],
    ['NOTIFICATION_LEVEL', 'ERROR', '通知等級'],
    ['AUTO_CATEGORIZE', true, '自動分類']
  ];

  const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
  const settingsSheet = ss.getSheetByName('Settings');
  
  if (!settingsSheet) {
    throw new Error('Settings 工作表不存在，請先執行 setup-sheets-template.gs');
  }

  // 檢查是否已有配置
  const existingData = settingsSheet.getDataRange().getValues();
  const existingKeys = existingData.slice(1).map(row => row[0]);

  // 只新增不存在的配置
  const newConfigs = defaultConfigs.filter(config => !existingKeys.includes(config[0]));
  
  if (newConfigs.length > 0) {
    const lastRow = settingsSheet.getLastRow();
    settingsSheet.getRange(lastRow + 1, 1, newConfigs.length, 3).setValues(newConfigs);
    Logger.log(`已新增 ${newConfigs.length} 個預設配置`);
  } else {
    Logger.log('所有預設配置已存在');
  }
}
```

---

## 🔒 敏感資訊管理

### 1. 分級管理策略

#### 🔴 高敏感度（Apps Script 屬性）
```javascript
// 這些資訊絕不應出現在 Google Sheets 中
const SENSITIVE_CONFIGS = [
  'GEMINI_API_KEY',
  'DOCUMENT_AI_PROCESSOR_ID',
  'WEBHOOK_SECRET',
  'DATABASE_PASSWORD'
];

// 設定敏感配置
function setSensitiveConfig(key, value) {
  if (SENSITIVE_CONFIGS.includes(key)) {
    PropertiesService.getScriptProperties().setProperty(key, value);
    Logger.log(`敏感配置 ${key} 已安全儲存`);
  } else {
    throw new Error(`${key} 不是敏感配置項目`);
  }
}
```

#### 🟡 中敏感度（Google Sheets Settings）
```javascript
// 這些可以在 Sheets 中管理，但需要適當權限控制
const SEMI_SENSITIVE_CONFIGS = [
  'NOTIFICATION_EMAIL',
  'WEBHOOK_URL',
  'MAIN_LEDGER_ID'
];
```

#### 🟢 低敏感度（公開配置）
```javascript
// 這些配置可以公開，不涉及安全問題
const PUBLIC_CONFIGS = [
  'DEFAULT_CURRENCY',
  'LANGUAGE_PREFERENCE',
  'TIMEZONE',
  'LOG_LEVEL'
];
```

### 2. 金鑰輪換機制

```javascript
/**
 * API 金鑰輪換
 */
function rotateApiKeys() {
  const oldKey = configManager.get('GEMINI_API_KEY');
  
  // 提示使用者在 GCP Console 建立新金鑰
  Logger.log('請在 Google Cloud Console 建立新的 API 金鑰');
  Logger.log('完成後執行 updateApiKey(newKey) 函數');
  
  // 記錄輪換時間
  configManager.set('LAST_KEY_ROTATION', new Date().toISOString());
}

function updateApiKey(newKey) {
  if (!newKey || !newKey.startsWith('AIza')) {
    throw new Error('無效的 Gemini API 金鑰格式');
  }
  
  // 測試新金鑰
  const testResult = testApiKey(newKey);
  if (!testResult.success) {
    throw new Error(`新 API 金鑰測試失敗: ${testResult.error}`);
  }
  
  // 更新金鑰
  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', newKey);
  configManager.clearCache();
  
  Logger.log('API 金鑰已成功更新並測試通過');
}

function testApiKey(apiKey) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        contents: [{ parts: [{ text: 'test' }] }]
      }),
      muteHttpExceptions: true
    });
    
    return {
      success: response.getResponseCode() === 200,
      error: response.getResponseCode() !== 200 ? response.getContentText() : null
    };
  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}
```

---

## 🔄 配置更新與同步

### 1. 熱更新機制

```javascript
/**
 * 配置熱更新
 * 無需重新部署即可更新配置
 */
function hotReloadConfigs() {
  // 清除快取
  configManager.clearCache();
  
  // 重新載入配置
  const validation = configManager.validate();
  
  if (!validation.isValid) {
    Logger.log('配置驗證失敗:');
    validation.errors.forEach(error => Logger.log(`- ${error}`));
    return false;
  }
  
  Logger.log('配置已成功熱更新');
  return true;
}
```

### 2. 配置同步機制

```javascript
/**
 * 配置備份
 */
function backupConfigs() {
  const allConfigs = configManager.getAll();
  const backup = {
    timestamp: new Date().toISOString(),
    configs: allConfigs
  };
  
  // 儲存到 Google Drive
  const blob = Utilities.newBlob(
    JSON.stringify(backup, null, 2),
    'application/json',
    `config-backup-${new Date().toISOString().split('T')[0]}.json`
  );
  
  DriveApp.createFile(blob);
  Logger.log('配置已備份到 Google Drive');
}

/**
 * 配置還原
 */
function restoreConfigs(backupData) {
  try {
    const backup = JSON.parse(backupData);
    
    Object.entries(backup.configs).forEach(([key, value]) => {
      configManager.set(key, value);
    });
    
    Logger.log(`已還原 ${Object.keys(backup.configs).length} 個配置項目`);
  } catch (error) {
    Logger.log(`配置還原失敗: ${error.toString()}`);
    throw error;
  }
}
```

---

## 📊 配置監控與告警

### 1. 配置健康檢查

```javascript
/**
 * 定期配置健康檢查
 */
function configHealthCheck() {
  const validation = configManager.validate();
  const issues = [];
  
  // 檢查必要配置
  if (!validation.isValid) {
    issues.push(...validation.errors);
  }
  
  // 檢查 API 金鑰有效性
  const apiKeyTest = testApiKey(configManager.get('GEMINI_API_KEY'));
  if (!apiKeyTest.success) {
    issues.push(`Gemini API 金鑰無效: ${apiKeyTest.error}`);
  }
  
  // 檢查配置值合理性
  const duplicateThreshold = configManager.get('DUPLICATE_THRESHOLD');
  if (duplicateThreshold > 0.95) {
    issues.push('重複判定閾值過高，可能導致重複記錄');
  }
  
  // 發送告警
  if (issues.length > 0) {
    sendConfigAlert(issues);
  }
  
  return {
    healthy: issues.length === 0,
    issues: issues
  };
}

function sendConfigAlert(issues) {
  const message = `配置健康檢查發現問題:\n${issues.map(issue => `- ${issue}`).join('\n')}`;
  sendNotification('配置告警', message, 'WARNING');
}
```

### 2. 配置變更追蹤

```javascript
/**
 * 配置變更日誌
 */
function logConfigChange(key, oldValue, newValue, user = 'system') {
  const logEntry = {
    timestamp: new Date().toISOString(),
    key: key,
    oldValue: oldValue,
    newValue: newValue,
    user: user,
    source: 'ConfigManager'
  };
  
  // 記錄到日誌工作表（如果存在）
  try {
    const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
    let logSheet = ss.getSheetByName('ConfigLogs');
    
    if (!logSheet) {
      logSheet = ss.insertSheet('ConfigLogs');
      logSheet.getRange(1, 1, 1, 6).setValues([
        ['Timestamp', 'Key', 'OldValue', 'NewValue', 'User', 'Source']
      ]);
    }
    
    logSheet.appendRow([
      logEntry.timestamp,
      logEntry.key,
      logEntry.oldValue,
      logEntry.newValue,
      logEntry.user,
      logEntry.source
    ]);
  } catch (error) {
    Logger.log(`記錄配置變更失敗: ${error.toString()}`);
  }
}
```

---

## 🛠️ 配置管理最佳實踐

### 1. 配置命名規範
- 使用 `UPPER_SNAKE_CASE` 格式
- 按功能分組前綴：`API_`, `BUSINESS_`, `USER_`
- 避免使用縮寫，保持名稱清晰
- 使用描述性名稱，如 `EMAIL_NOTIFICATION_ENABLED` 而非 `EMAIL_ON`

### 2. 配置值格式
- 布林值：使用 `true`/`false`
- 數值：直接使用數字
- 陣列/物件：使用 JSON 格式字串
- 時間：使用 ISO 8601 格式
- 密碼/金鑰：使用 Apps Script 屬性儲存

### 3. 配置安全原則
- 敏感資訊使用 Apps Script 屬性
- 定期輪換 API 金鑰（建議每 90 天）
- 限制 Google Sheets 存取權限
- 啟用配置變更日誌
- 實施配置值驗證

### 4. 效能考量
- 使用快取減少讀取次數（預設 5 分鐘 TTL）
- 批次獲取相關配置
- 避免在迴圈中頻繁讀取配置
- 定期清理過期快取
- 監控配置讀取效能

### 5. 版本控制與變更管理
- 記錄所有配置變更
- 實施配置審核流程
- 建立配置回滾機制
- 定期備份配置狀態

---

## 🚀 快速開始指南

### 1. 初次設定
```javascript
// 執行配置設定嚮導
configSetupWizard();

// 或手動初始化
initializeConfigs();
setSensitiveConfig('GEMINI_API_KEY', 'your_api_key_here');
setSensitiveConfig('MAIN_LEDGER_ID', 'your_sheets_id_here');
```

### 2. 日常使用
```javascript
// 獲取配置
const currency = configManager.get('DEFAULT_CURRENCY');
const timeout = configManager.get('API_TIMEOUT', 30000);

// 設定配置
configManager.set('NOTIFICATION_LEVEL', 'INFO');

// 批次設定
setBatchConfigs({
  'DEFAULT_CURRENCY': 'USD',
  'LANGUAGE_PREFERENCE': 'en-US',
  'AUTO_MERGE_ENABLED': false
});
```

### 3. 維護操作
```javascript
// 健康檢查
configHealthCheck();

// 備份配置
backupConfigs();

// 熱更新
hotReloadConfigs();

// 效能分析
analyzeConfigPerformance();
```

---

## 🎯 配置管理工具

### 1. Web 介面
- 執行 `createConfigWebUI()` 開啟圖形化管理介面
- 支援即時編輯和驗證
- 提供健康檢查和效能監控

### 2. 命令列工具
- `configSetupWizard()` - 配置設定嚮導
- `exportConfigsToJson()` - 匯出配置
- `importConfigsFromJson()` - 匯入配置
- `compareConfigs()` - 配置比較

### 3. 自動化腳本
- 定期健康檢查觸發器
- 自動備份機制
- 配置變更通知

---

## 📋 配置檢查清單

### 部署前檢查
- [ ] 所有必要配置已設定
- [ ] 敏感資訊已安全儲存
- [ ] 配置值格式正確
- [ ] 配置驗證通過
- [ ] 已執行 `configSetupWizard()`

### 運行時檢查
- [ ] 配置快取正常運作
- [ ] API 金鑰有效且未過期
- [ ] 配置值在合理範圍內
- [ ] 配置變更已記錄
- [ ] 效能指標正常

### 維護檢查
- [ ] 定期備份配置（建議每週）
- [ ] 檢查配置健康狀況（建議每日）
- [ ] 更新過期配置
- [ ] 清理無用配置
- [ ] 檢查安全性設定

### 安全檢查
- [ ] API 金鑰未在 Google Sheets 中明文顯示
- [ ] 配置變更日誌完整
- [ ] 存取權限設定正確
- [ ] 敏感配置加密儲存

---

## 🔧 故障排除

### 常見問題

#### 1. 配置讀取失敗
**症狀**: `configManager.get()` 回傳 null 或預設值
**解決方案**:
- 檢查 Google Sheets 存取權限
- 確認工作表名稱正確
- 執行 `configHealthCheck()` 診斷

#### 2. 配置快取問題
**症狀**: 配置更新後未生效
**解決方案**:
- 執行 `configManager.clearCache()`
- 或執行 `hotReloadConfigs()`

#### 3. API 金鑰無效
**症狀**: API 調用失敗
**解決方案**:
- 執行 `testApiKey()` 驗證
- 使用 `setSensitiveConfig()` 更新金鑰

#### 4. 效能問題
**症狀**: 配置讀取緩慢
**解決方案**:
- 執行 `analyzeConfigPerformance()` 分析
- 檢查快取設定
- 考慮批次讀取

---

## 📚 進階主題

### 1. 自訂配置驗證規則
```javascript
// 擴展 ConfigManager 的 validate 方法
ConfigManager.prototype.customValidate = function(key, value) {
  const rules = {
    'EMAIL_ADDRESS': /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    'PHONE_NUMBER': /^\+?[\d\s-()]+$/,
    'URL': /^https?:\/\/.+/
  };
  
  if (rules[key]) {
    return rules[key].test(value);
  }
  return true;
};
```

### 2. 配置環境隔離
```javascript
// 根據環境載入不同配置
function getEnvironmentConfig() {
  const env = configManager.get('ENVIRONMENT', 'production');
  const envConfigs = {
    'development': {
      'LOG_LEVEL': 'DEBUG',
      'API_TIMEOUT': 60000
    },
    'production': {
      'LOG_LEVEL': 'ERROR',
      'API_TIMEOUT': 30000
    }
  };
  
  return envConfigs[env] || envConfigs['production'];
}
```

### 3. 配置變更通知
```javascript
// 監聽配置變更並發送通知
function onConfigChange(key, oldValue, newValue) {
  const criticalConfigs = ['GEMINI_API_KEY', 'DEFAULT_CURRENCY'];
  
  if (criticalConfigs.includes(key)) {
    sendNotification(
      '重要配置變更',
      `配置 ${key} 已從 ${oldValue} 變更為 ${newValue}`,
      'INFO'
    );
  }
}
```

<function_calls>
<invoke name="fsWrite">
<parameter name="path">ConfigManager.gs