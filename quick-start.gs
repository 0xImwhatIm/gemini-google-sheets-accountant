/**
 * 智慧記帳 GEM - 快速啟動與測試腳本
 * 
 * 此腳本包含各種測試和驗證函數，幫助您確認系統是否正確部署
 */

/**
 * 快速系統健康檢查
 * 執行此函數來驗證基本設定是否正確
 */
function quickHealthCheck() {
  console.log('🔍 開始系統健康檢查...');
  
  const results = {
    sheetsAccess: false,
    apiKey: false,
    sheetsStructure: false,
    basicFunctions: false
  };
  
  try {
    // 檢查 Google Sheets 存取
    const mainLedgerId = getConfig('MAIN_LEDGER_ID');
    if (!mainLedgerId) {
      throw new Error('MAIN_LEDGER_ID 未設定');
    }
    const ss = SpreadsheetApp.openById(mainLedgerId);
    console.log('✅ Google Sheets 存取正常');
    results.sheetsAccess = true;
    
    // 檢查工作表結構
    const requiredSheets = ['All Records', 'EmailRules', 'Settings', 'Events', 'Participants', 'Debts'];
    const existingSheets = ss.getSheets().map(sheet => sheet.getName());
    const missingSheets = requiredSheets.filter(name => !existingSheets.includes(name));
    
    if (missingSheets.length === 0) {
      console.log('✅ 所有必要工作表都存在');
      results.sheetsStructure = true;
    } else {
      console.log('❌ 缺少工作表：' + missingSheets.join(', '));
    }
    
    // 檢查 API 金鑰
    if (GEMINI_API_KEY && GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE') {
      console.log('✅ Gemini API 金鑰已設定');
      results.apiKey = true;
    } else {
      console.log('❌ Gemini API 金鑰未設定或使用預設值');
    }
    
    // 檢查基本函數
    if (typeof processVoice === 'function' && typeof processIou === 'function') {
      console.log('✅ 核心函數存在');
      results.basicFunctions = true;
    } else {
      console.log('❌ 核心函數缺失');
    }
    
  } catch (error) {
    console.log('❌ 健康檢查失敗：' + error.toString());
  }
  
  // 顯示結果摘要
  const passedChecks = Object.values(results).filter(Boolean).length;
  const totalChecks = Object.keys(results).length;
  
  console.log(`\n📊 健康檢查結果：${passedChecks}/${totalChecks} 項通過`);
  
  if (passedChecks === totalChecks) {
    console.log('🎉 系統健康狀況良好，可以開始使用！');
  } else {
    console.log('⚠️ 系統存在問題，請檢查上述錯誤訊息');
  }
  
  return results;
}

/**
 * 測試語音記帳功能
 */
function testVoiceFunction() {
  console.log('🎤 測試語音記帳功能...');
  
  try {
    const testText = "今天買咖啡花了 150 元";
    const mainLedgerId = getConfig('MAIN_LEDGER_ID');
    if (!mainLedgerId) {
      throw new Error('MAIN_LEDGER_ID 未設定');
    }
    const result = processVoice(testText, mainLedgerId);
    
    if (result) {
      console.log('✅ 語音記帳測試成功');
      console.log('請檢查 Google Sheets 的 All Records 工作表是否有新記錄');
    } else {
      console.log('❌ 語音記帳測試失敗');
    }
    
    return result;
  } catch (error) {
    console.log('❌ 語音記帳測試錯誤：' + error.toString());
    return false;
  }
}

/**
 * 測試 IOU 功能
 */
function testIouFunction() {
  console.log('💰 測試 IOU 功能...');
  
  try {
    const testText = "我幫小明代墊了 250 元的電影票";
    const result = processIou(testText);
    
    console.log('✅ IOU 功能測試完成');
    console.log('請檢查 Google Sheets 的 Events、Participants、Debts 工作表');
    
    return result;
  } catch (error) {
    console.log('❌ IOU 功能測試錯誤：' + error.toString());
    return false;
  }
}

/**
 * 測試 Gemini API 連線
 */
function testGeminiAPI() {
  console.log('🤖 測試 Gemini API 連線...');
  
  try {
    const testPrompt = "請回答：1+1等於多少？";
    const requestBody = {
      "contents": [{ "parts": [{ "text": testPrompt }] }]
    };
    
    const options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify(requestBody),
      'muteHttpExceptions': true
    };
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
    const response = UrlFetchApp.fetch(url, options);
    
    if (response.getResponseCode() === 200) {
      console.log('✅ Gemini API 連線成功');
      const jsonResponse = JSON.parse(response.getContentText());
      console.log('API 回應：' + jsonResponse.candidates[0].content.parts[0].text);
      return true;
    } else {
      console.log('❌ Gemini API 連線失敗，HTTP 狀態碼：' + response.getResponseCode());
      console.log('錯誤訊息：' + response.getContentText());
      return false;
    }
    
  } catch (error) {
    console.log('❌ Gemini API 測試錯誤：' + error.toString());
    return false;
  }
}

