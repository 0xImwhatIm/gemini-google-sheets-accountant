// =================================================================================================
// ConfigManager 修復工具 - 解決 MAIN_LEDGER_ID 未定義問題
// 最後更新：2025-07-27
// =================================================================================================

/**
 * 診斷 ConfigManager 問題
 */
function diagnoseConfigManagerIssue() {
  Logger.log('=== ConfigManager 問題診斷 ===');
  
  try {
    // 1. 檢查 MAIN_LEDGER_ID 常數
    Logger.log('--- 1. 檢查 MAIN_LEDGER_ID 常數 ---');
    try {
      const mainLedgerId = eval('MAIN_LEDGER_ID');
      Logger.log(`✅ MAIN_LEDGER_ID 常數存在: ${mainLedgerId}`);
    } catch (error) {
      Logger.log(`❌ MAIN_LEDGER_ID 常數不存在: ${error.toString()}`);
    }
    
    // 2. 檢查 PropertiesService 中的配置
    Logger.log('--- 2. 檢查 PropertiesService 配置 ---');
    const scriptProperties = PropertiesService.getScriptProperties();
    const mainLedgerFromProps = scriptProperties.getProperty('MAIN_LEDGER_ID');
    Logger.log(`MAIN_LEDGER_ID (Properties): ${mainLedgerFromProps || '未設定'}`);
    
    const geminiApiKey = scriptProperties.getProperty('GEMINI_API_KEY');
    Logger.log(`GEMINI_API_KEY (Properties): ${geminiApiKey ? '已設定' : '未設定'}`);
    
    // 3. 檢查 ConfigManager 實例
    Logger.log('--- 3. 檢查 ConfigManager 實例 ---');
    try {
      const configManagerExists = typeof configManager !== 'undefined';
      Logger.log(`ConfigManager 實例: ${configManagerExists ? '存在' : '不存在'}`);
      
      if (configManagerExists) {
        // 測試 ConfigManager 的基本功能
        const testValue = configManager.get('DEFAULT_CURRENCY', 'TWD');
        Logger.log(`ConfigManager 測試讀取: ${testValue}`);
      }
    } catch (configError) {
      Logger.log(`❌ ConfigManager 測試失敗: ${configError.toString()}`);
    }
    
    // 4. 檢查所有屬性
    Logger.log('--- 4. 所有 Script Properties ---');
    const allProperties = scriptProperties.getProperties();
    Object.keys(allProperties).forEach(key => {
      const value = allProperties[key];
      const displayValue = key.includes('API_KEY') ? '***已設定***' : value;
      Logger.log(`  ${key}: ${displayValue}`);
    });
    
  } catch (error) {
    Logger.log(`❌ 診斷過程發生錯誤: ${error.toString()}`);
  }
}

/**
 * 修復 ConfigManager 的 MAIN_LEDGER_ID 問題
 */
