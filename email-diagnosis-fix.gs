// =================================================================================================
// 智慧記帳 GEM - 電子發票處理診斷和修復工具
// 版本：V46 修復版
// 最後更新：2025-07-27
// =================================================================================================

/**
 * 診斷電子發票處理問題
 * 在 Google Apps Script 編輯器中執行此函數來檢查問題
 */
function diagnoseEmailProcessing() {
  Logger.log('=== 電子發票處理診斷開始 ===');
  
  try {
    // 1. 檢查配置
    Logger.log('--- 檢查配置 ---');
    const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    const geminiApiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    
    Logger.log(`主帳本 ID: ${mainLedgerId ? '✅ 已設定' : '❌ 未設定'}`);
    Logger.log(`Gemini API Key: ${geminiApiKey ? '✅ 已設定' : '❌ 未設定'}`);
    
    // 2. 檢查工作表
    Logger.log('--- 檢查工作表 ---');
    if (mainLedgerId) {
      const ss = SpreadsheetApp.openById(mainLedgerId);
      const allRecordsSheet = ss.getSheetByName('All Records');
      const emailRulesSheet = ss.getSheetByName('EmailRules');
      
      Logger.log(`All Records 工作表: ${allRecordsSheet ? '✅ 存在' : '❌ 不存在'}`);
      Logger.log(`EmailRules 工作表: ${emailRulesSheet ? '✅ 存在' : '❌ 不存在'}`);
      
      if (!emailRulesSheet) {
        Logger.log('⚠️ 建議建立 EmailRules 工作表');
      }
    }
    
    // 3. 檢查觸發器
    Logger.log('--- 檢查觸發器 ---');
    const triggers = ScriptApp.getProjectTriggers();
    const emailTriggers = triggers.filter(trigger => 
      trigger.getHandlerFunction().includes('processAutomatedEmails') ||
      trigger.getHandlerFunction().includes('Email')
    );
    
    Logger.log(`找到 ${emailTriggers.length} 個郵件相關觸發器`);
    emailTriggers.forEach(trigger => {
      Logger.log(`- 函數: ${trigger.getHandlerFunction()}, 類型: ${trigger.getTriggerSource()}`);
    });
    
    // 4. 檢查函數可用性
    Logger.log('--- 檢查函數可用性 ---');
    Logger.log(`processAutomatedEmails: ${typeof processAutomatedEmails === 'function' ? '✅ 可用' : '❌ 不可用'}`);
    Logger.log(`processAutomatedEmailsFixed: ${typeof processAutomatedEmailsFixed === 'function' ? '✅ 可用' : '❌ 不可用'}`);
    Logger.log(`processAutomatedEmailsV46Compatible: ${typeof processAutomatedEmailsV46Compatible === 'function' ? '✅ 可用' : '❌ 不可用'}`);
    
    // 5. 測試郵件搜尋
    Logger.log('--- 測試郵件搜尋 ---');
    try {
      const testThreads = GmailApp.search('subject:電子發票 is:unread', 0, 1);
      Logger.log(`找到 ${testThreads.length} 封未讀電子發票郵件`);
    } catch (gmailError) {
      Logger.log(`❌ Gmail 搜尋失敗: ${gmailError.toString()}`);
    }
    
    Logger.log('=== 診斷完成 ===');
    
  } catch (error) {
    Logger.log(`❌ 診斷過程發生錯誤: ${error.toString()}`);
  }
}

/**
 * 修復電子發票處理功能
 */
