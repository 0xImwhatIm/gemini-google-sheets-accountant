// =================================================================================================
// Google Sheets 工作表重新整理工具
// 解決 ConfigManager 與現有工作表的命名衝突
// 最後更新：2025-07-27
// =================================================================================================

/**
 * 分析現有工作表結構
 */
function analyzeCurrentSheetStructure() {
  Logger.log('=== 分析現有工作表結構 ===');
  
  try {
    const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    if (!mainLedgerId) {
      Logger.log('❌ MAIN_LEDGER_ID 未設定');
      return;
    }
    
    const ss = SpreadsheetApp.openById(mainLedgerId);
    const sheets = ss.getSheets();
    
    Logger.log(`📊 總共有 ${sheets.length} 個工作表：`);
    
    sheets.forEach((sheet, index) => {
      const name = sheet.getName();
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      
      Logger.log(`\n${index + 1}. 工作表名稱: ${name}`);
      Logger.log(`   資料範圍: ${lastRow} 行 x ${lastCol} 欄`);
      
      // 檢查前幾行的內容來判斷用途
      if (lastRow > 0 && lastCol > 0) {
        const headerRange = sheet.getRange(1, 1, Math.min(3, lastRow), lastCol);
        const headerValues = headerRange.getValues();
        
        Logger.log(`   標題行: ${JSON.stringify(headerValues[0])}`);
        
        // 特別分析 Settings 相關工作表
        if (name === 'Settings') {
          Logger.log('   🔍 這是通知設定工作表 (Channel | Target | Level)');
          Logger.log('   ⚠️  與 ConfigManager 期望的格式衝突');
        } else if (name === '_Setting') {
          Logger.log('   🔍 這是幣別設定工作表');
        } else if (name === 'All Records') {
          Logger.log('   🔍 這是主要記帳資料表');
        }
      }
    });
    
    // 檢查是否有 ConfigManager 需要的工作表
    const configSheet = ss.getSheetByName('Settings');
    if (configSheet) {
      const data = configSheet.getDataRange().getValues();
      if (data.length > 0) {
        const headers = data[0];
        if (headers.includes('Channel') && headers.includes('Target')) {
          Logger.log('\n⚠️  發現衝突：現有 Settings 工作表是通知設定格式');
          Logger.log('   ConfigManager 需要 Key-Value 格式的 Settings 工作表');
        }
      }
    }
    
  } catch (error) {
    Logger.log(`❌ 分析工作表結構失敗: ${error.toString()}`);
  }
}

/**
 * 重新整理工作表命名
 */
