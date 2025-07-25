/**
 * 智慧記帳 GEM - 配置管理器
 * 
 * 提供統一的配置管理介面，支援多層次配置和動態更新
 */

class ConfigManager {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = new Map();
    this.CACHE_TTL = 300000; // 5分鐘快取
  }

  /**
   * 獲取配置值
   * @param {string} key - 配置鍵
   * @param {*} defaultValue - 預設值
   * @param {boolean} useCache - 是否使用快取
   * @returns {*} 配置值
   */
  get(key, defaultValue = null, useCache = true) {
    try {
      // 檢查快取
      if (useCache && this.isCacheValid(key)) {
        return this.cache.get(key);
      }

      let value = null;

      // 1. 優先從 Google Sheets Settings 工作表讀取
      value = this.getFromSheets(key);
      
      // 2. 其次從 Apps Script 指令碼屬性讀取
      if (value === null) {
        value = this.getFromProperties(key);
      }
      
      // 3. 最後使用預設值
      if (value === null) {
        value = this.getFromDefaults(key, defaultValue);
      }

      // 類型轉換
      value = this.convertType(value);

      // 更新快取
      if (useCache) {
        this.updateCache(key, value);
      }

      return value;
    } catch (error) {
      Logger.log(`[ConfigManager] 獲取配置 ${key} 失敗: ${error.toString()}`);
      return defaultValue;
    }
  }

  /**
   * 設定配置值
   * @param {string} key - 配置鍵
   * @param {*} value - 配置值
   * @param {string} target - 目標位置：'sheets' | 'properties'
   */
  set(key, value, target = 'sheets') {
    try {
      const oldValue = this.get(key);

      if (target === 'sheets') {
        this.setToSheets(key, value);
      } else if (target === 'properties') {
        this.setToProperties(key, value);
      }

      // 清除快取
      this.cache.delete(key);
      this.cacheExpiry.delete(key);

      // 記錄變更
      this.logConfigChange(key, oldValue, value);

      Logger.log(`[ConfigManager] 配置 ${key} 已更新為: ${value}`);
    } catch (error) {
      Logger.log(`[ConfigManager] 設定配置 ${key} 失敗: ${error.toString()}`);
      throw error;
    }
  }

  /**
   * 從 Google Sheets 讀取配置
   */
  getFromSheets(key) {
    try {
      const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
      const settingsSheet = ss.getSheetByName('Settings');
      
      if (!settingsSheet) return null;

      const data = settingsSheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === key) {
          return data[i][1];
        }
      }
      return null;
    } catch (error) {
      Logger.log(`[ConfigManager] 從 Sheets 讀取配置失敗: ${error.toString()}`);
      return null;
    }
  }

  /**
   * 寫入配置到 Google Sheets
   */
  setToSheets(key, value) {
    const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
    const settingsSheet = ss.getSheetByName('Settings');
    
    if (!settingsSheet) {
      throw new Error('Settings 工作表不存在');
    }

    const data = settingsSheet.getDataRange().getValues();
    let updated = false;

    // 尋找現有配置並更新
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        settingsSheet.getRange(i + 1, 2).setValue(value);
        updated = true;
        break;
      }
    }

    // 如果不存在，新增一行
    if (!updated) {
      const lastRow = settingsSheet.getLastRow();
      settingsSheet.getRange(lastRow + 1, 1, 1, 3).setValues([[key, value, '']]);
    }
  }

  /**
   * 從 Apps Script 屬性讀取配置
   */
  getFromProperties(key) {
    try {
      return PropertiesService.getScriptProperties().getProperty(key);
    } catch (error) {
      Logger.log(`[ConfigManager] 從屬性讀取配置失敗: ${error.toString()}`);
      return null;
    }
  }

  /**
   * 寫入配置到 Apps Script 屬性
   */
  setToProperties(key, value) {
    PropertiesService.getScriptProperties().setProperty(key, String(value));
  }

  /**
   * 從預設值獲取配置
   */
  getFromDefaults(key, fallback) {
    const defaults = this.getDefaultConfigs();
    return defaults[key] !== undefined ? defaults[key] : fallback;
  }

  /**
   * 獲取所有預設配置
   */
  getDefaultConfigs() {
    return {
      // 系統配置
      'API_TIMEOUT': 30000,
      'MAX_RETRY_ATTEMPTS': 3,
      'RETRY_DELAY_BASE': 1000,
      'BATCH_SIZE': 5,
      'MAX_CONCURRENT_REQUESTS': 3,
      'LOG_LEVEL': 'INFO',
      'ENABLE_PERFORMANCE_LOGGING': true,
      'CACHE_TTL': 3600,
      'ENABLE_AI_CACHE': true,
      
      // 業務配置
      'DEFAULT_CURRENCY': 'TWD',
      'SUPPORTED_CURRENCIES': ['TWD', 'USD', 'JPY', 'EUR', 'CNY'],
      'EXCHANGE_RATE_UPDATE_INTERVAL': 86400,
      'DUPLICATE_THRESHOLD': 0.8,
      'AUTO_MERGE_ENABLED': true,
      'TEXT_SIMILARITY_THRESHOLD': 0.7,
      'AI_CONFIDENCE_THRESHOLD': 0.6,
      'ENABLE_TWO_PASS_AI': true,
      'IOU_AUTO_SETTLEMENT': false,
      'IOU_REMINDER_DAYS': 7,
      
      // 使用者配置
      'NOTIFICATION_CHANNELS': ['email'],
      'NOTIFICATION_LEVEL': 'ERROR',
      'EMAIL_NOTIFICATION': true,
      'WEBHOOK_NOTIFICATION': false,
      'LANGUAGE_PREFERENCE': 'zh-TW',
      'TIMEZONE': 'Asia/Taipei',
      'DATE_FORMAT': 'YYYY-MM-DD',
      'NUMBER_FORMAT': '#,##0.00',
      'AUTO_CATEGORIZE': true,
      'VOICE_LANGUAGE': 'zh-TW',
      'DEFAULT_CATEGORY': '其他'
    };
  }

  /**
   * 類型轉換
   */
  convertType(value) {
    if (value === null || value === undefined) return value;
    
    const str = String(value).toLowerCase();
    
    // 布林值轉換
    if (str === 'true') return true;
    if (str === 'false') return false;
    
    // 數字轉換
    if (!isNaN(value) && !isNaN(parseFloat(value))) {
      return parseFloat(value);
    }
    
    // JSON 轉換
    if ((str.startsWith('{') && str.endsWith('}')) || 
        (str.startsWith('[') && str.endsWith(']'))) {
      try {
        return JSON.parse(value);
      } catch (e) {
        // 如果解析失敗，返回原值
      }
    }
    
    return value;
  }

  /**
   * 快取管理
   */
  isCacheValid(key) {
    if (!this.cache.has(key)) return false;
    
    const expiry = this.cacheExpiry.get(key);
    return expiry && Date.now() < expiry;
  }

  updateCache(key, value) {
    this.cache.set(key, value);
    this.cacheExpiry.set(key, Date.now() + this.CACHE_TTL);
  }

  clearCache() {
    this.cache.clear();
    this.cacheExpiry.clear();
    Logger.log('[ConfigManager] 快取已清除');
  }

  /**
   * 批次獲取配置
   */
  getMultiple(keys) {
    const result = {};
    keys.forEach(key => {
      result[key] = this.get(key);
    });
    return result;
  }

  /**
   * 獲取所有配置
   */
  getAll() {
    const result = {};
    
    // 從 Sheets 獲取所有配置
    try {
      const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
      const settingsSheet = ss.getSheetByName('Settings');
      
      if (settingsSheet) {
        const data = settingsSheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
          if (data[i][0]) {
            result[data[i][0]] = this.convertType(data[i][1]);
          }
        }
      }
    } catch (error) {
      Logger.log(`[ConfigManager] 獲取所有配置失敗: ${error.toString()}`);
    }
    
    return result;
  }

  /**
   * 驗證配置
   */
  validate() {
    const errors = [];
    const requiredConfigs = [
      'MAIN_LEDGER_ID',
      'GEMINI_API_KEY',
      'DEFAULT_CURRENCY'
    ];

    requiredConfigs.forEach(key => {
      const value = this.get(key);
      if (!value || String(value).includes('YOUR_') || String(value).includes('_HERE')) {
        errors.push(`必要配置 ${key} 未設定或使用預設值`);
      }
    });

    // 驗證數值範圍
    const numericValidations = {
      'DUPLICATE_THRESHOLD': { min: 0, max: 1 },
      'AI_CONFIDENCE_THRESHOLD': { min: 0, max: 1 },
      'BATCH_SIZE': { min: 1, max: 100 },
      'API_TIMEOUT': { min: 1000, max: 300000 }
    };

    Object.entries(numericValidations).forEach(([key, range]) => {
      const value = this.get(key);
      if (value !== null && (value < range.min || value > range.max)) {
        errors.push(`配置 ${key} 值 ${value} 超出有效範圍 [${range.min}, ${range.max}]`);
      }
    });

    // 驗證幣別格式
    const currency = this.get('DEFAULT_CURRENCY');
    const supportedCurrencies = this.get('SUPPORTED_CURRENCIES');
    if (currency && supportedCurrencies && !supportedCurrencies.includes(currency)) {
      errors.push(`預設幣別 ${currency} 不在支援清單中`);
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * 記錄配置變更
   */
  logConfigChange(key, oldValue, newValue, user = 'system') {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        key: key,
        oldValue: oldValue,
        newValue: newValue,
        user: user,
        source: 'ConfigManager'
      };
      
      const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
      let logSheet = ss.getSheetByName('ConfigLogs');
      
      if (!logSheet) {
        logSheet = ss.insertSheet('ConfigLogs');
        logSheet.getRange(1, 1, 1, 6).setValues([
          ['Timestamp', 'Key', 'OldValue', 'NewValue', 'User', 'Source']
        ]);
        
        // 格式化標題列
        const headerRange = logSheet.getRange(1, 1, 1, 6);
        headerRange.setBackground('#607d8b');
        headerRange.setFontColor('white');
        headerRange.setFontWeight('bold');
      }
      
      logSheet.appendRow([
        logEntry.timestamp,
        logEntry.key,
        String(logEntry.oldValue),
        String(logEntry.newValue),
        logEntry.user,
        logEntry.source
      ]);
    } catch (error) {
      Logger.log(`[ConfigManager] 記錄配置變更失敗: ${error.toString()}`);
    }
  }
}