function fixEmailProcessing() {
  Logger.log('=== 開始修復電子發票處理功能 ===');
  
  try {
    // 1. 建立 EmailRules 工作表（如果不存在）
    const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    if (mainLedgerId) {
      const ss = SpreadsheetApp.openById(mainLedgerId);
      let emailRulesSheet = ss.getSheetByName('EmailRules');
      
      if (!emailRulesSheet) {
        Logger.log('📋 建立 EmailRules 工作表...');
        emailRulesSheet = ss.insertSheet('EmailRules');
        
        // 設定標題行
        emailRulesSheet.getRange(1, 1, 1, 3).setValues([
          ['Query', 'Type', 'Description']
        ]);
        
        // 新增預設規則
        const defaultRules = [
          ['subject:電子發票 is:unread', 'HTML', '電子發票郵件'],
          ['subject:發票 is:unread', 'HTML', '一般發票郵件'],
          ['subject:收據 is:unread', 'HTML', '收據郵件'],
          ['has:attachment filename:csv is:unread', 'CSV', 'CSV 附件郵件']
        ];
        
        emailRulesSheet.getRange(2, 1, defaultRules.length, 3).setValues(defaultRules);
        Logger.log('✅ EmailRules 工作表建立完成');
      }
    }
    
    // 2. 重新設定觸發器
    Logger.log('🔄 重新設定觸發器...');
    
    // 刪除現有的郵件處理觸發器
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction().includes('processAutomatedEmails') ||
          trigger.getHandlerFunction().includes('Email')) {
        ScriptApp.deleteTrigger(trigger);
        Logger.log(`🗑️ 刪除觸發器: ${trigger.getHandlerFunction()}`);
      }
    });
    
    // 建立新的觸發器
    ScriptApp.newTrigger('processAutomatedEmailsV46Fixed')
      .timeBased()
      .everyMinutes(15)
      .create();
    
    Logger.log('✅ 新觸發器建立完成 (每 15 分鐘執行)');
    
    // 3. 測試執行
    Logger.log('🧪 測試執行...');
    try {
      processAutomatedEmailsV46Fixed();
      Logger.log('✅ 測試執行成功');
    } catch (testError) {
      Logger.log(`⚠️ 測試執行失敗: ${testError.toString()}`);
    }
    
    Logger.log('=== 修復完成 ===');
    
  } catch (error) {
    Logger.log(`❌ 修復過程發生錯誤: ${error.toString()}`);
  }
}

/**
 * V46 修復版電子發票處理函數
 */
