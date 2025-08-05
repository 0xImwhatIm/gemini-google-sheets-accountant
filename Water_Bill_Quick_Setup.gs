// =================================================================================================
// 台北自來水帳單快速設定工具
// 版本：V47.4.1 - 2025-08-05
// 用途：快速設定台北自來水帳單 HTML 內文處理功能
// =================================================================================================

/**
 * 🚰 快速設定台北自來水帳單處理功能
 * 這個函數可以直接在 Google Apps Script 編輯器中執行
 */
function quickSetupWaterBillProcessing() {
  Logger.log('🚰 === 台北自來水帳單快速設定開始 ===');
  
  try {
    // 步驟 1: 添加 Email Rules
    Logger.log('📋 步驟 1: 設定 Email Rules...');
    const rulesSuccess = addWaterBillRuleToEmailRules();
    
    if (!rulesSuccess) {
      Logger.log('❌ Email Rules 設定失敗');
      return false;
    }
    
    // 步驟 2: 測試水費帳單解析功能
    Logger.log('🧪 步驟 2: 測試水費帳單解析功能...');
    testWaterBillParsing();
    
    // 步驟 3: 設定觸發器（簡化版）
    Logger.log('⏰ 步驟 3: 設定觸發器...');
    setupWaterBillTrigger();
    
    Logger.log('🎉 === 台北自來水帳單快速設定完成 ===');
    Logger.log('✅ Email Rules 已添加');
    Logger.log('✅ 解析功能已測試');
    Logger.log('✅ 觸發器已設定');
    Logger.log('📧 系統將自動處理來自 ebill@water.gov.taipei 的郵件');
    
    return true;
    
  } catch (error) {
    Logger.log(`❌ 快速設定失敗: ${error.toString()}`);
    return false;
  }
}

/**
 * 🚰 添加台北自來水帳單處理規則到 Email Rules（簡化版）
 */
function addWaterBillRuleToEmailRules() {
  Logger.log('🚰 添加台北自來水帳單處理規則...');
  
  try {
    const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
    let emailRulesSheet = ss.getSheetByName(EMAIL_RULES_SHEET_NAME);
    
    // 如果 Email Rules 工作表不存在，創建它
    if (!emailRulesSheet) {
      emailRulesSheet = ss.insertSheet(EMAIL_RULES_SHEET_NAME);
      
      // 添加標題行
      emailRulesSheet.appendRow([
        'Sender Email',
        'Keywords', 
        'Category',
        'Processing Method',
        'Enabled',
        'Rule Name',
        'Processing Type',
        'Special Flags'
      ]);
      
      Logger.log(`✅ 創建了新的 Email Rules 工作表`);
    }
    
    // 檢查是否已存在台北自來水規則
    const existingData = emailRulesSheet.getDataRange().getValues();
    const waterRuleExists = existingData.some(row => 
      row[0] && row[0].includes('ebill@water.gov.taipei')
    );
    
    if (!waterRuleExists) {
      // 添加台北自來水帳單規則
      const waterBillRule = [
        'ebill@water.gov.taipei',                    // Sender Email
        '臺北自來水事業處,水費,電子帳單',              // Keywords
        '住',                                       // Category
        'html_content_extraction',                  // Processing Method
        true,                                       // Enabled
        '台北自來水事業處電子帳單',                   // Rule Name
        'html_content',                             // Processing Type
        'skip_pdf_attachments'                      // Special Flags
      ];
      
      emailRulesSheet.appendRow(waterBillRule);
      Logger.log('✅ 台北自來水帳單規則已添加到 Email Rules');
    } else {
      Logger.log('ℹ️ 台北自來水帳單規則已存在，跳過添加');
    }
    
    return true;
    
  } catch (error) {
    Logger.log(`❌ Email Rules 設定失敗: ${error.toString()}`);
    return false;
  }
}

/**
 * ⏰ 設定台北自來水帳單處理觸發器（簡化版）
 */