// 全域配置管理器實例
const configManager = new ConfigManager();

// =================================================================================================
// 配置管理輔助函數
// =================================================================================================

/**
 * 初始化系統配置
 */
function initializeConfigs() {
  const defaultConfigs = [
    // 系統配置
    ['API_TIMEOUT', 30000, 'API 請求超時時間（毫秒）'],
    ['MAX_RETRY_ATTEMPTS', 3, '最大重試次數'],
    ['BATCH_SIZE', 5, '批次處理大小'],
    ['LOG_LEVEL', 'INFO', '日誌等級：DEBUG, INFO, WARN, ERROR'],
    ['ENABLE_AI_CACHE', true, '啟用 AI 結果快取'],
    
    // 業務配置
    ['DEFAULT_CURRENCY', 'TWD', '預設幣別'],
    ['DUPLICATE_THRESHOLD', 0.8, '重複記錄判定閾值（0-1）'],
    ['AUTO_MERGE_ENABLED', true, '啟用自動合併'],
    ['AI_CONFIDENCE_THRESHOLD', 0.6, 'AI 信心度閾值（0-1）'],
    ['ENABLE_TWO_PASS_AI', true, '啟用兩段式 AI 處理'],
    
    // 使用者配置
    ['LANGUAGE_PREFERENCE', 'zh-TW', '語言偏好'],
    ['TIMEZONE', 'Asia/Taipei', '時區'],
    ['NOTIFICATION_LEVEL', 'ERROR', '通知等級：DEBUG, INFO, WARN, ERROR'],
    ['AUTO_CATEGORIZE', true, '自動分類'],
    ['DEFAULT_CATEGORY', '其他', '預設分類']
  ];

  try {
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
      Logger.log(`✅ 已新增 ${newConfigs.length} 個預設配置`);
    } else {
      Logger.log('ℹ️ 所有預設配置已存在');
    }
    
    // 驗證配置
    const validation = configManager.validate();
    if (!validation.isValid) {
      Logger.log('⚠️ 配置驗證發現問題：');
      validation.errors.forEach(error => Logger.log(`  - ${error}`));
    } else {
      Logger.log('✅ 配置驗證通過');
    }
    
  } catch (error) {
    Logger.log(`❌ 初始化配置失敗: ${error.toString()}`);
    throw error;
  }
}

