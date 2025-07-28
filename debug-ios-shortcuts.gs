/**
 * iOS 捷徑診斷工具
 * 用於檢查拍照+語音記帳的問題
 */

/**
 * 測試 doPost 端點
 */
function testDoPostEndpoints() {
  Logger.log('🔍 測試 doPost 端點...');
  
  // 測試 1: 無 endpoint 參數
  Logger.log('\n--- 測試 1: 無 endpoint 參數 ---');
  try {
    const mockEvent1 = {
      parameter: {},
      postData: { contents: '{}' }
    };
    const result1 = doPost(mockEvent1);
    Logger.log('結果: ' + result1.getContent());
  } catch (error) {
    Logger.log('錯誤: ' + error.toString());
  }
  
  // 測試 2: image endpoint
  Logger.log('\n--- 測試 2: image endpoint ---');
  try {
    const mockEvent2 = {
      parameter: { endpoint: 'image' },
      postData: { 
        contents: JSON.stringify({
          image: 'test_base64_data',
          filename: 'test.jpg'
        })
      }
    };
    const result2 = doPost(mockEvent2);
    Logger.log('結果: ' + result2.getContent());
  } catch (error) {
    Logger.log('錯誤: ' + error.toString());
  }
  
  // 測試 3: voice endpoint
  Logger.log('\n--- 測試 3: voice endpoint ---');
  try {
    const mockEvent3 = {
      parameter: { endpoint: 'voice' },
      postData: { 
        contents: JSON.stringify({
          text: '測試語音記帳，買咖啡150元'
        })
      }
    };
    const result3 = doPost(mockEvent3);
    Logger.log('結果: ' + result3.getContent());
  } catch (error) {
    Logger.log('錯誤: ' + error.toString());
  }
}

/**
 * 檢查 iOS 捷徑常見問題
 */
function checkIOSShortcutsIssues() {
  Logger.log('🔍 檢查 iOS 捷徑常見問題...');
  
  // 檢查 1: 配置狀態
  Logger.log('\n--- 檢查 1: 配置狀態 ---');
  checkCurrentConfig();
  
  // 檢查 2: doPost 函數是否存在
  Logger.log('\n--- 檢查 2: 函數檢查 ---');
  if (typeof doPost === 'function') {
    Logger.log('✅ doPost 函數存在');
  } else {
    Logger.log('❌ doPost 函數不存在');
  }
  
  if (typeof doPost_Image === 'function') {
    Logger.log('✅ doPost_Image 函數存在');
  } else {
    Logger.log('❌ doPost_Image 函數不存在');
  }
  
  if (typeof doPost_Voice === 'function') {
    Logger.log('✅ doPost_Voice 函數存在');
  } else {
    Logger.log('❌ doPost_Voice 函數不存在');
  }
  
  // 檢查 3: Gemini API 狀態
  Logger.log('\n--- 檢查 3: Gemini API 狀態 ---');
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (apiKey && !apiKey.includes('YOUR_')) {
    Logger.log('✅ Gemini API 金鑰已設定');
    
    // 簡單測試 API
    try {
      const testResult = callGeminiForVision || callGeminiForText;
      if (testResult) {
        Logger.log('✅ Gemini API 函數可用');
      } else {
        Logger.log('⚠️ Gemini API 函數可能不存在');
      }
    } catch (error) {
      Logger.log('⚠️ Gemini API 測試失敗: ' + error.toString());
    }
  } else {
    Logger.log('❌ Gemini API 金鑰未設定');
  }
}

/**
 * 生成 iOS 捷徑測試 URL
 */
function generateTestURL() {
  Logger.log('🔗 生成測試 URL...');
  
  // 獲取部署 URL（需要手動填入）
  const deploymentUrl = 'YOUR_DEPLOYMENT_URL_HERE';
  
  Logger.log('\n📋 iOS 捷徑測試 URL:');
  Logger.log('語音記帳 (GET): ' + deploymentUrl + '?endpoint=voice&text=測試語音記帳');
  Logger.log('圖片記帳 (POST): ' + deploymentUrl + '?endpoint=image');
  Logger.log('代墊款 (GET): ' + deploymentUrl + '?endpoint=iou&text=我幫小明代墊100元');
  
  Logger.log('\n🔧 請將 YOUR_DEPLOYMENT_URL_HERE 替換為你的實際部署 URL');
}

/**
 * 檢查部署狀態
 */
function checkDeploymentStatus() {
  Logger.log('🚀 檢查部署狀態...');
  
  // 檢查版本資訊
  Logger.log('\n--- 版本資訊 ---');
  Logger.log('當前版本: V47.3 (修復版)');
  
  // 檢查核心函數
  const coreFunctions = [
    'doGet', 'doPost', 'doPost_Image', 'doPost_Voice', 
    'setupMainLedgerId', 'checkCurrentConfig'
  ];
  
  Logger.log('\n--- 核心函數檢查 ---');
  coreFunctions.forEach(funcName => {
    try {
      const func = eval(funcName);
      if (typeof func === 'function') {
        Logger.log('✅ ' + funcName + ' 存在');
      } else {
        Logger.log('❌ ' + funcName + ' 不存在');
      }
    } catch (error) {
      Logger.log('❌ ' + funcName + ' 不存在或有錯誤');
    }
  });
}//
 =================================================================================================
// 【V47.3 新增】商務發票識別測試工具
// =================================================================================================

/**
 * 測試商務發票識別功能
 */