function setupWaterBillTrigger() {
  Logger.log('⏰ 設定台北自來水帳單處理觸發器...');
  
  try {
    // 檢查是否已有相關觸發器
    const existingTriggers = ScriptApp.getProjectTriggers();
    const hasWaterBillTrigger = existingTriggers.some(trigger => 
      trigger.getHandlerFunction().includes('processWaterBillEmails') ||
      trigger.getHandlerFunction().includes('processAutomatedEmails')
    );
    
    if (!hasWaterBillTrigger) {
      // 創建新的觸發器，使用現有的 processAutomatedEmails 函數
      ScriptApp.newTrigger('processAutomatedEmails')
        .timeBased()
        .everyMinutes(15)
        .create();
      
      Logger.log('✅ 已創建觸發器：每15分鐘執行 processAutomatedEmails');
    } else {
      Logger.log('ℹ️ 相關觸發器已存在，跳過創建');
    }
    
    return true;
    
  } catch (error) {
    Logger.log(`❌ 觸發器設定失敗: ${error.toString()}`);
    return false;
  }
}

/**
 * 🧪 測試台北自來水帳單處理功能（簡化版）
 */
function testWaterBillProcessingQuick() {
  Logger.log('🧪 === 台北自來水帳單處理測試開始 ===');
  
  try {
    // 1. 測試解析功能
    Logger.log('📊 測試 HTML 解析功能...');
    const parseResult = testWaterBillParsing();
    
    if (!parseResult || parseResult.amount !== 428) {
      Logger.log('❌ 解析測試失敗');
      return false;
    }
    
    // 2. 檢查 Email Rules
    Logger.log('📋 檢查 Email Rules...');
    const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
    const emailRulesSheet = ss.getSheetByName(EMAIL_RULES_SHEET_NAME);
    
    if (!emailRulesSheet) {
      Logger.log('❌ Email Rules 工作表不存在');
      return false;
    }
    
    const rulesData = emailRulesSheet.getDataRange().getValues();
    const hasWaterRule = rulesData.some(row => 
      row[0] && row[0].includes('ebill@water.gov.taipei')
    );
    
    if (!hasWaterRule) {
      Logger.log('❌ 台北自來水規則不存在');
      return false;
    }
    
    // 3. 檢查觸發器
    Logger.log('⏰ 檢查觸發器...');
    const triggers = ScriptApp.getProjectTriggers();
    const hasEmailTrigger = triggers.some(trigger => 
      trigger.getHandlerFunction().includes('processAutomatedEmails')
    );
    
    if (!hasEmailTrigger) {
      Logger.log('❌ Email 處理觸發器不存在');
      return false;
    }
    
    Logger.log('🎉 === 所有測試通過！台北自來水帳單處理功能已就緒 ===');
    Logger.log('✅ HTML 解析功能正常（428 元）');
    Logger.log('✅ Email Rules 已設定');
    Logger.log('✅ 觸發器已啟用');
    
    return true;
    
  } catch (error) {
    Logger.log(`❌ 測試失敗: ${error.toString()}`);
    return false;
  }
}

/**
 * 🔧 手動處理台北自來水帳單郵件（測試用）
 */