/**
 * 配置健康檢查
 */
function configHealthCheck() {
  Logger.log('🔍 開始配置健康檢查...');
  
  const validation = configManager.validate();
  const issues = [];
  
  // 檢查必要配置
  if (!validation.isValid) {
    issues.push(...validation.errors);
  }
  
  // 檢查 API 金鑰有效性
  const apiKey = configManager.get('GEMINI_API_KEY');
  if (apiKey && !apiKey.includes('YOUR_')) {
    const apiKeyTest = testApiKey(apiKey);
    if (!apiKeyTest.success) {
      issues.push(`Gemini API 金鑰無效: ${apiKeyTest.error}`);
    }
  }
  
  // 檢查配置值合理性
  const duplicateThreshold = configManager.get('DUPLICATE_THRESHOLD');
  if (duplicateThreshold > 0.95) {
    issues.push('重複判定閾值過高，可能導致重複記錄');
  }
  
  const batchSize = configManager.get('BATCH_SIZE');
  if (batchSize > 50) {
    issues.push('批次處理大小過大，可能影響效能');
  }
  
  // 輸出結果
  if (issues.length === 0) {
    Logger.log('✅ 配置健康檢查通過');
  } else {
    Logger.log('⚠️ 配置健康檢查發現問題：');
    issues.forEach(issue => Logger.log(`  - ${issue}`));
    
    // 發送告警（如果配置了通知）
    if (configManager.get('EMAIL_NOTIFICATION')) {
      sendConfigAlert(issues);
    }
  }
  
  return {
    healthy: issues.length === 0,
    issues: issues
  };
}

