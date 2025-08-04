// =================================================================================================
// Code.gs 整合補丁 - 2025-08-04
// 將優化版功能整合到現有的 Code.gs 系統中
// =================================================================================================

/**
 * 🔗 將優化版功能整合到現有系統
 * 在 Code.gs 文件末尾添加以下代碼
 */

// =================================================================================================
// 【V47.4 新增】優化版 Email 處理整合
// =================================================================================================

/**
 * 🎯 優化版 Email Rules 處理器（整合到 Code.gs）
 * 包含智能分類、精確日期、重複檢測功能
 */
function processReceiptsByEmailRulesOptimized() {
  return withPhase4ErrorHandling(() => {
    Logger.log('🎯 優化版完整的 Email Rules 處理器啟動...');
    
    try {
      const emailRules = [
        {
          query: 'from:no_reply@email.apple.com subject:發票通知 is:unread',
          type: 'Apple',
          processor: 'processAppleInvoiceOptimized',
          needsAttachment: false
        },
        {
          query: 'from:payments-noreply@google.com subject:應付憑據 is:unread',
          type: 'Google',
          processor: 'processGooglePaymentOptimized',
          needsAttachment: true,
          attachmentType: 'PDF'
        },
        {
          query: 'from:invoice@cht.com.tw subject:電子發票 is:unread',
          type: 'CHT',
          processor: 'processCHTInvoiceOptimized',
          needsAttachment: true,
          attachmentType: 'HTML'
        },
        {
          query: 'from:einvoice@einvoice.nat.gov.tw subject:彙整 is:unread',
          type: 'Government',
          processor: 'processGovernmentInvoiceOptimized',
          needsAttachment: true,
          attachmentType: 'CSV'
        }
      ];
      
      let totalProcessed = 0;
      let totalSkipped = 0;
      let processedMessageIds = new Set();
      
      emailRules.forEach((rule, index) => {
        Logger.log(`\n🔍 處理規則 ${index + 1}/${emailRules.length}: ${rule.type}`);
        Logger.log(`📧 搜尋條件: ${rule.query}`);
        
        try {
          const threads = GmailApp.search(rule.query, 0, 3);
          Logger.log(`找到 ${threads.length} 個郵件串`);
          
          threads.forEach(thread => {
            const messages = thread.getMessages();
            
            messages.forEach(message => {
              const messageId = message.getId();
              
              if (processedMessageIds.has(messageId)) {
                Logger.log(`⏭️ 跳過已處理的郵件: ${messageId}`);
                return;
              }
              
              if (message.isUnread()) {
                Logger.log(`📨 處理郵件: ${message.getSubject()}`);
                
                try {
                  const results = processEmailOptimized(message, rule);
                  
                  if (results) {
                    let recordsToSave = [];
                    
                    if (Array.isArray(results)) {
                      recordsToSave = results;
                    } else if (results.amount > 0) {
                      recordsToSave = [results];
                    }
                    
                    if (recordsToSave.length > 0) {
                      saveEmailRecordsOptimized(recordsToSave, message);
                      totalProcessed += recordsToSave.length;
                      Logger.log(`✅ 處理了 ${recordsToSave.length} 筆記錄`);
                    } else {
                      totalSkipped++;
                      Logger.log('⏭️ 所有記錄都是重複，已跳過');
                    }
                    
                    Utilities.sleep(500);
                    message.markRead();
                    Logger.log('✅ 郵件已標記為已讀');
                    
                    processedMessageIds.add(messageId);
                    Logger.log('✅ 郵件處理完成');
                  } else {
                    Logger.log('⚠️ 郵件解析失敗，跳過');
                  }
                } catch (emailError) {
                  Logger.log(`❌ 處理郵件失敗: ${emailError.toString()}`);
                }
              }
            });
          });
          
        } catch (ruleError) {
          Logger.log(`❌ 處理規則失敗: ${ruleError.toString()}`);
        }
      });
      
      Logger.log(`\n✅ 優化版處理完成`);
      Logger.log(`📊 新增記錄: ${totalProcessed} 筆`);
      Logger.log(`⏭️ 跳過重複: ${totalSkipped} 筆`);
      Logger.log(`🎯 重複檢測和智能分類已啟用`);
      
    } catch (error) {
      Logger.log(`❌ 優化版處理失敗: ${error.toString()}`);
    }
  }, {}, 'processReceiptsByEmailRulesOptimized');
}

/**
 * 📧 優化版郵件處理邏輯
 */
