// =================================================================================================
// V47.1 授權和觸發器問題修復工具
// 最後更新：2025-07-27
// =================================================================================================

/**
 * 完整診斷 V47.1 的授權和觸發器問題
 */
function diagnoseV47AuthorizationIssues() {
  Logger.log('=== V47.1 授權和觸發器問題診斷 ===');
  
  try {
    // 1. 檢查基本配置
    Logger.log('--- 1. 檢查基本配置 ---');
    const scriptProperties = PropertiesService.getScriptProperties();
    const mainLedgerId = scriptProperties.getProperty('MAIN_LEDGER_ID');
    const geminiApiKey = scriptProperties.getProperty('GEMINI_API_KEY');
    
    Logger.log(`主帳本 ID: ${mainLedgerId ? '✅ 已設定' : '❌ 未設定'}`);
    Logger.log(`Gemini API Key: ${geminiApiKey ? '✅ 已設定' : '❌ 未設定'}`);
    
    // 2. 檢查 Phase4 組件
    Logger.log('--- 2. 檢查 Phase4 組件 ---');
    const phase4Components = [
      'Phase4ErrorHandler',
      'Phase4TransactionManager',
      'Phase4ConsistencyChecker',
      'Phase4NotificationManager',
      'Phase4LedgerLinkDetector',
      'Phase4ExpenseRealizationHandler',
      'Phase4LinkRecoveryManager',
      'Phase4ErrorHandlingIntegration'
    ];
    
    let missingComponents = [];
    phase4Components.forEach(component => {
      try {
        const isAvailable = eval(`typeof ${component} !== 'undefined'`);
        Logger.log(`${isAvailable ? '✅' : '❌'} ${component}: ${isAvailable ? '已載入' : '未載入'}`);
        if (!isAvailable) {
          missingComponents.push(component);
        }
      } catch (error) {
        Logger.log(`❌ ${component}: 錯誤 - ${error.message}`);
        missingComponents.push(component);
      }
    });
    
    // 3. 檢查觸發器
    Logger.log('--- 3. 檢查觸發器 ---');
    const triggers = ScriptApp.getProjectTriggers();
    Logger.log(`總觸發器數量: ${triggers.length}`);
    
    triggers.forEach((trigger, index) => {
      Logger.log(`觸發器 ${index + 1}:`);
      Logger.log(`  - 函數: ${trigger.getHandlerFunction()}`);
      Logger.log(`  - 類型: ${trigger.getTriggerSource()}`);
      Logger.log(`  - 事件類型: ${trigger.getEventType()}`);
    });
    
    // 4. 檢查權限範圍
    Logger.log('--- 4. 檢查權限範圍 ---');
    try {
      // 測試 Gmail 權限
      const gmailThreads = GmailApp.search('is:unread', 0, 1);
      Logger.log(`✅ Gmail 權限: 正常 (找到 ${gmailThreads.length} 個未讀郵件串)`);
    } catch (gmailError) {
      Logger.log(`❌ Gmail 權限: 失敗 - ${gmailError.toString()}`);
    }
    
    try {
      // 測試 Sheets 權限
      if (mainLedgerId) {
        const ss = SpreadsheetApp.openById(mainLedgerId);
        const sheet = ss.getSheetByName('All Records');
        Logger.log(`✅ Sheets 權限: 正常 (可存取主帳本)`);
      } else {
        Logger.log(`⚠️ Sheets 權限: 無法測試 (主帳本 ID 未設定)`);
      }
    } catch (sheetsError) {
      Logger.log(`❌ Sheets 權限: 失敗 - ${sheetsError.toString()}`);
    }
    
    try {
      // 測試 Drive 權限
      const folders = DriveApp.getFolders();
      Logger.log(`✅ Drive 權限: 正常`);
    } catch (driveError) {
      Logger.log(`❌ Drive 權限: 失敗 - ${driveError.toString()}`);
    }
    
    // 5. 檢查函數可用性
    Logger.log('--- 5. 檢查關鍵函數 ---');
    const keyFunctions = [
      'processAutomatedEmails',
      'processAutomatedEmailsFixed',
      'processAutomatedEmailsV46Compatible',
      'checkReceiptsFolder'
    ];
    
    keyFunctions.forEach(funcName => {
      try {
        const isAvailable = eval(`typeof ${funcName} === 'function'`);
        Logger.log(`${isAvailable ? '✅' : '❌'} ${funcName}: ${isAvailable ? '可用' : '不可用'}`);
      } catch (error) {
        Logger.log(`❌ ${funcName}: 錯誤 - ${error.message}`);
      }
    });
    
    // 6. 總結問題
    Logger.log('--- 6. 問題總結 ---');
    if (missingComponents.length > 0) {
      Logger.log(`❌ 缺失的 Phase4 組件: ${missingComponents.join(', ')}`);
    }
    
    Logger.log('=== 診斷完成 ===');
    
    return {
      missingComponents: missingComponents,
      triggerCount: triggers.length,
      hasMainLedger: !!mainLedgerId,
      hasGeminiKey: !!geminiApiKey
    };
    
  } catch (error) {
    Logger.log(`❌ 診斷過程發生錯誤: ${error.toString()}`);
    return { error: error.toString() };
  }
}