function reorganizeSheetNames() {
  Logger.log('=== 重新整理工作表命名 ===');
  
  try {
    const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    const ss = SpreadsheetApp.openById(mainLedgerId);
    
    // 1. 重新命名現有的 Settings 工作表
    const currentSettingsSheet = ss.getSheetByName('Settings');
    if (currentSettingsSheet) {
      Logger.log('📝 重新命名 Settings → NotificationSettings');
      currentSettingsSheet.setName('NotificationSettings');
    }
    
    // 2. 重新命名 _Setting 工作表
    const currentSettingSheet = ss.getSheetByName('_Setting');
    if (currentSettingSheet) {
      Logger.log('📝 重新命名 _Setting → SupportedCurrencies');
      currentSettingSheet.setName('SupportedCurrencies');
    }
    
    // 3. 建立新的 Settings 工作表給 ConfigManager 使用
    Logger.log('📋 建立新的 Settings 工作表給 ConfigManager');
    const newSettingsSheet = ss.insertSheet('Settings');
    
    // 設定 ConfigManager 需要的格式
    newSettingsSheet.getRange(1, 1, 1, 3).setValues([
      ['Key', 'Value', 'Description']
    ]);
    
    // 格式化標題行
    const headerRange = newSettingsSheet.getRange(1, 1, 1, 3);
    headerRange.setBackground('#4CAF50');
    headerRange.setFontColor('white');
    headerRange.setFontWeight('bold');
    
    // 設定欄寬
    newSettingsSheet.setColumnWidth(1, 200); // Key
    newSettingsSheet.setColumnWidth(2, 300); // Value
    newSettingsSheet.setColumnWidth(3, 400); // Description
    
    // 新增基本配置
    const basicConfigs = [
      ['DEFAULT_CURRENCY', 'TWD', '預設幣別'],
      ['LANGUAGE_PREFERENCE', 'zh-TW', '語言偏好'],
      ['TIMEZONE', 'Asia/Taipei', '時區'],
      ['NOTIFICATION_LEVEL', 'ERROR', '通知等級'],
      ['AUTO_CATEGORIZE', 'true', '自動分類'],
      ['DEFAULT_CATEGORY', '其他', '預設分類'],
      ['API_TIMEOUT', '30000', 'API 請求超時時間（毫秒）'],
      ['BATCH_SIZE', '5', '批次處理大小'],
      ['DUPLICATE_THRESHOLD', '0.8', '重複記錄判定閾值'],
      ['AUTO_MERGE_ENABLED', 'true', '啟用自動合併']
    ];
    
    newSettingsSheet.getRange(2, 1, basicConfigs.length, 3).setValues(basicConfigs);
    
    Logger.log('✅ 工作表重新整理完成');
    
    // 4. 顯示重新整理後的結構
    Logger.log('\n📊 重新整理後的工作表結構：');
    Logger.log('  - NotificationSettings: 通知設定 (原 Settings)');
    Logger.log('  - SupportedCurrencies: 支援幣別 (原 _Setting)');
    Logger.log('  - Settings: ConfigManager 系統配置 (新建)');
    Logger.log('  - All Records: 主要記帳資料 (不變)');
    Logger.log('  - 其他工作表: 保持不變');
    
    return true;
    
  } catch (error) {
    Logger.log(`❌ 重新整理工作表失敗: ${error.toString()}`);
    return false;
  }
}

/**
 * 更新程式碼中的工作表引用
 */
function updateSheetReferences() {
  Logger.log('=== 更新程式碼中的工作表引用建議 ===');
  
  Logger.log('📝 需要更新的程式碼引用：');
  Logger.log('');
  Logger.log('1. 通知相關程式碼：');
  Logger.log('   將 "Settings" 改為 "NotificationSettings"');
  Logger.log('   例如：ss.getSheetByName("NotificationSettings")');
  Logger.log('');
  Logger.log('2. 幣別相關程式碼：');
  Logger.log('   將 "_Setting" 改為 "SupportedCurrencies"');
  Logger.log('   例如：ss.getSheetByName("SupportedCurrencies")');
  Logger.log('');
  Logger.log('3. ConfigManager：');
  Logger.log('   現在可以正常使用 "Settings" 工作表');
  Logger.log('');
  
  // 檢查是否有程式碼需要更新
  Logger.log('⚠️  請檢查以下檔案是否需要更新工作表名稱：');
  Logger.log('   - 通知相關函數');
  Logger.log('   - 幣別處理函數');
  Logger.log('   - 任何直接引用 "Settings" 或 "_Setting" 的程式碼');
}

/**
 * 建立工作表引用更新函數
 */
