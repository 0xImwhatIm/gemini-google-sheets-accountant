// =================================================================================================
// V47.1 觸發器更新工具 - 使用增強版處理函數
// 最後更新：2025-07-27
// =================================================================================================

/**
 * 更新觸發器為增強版處理函數
 */
function updateTriggersToEnhanced() {
  Logger.log('=== 更新觸發器為增強版 ===');
  
  try {
    // 1. 刪除所有現有觸發器
    Logger.log('--- 1. 刪除現有觸發器 ---');
    const existingTriggers = ScriptApp.getProjectTriggers();
    existingTriggers.forEach(trigger => {
      ScriptApp.deleteTrigger(trigger);
      Logger.log(`🗑️ 刪除觸發器: ${trigger.getHandlerFunction()}`);
    });
    
    // 2. 建立增強版觸發器
    Logger.log('--- 2. 建立增強版觸發器 ---');
    
    // 郵件處理觸發器 - 每15分鐘
    try {
      ScriptApp.newTrigger('processAutomatedEmailsEnhanced')
        .timeBased()
        .everyMinutes(15)
        .create();
      Logger.log('✅ 建立增強版郵件處理觸發器 (每 15 分鐘)');
    } catch (triggerError) {
      Logger.log(`❌ 建立郵件觸發器失敗: ${triggerError.toString()}`);
    }
    
    // 收據檢查觸發器 - 每小時
    try {
      ScriptApp.newTrigger('checkReceiptsFolderSimplified')
        .timeBased()
        .everyHours(1)
        .create();
      Logger.log('✅ 建立收據檢查觸發器 (每 1 小時)');
    } catch (triggerError) {
      Logger.log(`❌ 建立收據觸發器失敗: ${triggerError.toString()}`);
    }
    
    // 3. 測試新觸發器
    Logger.log('--- 3. 測試新觸發器 ---');
    try {
      processAutomatedEmailsEnhanced();
      Logger.log('✅ 增強版郵件處理測試成功');
    } catch (testError) {
      Logger.log(`⚠️ 增強版郵件處理測試失敗: ${testError.toString()}`);
    }
    
    // 4. 顯示當前觸發器狀態
    Logger.log('--- 4. 當前觸發器狀態 ---');
    const newTriggers = ScriptApp.getProjectTriggers();
    newTriggers.forEach((trigger, index) => {
      Logger.log(`觸發器 ${index + 1}:`);
      Logger.log(`  - 函數: ${trigger.getHandlerFunction()}`);
      Logger.log(`  - 類型: ${trigger.getTriggerSource()}`);
      Logger.log(`  - 事件: ${trigger.getEventType()}`);
    });
    
    Logger.log('=== 觸發器更新完成 ===');
    
  } catch (error) {
    Logger.log(`❌ 更新觸發器失敗: ${error.toString()}`);
  }
}

/**
 * 修復現有資料的欄位問題
 */
function fixExistingRecordColumns() {
  Logger.log('=== 修復現有記錄的欄位問題 ===');
  
  try {
    const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    const ss = SpreadsheetApp.openById(mainLedgerId);
    const sheet = ss.getSheetByName('All Records');
    
    if (!sheet) {
      throw new Error('找不到 All Records 工作表');
    }
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    Logger.log(`📊 檢查 ${values.length - 1} 筆記錄...`);
    
    let fixedCount = 0;
    
    // 從第二行開始檢查（跳過標題行）
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      
      // 檢查是否是有問題的記錄（金額為0且來源是Email相關）
      const amount = row[1]; // B欄：AMOUNT
      const currency = row[2]; // C欄：CURRENCY
      const source = row[16]; // Q欄：SOURCE
      const originalText = row[18]; // S欄：Original Text
      
      if ((amount === 0 || amount === '0') && 
          source && source.includes('Email') && 
          originalText) {
        
        Logger.log(`🔧 修復第 ${i + 1} 行記錄: ${originalText}`);
        
        // 嘗試重新解析金額
        let newAmount = 0;
        let newCurrency = 'TWD';
        let newCategory = '其他';
        let newMerchant = '';
        
        // Apple 收據特殊處理
        if (originalText.includes('Apple') || originalText.includes('apple')) {
          const appleAmountMatch = originalText.match(/\$([0-9,]+\.?[0-9]*)/);
          if (appleAmountMatch) {
            newAmount = parseFloat(appleAmountMatch[1].replace(/,/g, ''));
            newCategory = '育';
            newMerchant = 'Apple';
          }
        }
        
        // 一般金額提取
        if (newAmount === 0) {
          const generalAmountMatch = originalText.match(/(\d+(?:,\d{3})*(?:\.\d{2})?)/);
          if (generalAmountMatch) {
            newAmount = parseFloat(generalAmountMatch[1].replace(/,/g, ''));
          }
        }
        
        // 更新記錄
        if (newAmount > 0) {
          const exchangeRate = newCurrency === 'TWD' ? 1 : 0.21;
          
          // 更新相關欄位
          sheet.getRange(i + 1, 2).setValue(newAmount); // B欄：AMOUNT
          sheet.getRange(i + 1, 3).setValue(newCurrency); // C欄：CURRENCY
          sheet.getRange(i + 1, 4).setValue(exchangeRate); // D欄：EXCHANGE RATE
          sheet.getRange(i + 1, 6).setValue(newCategory); // F欄：CATEGORY
          
          // 更新 META_DATA 加入商家資訊
          try {
            const metaData = JSON.parse(row[20] || '{}');
            metaData.merchant = newMerchant;
            sheet.getRange(i + 1, 21).setValue(JSON.stringify(metaData)); // U欄：META_DATA
          } catch (metaError) {
            Logger.log(`⚠️ 更新 META_DATA 失敗: ${metaError.toString()}`);
          }
          
          fixedCount++;
          Logger.log(`✅ 修復完成: 金額=${newAmount}, 類別=${newCategory}`);
        }
      }
    }
    
    Logger.log(`✅ 共修復 ${fixedCount} 筆記錄`);
    
  } catch (error) {
    Logger.log(`❌ 修復現有記錄失敗: ${error.toString()}`);
  }
}