/**
 * 建立測試資料
 */
function createTestData() {
  console.log('📝 建立測試資料...');
  
  try {
    const mainLedgerId = getConfig('MAIN_LEDGER_ID');
    if (!mainLedgerId) {
      throw new Error('MAIN_LEDGER_ID 未設定');
    }
    const ss = SpreadsheetApp.openById(mainLedgerId);
    const allRecordsSheet = ss.getSheetByName('All Records');
    
    if (!allRecordsSheet) {
      console.log('❌ 找不到 All Records 工作表');
      return false;
    }
    
    // 建立測試記錄
    const testData = [
      [new Date(), 150, 'TWD', '飲食', '測試咖啡', '手動測試', '已確認', '測試資料', '', '', ''],
      [new Date(), 85, 'TWD', '交通', '測試捷運', '手動測試', '已確認', '測試資料', '', '', ''],
      [new Date(), 320, 'TWD', '購物', '測試書籍', '手動測試', '已確認', '測試資料', '', '', '']
    ];
    
    const lastRow = allRecordsSheet.getLastRow();
    allRecordsSheet.getRange(lastRow + 1, 1, testData.length, testData[0].length).setValues(testData);
    
    console.log('✅ 測試資料建立完成，共新增 ' + testData.length + ' 筆記錄');
    return true;
    
  } catch (error) {
    console.log('❌ 建立測試資料失敗：' + error.toString());
    return false;
  }
}

/**
 * 清理測試資料
 */
function cleanupTestData() {
  console.log('🧹 清理測試資料...');
  
  try {
    const mainLedgerId = getConfig('MAIN_LEDGER_ID');
    if (!mainLedgerId) {
      throw new Error('MAIN_LEDGER_ID 未設定');
    }
    const ss = SpreadsheetApp.openById(mainLedgerId);
    const allRecordsSheet = ss.getSheetByName('All Records');
    
    if (!allRecordsSheet) {
      console.log('❌ 找不到 All Records 工作表');
      return false;
    }
    
    const data = allRecordsSheet.getDataRange().getValues();
    const rowsToDelete = [];
    
    // 找出包含 "測試" 的記錄
    for (let i = data.length - 1; i > 0; i--) { // 從最後一列開始，跳過標題列
      const row = data[i];
      if (row.some(cell => String(cell).includes('測試'))) {
        rowsToDelete.push(i + 1); // +1 因為 getRange 使用 1-based 索引
      }
    }
    
    // 刪除測試記錄
    rowsToDelete.forEach(rowIndex => {
      allRecordsSheet.deleteRow(rowIndex);
    });
    
    console.log('✅ 測試資料清理完成，共刪除 ' + rowsToDelete.length + ' 筆記錄');
    return true;
    
  } catch (error) {
    console.log('❌ 清理測試資料失敗：' + error.toString());
    return false;
  }
}

/**
 * 顯示系統資訊
 */
function showSystemInfo() {
  console.log('ℹ️ 系統資訊：');
  console.log('Google Sheets ID：' + getConfig('MAIN_LEDGER_ID'));
  console.log('GCP 專案 ID：' + getConfig('GCP_PROJECT_ID'));
  console.log('API 金鑰狀態：' + (getConfig('GEMINI_API_KEY') && getConfig('GEMINI_API_KEY') !== 'YOUR_GEMINI_API_KEY_HERE' ? '已設定' : '未設定'));
  console.log('Apps Script 版本：V46.0');
  console.log('執行時間：' + new Date().toLocaleString('zh-TW'));
}

/**
 * 完整的部署驗證流程
 */
function runFullDeploymentTest() {
  console.log('🚀 開始完整部署驗證...\n');
  
  showSystemInfo();
  console.log('\n' + '='.repeat(50) + '\n');
  
  const healthCheck = quickHealthCheck();
  console.log('\n' + '='.repeat(50) + '\n');
  
  if (healthCheck.sheetsAccess && healthCheck.apiKey) {
    testGeminiAPI();
    console.log('\n' + '-'.repeat(30) + '\n');
    
    testVoiceFunction();
    console.log('\n' + '-'.repeat(30) + '\n');
    
    testIouFunction();
    console.log('\n' + '-'.repeat(30) + '\n');
  } else {
    console.log('⚠️ 基本設定有問題，跳過功能測試');
  }
  
  console.log('\n🎯 部署驗證完成！請檢查上述結果並修正任何問題。');
}