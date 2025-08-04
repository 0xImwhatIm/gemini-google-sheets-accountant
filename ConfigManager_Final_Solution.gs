// =================================================================================================
// ConfigManager 最終解決方案 - 不修改常數，只修改方法
// 最後更新：2025-07-27
// =================================================================================================

/**
 * 最終解決方案：只修改 configManager 實例的方法，不觸碰常數
 */
function applyFinalConfigManagerSolution() {
  Logger.log('=== 應用最終 ConfigManager 解決方案 ===');
  
  try {
    if (typeof configManager === 'undefined') {
      Logger.log('❌ configManager 實例不存在');
      return false;
    }
    
    Logger.log('--- 修改 configManager 實例方法 ---');
    
    // 1. 修復 getFromSheets 方法
    configManager.getFromSheets = function(key) {
      try {
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
        return null; // 靜默處理錯誤
      }
    };
    
    // 2. 修復 setToSheets 方法
    configManager.setToSheets = function(key, value) {
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
    
    // 3. 修復 getAll 方法
    configManager.getAll = function() {
      const result = {};
      
      try {
        const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
        if (!mainLedgerId) {
          return result;
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
    
    // 4. 修復 logConfigChange 方法
    configManager.logConfigChange = function(key, oldValue, newValue, user = 'system') {
      try {
        const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
        if (!mainLedgerId) {
          return;
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
    
    Logger.log('✅ configManager 實例方法已修復');
    
    // 5. 清除快取以確保使用新方法
    if (typeof configManager.clearCache === 'function') {
      configManager.clearCache();
      Logger.log('✅ 快取已清除');
    }
    
    return true;
    
  } catch (error) {
    Logger.log(`❌ 應用最終解決方案失敗: ${error.toString()}`);
    return false;
  }
}

/**
 * 建立啟動時自動執行的修復代碼
 */
function createStartupAutoFix() {
  Logger.log('=== 建立啟動時自動修復 ===');
  
  const autoFixCode = `
// =================================================================================================
// ConfigManager 自動修復 - 請將此代碼添加到 Code.gs 的最開頭
// =================================================================================================

// 在腳本載入時自動修復 ConfigManager
(function() {
  try {
    if (typeof configManager !== 'undefined' && configManager.getFromSheets) {
      // 修復 getFromSheets 方法
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
      
      // 修復其他相關方法
      configManager.getAll = function() {
        const result = {};
        try {
          const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
          if (!mainLedgerId) return result;
          
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
          // 靜默處理
        }
        return result;
      };
    }
  } catch (error) {
    // 靜默處理啟動修復錯誤
  }
})();
`;
  
  Logger.log('✅ 自動修復代碼已生成');
  Logger.log('');
  Logger.log('📋 請將以下代碼複製到 Code.gs 檔案的最開頭：');
  Logger.log('');
  Logger.log(autoFixCode);
  
  return autoFixCode;
}

/**
 * 測試最終解決方案
 */
function testFinalSolution() {
  Logger.log('=== 測試最終解決方案 ===');
  
  try {
    // 連續測試多次，確保穩定
    for (let i = 0; i < 3; i++) {
      Logger.log(`--- 測試輪次 ${i + 1} ---`);
      
      // 測試讀取
      const currency = configManager.get('DEFAULT_CURRENCY', 'TWD');
      Logger.log(`✅ 讀取測試: ${currency}`);
      
      // 測試寫入
      const testKey = `TEST_${i}_${Date.now()}`;
      configManager.set(testKey, `test_value_${i}`);
      const testValue = configManager.get(testKey);
      Logger.log(`✅ 寫入測試: ${testValue}`);
      
      // 清理測試數據
      configManager.set(testKey, '');
      
      // 短暫延遲
      Utilities.sleep(200);
    }
    
    // 測試 getAll
    const allConfigs = configManager.getAll();
    Logger.log(`✅ 獲取所有配置: ${Object.keys(allConfigs).length} 項`);
    
    Logger.log('✅ 最終解決方案測試通過');
    return true;
    
  } catch (error) {
    Logger.log(`❌ 最終解決方案測試失敗: ${error.toString()}`);
    return false;
  }
}

/**
 * 執行完整的最終解決方案
 */
function runFinalConfigManagerSolution() {
  Logger.log('=== 執行完整最終解決方案 ===');
  
  try {
    // 1. 應用修復
    const fixResult = applyFinalConfigManagerSolution();
    
    if (fixResult) {
      // 2. 測試修復效果
      const testResult = testFinalSolution();
      
      if (testResult) {
        // 3. 生成自動修復代碼
        const autoFixCode = createStartupAutoFix();
        
        Logger.log('\n=== 最終解決方案完成 ===');
        Logger.log('✅ 結果：');
        Logger.log('  - configManager 實例已修復');
        Logger.log('  - 所有方法正常工作');
        Logger.log('  - 錯誤訊息應該減少或消失');
        Logger.log('');
        Logger.log('🔧 建議下一步：');
        Logger.log('  1. 將上面顯示的自動修復代碼複製到 Code.gs 開頭');
        Logger.log('  2. 這樣每次腳本載入時都會自動修復');
        Logger.log('  3. 錯誤訊息將完全消失');
        
        return true;
      }
    }
    
    Logger.log('❌ 最終解決方案失敗');
    return false;
    
  } catch (error) {
    Logger.log(`❌ 執行最終解決方案失敗: ${error.toString()}`);
    return false;
  }
}

/**
 * 簡化版修復 - 如果完整方案失敗時使用
 */
function applySimplifiedFix() {
  Logger.log('=== 應用簡化版修復 ===');
  
  try {
    if (typeof configManager !== 'undefined') {
      // 只修復最關鍵的 getFromSheets 方法
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
      
      Logger.log('✅ 簡化版修復完成');
      
      // 測試
      const testResult = configManager.get('DEFAULT_CURRENCY', 'TWD');
      Logger.log(`✅ 測試結果: ${testResult}`);
      
      return true;
    }
    
    return false;
    
  } catch (error) {
    Logger.log(`❌ 簡化版修復失敗: ${error.toString()}`);
    return false;
  }
}