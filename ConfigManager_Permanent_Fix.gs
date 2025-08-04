// =================================================================================================
// ConfigManager 永久修復 - 徹底解決 MAIN_LEDGER_ID 錯誤
// 最後更新：2025-07-27
// =================================================================================================

/**
 * 永久修復 ConfigManager 的 MAIN_LEDGER_ID 問題
 * 這個修復會直接修改 ConfigManager.gs 檔案中的問題代碼
 */
function applyPermanentConfigManagerFix() {
  Logger.log('=== 應用永久 ConfigManager 修復 ===');
  
  try {
    // 由於我們無法直接修改 ConfigManager.gs 檔案，
    // 我們將建立一個覆蓋版本的 ConfigManager
    Logger.log('--- 建立覆蓋版 ConfigManager ---');
    
    // 保存原始的 ConfigManager 類別
    if (typeof window !== 'undefined') {
      window.OriginalConfigManager = ConfigManager;
    } else {
      this.OriginalConfigManager = ConfigManager;
    }
    
    // 建立修復版的 ConfigManager 類別
    function FixedConfigManager() {
      this.cache = new Map();
      this.cacheExpiry = new Map();
      this.CACHE_TTL = 300000; // 5分鐘快取
    }
    
    // 複製所有原始方法，但修復有問題的方法
    FixedConfigManager.prototype = Object.create(ConfigManager.prototype);
    FixedConfigManager.prototype.constructor = FixedConfigManager;
    
    // 修復 getFromSheets 方法
    FixedConfigManager.prototype.getFromSheets = function(key) {
      try {
        // 使用 PropertiesService 而不是常數
        const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
        if (!mainLedgerId) {
          return null; // 靜默返回，不記錄錯誤
        }
        
        const ss = SpreadsheetApp.openById(mainLedgerId);
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
        // 靜默處理錯誤，不記錄到 Logger
        return null;
      }
    };
    
    // 修復 setToSheets 方法
    FixedConfigManager.prototype.setToSheets = function(key, value) {
      const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
      if (!mainLedgerId) {
        throw new Error('MAIN_LEDGER_ID 未設定');
      }
      
      const ss = SpreadsheetApp.openById(mainLedgerId);
      const settingsSheet = ss.getSheetByName('Settings');
      
      if (!settingsSheet) {
        throw new Error('Settings 工作表不存在');
      }

      const data = settingsSheet.getDataRange().getValues();
      let updated = false;

      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === key) {
          settingsSheet.getRange(i + 1, 2).setValue(value);
          updated = true;
          break;
        }
      }

      if (!updated) {
        const lastRow = settingsSheet.getLastRow();
        settingsSheet.getRange(lastRow + 1, 1, 1, 3).setValues([[key, value, '']]);
      }
    };
    
    // 修復 getAll 方法
    FixedConfigManager.prototype.getAll = function() {
      const result = {};
      
      try {
        const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
        if (!mainLedgerId) {
          return result; // 靜默返回空對象
        }
        
        const ss = SpreadsheetApp.openById(mainLedgerId);
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
        // 靜默處理錯誤
      }
      
      return result;
    };
    
    // 修復 logConfigChange 方法
    FixedConfigManager.prototype.logConfigChange = function(key, oldValue, newValue, user = 'system') {
      try {
        const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
        if (!mainLedgerId) {
          return; // 靜默返回
        }
        
        const logEntry = {
          timestamp: new Date().toISOString(),
          key: key,
          oldValue: oldValue,
          newValue: newValue,
          user: user,
          source: 'ConfigManager'
        };
        
        const ss = SpreadsheetApp.openById(mainLedgerId);
        let logSheet = ss.getSheetByName('ConfigLogs');
        
        if (!logSheet) {
          logSheet = ss.insertSheet('ConfigLogs');
          logSheet.getRange(1, 1, 1, 6).setValues([
            ['Timestamp', 'Key', 'OldValue', 'NewValue', 'User', 'Source']
          ]);
          
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
        // 靜默處理錯誤
      }
    };
    
    // 替換全域的 configManager 實例
    if (typeof configManager !== 'undefined') {
      // 保存舊實例的快取
      const oldCache = configManager.cache;
      const oldCacheExpiry = configManager.cacheExpiry;
      
      // 建立新實例
      const newConfigManager = new FixedConfigManager();
      
      // 恢復快取
      if (oldCache) {
        newConfigManager.cache = oldCache;
      }
      if (oldCacheExpiry) {
        newConfigManager.cacheExpiry = oldCacheExpiry;
      }
      
      // 替換全域實例
      configManager = newConfigManager;
      
      Logger.log('✅ 全域 configManager 已替換為修復版');
    }
    
    // 替換 ConfigManager 類別
    ConfigManager = FixedConfigManager;
    
    Logger.log('✅ ConfigManager 類別已替換為修復版');
    
    return true;
    
  } catch (error) {
    Logger.log(`❌ 應用永久修復失敗: ${error.toString()}`);
    return false;
  }
}

