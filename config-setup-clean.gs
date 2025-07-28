/**
 * 智慧記帳 GEM - 配置快速設定腳本
 * 
 * 此腳本提供一鍵式配置設定，讓使用者能快速完成系統配置
 */

/**
 * 快速設定 Google Sheets ID
 * 這是最常用的設定函數
 */
function setupMainLedgerId(sheetId) {
  if (!sheetId) {
    Logger.log('❌ 請提供 Google Sheets ID');
    Logger.log('使用方式: setupMainLedgerId("你的Google_Sheets_ID")');
    Logger.log('');
    Logger.log('📋 如何取得 Google Sheets ID:');
    Logger.log('1. 開啟你的 Google Sheets');
    Logger.log('2. 從網址列複製 ID (在 d 和 edit 之間的部分)');
    Logger.log('   例如: https://docs.google.com/spreadsheets/d/[這裡是ID]/edit');
    return false;
  }
  
  try {
    // 驗證 Sheets ID 格式
    if (sheetId.length < 20 || sheetId.includes('YOUR_') || sheetId.includes('SHEET_ID')) {
      throw new Error('無效的 Google Sheets ID 格式');
    }
    
    // 測試 Sheets 存取權限
    Logger.log('🧪 測試 Google Sheets 存取權限...');
    const ss = SpreadsheetApp.openById(sheetId);
    const sheetName = ss.getName();
    Logger.log('✅ 成功存取 Google Sheets: "' + sheetName + '"');
    
    // 儲存到 PropertiesService
    PropertiesService.getScriptProperties().setProperty('MAIN_LEDGER_ID', sheetId);
    Logger.log('✅ MAIN_LEDGER_ID 已設定完成');
    
    // 清除 ConfigManager 快取
    if (typeof configManager !== 'undefined') {
      configManager.clearCache();
      Logger.log('🔄 ConfigManager 快取已清除');
    }
    
    // 驗證設定
    const savedId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    if (savedId === sheetId) {
      Logger.log('✅ 設定驗證成功');
      Logger.log('');
      Logger.log('🎉 Google Sheets ID 設定完成！');
      Logger.log('現在你可以開始使用智慧記帳功能了。');
      return true;
    } else {
      throw new Error('設定驗證失敗');
    }
    
  } catch (error) {
    Logger.log('❌ 設定失敗: ' + error.toString());
    Logger.log('');
    Logger.log('🔧 故障排除建議:');
    Logger.log('1. 確認 Google Sheets ID 正確');
    Logger.log('2. 確認你有該 Google Sheets 的存取權限');
    Logger.log('3. 確認 Google Sheets 不是空的或已刪除');
    return false;
  }
}

/**
 * 快速設定 Gemini API 金鑰
 */
function setupGeminiApiKey(apiKey) {
  if (!apiKey) {
    Logger.log('❌ 請提供 Gemini API 金鑰');
    Logger.log('使用方式: setupGeminiApiKey("你的API金鑰")');
    Logger.log('');
    Logger.log('📋 如何取得 Gemini API 金鑰:');
    Logger.log('1. 前往 https://makersuite.google.com/app/apikey');
    Logger.log('2. 建立新的 API 金鑰');
    Logger.log('3. 複製金鑰並使用此函數設定');
    return false;
  }
  
  try {
    // 儲存到 PropertiesService
    PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', apiKey);
    Logger.log('✅ GEMINI_API_KEY 已設定完成');
    
    // 清除 ConfigManager 快取
    if (typeof configManager !== 'undefined') {
      configManager.clearCache();
      Logger.log('🔄 ConfigManager 快取已清除');
    }
    
    Logger.log('🎉 Gemini API 金鑰設定完成！');
    return true;
  } catch (error) {
    Logger.log('❌ 設定失敗: ' + error.toString());
    return false;
  }
}

/**
 * 檢查目前的配置狀態
 */
function checkCurrentConfig() {
  Logger.log('🔍 檢查目前配置狀態...');
  Logger.log('');
  
  // 檢查 MAIN_LEDGER_ID
  const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
  if (mainLedgerId && !mainLedgerId.includes('YOUR_')) {
    Logger.log('✅ MAIN_LEDGER_ID: 已設定');
    try {
      const ss = SpreadsheetApp.openById(mainLedgerId);
      Logger.log('   📊 Google Sheets: "' + ss.getName() + '"');
    } catch (error) {
      Logger.log('   ❌ Google Sheets 存取失敗');
    }
  } else {
    Logger.log('❌ MAIN_LEDGER_ID: 未設定');
    Logger.log('   請執行: setupMainLedgerId("你的Google_Sheets_ID")');
  }
  
  // 檢查 GEMINI_API_KEY
  const geminiApiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (geminiApiKey && !geminiApiKey.includes('YOUR_')) {
    Logger.log('✅ GEMINI_API_KEY: 已設定');
  } else {
    Logger.log('❌ GEMINI_API_KEY: 未設定');
    Logger.log('   請執行: setupGeminiApiKey("你的API金鑰")');
  }
  
  // 檢查 GCP_PROJECT_ID
  const gcpProjectId = PropertiesService.getScriptProperties().getProperty('GCP_PROJECT_ID');
  if (gcpProjectId && !gcpProjectId.includes('YOUR_')) {
    Logger.log('✅ GCP_PROJECT_ID: 已設定');
  } else {
    Logger.log('⚠️ GCP_PROJECT_ID: 未設定 (可選)');
  }
  
  Logger.log('');
  Logger.log('📋 配置檢查完成');
}
// ==
===============================================================================================
// 測試函數 - 請修改下面的 ID 和 API 金鑰後執行
// =================================================================================================

/**
 * 測試設定函數 - 請修改 ID 後執行
 */
function testSetupMainLedger() {
  // 🔧 請把下面的 "YOUR_GOOGLE_SHEETS_ID_HERE" 替換為你的實際 Google Sheets ID
  const mySheetId = "YOUR_GOOGLE_SHEETS_ID_HERE";
  
  // 執行設定
  setupMainLedgerId(mySheetId);
}

/**
 * 測試設定 API 金鑰 - 請修改金鑰後執行
 */
function testSetupGeminiKey() {
  // 🔧 請把下面的 "YOUR_GEMINI_API_KEY_HERE" 替換為你的實際 API 金鑰
  const myApiKey = "YOUR_GEMINI_API_KEY_HERE";
  
  // 執行設定
  setupGeminiApiKey(myApiKey);
}