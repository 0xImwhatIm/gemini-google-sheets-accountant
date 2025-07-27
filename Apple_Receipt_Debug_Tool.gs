// =================================================================================================
// Apple 收據調試工具 - 專門解決 Apple 收據解析問題
// 最後更新：2025-07-27
// =================================================================================================

/**
 * 調試 Apple 收據解析問題
 */
function debugAppleReceiptParsing() {
  Logger.log('=== Apple 收據調試開始 ===');
  
  try {
    // 搜尋 Apple 收據
    const threads = GmailApp.search('from:Apple subject:收據', 0, 1);
    
    if (threads.length === 0) {
      Logger.log('❌ 找不到 Apple 收據郵件');
      return;
    }
    
    const message = threads[0].getMessages()[0];
    Logger.log(`📨 找到郵件: ${message.getSubject()}`);
    Logger.log(`📧 寄件者: ${message.getFrom()}`);
    Logger.log(`📅 日期: ${message.getDate()}`);
    
    // 獲取郵件內容
    const htmlBody = message.getBody();
    const plainBody = message.getPlainBody();
    
    Logger.log('\n=== 郵件內容分析 ===');
    Logger.log('--- HTML 內容 (前 500 字元) ---');
    Logger.log(htmlBody.substring(0, 500));
    
    Logger.log('\n--- 純文字內容 (前 500 字元) ---');
    Logger.log(plainBody.substring(0, 500));
    
    // 測試各種金額提取模式
    Logger.log('\n=== 金額提取測試 ===');
    
    const textToSearch = plainBody || htmlBody.replace(/<[^>]*>/g, ' ');
    
    const amountPatterns = [
      { name: '總計模式1', pattern: /總計[：:\s]*([A-Z]{3})\s*\$?([0-9,]+\.?[0-9]*)/i },
      { name: '總計模式2', pattern: /Total[：:\s]*([A-Z]{3})\s*\$?([0-9,]+\.?[0-9]*)/i },
      { name: '金額+幣別', pattern: /\$([0-9,]+\.?[0-9]*)\s*([A-Z]{3})/i },
      { name: '幣別+金額', pattern: /([A-Z]{3})\s*\$([0-9,]+\.?[0-9]*)/i },
      { name: 'NT$模式', pattern: /NT\$([0-9,]+\.?[0-9]*)/i },
      { name: 'TWD模式', pattern: /TWD\s*([0-9,]+\.?[0-9]*)/i },
      { name: '一般$模式', pattern: /\$([0-9,]+\.?[0-9]*)/g },
      { name: '數字+元', pattern: /([0-9,]+\.?[0-9]*)\s*元/g },
      { name: '純數字', pattern: /([0-9,]+\.?[0-9]*)/g }
    ];
    
    amountPatterns.forEach(({ name, pattern }) => {
      const matches = textToSearch.match(pattern);
      if (matches) {
        Logger.log(`✅ ${name} 找到: ${JSON.stringify(matches)}`);
      } else {
        Logger.log(`❌ ${name} 未找到`);
      }
    });
    
    // 測試商品名稱提取
    Logger.log('\n=== 商品名稱提取測試 ===');
    
    const itemPatterns = [
      { name: '購買項目', pattern: /購買項目[：:\s]*([^\n\r]+)/i },
      { name: 'Item', pattern: /Item[：:\s]*([^\n\r]+)/i },
      { name: '應用程式', pattern: /應用程式[：:\s]*([^\n\r]+)/i },
      { name: 'App名稱', pattern: /App\s*Name[：:\s]*([^\n\r]+)/i }
    ];
    
    itemPatterns.forEach(({ name, pattern }) => {
      const match = textToSearch.match(pattern);
      if (match) {
        Logger.log(`✅ ${name} 找到: ${match[1]}`);
      } else {
        Logger.log(`❌ ${name} 未找到`);
      }
    });
    
    // 使用增強版解析
    Logger.log('\n=== 使用增強版解析 ===');
    const result = parseAppleReceiptEnhanced(message);
    Logger.log(`解析結果: ${JSON.stringify(result, null, 2)}`);
    
  } catch (error) {
    Logger.log(`❌ 調試失敗: ${error.toString()}`);
    Logger.log(`❌ 錯誤堆疊: ${error.stack}`);
  }
}

/**
 * 增強版 Apple 收據解析
 */