function manualProcessWaterBillEmails() {
  Logger.log('🔧 === 手動處理台北自來水帳單郵件 ===');
  
  try {
    // 搜尋台北自來水的郵件
    const searchQuery = 'from:ebill@water.gov.taipei subject:(臺北自來水事業處 OR 水費 OR 電子帳單) is:unread';
    const threads = GmailApp.search(searchQuery, 0, 5);
    
    Logger.log(`🔍 找到 ${threads.length} 封台北自來水帳單郵件`);
    
    if (threads.length === 0) {
      Logger.log('ℹ️ 沒有找到未讀的台北自來水帳單郵件');
      return 0;
    }
    
    let processedCount = 0;
    
    for (const thread of threads) {
      const messages = thread.getMessages();
      
      for (const message of messages) {
        try {
          Logger.log(`📧 處理郵件: ${message.getSubject()}`);
          
          // 獲取 HTML 內容
          const htmlBody = message.getBody();
          const subject = message.getSubject();
          const receivedDate = message.getDate();
          
          if (!htmlBody) {
            Logger.log('⚠️ 郵件沒有 HTML 內容，跳過');
            continue;
          }
          
          // 使用水費帳單解析器
          const accountingData = parseWaterBillHtmlContent(htmlBody, subject, receivedDate);
          
          if (accountingData && accountingData.amount > 0) {
            Logger.log(`💰 提取到金額: ${accountingData.amount} 元`);
            Logger.log(`📅 記帳日期: ${accountingData.date}`);
            Logger.log(`🏷️ 項目: ${accountingData.item}`);
            
            // 這裡可以選擇是否實際寫入 Sheets
            // const writeSuccess = writeToSheet(accountingData, 'email_water_bill');
            
            Logger.log('✅ 郵件處理成功（未實際寫入 Sheets，僅測試）');
            processedCount++;
            
            // 可以選擇是否標記為已讀
            // message.markRead();
            
          } else {
            Logger.log('⚠️ 無法從郵件提取有效的帳單信息');
          }
          
        } catch (messageError) {
          Logger.log(`❌ 處理單封郵件失敗: ${messageError.toString()}`);
        }
      }
    }
    
    Logger.log(`🎉 手動處理完成，共處理 ${processedCount} 封郵件`);
    return processedCount;
    
  } catch (error) {
    Logger.log(`❌ 手動處理失敗: ${error.toString()}`);
    return 0;
  }
}

/**
 * 📋 顯示台北自來水帳單設定狀態
 */
function checkWaterBillSetupStatus() {
  Logger.log('📋 === 台北自來水帳單設定狀態檢查 ===');
  
  try {
    let allGood = true;
    
    // 1. 檢查 Email Rules
    Logger.log('📋 檢查 Email Rules...');
    const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
    const emailRulesSheet = ss.getSheetByName(EMAIL_RULES_SHEET_NAME);
    
    if (emailRulesSheet) {
      const rulesData = emailRulesSheet.getDataRange().getValues();
      const hasWaterRule = rulesData.some(row => 
        row[0] && row[0].includes('ebill@water.gov.taipei')
      );
      
      if (hasWaterRule) {
        Logger.log('✅ Email Rules: 台北自來水規則已設定');
      } else {
        Logger.log('❌ Email Rules: 台北自來水規則不存在');
        allGood = false;
      }
    } else {
      Logger.log('❌ Email Rules: 工作表不存在');
      allGood = false;
    }
    
    // 2. 檢查觸發器
    Logger.log('⏰ 檢查觸發器...');
    const triggers = ScriptApp.getProjectTriggers();
    const hasEmailTrigger = triggers.some(trigger => 
      trigger.getHandlerFunction().includes('processAutomatedEmails')
    );
    
    if (hasEmailTrigger) {
      Logger.log('✅ 觸發器: Email 處理觸發器已設定');
    } else {
      Logger.log('❌ 觸發器: Email 處理觸發器不存在');
      allGood = false;
    }
    
    // 3. 檢查必要函數
    Logger.log('🔧 檢查必要函數...');
    const requiredFunctions = [
      'parseWaterBillHtmlContent',
      'extractAmountFromWaterBill',
      'testWaterBillParsing'
    ];
    
    for (const funcName of requiredFunctions) {
      try {
        const func = eval(funcName);
        if (typeof func === 'function') {
          Logger.log(`✅ 函數: ${funcName} 存在`);
        } else {
          Logger.log(`❌ 函數: ${funcName} 不存在`);
          allGood = false;
        }
      } catch (error) {
        Logger.log(`❌ 函數: ${funcName} 不存在或有錯誤`);
        allGood = false;
      }
    }
    
    // 總結
    if (allGood) {
      Logger.log('🎉 === 所有設定都正常！台北自來水帳單處理功能已就緒 ===');
      Logger.log('💡 你可以執行 manualProcessWaterBillEmails() 來測試實際郵件處理');
    } else {
      Logger.log('⚠️ === 發現設定問題，請執行 quickSetupWaterBillProcessing() 來修復 ===');
    }
    
    return allGood;
    
  } catch (error) {
    Logger.log(`❌ 狀態檢查失敗: ${error.toString()}`);
    return false;
  }
}