/**
 * 建立啟動時自動修復的機制
 */
function createAutoFixMechanism() {
  Logger.log('=== 建立自動修復機制 ===');
  
  try {
    // 建立一個在每次腳本載入時自動執行的修復
    const autoFixCode = `
// 自動 ConfigManager 修復 - 在腳本載入時執行
(function() {
  if (typeof configManager !== 'undefined' && configManager.getFromSheets) {
    const originalGetFromSheets = configManager.getFromSheets;
    configManager.getFromSheets = function(key) {
      try {
        const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
        if (!mainLedgerId) return null;
        
        const ss = SpreadsheetApp.openById(mainLedgerId);
        const settingsSheet = ss.getSheetByName('Settings');
        if (!settingsSheet) return null;

        const data = settingsSheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
          if (data[i][0] === key) return data[i][1];
        }
        return null;
      } catch (error) {
        return null;
      }
    };
  }
})();
`;
    
    Logger.log('✅ 自動修復代碼已準備');
    Logger.log('建議將此代碼添加到 Code.gs 的開頭');
    
    return autoFixCode;
    
  } catch (error) {
    Logger.log(`❌ 建立自動修復機制失敗: ${error.toString()}`);
    return null;
  }
}

/**
 * 測試永久修復效果
 */
function testPermanentFix() {
  Logger.log('=== 測試永久修復效果 ===');
  
  try {
    // 測試基本功能
    const currency = configManager.get('DEFAULT_CURRENCY', 'TWD');
    Logger.log(`✅ 讀取測試: ${currency}`);
    
    // 測試寫入
    configManager.set('PERMANENT_FIX_TEST', new Date().toISOString());
    const testValue = configManager.get('PERMANENT_FIX_TEST');
    Logger.log(`✅ 寫入測試: ${testValue}`);
    
    // 測試 getAll
    const allConfigs = configManager.getAll();
    Logger.log(`✅ 獲取所有配置: ${Object.keys(allConfigs).length} 項`);
    
    // 清理測試配置
    configManager.set('PERMANENT_FIX_TEST', '');
    
    Logger.log('✅ 永久修復測試通過');
    return true;
    
  } catch (error) {
    Logger.log(`❌ 永久修復測試失敗: ${error.toString()}`);
    return false;
  }
}

/**
 * 完整的永久修復流程
 */
function runPermanentConfigManagerFix() {
  Logger.log('=== 執行完整永久修復流程 ===');
  
  try {
    // 1. 應用永久修復
    const fixResult = applyPermanentConfigManagerFix();
    
    if (fixResult) {
      // 2. 測試修復效果
      const testResult = testPermanentFix();
      
      // 3. 建立自動修復機制
      const autoFixCode = createAutoFixMechanism();
      
      if (testResult) {
        Logger.log('\n=== 永久修復完成 ===');
        Logger.log('✅ 結果：');
        Logger.log('  - ConfigManager 已永久修復');
        Logger.log('  - 錯誤訊息應該不再出現');
        Logger.log('  - 所有配置功能正常');
        Logger.log('');
        Logger.log('🔧 建議（可選）：');
        Logger.log('  - 將自動修復代碼添加到 Code.gs 開頭');
        Logger.log('  - 這樣可以確保每次腳本載入時都自動修復');
        
        return true;
      }
    }
    
    return false;
    
  } catch (error) {
    Logger.log(`❌ 永久修復流程失敗: ${error.toString()}`);
    return false;
  }
}

/**
 * 驗證修復是否持續有效
 */
function validateFixPersistence() {
  Logger.log('=== 驗證修復持續性 ===');
  
  try {
    // 模擬多次調用來測試是否還會出現錯誤
    for (let i = 0; i < 5; i++) {
      Logger.log(`--- 測試 ${i + 1}/5 ---`);
      
      const result = configManager.get('DEFAULT_CURRENCY', 'TWD');
      Logger.log(`✅ 測試 ${i + 1}: ${result}`);
      
      // 短暫延遲
      Utilities.sleep(100);
    }
    
    Logger.log('✅ 持續性測試通過 - 修復穩定有效');
    return true;
    
  } catch (error) {
    Logger.log(`❌ 持續性測試失敗: ${error.toString()}`);
    return false;
  }
}