function parseAppleReceiptEnhanced(message) {
  try {
    const subject = message.getSubject();
    const htmlBody = message.getBody();
    const plainBody = message.getPlainBody();
    const sender = message.getFrom();
    const messageDate = message.getDate();
    
    let result = {
      date: Utilities.formatDate(messageDate, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      amount: 0,
      currency: 'TWD',
      category: '育',
      description: subject,
      merchant: 'Apple',
      source: 'Email Enhanced Apple'
    };
    
    // 優先使用純文字內容，如果沒有則處理 HTML
    let textToSearch = plainBody;
    if (!textToSearch || textToSearch.trim() === '') {
      textToSearch = htmlBody.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    }
    
    Logger.log(`🔍 搜尋文字長度: ${textToSearch.length}`);
    Logger.log(`🔍 搜尋文字樣本: ${textToSearch.substring(0, 200)}...`);
    
    // 更全面的金額提取邏輯
    const amountExtractionMethods = [
      // 方法1: 尋找總計行
      () => {
        const totalMatch = textToSearch.match(/總計[：:\s]*([A-Z]{3})\s*\$?([0-9,]+\.?[0-9]*)/i);
        if (totalMatch) {
          return { amount: parseFloat(totalMatch[2].replace(/,/g, '')), currency: totalMatch[1] };
        }
        return null;
      },
      
      // 方法2: 尋找 Total 行
      () => {
        const totalMatch = textToSearch.match(/Total[：:\s]*([A-Z]{3})\s*\$?([0-9,]+\.?[0-9]*)/i);
        if (totalMatch) {
          return { amount: parseFloat(totalMatch[2].replace(/,/g, '')), currency: totalMatch[1] };
        }
        return null;
      },
      
      // 方法3: 尋找 NT$ 格式
      () => {
        const ntMatch = textToSearch.match(/NT\$([0-9,]+\.?[0-9]*)/i);
        if (ntMatch) {
          return { amount: parseFloat(ntMatch[1].replace(/,/g, '')), currency: 'TWD' };
        }
        return null;
      },
      
      // 方法4: 尋找 TWD 格式
      () => {
        const twdMatch = textToSearch.match(/TWD\s*\$?([0-9,]+\.?[0-9]*)/i);
        if (twdMatch) {
          return { amount: parseFloat(twdMatch[1].replace(/,/g, '')), currency: 'TWD' };
        }
        return null;
      },
      
      // 方法5: 尋找 $ + 數字 + 幣別
      () => {
        const currencyMatch = textToSearch.match(/\$([0-9,]+\.?[0-9]*)\s*([A-Z]{3})/i);
        if (currencyMatch) {
          return { amount: parseFloat(currencyMatch[1].replace(/,/g, '')), currency: currencyMatch[2] };
        }
        return null;
      },
      
      // 方法6: 尋找幣別 + $ + 數字
      () => {
        const currencyMatch = textToSearch.match(/([A-Z]{3})\s*\$([0-9,]+\.?[0-9]*)/i);
        if (currencyMatch) {
          return { amount: parseFloat(currencyMatch[2].replace(/,/g, '')), currency: currencyMatch[1] };
        }
        return null;
      },
      
      // 方法7: 尋找所有 $ 符號後的數字，取最大值
      () => {
        const allMatches = textToSearch.match(/\$([0-9,]+\.?[0-9]*)/g);
        if (allMatches && allMatches.length > 0) {
          const amounts = allMatches.map(match => {
            const num = match.replace('$', '').replace(/,/g, '');
            return parseFloat(num);
          }).filter(num => !isNaN(num) && num > 0);
          
          if (amounts.length > 0) {
            // 取最大值作為總金額
            const maxAmount = Math.max(...amounts);
            return { amount: maxAmount, currency: 'TWD' };
          }
        }
        return null;
      }
    ];
    
    // 依序嘗試各種提取方法
    for (let i = 0; i < amountExtractionMethods.length; i++) {
      const extractionResult = amountExtractionMethods[i]();
      if (extractionResult && extractionResult.amount > 0) {
        result.amount = extractionResult.amount;
        result.currency = extractionResult.currency;
        Logger.log(`💰 方法 ${i + 1} 成功提取金額: ${result.amount} ${result.currency}`);
        break;
      }
    }
    
    // 提取商品名稱
    const itemExtractionMethods = [
      () => textToSearch.match(/購買項目[：:\s]*([^\n\r]+)/i),
      () => textToSearch.match(/Item[：:\s]*([^\n\r]+)/i),
      () => textToSearch.match(/應用程式[：:\s]*([^\n\r]+)/i),
      () => textToSearch.match(/App\s*Name[：:\s]*([^\n\r]+)/i),
      () => textToSearch.match(/產品[：:\s]*([^\n\r]+)/i)
    ];
    
    for (let method of itemExtractionMethods) {
      const match = method();
      if (match && match[1]) {
        result.description = `Apple - ${match[1].trim()}`;
        Logger.log(`📱 提取到商品名稱: ${match[1].trim()}`);
        break;
      }
    }
    
    return result;
    
  } catch (error) {
    Logger.log(`❌ Apple 收據解析失敗: ${error.toString()}`);
    return null;
  }
}

/**
 * 修復現有的 Apple 收據記錄
 */
function fixExistingAppleRecords() {
  Logger.log('=== 修復現有 Apple 收據記錄 ===');
  
  try {
    const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    const ss = SpreadsheetApp.openById(mainLedgerId);
    const sheet = ss.getSheetByName('All Records');
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    let fixedCount = 0;
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const amount = row[1]; // B欄：AMOUNT
      const originalText = row[18]; // S欄：Original Text
      const metaData = row[20]; // U欄：META_DATA
      
      // 檢查是否是 Apple 收據且金額為 0
      if ((amount === 0 || amount === '0') && 
          originalText && originalText.includes('Apple') &&
          metaData) {
        
        Logger.log(`🔧 修復第 ${i + 1} 行 Apple 記錄: ${originalText}`);
        
        try {
          const meta = JSON.parse(metaData);
          const messageId = meta.messageId;
          
          if (messageId) {
            // 重新獲取郵件並解析
            const threads = GmailApp.search(`rfc822msgid:${messageId}`, 0, 1);
            if (threads.length > 0) {
              const message = threads[0].getMessages()[0];
              const newResult = parseAppleReceiptEnhanced(message);
              
              if (newResult && newResult.amount > 0) {
                // 更新記錄
                sheet.getRange(i + 1, 2).setValue(newResult.amount); // B欄：AMOUNT
                sheet.getRange(i + 1, 3).setValue(newResult.currency); // C欄：CURRENCY
                sheet.getRange(i + 1, 4).setValue(newResult.currency === 'TWD' ? 1 : 0.21); // D欄：EXCHANGE RATE
                sheet.getRange(i + 1, 6).setValue(newResult.category); // F欄：CATEGORY
                sheet.getRange(i + 1, 7).setValue(newResult.description); // G欄：ITEM
                sheet.getRange(i + 1, 17).setValue(newResult.source); // Q欄：SOURCE
                
                // 更新 META_DATA
                meta.merchant = newResult.merchant;
                sheet.getRange(i + 1, 21).setValue(JSON.stringify(meta)); // U欄：META_DATA
                
                fixedCount++;
                Logger.log(`✅ 修復成功: 金額=${newResult.amount}, 描述=${newResult.description}`);
              }
            }
          }
        } catch (parseError) {
          Logger.log(`⚠️ 解析 META_DATA 失敗: ${parseError.toString()}`);
        }
      }
    }
    
    Logger.log(`✅ 共修復 ${fixedCount} 筆 Apple 記錄`);
    
  } catch (error) {
    Logger.log(`❌ 修復 Apple 記錄失敗: ${error.toString()}`);
  }
}

