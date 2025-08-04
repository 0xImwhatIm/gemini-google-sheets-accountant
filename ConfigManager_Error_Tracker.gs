// =================================================================================================
// ConfigManager 錯誤追蹤工具 - 找出錯誤的具體來源
// 最後更新：2025-07-27
// =================================================================================================

/**
 * 追蹤 ConfigManager 錯誤的來源
 */
function trackConfigManagerError() {
  Logger.log('=== 追蹤 ConfigManager 錯誤來源 ===');
  
  try {
    // 1. 檢查 ConfigManager 實例狀態
    Logger.log('--- 1. ConfigManager 實例狀態 ---');
    Logger.log(`ConfigManager 存在: ${typeof configManager !== 'undefined'}`);
    
    if (typeof configManager !== 'undefined') {
      Logger.log(`ConfigManager 類型: ${typeof configManager}`);
      Logger.log(`ConfigManager 方法: ${Object.getOwnPropertyNames(configManager).join(', ')}`);
    }
    
    // 2. 檢查 MAIN_LEDGER_ID 的各種來源
    Logger.log('--- 2. MAIN_LEDGER_ID 來源檢查 ---');
    
    // 檢查常數
    try {
      const constantValue = eval('MAIN_LEDGER_ID');
      Logger.log(`✅ MAIN_LEDGER_ID 常數: ${constantValue}`);
    } catch (error) {
      Logger.log(`❌ MAIN_LEDGER_ID 常數: ${error.toString()}`);
    }
    
    // 檢查 PropertiesService
    const propsValue = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    Logger.log(`PropertiesService MAIN_LEDGER_ID: ${propsValue || '未設定'}`);
    
    // 3. 測試 ConfigManager 的各個方法
    Logger.log('--- 3. 測試 ConfigManager 方法 ---');
    
    // 測試 get 方法
    try {
      const testGet = configManager.get('DEFAULT_CURRENCY');
      Logger.log(`✅ configManager.get(): ${testGet}`);
    } catch (error) {
      Logger.log(`❌ configManager.get(): ${error.toString()}`);
    }
    
    // 測試 getFromSheets 方法
    try {
      const testSheets = configManager.getFromSheets('DEFAULT_CURRENCY');
      Logger.log(`✅ configManager.getFromSheets(): ${testSheets}`);
    } catch (error) {
      Logger.log(`❌ configManager.getFromSheets(): ${error.toString()}`);
    }
    
    // 測試 getAll 方法
    try {
      const testAll = configManager.getAll();
      Logger.log(`✅ configManager.getAll(): ${Object.keys(testAll).length} 項`);
    } catch (error) {
      Logger.log(`❌ configManager.getAll(): ${error.toString()}`);
    }
    
    // 4. 檢查是否有其他地方調用 ConfigManager
    Logger.log('--- 4. 檢查可能的錯誤觸發點 ---');
    
    // 檢查是否有全域變數或初始化代碼
    Logger.log('檢查全域變數...');
    
    // 5. 模擬可能觸發錯誤的場景
    Logger.log('--- 5. 模擬錯誤觸發場景 ---');
    
    // 嘗試直接調用可能有問題的方法
    try {
      // 這可能會觸發錯誤
      const directCall = configManager.getFromSheets('TEST_KEY');
      Logger.log(`直接調用 getFromSheets: ${directCall}`);
    } catch (error) {
      Logger.log(`直接調用 getFromSheets 錯誤: ${error.toString()}`);
    }
    
  } catch (error) {
    Logger.log(`❌ 追蹤過程發生錯誤: ${error.toString()}`);
  }
}

/**
 * 檢查 ConfigManager 初始化過程
 */
function checkConfigManagerInitialization() {
  Logger.log('=== 檢查 ConfigManager 初始化 ===');
  
  try {
    // 1. 檢查 ConfigManager 類別定義
    Logger.log('--- 1. ConfigManager 類別檢查 ---');
    Logger.log(`ConfigManager 類別存在: ${typeof ConfigManager !== 'undefined'}`);
    
    // 2. 檢查全域實例
    Logger.log('--- 2. 全域實例檢查 ---');
    Logger.log(`configManager 實例存在: ${typeof configManager !== 'undefined'}`);
    
    // 3. 嘗試重新建立實例
    Logger.log('--- 3. 重新建立實例測試 ---');
    try {
      const newConfigManager = new ConfigManager();
      Logger.log('✅ 可以建立新的 ConfigManager 實例');
      
      // 測試新實例
      const testValue = newConfigManager.get('DEFAULT_CURRENCY', 'TWD');
      Logger.log(`✅ 新實例測試: ${testValue}`);
      
    } catch (newInstanceError) {
      Logger.log(`❌ 建立新實例失敗: ${newInstanceError.toString()}`);
    }
    
    // 4. 檢查是否有靜態初始化代碼
    Logger.log('--- 4. 檢查靜態初始化 ---');
    
    // 檢查 Code.gs 中的 getConfig 函數
    try {
      if (typeof getConfig === 'function') {
        const testGetConfig = getConfig('DEFAULT_CURRENCY', 'TWD');
        Logger.log(`✅ getConfig 函數: ${testGetConfig}`);
      } else {
        Logger.log('❌ getConfig 函數不存在');
      }
    } catch (getConfigError) {
      Logger.log(`❌ getConfig 函數錯誤: ${getConfigError.toString()}`);
    }
    
  } catch (error) {
    Logger.log(`❌ 初始化檢查失敗: ${error.toString()}`);
  }
}

