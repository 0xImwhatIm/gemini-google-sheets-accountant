// =================================================================================================
// Apple 收據修正版 - 專門解決 NT$ 90 格式問題
// 最後更新：2025-07-27
// =================================================================================================

/**
 * 修正版 Apple 收據解析 - 針對實際格式優化
 */
function parseAppleReceiptFixed(message) {
  try {
    const subject = message.getSubject();
    const htmlBody = message.getBody();
    const plainBody = message.getPlainBody();
    const messageDate = message.getDate();
    
    let result = {
      date: Utilities.formatDate(messageDate, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      amount: 0,
      currency: 'TWD',
      category: '育',
      description: subject,
      merchant: 'Apple',
      source: 'Email Apple Fixed'
    };
    
    // 使用純文字內容
    let textToSearch = plainBody;
    if (!textToSearch || textToSearch.trim() === '') {
      textToSearch = htmlBody.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    }
    
    Logger.log(`🔍 開始解析 Apple 收據...`);
    Logger.log(`📄 文字內容長度: ${textToSearch.length}`);
    
    // 針對實際格式的金額提取
    const amountExtractionMethods = [
      // 方法1: 專門匹配 "NT$ 數字" 格式
      () => {
        const ntMatch = textToSearch.match(/NT\$\s*([0-9,]+(?:\.[0-9]{1,2})?)/g);
        if (ntMatch && ntMatch.length > 0) {
          Logger.log(`💰 找到 NT$ 格式: ${JSON.stringify(ntMatch)}`);
          // 取最後一個匹配（通常是總計）
          const lastMatch = ntMatch[ntMatch.length - 1];
          const amount = parseFloat(lastMatch.replace('NT$', '').replace(/,/g, '').trim());
          if (amount > 0) {
            return { amount: amount, currency: 'TWD' };
          }
        }
        return null;
      },
      
      // 方法2: 匹配 "總計 NT$ 數字" 格式
      () => {
        const totalMatch = textToSearch.match(/總計\s*NT\$\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
        if (totalMatch) {
          const amount = parseFloat(totalMatch[1].replace(/,/g, ''));
          Logger.log(`💰 找到總計格式: ${amount}`);
          return { amount: amount, currency: 'TWD' };
        }
        return null;
      },
      
      // 方法3: 匹配 "更新 NT$ 數字" 格式（訂閱費用）
      () => {
        const updateMatch = textToSearch.match(/更新\s*NT\$\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
        if (updateMatch) {
          const amount = parseFloat(updateMatch[1].replace(/,/g, ''));
          Logger.log(`💰 找到更新費用格式: ${amount}`);
          return { amount: amount, currency: 'TWD' };
        }
        return null;
      },
      
      // 方法4: 尋找所有 NT$ 後的數字
      () => {
        const allNTMatches = textToSearch.match(/NT\$\s*([0-9,]+(?:\.[0-9]{1,2})?)/g);
        if (allNTMatches && allNTMatches.length > 0) {
          Logger.log(`💰 找到所有 NT$ 匹配: ${JSON.stringify(allNTMatches)}`);
          const amounts = allNTMatches.map(match => {
            const cleanAmount = match.replace('NT$', '').replace(/,/g, '').trim();
            return parseFloat(cleanAmount);
          }).filter(amount => !isNaN(amount) && amount > 0);
          
          if (amounts.length > 0) {
            // 如果有多個金額，取最常出現的或最大的
            const maxAmount = Math.max(...amounts);
            Logger.log(`💰 選擇最大金額: ${maxAmount}`);
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
        Logger.log(`✅ 方法 ${i + 1} 成功提取金額: ${result.amount} ${result.currency}`);
        break;
      }
    }
    
    // 提取商品/服務名稱
    const itemExtractionMethods = [
      // 方法1: 尋找 iCloud+ 相關
      () => {
        if (textToSearch.includes('iCloud+')) {
          const icloudMatch = textToSearch.match(/iCloud\+[^0-9]*([^NT$]*)/i);
          if (icloudMatch) {
            return `iCloud+ 訂閱`;
          }
          return 'iCloud+ 服務';
        }
        return null;
      },
      
      // 方法2: 尋找應用程式名稱
      () => {
        const appMatch = textToSearch.match(/([A-Za-z0-9\s]+)\s*每月/i);
        if (appMatch && appMatch[1]) {
          return appMatch[1].trim();
        }
        return null;
      },
      
      // 方法3: 從發票項目中提取
      () => {
        const itemMatch = textToSearch.match(/發票號碼[^0-9]*[0-9]+\s*([^每月NT$]*)/i);
        if (itemMatch && itemMatch[1]) {
          const item = itemMatch[1].trim();
          if (item.length > 0 && item.length < 50) {
            return item;
          }
        }
        return null;
      }
    ];
    
    for (let method of itemExtractionMethods) {
      const itemName = method();
      if (itemName) {
        result.description = `Apple - ${itemName}`;
        Logger.log(`📱 提取到商品名稱: ${itemName}`);
        break;
      }
    }
    
    // 如果沒有找到具體商品名稱，使用預設描述
    if (result.description === subject) {
      result.description = 'Apple - 數位服務';
    }
    
    Logger.log(`🎯 最終解析結果: ${result.amount} ${result.currency} - ${result.description}`);
    
    return result;
    
  } catch (error) {
    Logger.log(`❌ Apple 收據解析失敗: ${error.toString()}`);
    return null;
  }
}

/**
 * 測試修正版解析
 */
function testAppleReceiptFixed() {
  Logger.log('=== 測試修正版 Apple 收據解析 ===');
  
  try {
    const threads = GmailApp.search('from:Apple subject:收據', 0, 1);
    
    if (threads.length === 0) {
      Logger.log('❌ 找不到 Apple 收據郵件');
      return;
    }
    
    const message = threads[0].getMessages()[0];
    Logger.log(`📨 測試郵件: ${message.getSubject()}`);
    
    const result = parseAppleReceiptFixed(message);
    
    if (result) {
      Logger.log('✅ 修正版解析成功:');
      Logger.log(`  - 日期: ${result.date}`);
      Logger.log(`  - 金額: ${result.amount}`);
      Logger.log(`  - 幣別: ${result.currency}`);
      Logger.log(`  - 類別: ${result.category}`);
      Logger.log(`  - 描述: ${result.description}`);
      Logger.log(`  - 商家: ${result.merchant}`);
      Logger.log(`  - 來源: ${result.source}`);
      
      // 測試儲存（不實際儲存，只是測試格式）
      Logger.log('\n📋 儲存格式預覽:');
      Logger.log(`${result.date} | ${result.amount} | ${result.currency} | 1 | ${result.amount} | ${result.category} | ${result.description}`);
      
    } else {
      Logger.log('❌ 修正版解析失敗');
    }
    
  } catch (error) {
    Logger.log(`❌ 測試失敗: ${error.toString()}`);
  }
}

/**
 * 修復現有的 Apple 收據記錄（使用修正版解析）
 */
function fixAppleRecordsWithCorrectParsing() {
  Logger.log('=== 使用修正版解析修復 Apple 記錄 ===');
  
  try {
    const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    
    if (!mainLedgerId) {
      Logger.log('❌ 主帳本 ID 未設定');
      return;
    }
    
    const ss = SpreadsheetApp.openById(mainLedgerId);
    const sheet = ss.getSheetByName('All Records');
    
    if (!sheet) {
      Logger.log('❌ 找不到 All Records 工作表');
      return;
    }
    
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
            // 嘗試重新獲取郵件
            const threads = GmailApp.search('from:Apple subject:收據', 0, 5);
            let foundMessage = null;
            
            for (let thread of threads) {
              const messages = thread.getMessages();
              for (let message of messages) {
                if (message.getId() === messageId) {
                  foundMessage = message;
                  break;
                }
              }
              if (foundMessage) break;
            }
            
            if (foundMessage) {
              const newResult = parseAppleReceiptFixed(foundMessage);
              
              if (newResult && newResult.amount > 0) {
                // 更新記錄
                sheet.getRange(i + 1, 2).setValue(newResult.amount); // B欄：AMOUNT
                sheet.getRange(i + 1, 3).setValue(newResult.currency); // C欄：CURRENCY
                sheet.getRange(i + 1, 4).setValue(1); // D欄：EXCHANGE RATE (TWD = 1)
                sheet.getRange(i + 1, 6).setValue(newResult.category); // F欄：CATEGORY
                sheet.getRange(i + 1, 7).setValue(newResult.description); // G欄：ITEM
                sheet.getRange(i + 1, 17).setValue(newResult.source); // Q欄：SOURCE
                
                // 更新 META_DATA
                meta.merchant = newResult.merchant;
                meta.fixedAt = new Date().toISOString();
                sheet.getRange(i + 1, 21).setValue(JSON.stringify(meta)); // U欄：META_DATA
                
                fixedCount++;
                Logger.log(`✅ 修復成功: 金額=${newResult.amount}, 描述=${newResult.description}`);
              } else {
                Logger.log(`⚠️ 重新解析仍然失敗`);
              }
            } else {
              Logger.log(`⚠️ 找不到對應的郵件: ${messageId}`);
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
 * 更新觸發器使用修正版解析
 */
function updateTriggerWithFixedParsing() {
  Logger.log('=== 更新觸發器使用修正版解析 ===');
  
  try {
    // 刪除現有觸發器
    const existingTriggers = ScriptApp.getProjectTriggers();
    existingTriggers.forEach(trigger => {
      ScriptApp.deleteTrigger(trigger);
      Logger.log(`🗑️ 刪除觸發器: ${trigger.getHandlerFunction()}`);
    });
    
    // 建立新的修正版觸發器
    ScriptApp.newTrigger('processEmailsWithFixedAppleParsing')
      .timeBased()
      .everyMinutes(15)
      .create();
    
    Logger.log('✅ 建立修正版觸發器');
    
    // 測試新觸發器
    processEmailsWithFixedAppleParsing();
    
  } catch (error) {
    Logger.log(`❌ 更新觸發器失敗: ${error.toString()}`);
  }
}

/**
 * 使用修正版解析的郵件處理函數
 */
function processEmailsWithFixedAppleParsing() {
  Logger.log('🔄 開始處理郵件（修正版 Apple 解析）...');
  
  try {
    const searchQueries = [
      'subject:電子發票 is:unread',
      'subject:發票 is:unread',
      'subject:收據 is:unread',
      'from:Apple subject:收據 is:unread'
    ];
    
    let totalProcessed = 0;
    
    searchQueries.forEach(query => {
      Logger.log(`\n🔍 搜尋: ${query}`);
      
      const threads = GmailApp.search(query, 0, 3);
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
                result = parseAppleReceiptFixed(message);
              } else {
                // 一般郵件處理
                result = {
                  date: Utilities.formatDate(message.getDate(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
                  amount: 0,
                  currency: 'TWD',
                  category: '其他',
                  description: message.getSubject(),
                  merchant: '',
                  source: 'Email Fixed General'
                };
                
                // 簡單金額提取
                const amountMatch = message.getSubject().match(/(\d+(?:,\d{3})*(?:\.\d{2})?)/);
                if (amountMatch) {
                  result.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
                }
              }
              
              if (result && result.amount > 0) {
                saveEmailRecordFixed(result, message);
                message.markRead();
                totalProcessed++;
                Logger.log('✅ 郵件處理完成');
              } else {
                Logger.log('⚠️ 郵件解析失敗或金額為 0，跳過');
              }
              
            } catch (emailError) {
              Logger.log(`❌ 處理郵件失敗: ${emailError.toString()}`);
            }
          }
        });
      });
    });
    
    Logger.log(`\n✅ 修正版處理完成，共處理 ${totalProcessed} 封郵件`);
    
  } catch (error) {
    Logger.log(`❌ 修正版處理失敗: ${error.toString()}`);
  }
}

/**
 * 修正版記錄儲存
 */
function saveEmailRecordFixed(data, message) {
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
        merchant: data.merchant || '',
        parsedAt: new Date().toISOString()
      })
    ];
    
    sheet.appendRow(newRow);
    Logger.log(`💾 修正版記錄已儲存: ${data.amount} ${data.currency} - ${data.description}`);
    
  } catch (error) {
    Logger.log(`❌ 修正版儲存失敗: ${error.toString()}`);
    throw error;
  }
}

/**
 * 完整的修正版修復流程
 */
function runCompleteAppleFixedSolution() {
  Logger.log('=== 執行完整修正版 Apple 修復 ===');
  
  try {
    // 1. 測試修正版解析
    testAppleReceiptFixed();
    
    // 2. 修復現有記錄
    fixAppleRecordsWithCorrectParsing();
    
    // 3. 更新觸發器
    updateTriggerWithFixedParsing();
    
    Logger.log('=== 修正版 Apple 修復完成 ===');
    Logger.log('✅ 建議檢查：');
    Logger.log('  1. Google Sheets 中的 Apple 記錄金額是否已修正為 90');
    Logger.log('  2. 描述是否已更新為 "Apple - iCloud+ 訂閱"');
    Logger.log('  3. 來源是否顯示為 "Email Apple Fixed"');
    
  } catch (error) {
    Logger.log(`❌ 修正版修復失敗: ${error.toString()}`);
  }
}