/**
 * 檢查和修復重複記錄
 */
function checkAndFixDuplicateRecords() {
  Logger.log('=== 檢查和修復重複記錄 ===');
  
  try {
    const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    const ss = SpreadsheetApp.openById(mainLedgerId);
    const sheet = ss.getSheetByName('All Records');
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    const messageIds = new Set();
    const duplicateRows = [];
    
    // 檢查重複的 messageId
    for (let i = 1; i < values.length; i++) {
      const metaData = values[i][20]; // U欄：META_DATA
      
      if (metaData) {
        try {
          const parsed = JSON.parse(metaData);
          if (parsed.messageId) {
            if (messageIds.has(parsed.messageId)) {
              duplicateRows.push(i + 1); // 記錄行號（1-based）
              Logger.log(`🔍 發現重複記錄: 第 ${i + 1} 行, messageId: ${parsed.messageId}`);
            } else {
              messageIds.add(parsed.messageId);
            }
          }
        } catch (parseError) {
          // 忽略解析錯誤
        }
      }
    }
    
    Logger.log(`📊 檢查完成: 找到 ${duplicateRows.length} 筆重複記錄`);
    
    // 可以選擇是否刪除重複記錄
    if (duplicateRows.length > 0) {
      Logger.log('⚠️ 發現重複記錄，請手動檢查是否需要刪除');
      duplicateRows.forEach(rowNum => {
        Logger.log(`  - 第 ${rowNum} 行: ${values[rowNum - 1][18]}`); // 顯示原始文字
      });
    }
    
  } catch (error) {
    Logger.log(`❌ 檢查重複記錄失敗: ${error.toString()}`);
  }
}

/**
 * 完整的資料修復流程
 */
function runCompleteDataFix() {
  Logger.log('=== 執行完整資料修復流程 ===');
  
  try {
    // 1. 更新觸發器
    updateTriggersToEnhanced();
    
    // 2. 修復現有記錄
    fixExistingRecordColumns();
    
    // 3. 檢查重複記錄
    checkAndFixDuplicateRecords();
    
    // 4. 標記已處理郵件為已讀
    markProcessedEmailsAsRead();
    
    // 5. 測試增強版處理
    Logger.log('--- 5. 測試增強版處理 ---');
    manualTestEnhancedEmailProcessing();
    
    Logger.log('=== 完整修復流程完成 ===');
    Logger.log('✅ 建議接下來：');
    Logger.log('  1. 檢查 Google Sheets 中的記錄是否正確');
    Logger.log('  2. 確認郵件已標記為已讀');
    Logger.log('  3. 等待下次觸發器執行（15分鐘後）');
    
  } catch (error) {
    Logger.log(`❌ 完整修復流程失敗: ${error.toString()}`);
  }
}

/**
 * 手動處理特定郵件（用於測試）
 */
function manualProcessSpecificEmail() {
  Logger.log('=== 手動處理特定郵件 ===');
  
  try {
    // 搜尋 Apple 收據
    const threads = GmailApp.search('from:Apple subject:收據', 0, 1);
    
    if (threads.length > 0) {
      const messages = threads[0].getMessages();
      
      if (messages.length > 0) {
        const message = messages[0];
        Logger.log(`📨 處理郵件: ${message.getSubject()}`);
        Logger.log(`📧 寄件者: ${message.getFrom()}`);
        
        const result = processEmailEnhanced(message);
        
        if (result) {
          Logger.log('✅ 解析結果:');
          Logger.log(`  - 日期: ${result.date}`);
          Logger.log(`  - 金額: ${result.amount}`);
          Logger.log(`  - 幣別: ${result.currency}`);
          Logger.log(`  - 類別: ${result.category}`);
          Logger.log(`  - 描述: ${result.description}`);
          Logger.log(`  - 商家: ${result.merchant}`);
          
          // 實際儲存（取消註解以執行）
          // saveEmailRecordEnhanced(result, message);
          // message.markRead();
          
        } else {
          Logger.log('❌ 解析失敗');
        }
      }
    } else {
      Logger.log('⚠️ 找不到 Apple 收據郵件');
    }
    
  } catch (error) {
    Logger.log(`❌ 手動處理失敗: ${error.toString()}`);
  }
}