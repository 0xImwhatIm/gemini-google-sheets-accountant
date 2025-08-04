// =================================================================================================
// 修復缺失的 SupportedCurrencies 工作表
// 最後更新：2025-07-27
// =================================================================================================

/**
 * 修復 _Settings 工作表重新命名問題
 */
function fixCurrencySheetRename() {
  Logger.log('=== 修復 SupportedCurrencies 工作表 ===');
  
  try {
    const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    const ss = SpreadsheetApp.openById(mainLedgerId);
    
    // 檢查是否有 _Settings 工作表（注意是複數）
    const settingsSheet = ss.getSheetByName('_Settings');
    if (settingsSheet) {
      Logger.log('📝 找到 _Settings 工作表，重新命名為 SupportedCurrencies');
      settingsSheet.setName('SupportedCurrencies');
      Logger.log('✅ _Settings → SupportedCurrencies 重新命名完成');
    } else {
      // 檢查是否已經存在 SupportedCurrencies
      const currencySheet = ss.getSheetByName('SupportedCurrencies');
      if (currencySheet) {
        Logger.log('✅ SupportedCurrencies 工作表已存在');
      } else {
        // 如果都不存在，建立新的
        Logger.log('📋 建立新的 SupportedCurrencies 工作表');
        const newCurrencySheet = ss.insertSheet('SupportedCurrencies');
        
        // 設定幣別清單
        const currencies = [
          ['TWD'],
          ['USD'],
          ['JPY'],
          ['EUR'],
          ['CNY']
        ];
        
        newCurrencySheet.getRange(1, 1, currencies.length, 1).setValues(currencies);
        
        // 格式化
        newCurrencySheet.setColumnWidth(1, 100);
        const dataRange = newCurrencySheet.getRange(1, 1, currencies.length, 1);
        dataRange.setHorizontalAlignment('center');
        dataRange.setBorder(true, true, true, true, true, true);
        
        Logger.log('✅ 新的 SupportedCurrencies 工作表建立完成');
      }
    }
    
    return true;
    
  } catch (error) {
    Logger.log(`❌ 修復 SupportedCurrencies 工作表失敗: ${error.toString()}`);
    return false;
  }
}

/**
 * 驗證所有工作表是否正確
 */
function validateAllSheets() {
  Logger.log('=== 驗證所有工作表 ===');
  
  try {
    const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    const ss = SpreadsheetApp.openById(mainLedgerId);
    
    const requiredSheets = [
      { name: 'All Records', purpose: '主要記帳資料' },
      { name: 'NotificationSettings', purpose: '通知設定' },
      { name: 'SupportedCurrencies', purpose: '支援幣別' },
      { name: 'Settings', purpose: 'ConfigManager 系統配置' },
      { name: 'EmailRules', purpose: '郵件處理規則' },
      { name: 'Events', purpose: 'IOU 事件' },
      { name: 'Participants', purpose: 'IOU 參與者' },
      { name: 'Debts', purpose: 'IOU 債務' }
    ];
    
    let allValid = true;
    
    Logger.log('📊 工作表檢查結果：');
    requiredSheets.forEach(sheet => {
      const sheetObj = ss.getSheetByName(sheet.name);
      if (sheetObj) {
        Logger.log(`✅ ${sheet.name}: 存在 (${sheet.purpose})`);
        
        // 特別檢查 Settings 工作表格式
        if (sheet.name === 'Settings') {
          const data = sheetObj.getDataRange().getValues();
          if (data.length > 0 && data[0][0] === 'Key' && data[0][1] === 'Value') {
            Logger.log('   ✅ 格式正確 (Key-Value 結構)');
          } else {
            Logger.log('   ❌ 格式不正確');
            allValid = false;
          }
        }
        
        // 檢查 SupportedCurrencies 工作表內容
        if (sheet.name === 'SupportedCurrencies') {
          const data = sheetObj.getDataRange().getValues();
          const currencies = data.map(row => row[0]).filter(currency => currency);
          Logger.log(`   ✅ 包含幣別: ${currencies.join(', ')}`);
        }
        
      } else {
        Logger.log(`❌ ${sheet.name}: 不存在 (${sheet.purpose})`);
        allValid = false;
      }
    });
    
    // 檢查是否有舊的工作表需要清理
    const sheets = ss.getSheets();
    const obsoleteSheets = ['_Settings', '_Setting'];
    
    Logger.log('\n🔍 檢查過時的工作表：');
    obsoleteSheets.forEach(obsoleteName => {
      const obsoleteSheet = ss.getSheetByName(obsoleteName);
      if (obsoleteSheet) {
        Logger.log(`⚠️  發現過時工作表: ${obsoleteName} (建議刪除)`);
      } else {
        Logger.log(`✅ ${obsoleteName}: 已清理`);
      }
    });
    
    if (allValid) {
      Logger.log('\n✅ 所有必要工作表驗證通過');
    } else {
      Logger.log('\n❌ 工作表驗證失敗，需要修復');
    }
    
    return allValid;
    
  } catch (error) {
    Logger.log(`❌ 驗證工作表失敗: ${error.toString()}`);
    return false;
  }
}