/**
 * 測試 API 金鑰
 */
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

/**
 * 發送配置告警
 */
function sendConfigAlert(issues) {
  try {
    const message = `配置健康檢查發現問題:\n${issues.map(issue => `- ${issue}`).join('\n')}`;
    
    // 使用現有的通知系統
    if (typeof sendNotification === 'function') {
      sendNotification('配置告警', message, 'WARNING');
    } else {
      Logger.log('⚠️ 無法發送配置告警：sendNotification 函數不存在');
    }
  } catch (error) {
    Logger.log(`發送配置告警失敗: ${error.toString()}`);
  }
}

/**
 * 配置熱更新
 */
function hotReloadConfigs() {
  Logger.log('🔄 開始配置熱更新...');
  
  try {
    // 清除快取
    configManager.clearCache();
    
    // 重新載入並驗證配置
    const validation = configManager.validate();
    
    if (!validation.isValid) {
      Logger.log('❌ 配置驗證失敗:');
      validation.errors.forEach(error => Logger.log(`  - ${error}`));
      return false;
    }
    
    Logger.log('✅ 配置已成功熱更新');
    return true;
  } catch (error) {
    Logger.log(`❌ 配置熱更新失敗: ${error.toString()}`);
    return false;
  }
}

/**
 * 配置備份
 */
function backupConfigs() {
  try {
    const allConfigs = configManager.getAll();
    const backup = {
      timestamp: new Date().toISOString(),
      version: 'V46.0',
      configs: allConfigs
    };
    
    // 儲存到 Google Drive
    const blob = Utilities.newBlob(
      JSON.stringify(backup, null, 2),
      'application/json',
      `gem-config-backup-${new Date().toISOString().split('T')[0]}.json`
    );
    
    const file = DriveApp.createFile(blob);
    Logger.log(`✅ 配置已備份到 Google Drive: ${file.getName()}`);
    Logger.log(`📁 檔案 ID: ${file.getId()}`);
    
    return file.getId();
  } catch (error) {
    Logger.log(`❌ 配置備份失敗: ${error.toString()}`);
    throw error;
  }
}

/**
 * 顯示當前配置摘要
 */
function showConfigSummary() {
  Logger.log('📊 當前配置摘要：');
  
  const importantConfigs = [
    'DEFAULT_CURRENCY',
    'LANGUAGE_PREFERENCE',
    'TIMEZONE',
    'API_TIMEOUT',
    'BATCH_SIZE',
    'DUPLICATE_THRESHOLD',
    'AUTO_MERGE_ENABLED',
    'NOTIFICATION_LEVEL'
  ];
  
  importantConfigs.forEach(key => {
    const value = configManager.get(key);
    Logger.log(`  ${key}: ${value}`);
  });
  
  // 檢查敏感配置狀態
  const sensitiveConfigs = ['GEMINI_API_KEY', 'MAIN_LEDGER_ID'];
  Logger.log('\n🔒 敏感配置狀態：');
  sensitiveConfigs.forEach(key => {
    const value = configManager.get(key);
    const status = value && !String(value).includes('YOUR_') ? '已設定' : '未設定';
    Logger.log(`  ${key}: ${status}`);
  });
}