function createUpdatedSheetReferenceFunctions() {
  Logger.log('=== 建立更新後的工作表引用函數 ===');
  
  // 這些函數可以複製到相關的程式碼中使用
  
  const updatedFunctions = `
// 更新後的通知設定讀取函數
function getNotificationSettings() {
  try {
    const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
    const notificationSheet = ss.getSheetByName('NotificationSettings'); // 更新的名稱
    
    if (!notificationSheet) return [];
    
    const data = notificationSheet.getDataRange().getValues();
    const settings = [];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        settings.push({
          channel: data[i][0],
          target: data[i][1],
          level: data[i][2]
        });
      }
    }
    
    return settings;
  } catch (error) {
    Logger.log('讀取通知設定失敗: ' + error.toString());
    return [];
  }
}

// 更新後的支援幣別讀取函數
function getSupportedCurrencies() {
  try {
    const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
    const currencySheet = ss.getSheetByName('SupportedCurrencies'); // 更新的名稱
    
    if (!currencySheet) return ['TWD', 'USD', 'JPY', 'EUR', 'CNY'];
    
    const data = currencySheet.getDataRange().getValues();
    const currencies = [];
    
    for (let i = 0; i < data.length; i++) {
      if (data[i][0]) {
        currencies.push(data[i][0]);
      }
    }
    
    return currencies.length > 0 ? currencies : ['TWD', 'USD', 'JPY', 'EUR', 'CNY'];
  } catch (error) {
    Logger.log('讀取支援幣別失敗: ' + error.toString());
    return ['TWD', 'USD', 'JPY', 'EUR', 'CNY'];
  }
}
`;
  
  Logger.log('📋 更新後的函數範例：');
  Logger.log(updatedFunctions);
}

/**
 * 驗證重新整理結果
 */
function validateReorganization() {
  Logger.log('=== 驗證重新整理結果 ===');
  
  try {
    const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    const ss = SpreadsheetApp.openById(mainLedgerId);
    
    // 檢查新的工作表結構
    const checks = [
      { name: 'NotificationSettings', purpose: '通知設定' },
      { name: 'SupportedCurrencies', purpose: '支援幣別' },
      { name: 'Settings', purpose: 'ConfigManager 系統配置' },
      { name: 'All Records', purpose: '主要記帳資料' }
    ];
    
    let allValid = true;
    
    checks.forEach(check => {
      const sheet = ss.getSheetByName(check.name);
      if (sheet) {
        Logger.log(`✅ ${check.name}: 存在 (${check.purpose})`);
        
        // 特別檢查新的 Settings 工作表格式
        if (check.name === 'Settings') {
          const data = sheet.getDataRange().getValues();
          if (data.length > 0 && data[0][0] === 'Key' && data[0][1] === 'Value') {
            Logger.log('   ✅ 格式正確 (Key-Value 結構)');
          } else {
            Logger.log('   ❌ 格式不正確');
            allValid = false;
          }
        }
      } else {
        Logger.log(`❌ ${check.name}: 不存在`);
        allValid = false;
      }
    });
    
    if (allValid) {
      Logger.log('\n✅ 工作表重新整理驗證通過');
      Logger.log('ConfigManager 現在應該可以正常工作');
    } else {
      Logger.log('\n❌ 工作表重新整理驗證失敗');
    }
    
    return allValid;
    
  } catch (error) {
    Logger.log(`❌ 驗證重新整理結果失敗: ${error.toString()}`);
    return false;
  }
}

/**
 * 完整的工作表重新整理流程
 */
function runCompleteSheetReorganization() {
  Logger.log('=== 執行完整工作表重新整理 ===');
  
  try {
    // 1. 分析現有結構
    analyzeCurrentSheetStructure();
    
    // 2. 重新整理工作表命名
    const reorganizeResult = reorganizeSheetNames();
    
    if (reorganizeResult) {
      // 3. 驗證結果
      const validateResult = validateReorganization();
      
      // 4. 提供更新建議
      updateSheetReferences();
      
      if (validateResult) {
        Logger.log('\n=== 工作表重新整理完成 ===');
        Logger.log('✅ 結果：');
        Logger.log('  - 工作表命名衝突已解決');
        Logger.log('  - ConfigManager 可以正常使用新的 Settings 工作表');
        Logger.log('  - 原有的通知和幣別設定保持完整');
        Logger.log('  - 建議檢查程式碼中的工作表引用');
        
        return true;
      }
    }
    
    return false;
    
  } catch (error) {
    Logger.log(`❌ 完整重新整理流程失敗: ${error.toString()}`);
    return false;
  }
}