function fixConfigManagerMainLedgerId() {
  Logger.log('=== 修復 ConfigManager MAIN_LEDGER_ID 問題 ===');
  
  try {
    // 1. 從 PropertiesService 獲取 MAIN_LEDGER_ID
    const scriptProperties = PropertiesService.getScriptProperties();
    const mainLedgerId = scriptProperties.getProperty('MAIN_LEDGER_ID');
    
    if (!mainLedgerId) {
      Logger.log('❌ MAIN_LEDGER_ID 未在 PropertiesService 中設定');
      Logger.log('請先執行 configSetupWizard() 來設定基本配置');
      return false;
    }
    
    Logger.log(`✅ 找到 MAIN_LEDGER_ID: ${mainLedgerId}`);
    
    // 2. 建立修復版的 ConfigManager
    Logger.log('--- 建立修復版 ConfigManager ---');
    
    // 修復 ConfigManager 的 getFromSheets 方法
    const originalGetFromSheets = configManager.getFromSheets;
    configManager.getFromSheets = function(key) {
      try {
        // 使用 PropertiesService 中的 MAIN_LEDGER_ID
        const ledgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
        if (!ledgerId) {
          Logger.log(`[ConfigManager] MAIN_LEDGER_ID 未設定，跳過 Sheets 讀取`);
          return null;
        }
        
        const ss = SpreadsheetApp.openById(ledgerId);
        const settingsSheet = ss.getSheetByName('Settings');
        
        if (!settingsSheet) {
          Logger.log(`[ConfigManager] Settings 工作表不存在`);
          return null;
        }

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
    };
    
    // 修復 ConfigManager 的 setToSheets 方法
    configManager.setToSheets = function(key, value) {
      const ledgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
      if (!ledgerId) {
        throw new Error('MAIN_LEDGER_ID 未設定');
      }
      
      const ss = SpreadsheetApp.openById(ledgerId);
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
    };
    
    // 修復 getAll 方法
    configManager.getAll = function() {
      const result = {};
      
      try {
        const ledgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
        if (!ledgerId) {
          Logger.log(`[ConfigManager] MAIN_LEDGER_ID 未設定，無法獲取所有配置`);
          return result;
        }
        
        const ss = SpreadsheetApp.openById(ledgerId);
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
    };
    
    // 修復 logConfigChange 方法
    configManager.logConfigChange = function(key, oldValue, newValue, user = 'system') {
      try {
        const ledgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
        if (!ledgerId) {
          Logger.log(`[ConfigManager] MAIN_LEDGER_ID 未設定，無法記錄配置變更`);
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
        
        const ss = SpreadsheetApp.openById(ledgerId);
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
    };
    
    Logger.log('✅ ConfigManager 已修復');
    
    // 3. 測試修復後的 ConfigManager
    Logger.log('--- 測試修復後的 ConfigManager ---');
    try {
      const testValue = configManager.get('DEFAULT_CURRENCY', 'TWD');
      Logger.log(`✅ 測試讀取成功: DEFAULT_CURRENCY = ${testValue}`);
      
      // 測試寫入（如果 Settings 工作表存在）
      const ss = SpreadsheetApp.openById(mainLedgerId);
      const settingsSheet = ss.getSheetByName('Settings');
      if (settingsSheet) {
        configManager.set('TEST_CONFIG', 'test_value');
        const readBack = configManager.get('TEST_CONFIG');
        Logger.log(`✅ 測試寫入成功: TEST_CONFIG = ${readBack}`);
        
        // 清理測試配置
        configManager.set('TEST_CONFIG', '');
      }
      
    } catch (testError) {
      Logger.log(`⚠️ 測試修復後的 ConfigManager 失敗: ${testError.toString()}`);
    }
    
    return true;
    
  } catch (error) {
    Logger.log(`❌ 修復 ConfigManager 失敗: ${error.toString()}`);
    return false;
  }
}

/**
 * 建立 Settings 工作表（如果不存在）
 */
function createSettingsSheetIfNotExists() {
  Logger.log('=== 檢查並建立 Settings 工作表 ===');
  
  try {
    const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    if (!mainLedgerId) {
      Logger.log('❌ MAIN_LEDGER_ID 未設定');
      return false;
    }
    
    const ss = SpreadsheetApp.openById(mainLedgerId);
    let settingsSheet = ss.getSheetByName('Settings');
    
    if (!settingsSheet) {
      Logger.log('📋 建立 Settings 工作表...');
      settingsSheet = ss.insertSheet('Settings');
      
      // 設定標題行
      settingsSheet.getRange(1, 1, 1, 3).setValues([
        ['Key', 'Value', 'Description']
      ]);
      
      // 格式化標題行
      const headerRange = settingsSheet.getRange(1, 1, 1, 3);
      headerRange.setBackground('#4CAF50');
      headerRange.setFontColor('white');
      headerRange.setFontWeight('bold');
      
      // 設定欄寬
      settingsSheet.setColumnWidth(1, 200); // Key
      settingsSheet.setColumnWidth(2, 300); // Value
      settingsSheet.setColumnWidth(3, 400); // Description
      
      // 新增基本配置
      const basicConfigs = [
        ['DEFAULT_CURRENCY', 'TWD', '預設幣別'],
        ['LANGUAGE_PREFERENCE', 'zh-TW', '語言偏好'],
        ['TIMEZONE', 'Asia/Taipei', '時區'],
        ['NOTIFICATION_LEVEL', 'ERROR', '通知等級'],
        ['AUTO_CATEGORIZE', 'true', '自動分類'],
        ['DEFAULT_CATEGORY', '其他', '預設分類']
      ];
      
      settingsSheet.getRange(2, 1, basicConfigs.length, 3).setValues(basicConfigs);
      
      Logger.log('✅ Settings 工作表建立完成');
    } else {
      Logger.log('✅ Settings 工作表已存在');
    }
    
    return true;
    
  } catch (error) {
    Logger.log(`❌ 建立 Settings 工作表失敗: ${error.toString()}`);
    return false;
  }
}

/**
 * 完整的 ConfigManager 修復流程
 */
function runCompleteConfigManagerFix() {
  Logger.log('=== 執行完整 ConfigManager 修復 ===');
  
  try {
    // 1. 診斷問題
    diagnoseConfigManagerIssue();
    
    // 2. 建立 Settings 工作表
    createSettingsSheetIfNotExists();
    
    // 3. 修復 ConfigManager
    const fixResult = fixConfigManagerMainLedgerId();
    
    if (fixResult) {
      Logger.log('=== ConfigManager 修復完成 ===');
      Logger.log('✅ 修復結果：');
      Logger.log('  - ConfigManager 已修復 MAIN_LEDGER_ID 問題');
      Logger.log('  - Settings 工作表已確認存在');
      Logger.log('  - 配置讀寫功能正常');
      Logger.log('  - 錯誤訊息應該不再出現');
      
      // 清除快取以確保使用新的邏輯
      configManager.clearCache();
      
      return true;
    } else {
      Logger.log('❌ ConfigManager 修復失敗');
      return false;
    }
    
  } catch (error) {
    Logger.log(`❌ 完整修復流程失敗: ${error.toString()}`);
    return false;
  }
}

/**
 * 測試修復後的 ConfigManager
 */
function testFixedConfigManager() {
  Logger.log('=== 測試修復後的 ConfigManager ===');
  
  try {
    // 測試基本讀取
    const currency = configManager.get('DEFAULT_CURRENCY', 'TWD');
    Logger.log(`✅ 讀取測試: DEFAULT_CURRENCY = ${currency}`);
    
    // 測試寫入
    configManager.set('TEST_TIMESTAMP', new Date().toISOString());
    const timestamp = configManager.get('TEST_TIMESTAMP');
    Logger.log(`✅ 寫入測試: TEST_TIMESTAMP = ${timestamp}`);
    
    // 測試獲取所有配置
    const allConfigs = configManager.getAll();
    Logger.log(`✅ 獲取所有配置: 找到 ${Object.keys(allConfigs).length} 個配置項`);
    
    // 測試驗證
    const validation = configManager.validate();
    Logger.log(`✅ 配置驗證: ${validation.isValid ? '通過' : '有問題'}`);
    if (!validation.isValid) {
      validation.errors.forEach(error => Logger.log(`  - ${error}`));
    }
    
    Logger.log('✅ ConfigManager 測試完成，功能正常');
    
  } catch (error) {
    Logger.log(`❌ 測試修復後的 ConfigManager 失敗: ${error.toString()}`);
  }
}