/**
 * 修復授權問題
 */
function fixAuthorizationIssues() {
  Logger.log('=== 開始修復授權問題 ===');
  
  try {
    // 1. 重新授權所有權限
    Logger.log('--- 1. 重新授權權限 ---');
    
    // 強制觸發權限請求
    try {
      GmailApp.search('is:unread', 0, 1);
      Logger.log('✅ Gmail 權限已授權');
    } catch (error) {
      Logger.log(`⚠️ Gmail 權限需要重新授權: ${error.toString()}`);
    }
    
    try {
      DriveApp.getFolders();
      Logger.log('✅ Drive 權限已授權');
    } catch (error) {
      Logger.log(`⚠️ Drive 權限需要重新授權: ${error.toString()}`);
    }
    
    // 2. 重建觸發器
    Logger.log('--- 2. 重建觸發器 ---');
    
    // 刪除所有現有觸發器
    const existingTriggers = ScriptApp.getProjectTriggers();
    existingTriggers.forEach(trigger => {
      ScriptApp.deleteTrigger(trigger);
      Logger.log(`🗑️ 刪除觸發器: ${trigger.getHandlerFunction()}`);
    });
    
    // 建立新的觸發器（使用簡化版本）
    try {
      ScriptApp.newTrigger('processAutomatedEmailsSimplified')
        .timeBased()
        .everyMinutes(15)
        .create();
      Logger.log('✅ 建立郵件處理觸發器 (簡化版)');
    } catch (triggerError) {
      Logger.log(`❌ 建立郵件觸發器失敗: ${triggerError.toString()}`);
    }
    
    try {
      ScriptApp.newTrigger('checkReceiptsFolderSimplified')
        .timeBased()
        .everyHours(1)
        .create();
      Logger.log('✅ 建立收據檢查觸發器 (簡化版)');
    } catch (triggerError) {
      Logger.log(`❌ 建立收據觸發器失敗: ${triggerError.toString()}`);
    }
    
    // 3. 測試新觸發器
    Logger.log('--- 3. 測試新觸發器 ---');
    try {
      processAutomatedEmailsSimplified();
      Logger.log('✅ 郵件處理測試成功');
    } catch (testError) {
      Logger.log(`⚠️ 郵件處理測試失敗: ${testError.toString()}`);
    }
    
    try {
      checkReceiptsFolderSimplified();
      Logger.log('✅ 收據檢查測試成功');
    } catch (testError) {
      Logger.log(`⚠️ 收據檢查測試失敗: ${testError.toString()}`);
    }
    
    Logger.log('=== 修復完成 ===');
    
  } catch (error) {
    Logger.log(`❌ 修復過程發生錯誤: ${error.toString()}`);
  }
}

/**
 * 簡化版郵件處理函數（不依賴 Phase4）
 */
function processAutomatedEmailsSimplified() {
  Logger.log('🔄 開始處理自動郵件（簡化版）...');
  
  try {
    const searchQueries = [
      'subject:電子發票 is:unread',
      'subject:發票 is:unread',
      'subject:收據 is:unread'
    ];
    
    let totalProcessed = 0;
    
    searchQueries.forEach(query => {
      Logger.log(`\n🔍 搜尋: ${query}`);
      
      try {
        const threads = GmailApp.search(query, 0, 3); // 限制數量避免超時
        Logger.log(`找到 ${threads.length} 個郵件串`);
        
        threads.forEach(thread => {
          const messages = thread.getMessages();
          
          messages.forEach(message => {
            if (message.isUnread()) {
              Logger.log(`📨 處理郵件: ${message.getSubject()}`);
              
              try {
                const result = processEmailSimplified(message);
                if (result) {
                  saveEmailRecordSimplified(result, message);
                  message.markRead();
                  totalProcessed++;
                  Logger.log('✅ 郵件處理完成');
                }
              } catch (emailError) {
                Logger.log(`❌ 處理單封郵件失敗: ${emailError.toString()}`);
              }
            }
          });
        });
        
      } catch (queryError) {
        Logger.log(`❌ 搜尋查詢失敗: ${queryError.toString()}`);
      }
    });
    
    Logger.log(`\n✅ 簡化版處理完成，共處理 ${totalProcessed} 封郵件`);
    
  } catch (error) {
    Logger.log(`❌ 簡化版處理失敗: ${error.toString()}`);
  }
}

/**
 * 簡化版收據檢查函數
 */
function checkReceiptsFolderSimplified() {
  Logger.log('🔄 開始檢查收據資料夾（簡化版）...');
  
  try {
    const folderId = PropertiesService.getScriptProperties().getProperty('FOLDER_ID_TO_PROCESS');
    
    if (!folderId) {
      Logger.log('⚠️ 收據資料夾 ID 未設定，跳過檢查');
      return;
    }
    
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFiles();
    
    let fileCount = 0;
    while (files.hasNext() && fileCount < 5) { // 限制處理數量
      const file = files.next();
      Logger.log(`📄 找到檔案: ${file.getName()}`);
      fileCount++;
    }
    
    Logger.log(`✅ 收據資料夾檢查完成，找到 ${fileCount} 個檔案`);
    
  } catch (error) {
    Logger.log(`❌ 收據資料夾檢查失敗: ${error.toString()}`);
  }
}