/**
 * 測試 ConfigManager 是否正常工作
 */
function testConfigManagerAfterFix() {
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
    
    // 清理測試配置
    configManager.set('TEST_TIMESTAMP', '');
    
    Logger.log('✅ ConfigManager 測試完成，功能正常');
    
    return true;
    
  } catch (error) {
    Logger.log(`❌ 測試 ConfigManager 失敗: ${error.toString()}`);
    Logger.log('⚠️  ConfigManager 可能仍有問題，建議執行 ConfigManager 修復工具');
    return false;
  }
}

/**
 * 清理過時的工作表
 */
function cleanupObsoleteSheets() {
  Logger.log('=== 清理過時的工作表 ===');
  
  try {
    const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    const ss = SpreadsheetApp.openById(mainLedgerId);
    
    const obsoleteSheets = ['_Settings', '_Setting'];
    let cleanedCount = 0;
    
    obsoleteSheets.forEach(obsoleteName => {
      const obsoleteSheet = ss.getSheetByName(obsoleteName);
      if (obsoleteSheet) {
        Logger.log(`🗑️ 刪除過時工作表: ${obsoleteName}`);
        ss.deleteSheet(obsoleteSheet);
        cleanedCount++;
      }
    });
    
    if (cleanedCount > 0) {
      Logger.log(`✅ 已清理 ${cleanedCount} 個過時工作表`);
    } else {
      Logger.log('✅ 沒有需要清理的過時工作表');
    }
    
    return true;
    
  } catch (error) {
    Logger.log(`❌ 清理過時工作表失敗: ${error.toString()}`);
    return false;
  }
}

/**
 * 完整的修復流程
 */
function runCompleteFix() {
  Logger.log('=== 執行完整修復流程 ===');
  
  try {
    // 1. 修復 SupportedCurrencies 工作表
    const fixResult = fixCurrencySheetRename();
    
    // 2. 驗證所有工作表
    const validateResult = validateAllSheets();
    
    // 3. 測試 ConfigManager
    const testResult = testConfigManagerAfterFix();
    
    // 4. 清理過時工作表
    cleanupObsoleteSheets();
    
    if (fixResult && validateResult && testResult) {
      Logger.log('\n=== 完整修復流程成功 ===');
      Logger.log('✅ 結果摘要：');
      Logger.log('  - SupportedCurrencies 工作表已修復');
      Logger.log('  - 所有必要工作表驗證通過');
      Logger.log('  - ConfigManager 功能正常');
      Logger.log('  - 過時工作表已清理');
      Logger.log('  - ConfigManager 錯誤訊息應該消失');
      
      return true;
    } else {
      Logger.log('\n❌ 修復流程部分失敗');
      if (!testResult) {
        Logger.log('⚠️  建議執行 ConfigManager 專用修復工具');
      }
      return false;
    }
    
  } catch (error) {
    Logger.log(`❌ 完整修復流程失敗: ${error.toString()}`);
    return false;
  }
}

/**
 * 顯示最終的工作表結構
 */
function showFinalSheetStructure() {
  Logger.log('=== 最終工作表結構 ===');
  
  try {
    const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    const ss = SpreadsheetApp.openById(mainLedgerId);
    const sheets = ss.getSheets();
    
    Logger.log(`📊 總共 ${sheets.length} 個工作表：`);
    
    sheets.forEach((sheet, index) => {
      const name = sheet.getName();
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      
      let purpose = '';
      switch (name) {
        case 'All Records':
          purpose = '主要記帳資料';
          break;
        case 'NotificationSettings':
          purpose = '通知設定 (原 Settings)';
          break;
        case 'SupportedCurrencies':
          purpose = '支援幣別 (原 _Settings)';
          break;
        case 'Settings':
          purpose = 'ConfigManager 系統配置 (新建)';
          break;
        case 'EmailRules':
          purpose = '郵件處理規則';
          break;
        case 'Events':
          purpose = 'IOU 事件記錄';
          break;
        case 'Participants':
          purpose = 'IOU 參與者';
          break;
        case 'Debts':
          purpose = 'IOU 債務記錄';
          break;
        default:
          purpose = '其他';
      }
      
      Logger.log(`${index + 1}. ${name} (${lastRow}行 x ${lastCol}欄) - ${purpose}`);
    });
    
  } catch (error) {
    Logger.log(`❌ 顯示工作表結構失敗: ${error.toString()}`);
  }
}