function processEmailOptimized(message, rule) {
  try {
    Logger.log(`🔍 開始處理 ${rule.type} 郵件`);
    
    let result = {
      date: Utilities.formatDate(message.getDate(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      amount: 0,
      currency: 'TWD',
      category: '其他',
      description: message.getSubject(),
      merchant: '',
      invoiceNumber: '',
      source: 'Email : 電子收據'
    };
    
    // 根據不同類型使用對應的處理邏輯
    switch (rule.type) {
      case 'Apple':
        result = processAppleInvoiceOptimized(message, result);
        break;
      case 'Google':
        result = processGooglePaymentOptimized(message, result);
        break;
      case 'CHT':
        result = processCHTInvoiceOptimized(message, result);
        break;
      case 'Government':
        return processGovernmentInvoiceOptimized(message, result); // 返回陣列
      default:
        Logger.log(`⚠️ 未知的郵件類型: ${rule.type}`);
        break;
    }
    
    return validateResultOptimized(result);
    
  } catch (error) {
    Logger.log(`❌ 郵件處理失敗: ${error.toString()}`);
    return null;
  }
}

/**
 * 💾 優化版記錄儲存（使用現有的 Code.gs 結構）
 */
function saveEmailRecordsOptimized(records, message) {
  try {
    const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    records.forEach((data, index) => {
      const exchangeRate = data.currency === 'TWD' ? 1 : (data.currency === 'USD' ? 31.5 : 1);
      
      const newRow = [
        data.date,                           // A: TIMESTAMP
        data.amount,                         // B: AMOUNT
        data.currency,                       // C: CURRENCY
        exchangeRate,                        // D: EXCHANGE RATE
        '',                                  // E: Amount (TWD) - 由公式計算
        data.category,                       // F: CATEGORY
        data.description,                    // G: ITEM
        '私人',                              // H: ACCOUNT TYPE
        '',                                  // I: Linked_IOU_EventID
        data.invoiceNumber || '',            // J: INVOICE NO.
        '',                                  // K: REFERENCES NO.
        '',                                  // L: BUYER NAME
        '',                                  // M: BUYER TAX ID
        '',                                  // N: SELLER TAX ID
        '',                                  // O: RECEIPT IMAGE
        '已確認',                            // P: STATUS
        data.source,                         // Q: SOURCE
        '',                                  // R: NOTES
        message.getSubject(),                // S: Original Text (OCR)
        '',                                  // T: Translation (AI)
        JSON.stringify({                     // U: META_DATA
          messageId: message.getId(),
          sender: message.getFrom(),
          receivedDate: message.getDate().toISOString(),
          merchant: data.merchant,
          processedAt: new Date().toISOString(),
          processor: 'Optimized Integration V1.0',
          recordIndex: index + 1,
          totalRecords: records.length,
          originalData: data.originalData || {}
        })
      ];
      
      sheet.appendRow(newRow);
      Logger.log(`💾 記錄 ${index + 1} 已儲存: ${data.amount} ${data.currency} - ${data.description}`);
    });
    
  } catch (error) {
    Logger.log(`❌ 儲存記錄失敗: ${error.toString()}`);
    throw error;
  }
}

/**
 * ✅ 結果驗證（優化版）
 */
function validateResultOptimized(result) {
  if (!result || isNaN(result.amount) || result.amount <= 0) {
    return null;
  }
  
  const validCurrencies = ['TWD', 'USD', 'JPY', 'EUR'];
  if (!validCurrencies.includes(result.currency)) {
    result.currency = 'TWD';
  }
  
  const validCategories = ['食', '衣', '住', '行', '育', '樂', '醫療', '保險', '其他'];
  if (!validCategories.includes(result.category)) {
    result.category = '其他';
  }
  
  return result;
}

// =================================================================================================
// 【整合說明】如何將優化版功能加入 Code.gs
// =================================================================================================

/*
要將優化版功能整合到現有的 Code.gs 中，請按照以下步驟：

1. 【複製智能分類器】
   將 Email_Rules_Based_Processor.gs 中的 SmartCategoryClassifier 類別
   複製到 Code.gs 文件末尾

2. 【複製日期處理器】
   將 SmartDateProcessor 類別複製到 Code.gs 文件末尾

3. 【複製重複檢測器】
   將 DuplicateDetector 類別複製到 Code.gs 文件末尾

4. 【複製處理函數】
   將以下函數複製到 Code.gs 文件末尾：
   - processAppleInvoiceOptimized (使用現有的 processAppleInvoiceFinal)
   - processGooglePaymentOptimized (使用現有的 processGooglePaymentFinal)
   - processCHTInvoiceOptimized (使用現有的 processCHTInvoiceFinal)
   - processGovernmentInvoiceOptimized (使用優化版)

5. 【更新觸發器】
   觸發器已經設定為使用 processReceiptsByEmailRulesOptimized

這樣就能在保持現有功能的同時，添加優化版的智能分類和重複檢測功能。
*/