function processAutomatedEmailsV46Fixed() {
  Logger.log('🔄 開始處理自動郵件（V46 修復版）...');
  
  try {
    const rules = getEmailRulesV46();
    Logger.log(`📋 載入了 ${rules.length} 條郵件處理規則`);
    
    let totalProcessed = 0;
    
    rules.forEach((rule, index) => {
      Logger.log(`\n📧 處理規則 ${index + 1}: ${rule.query}`);
      
      try {
        const threads = GmailApp.search(rule.query, 0, 5);
        Logger.log(`找到 ${threads.length} 個郵件串`);
        
        threads.forEach(thread => {
          const messages = thread.getMessages();
          
          messages.forEach(message => {
            if (message.isUnread()) {
              Logger.log(`📨 處理郵件: ${message.getSubject()}`);
              
              try {
                const result = processEmailMessageV46(message, rule.type);
                if (result) {
                  saveEmailRecordV46Fixed(result, message);
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
        
      } catch (ruleError) {
        Logger.log(`❌ 處理規則失敗: ${ruleError.toString()}`);
      }
    });
    
    Logger.log(`\n✅ V46 修復版處理完成，共處理 ${totalProcessed} 封郵件`);
    
  } catch (error) {
    Logger.log(`❌ V46 修復版處理失敗: ${error.toString()}`);
  }
}

/**
 * 獲取郵件處理規則
 */
function getEmailRulesV46() {
  try {
    const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    const ss = SpreadsheetApp.openById(mainLedgerId);
    const rulesSheet = ss.getSheetByName('EmailRules');
    
    if (!rulesSheet) {
      Logger.log('⚠️ 找不到 EmailRules 工作表，使用預設規則');
      return [
        { query: 'subject:電子發票 is:unread', type: 'HTML' },
        { query: 'subject:發票 is:unread', type: 'HTML' },
        { query: 'subject:收據 is:unread', type: 'HTML' }
      ];
    }
    
    const dataRange = rulesSheet.getDataRange();
    const values = dataRange.getValues();
    
    if (values.length < 2) {
      Logger.log('⚠️ EmailRules 工作表沒有資料，使用預設規則');
      return [
        { query: 'subject:電子發票 is:unread', type: 'HTML' },
        { query: 'subject:發票 is:unread', type: 'HTML' }
      ];
    }
    
    const rules = [];
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (row[0] && row[1]) {
        rules.push({
          query: row[0],
          type: row[1]
        });
      }
    }
    
    return rules;
    
  } catch (error) {
    Logger.log(`❌ 讀取郵件規則失敗: ${error.toString()}`);
    return [];
  }
}

/**
 * 處理單封郵件
 */
function processEmailMessageV46(message, type) {
  try {
    const subject = message.getSubject();
    const body = message.getBody();
    
    // 基本資料提取
    let result = {
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      currency: 'TWD',
      category: '其他',
      description: subject,
      source: 'Email V46'
    };
    
    // 嘗試從主旨提取金額
    const amountMatch = subject.match(/(\d+(?:,\d{3})*(?:\.\d{2})?)/);
    if (amountMatch) {
      result.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    }
    
    // 嘗試從內容提取更多資訊
    if (type === 'HTML') {
      // 簡化的 HTML 解析
      const htmlText = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
      
      // 尋找金額
      const htmlAmountMatch = htmlText.match(/金額[：:]\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/);
      if (htmlAmountMatch) {
        result.amount = parseFloat(htmlAmountMatch[1].replace(/,/g, ''));
      }
      
      // 尋找商家
      const merchantMatch = htmlText.match(/商家[：:]\s*([^\s]+)/);
      if (merchantMatch) {
        result.merchant = merchantMatch[1];
      }
    }
    
    Logger.log(`提取到資料: 金額=${result.amount}, 描述=${result.description}`);
    return result;
    
  } catch (error) {
    Logger.log(`❌ 處理郵件內容失敗: ${error.toString()}`);
    return null;
  }
}

/**
 * 儲存郵件記錄到 Google Sheets
 */
function saveEmailRecordV46Fixed(data, message) {
  try {
    const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    const ss = SpreadsheetApp.openById(mainLedgerId);
    const sheet = ss.getSheetByName('All Records');
    
    if (!sheet) {
      throw new Error('找不到 All Records 工作表');
    }
    
    // 計算匯率和台幣金額
    const currency = data.currency || 'TWD';
    const originalAmount = data.amount || 0;
    const exchangeRate = currency === 'TWD' ? 1 : 0.21; // 簡化的匯率處理
    
    const newRow = [
      data.date, // A: TIMESTAMP
      originalAmount, // B: AMOUNT
      currency, // C: CURRENCY
      exchangeRate, // D: EXCHANGE RATE
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
 * 手動測試電子發票處理
 */
function manualTestEmailProcessing() {
  Logger.log('=== 手動測試電子發票處理 ===');
  
  try {
    // 搜尋測試郵件
    const testThreads = GmailApp.search('subject:電子發票 OR subject:發票 OR subject:收據', 0, 3);
    Logger.log(`找到 ${testThreads.length} 個測試郵件串`);
    
    if (testThreads.length === 0) {
      Logger.log('⚠️ 沒有找到測試郵件，請確保您的 Gmail 中有相關郵件');
      return;
    }
    
    testThreads.forEach((thread, index) => {
      Logger.log(`\n--- 測試郵件 ${index + 1} ---`);
      const messages = thread.getMessages();
      
      messages.slice(0, 1).forEach(message => { // 只測試第一封
        Logger.log(`郵件主旨: ${message.getSubject()}`);
        Logger.log(`寄件者: ${message.getFrom()}`);
        Logger.log(`日期: ${message.getDate()}`);
        
        try {
          const result = processEmailMessageV46(message, 'HTML');
          if (result) {
            Logger.log(`✅ 解析成功: 金額=${result.amount}, 類別=${result.category}`);
            // 注意：這裡不實際儲存，只是測試解析
          } else {
            Logger.log('❌ 解析失敗');
          }
        } catch (testError) {
          Logger.log(`❌ 測試失敗: ${testError.toString()}`);
        }
      });
    });
    
    Logger.log('=== 手動測試完成 ===');
    
  } catch (error) {
    Logger.log(`❌ 手動測試失敗: ${error.toString()}`);
  }
}