function testBusinessInvoiceRecognition() {
  Logger.log('🧾 測試商務發票識別功能...');
  
  // 模擬測試資料
  const testInvoiceData = {
    date: '2025-07-28 14:30:00',
    amount: 1200,
    currency: 'TWD',
    category: '食',
    description: '商務午餐',
    merchant: '王品牛排',
    invoiceNumber: 'AB12345678',
    receiptNumber: 'R20250728001',
    buyerName: '科技股份有限公司',
    buyerTaxId: '12345678',
    sellerTaxId: '87654321',
    invoiceType: '三聯式',
    ocrText: '統一發票 AB12345678\n王品牛排\n統一編號：87654321\n買受人：科技股份有限公司\n統一編號：12345678\n商務午餐 NT$1,200',
    detectedLanguage: 'zh-TW',
    merchantInfo: {
      name: '王品牛排',
      address: '台北市信義區信義路五段7號',
      phone: '02-2345-6789',
      taxId: '87654321'
    }
  };
  
  Logger.log('--- 測試資料 ---');
  Logger.log('統一發票號碼 (J欄)：' + (testInvoiceData.invoiceNumber || '無'));
  Logger.log('收據編號 (K欄)：' + (testInvoiceData.receiptNumber || '無'));
  Logger.log('買方名稱 (L欄)：' + (testInvoiceData.buyerName || '無'));
  Logger.log('買方統編 (M欄)：' + (testInvoiceData.buyerTaxId || '無'));
  Logger.log('賣方統編 (N欄)：' + (testInvoiceData.sellerTaxId || '無'));
  Logger.log('發票類型：' + (testInvoiceData.invoiceType || '無'));
  
  // 測試寫入功能
  try {
    const mainLedgerId = getConfig('MAIN_LEDGER_ID');
    if (!mainLedgerId) {
      Logger.log('❌ MAIN_LEDGER_ID 未設定');
      return;
    }
    
    const result = writeToSheetFromImageEnhanced(
      testInvoiceData,
      mainLedgerId,
      'test-business-invoice.jpg',
      'https://drive.google.com/test-link',
      '測試商務發票識別功能'
    );
    
    Logger.log('✅ 商務發票測試資料寫入成功');
    Logger.log('請檢查 Google Sheets 的 J、K、L、M、N 欄位是否正確填入');
    
  } catch (error) {
    Logger.log('❌ 商務發票測試失敗：' + error.toString());
  }
}

/**
 * 檢查商務發票欄位對應
 */
function checkBusinessInvoiceColumns() {
  Logger.log('📊 檢查商務發票欄位對應...');
  
  const columnMapping = {
    'J': 'INVOICE NO. (統一發票號碼)',
    'K': 'REFERENCES NO. (收據編號)',
    'L': 'BUYER NAME (買方名稱)',
    'M': 'BUYER TAX ID (買方統一編號)',
    'N': 'SELLER TAX ID (賣方統一編號)'
  };
  
  Logger.log('--- 商務發票欄位對應 ---');
  Object.keys(columnMapping).forEach(column => {
    Logger.log(`${column} 欄：${columnMapping[column]}`);
  });
  
  Logger.log('\n--- 使用說明 ---');
  Logger.log('1. 統一發票號碼：2碼英文+8碼數字 (如：AB12345678)');
  Logger.log('2. 收據編號：各種格式的收據或訂單號碼');
  Logger.log('3. 買方名稱：三聯式發票的買受人名稱');
  Logger.log('4. 買方統編：8位數字的統一編號');
  Logger.log('5. 賣方統編：商家的8位數統一編號');
  
  Logger.log('\n--- 發票類型 ---');
  Logger.log('• 二聯式：一般消費者，通常無買方統編');
  Logger.log('• 三聯式：公司行號，有完整買賣方資訊');
  Logger.log('• 電子發票：有QR Code和載具號碼');
  Logger.log('• 一般收據：非統一發票的收據');
}

/**
 * 驗證統一發票號碼格式
 */
function validateInvoiceNumber(invoiceNumber) {
  if (!invoiceNumber) return false;
  
  // 統一發票號碼格式：2碼英文 + 8碼數字
  const invoicePattern = /^[A-Z]{2}\d{8}$/;
  return invoicePattern.test(invoiceNumber);
}

/**
 * 驗證統一編號格式
 */
function validateTaxId(taxId) {
  if (!taxId) return false;
  
  // 統一編號格式：8碼數字
  const taxIdPattern = /^\d{8}$/;
  return taxIdPattern.test(taxId);
}

/**
 * 商務發票資料驗證
 */
function validateBusinessInvoiceData(data) {
  Logger.log('🔍 驗證商務發票資料...');
  
  const validationResults = {
    invoiceNumber: {
      value: data.invoiceNumber || '',
      isValid: validateInvoiceNumber(data.invoiceNumber),
      message: '統一發票號碼格式：2碼英文+8碼數字'
    },
    buyerTaxId: {
      value: data.buyerTaxId || '',
      isValid: validateTaxId(data.buyerTaxId),
      message: '買方統編格式：8碼數字'
    },
    sellerTaxId: {
      value: data.sellerTaxId || '',
      isValid: validateTaxId(data.sellerTaxId),
      message: '賣方統編格式：8碼數字'
    }
  };
  
  Logger.log('--- 驗證結果 ---');
  Object.keys(validationResults).forEach(key => {
    const result = validationResults[key];
    const status = result.isValid ? '✅' : '❌';
    Logger.log(`${status} ${key}: ${result.value} (${result.message})`);
  });
  
  return validationResults;
}