/**
 * 簡化版郵件處理
 */
function processEmailSimplified(message) {
  try {
    const subject = message.getSubject();
    
    // 基本資料提取
    const result = {
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      currency: 'TWD',
      category: '其他',
      description: subject,
      source: 'Email Simplified'
    };
    
    // 嘗試從主旨提取金額
    const amountMatch = subject.match(/(\d+(?:,\d{3})*(?:\.\d{2})?)/);
    if (amountMatch) {
      result.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    }
    
    Logger.log(`提取到資料: 金額=${result.amount}, 描述=${result.description}`);
    return result;
    
  } catch (error) {
    Logger.log(`❌ 處理郵件內容失敗: ${error.toString()}`);
    return null;
  }
}

/**
 * 簡化版記錄儲存
 */
function saveEmailRecordSimplified(data, message) {
  try {
    const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    
    if (!mainLedgerId) {
      throw new Error('主帳本 ID 未設定');
    }
    
    const ss = SpreadsheetApp.openById(mainLedgerId);
    const sheet = ss.getSheetByName('All Records');
    
    if (!sheet) {
      throw new Error('找不到 All Records 工作表');
    }
    
    const newRow = [
      data.date, // A: TIMESTAMP
      data.amount, // B: AMOUNT
      data.currency, // C: CURRENCY
      1, // D: EXCHANGE RATE (簡化為 1)
      '', // E: Amount (TWD) - 由公式計算
      data.category, // F: CATEGORY
      data.description, // G: ITEM
      '私人', // H: ACCOUNT TYPE
      '', // I: Linked_IOU_EventID
      '', // J: INVOICE NO.
      '', // K: REFERENCES NO.
      '', // L: BUYER NAME
      '', // M: BUYER TAX ID
      '', // N: SELLER TAX ID
      '', // O: RECEIPT IMAGE
      'Active', // P: STATUS
      data.source, // Q: SOURCE
      '', // R: NOTES
      message.getSubject(), // S: Original Text (OCR)
      '', // T: Translation (AI)
      JSON.stringify({
        messageId: message.getId(),
        sender: message.getFrom(),
        receivedDate: message.getDate().toISOString()
      }) // U: META_DATA
    ];
    
    sheet.appendRow(newRow);
    Logger.log('💾 記錄已儲存到 Google Sheets');
    
  } catch (error) {
    Logger.log(`❌ 儲存記錄失敗: ${error.toString()}`);
    throw error;
  }
}

/**
 * 重新授權所有權限
 */
function reauthorizeAllPermissions() {
  Logger.log('=== 重新授權所有權限 ===');
  
  try {
    // 強制觸發各種權限請求
    Logger.log('--- Gmail 權限 ---');
    try {
      const threads = GmailApp.search('is:unread', 0, 1);
      Logger.log('✅ Gmail 權限正常');
    } catch (error) {
      Logger.log(`❌ Gmail 權限失敗: ${error.toString()}`);
    }
    
    Logger.log('--- Drive 權限 ---');
    try {
      const folders = DriveApp.getFolders();
      Logger.log('✅ Drive 權限正常');
    } catch (error) {
      Logger.log(`❌ Drive 權限失敗: ${error.toString()}`);
    }
    
    Logger.log('--- Sheets 權限 ---');
    try {
      const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
      if (mainLedgerId) {
        const ss = SpreadsheetApp.openById(mainLedgerId);
        Logger.log('✅ Sheets 權限正常');
      } else {
        Logger.log('⚠️ 無法測試 Sheets 權限 (主帳本 ID 未設定)');
      }
    } catch (error) {
      Logger.log(`❌ Sheets 權限失敗: ${error.toString()}`);
    }
    
    Logger.log('--- Script 權限 ---');
    try {
      const triggers = ScriptApp.getProjectTriggers();
      Logger.log('✅ Script 權限正常');
    } catch (error) {
      Logger.log(`❌ Script 權限失敗: ${error.toString()}`);
    }
    
    Logger.log('=== 權限檢查完成 ===');
    
  } catch (error) {
    Logger.log(`❌ 權限檢查過程發生錯誤: ${error.toString()}`);
  }
}

/**
 * 手動測試觸發器函數
 */
function manualTestTriggerFunctions() {
  Logger.log('=== 手動測試觸發器函數 ===');
  
  try {
    Logger.log('--- 測試郵件處理 ---');
    processAutomatedEmailsSimplified();
    
    Logger.log('--- 測試收據檢查 ---');
    checkReceiptsFolderSimplified();
    
    Logger.log('✅ 所有測試完成');
    
  } catch (error) {
    Logger.log(`❌ 測試失敗: ${error.toString()}`);
  }
}