/**
 * 測試並修復觸發器
 */
function fixAppleReceiptTrigger() {
  Logger.log('=== 修復 Apple 收據觸發器 ===');
  
  try {
    // 1. 刪除現有觸發器
    const existingTriggers = ScriptApp.getProjectTriggers();
    existingTriggers.forEach(trigger => {
      ScriptApp.deleteTrigger(trigger);
      Logger.log(`🗑️ 刪除觸發器: ${trigger.getHandlerFunction()}`);
    });
    
    // 2. 建立新的增強版觸發器
    ScriptApp.newTrigger('processAutomatedEmailsWithAppleFix')
      .timeBased()
      .everyMinutes(15)
      .create();
    
    Logger.log('✅ 建立新的 Apple 修復觸發器');
    
    // 3. 測試新觸發器
    processAutomatedEmailsWithAppleFix();
    
  } catch (error) {
    Logger.log(`❌ 修復觸發器失敗: ${error.toString()}`);
  }
}

/**
 * 帶有 Apple 修復的郵件處理函數
 */
function processAutomatedEmailsWithAppleFix() {
  Logger.log('🔄 開始處理自動郵件（Apple 修復版）...');
  
  try {
    const searchQueries = [
      'subject:電子發票 is:unread',
      'subject:發票 is:unread',
      'subject:收據 is:unread',
      'from:Apple subject:收據 is:unread',
      'from:no_reply@email.apple.com is:unread'
    ];
    
    let totalProcessed = 0;
    
    searchQueries.forEach(query => {
      Logger.log(`\n🔍 搜尋: ${query}`);
      
      const threads = GmailApp.search(query, 0, 5);
      Logger.log(`找到 ${threads.length} 個郵件串`);
      
      threads.forEach(thread => {
        const messages = thread.getMessages();
        
        messages.forEach(message => {
          if (message.isUnread()) {
            Logger.log(`📨 處理郵件: ${message.getSubject()}`);
            
            try {
              let result;
              
              // 特殊處理 Apple 郵件
              if (message.getFrom().includes('Apple') || message.getFrom().includes('apple.com')) {
                result = parseAppleReceiptEnhanced(message);
              } else {
                // 使用一般處理邏輯
                result = {
                  date: Utilities.formatDate(message.getDate(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
                  amount: 0,
                  currency: 'TWD',
                  category: '其他',
                  description: message.getSubject(),
                  merchant: '',
                  source: 'Email Apple Fix'
                };
                
                // 簡單的金額提取
                const amountMatch = message.getSubject().match(/(\d+(?:,\d{3})*(?:\.\d{2})?)/);
                if (amountMatch) {
                  result.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
                }
              }
              
              if (result) {
                saveEmailRecordWithAppleFix(result, message);
                message.markRead();
                totalProcessed++;
                Logger.log('✅ 郵件處理完成');
              }
              
            } catch (emailError) {
              Logger.log(`❌ 處理郵件失敗: ${emailError.toString()}`);
            }
          }
        });
      });
    });
    
    Logger.log(`\n✅ Apple 修復版處理完成，共處理 ${totalProcessed} 封郵件`);
    
  } catch (error) {
    Logger.log(`❌ Apple 修復版處理失敗: ${error.toString()}`);
  }
}

/**
 * 帶有 Apple 修復的記錄儲存
 */
function saveEmailRecordWithAppleFix(data, message) {
  try {
    const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    const ss = SpreadsheetApp.openById(mainLedgerId);
    const sheet = ss.getSheetByName('All Records');
    
    const exchangeRate = data.currency === 'TWD' ? 1 : 0.21;
    
    const newRow = [
      data.date,                    // A: TIMESTAMP
      data.amount,                  // B: AMOUNT
      data.currency,                // C: CURRENCY
      exchangeRate,                 // D: EXCHANGE RATE
      '',                          // E: Amount (TWD) - 由公式計算
      data.category,               // F: CATEGORY
      data.description,            // G: ITEM
      '私人',                      // H: ACCOUNT TYPE
      '',                          // I: Linked_IOU_EventID
      '',                          // J: INVOICE NO.
      '',                          // K: REFERENCES NO.
      '',                          // L: BUYER NAME
      '',                          // M: BUYER TAX ID
      '',                          // N: SELLER TAX ID
      '',                          // O: RECEIPT IMAGE
      'Active',                    // P: STATUS
      data.source,                 // Q: SOURCE
      '',                          // R: NOTES
      message.getSubject(),        // S: Original Text (OCR)
      '',                          // T: Translation (AI)
      JSON.stringify({             // U: META_DATA
        messageId: message.getId(),
        sender: message.getFrom(),
        receivedDate: message.getDate().toISOString(),
        merchant: data.merchant || ''
      })
    ];
    
    sheet.appendRow(newRow);
    Logger.log(`💾 Apple 修復版記錄已儲存: ${data.amount} ${data.currency} - ${data.description}`);
    
  } catch (error) {
    Logger.log(`❌ Apple 修復版儲存失敗: ${error.toString()}`);
    throw error;
  }
}

/**
 * 完整的 Apple 收據修復流程
 */
function runCompleteAppleFix() {
  Logger.log('=== 執行完整 Apple 收據修復 ===');
  
  try {
    // 1. 調試現有 Apple 收據
    debugAppleReceiptParsing();
    
    // 2. 修復現有記錄
    fixExistingAppleRecords();
    
    // 3. 修復觸發器
    fixAppleReceiptTrigger();
    
    Logger.log('=== Apple 收據修復完成 ===');
    
  } catch (error) {
    Logger.log(`❌ Apple 收據修復失敗: ${error.toString()}`);
  }
}