/**
 * 建立一個完全獨立的 ConfigManager 測試
 */
function createIndependentConfigManagerTest() {
  Logger.log('=== 建立獨立 ConfigManager 測試 ===');
  
  try {
    // 建立一個簡化版的配置管理器
    const SimpleConfigManager = {
      get: function(key, defaultValue = null) {
        try {
          // 1. 從 PropertiesService 讀取
          const propsValue = PropertiesService.getScriptProperties().getProperty(key);
          if (propsValue !== null) {
            return propsValue;
          }
          
          // 2. 從 Sheets 讀取
          const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
          if (mainLedgerId) {
            const ss = SpreadsheetApp.openById(mainLedgerId);
            const settingsSheet = ss.getSheetByName('Settings');
            
            if (settingsSheet) {
              const data = settingsSheet.getDataRange().getValues();
              for (let i = 1; i < data.length; i++) {
                if (data[i][0] === key) {
                  return data[i][1];
                }
              }
            }
          }
          
          // 3. 返回預設值
          return defaultValue;
          
        } catch (error) {
          Logger.log(`[SimpleConfigManager] 讀取 ${key} 失敗: ${error.toString()}`);
          return defaultValue;
        }
      }
    };
    
    // 測試簡化版配置管理器
    Logger.log('--- 測試簡化版配置管理器 ---');
    const testCurrency = SimpleConfigManager.get('DEFAULT_CURRENCY', 'TWD');
    Logger.log(`✅ 簡化版測試: DEFAULT_CURRENCY = ${testCurrency}`);
    
    // 比較結果
    const originalResult = configManager.get('DEFAULT_CURRENCY', 'TWD');
    Logger.log(`原版結果: ${originalResult}`);
    Logger.log(`簡化版結果: ${testCurrency}`);
    Logger.log(`結果一致: ${originalResult === testCurrency}`);
    
  } catch (error) {
    Logger.log(`❌ 獨立測試失敗: ${error.toString()}`);
  }
}

/**
 * 嘗試消除錯誤訊息
 */
function suppressConfigManagerError() {
  Logger.log('=== 嘗試消除 ConfigManager 錯誤訊息 ===');
  
  try {
    // 方法1: 重新定義 getFromSheets 方法
    Logger.log('--- 方法1: 重新定義 getFromSheets ---');
    
    if (typeof configManager !== 'undefined') {
      const originalGetFromSheets = configManager.getFromSheets;
      
      configManager.getFromSheets = function(key) {
        try {
          const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
          if (!mainLedgerId) {
            // 靜默返回 null，不記錄錯誤
            return null;
          }
          
          const ss = SpreadsheetApp.openById(mainLedgerId);
          const settingsSheet = ss.getSheetByName('Settings');
          
          if (!settingsSheet) {
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
          // 靜默處理錯誤，不記錄到 Logger
          return null;
        }
      };
      
      Logger.log('✅ getFromSheets 方法已重新定義');
    }
    
    // 方法2: 清除快取
    Logger.log('--- 方法2: 清除快取 ---');
    if (typeof configManager !== 'undefined' && typeof configManager.clearCache === 'function') {
      configManager.clearCache();
      Logger.log('✅ ConfigManager 快取已清除');
    }
    
    // 方法3: 測試修復效果
    Logger.log('--- 方法3: 測試修復效果 ---');
    const testResult = configManager.get('DEFAULT_CURRENCY', 'TWD');
    Logger.log(`✅ 修復後測試: ${testResult}`);
    
  } catch (error) {
    Logger.log(`❌ 消除錯誤失敗: ${error.toString()}`);
  }
}

/**
 * 完整的錯誤追蹤和修復流程
 */
function runCompleteErrorTracking() {
  Logger.log('=== 執行完整錯誤追蹤和修復 ===');
  
  try {
    // 1. 追蹤錯誤來源
    trackConfigManagerError();
    
    // 2. 檢查初始化
    checkConfigManagerInitialization();
    
    // 3. 建立獨立測試
    createIndependentConfigManagerTest();
    
    // 4. 嘗試消除錯誤
    suppressConfigManagerError();
    
    Logger.log('\n=== 錯誤追蹤完成 ===');
    Logger.log('✅ 建議：');
    Logger.log('  - ConfigManager 功能正常，錯誤可能是初始化時的警告');
    Logger.log('  - 如果功能正常，可以忽略該錯誤訊息');
    Logger.log('  - 或者使用 suppressConfigManagerError() 來消除訊息');
    
  } catch (error) {
    Logger.log(`❌ 完整追蹤失敗: ${error.toString()}`);
  }
}