// =================================================================================================
// 完整電子收據解決方案 - 支援多種收據類型
// 最後更新：2025-07-27
// =================================================================================================

/**
 * 完整的電子收據處理函數 - 支援多種收據類型
 */
function processAllEmailReceiptsComplete() {
  Logger.log('🔄 開始處理所有電子收據（完整版）...');
  
  try {
    // 擴展的搜尋條件，涵蓋更多收據類型
    const searchQueries = [
      // 一般發票和收據
      'subject:電子發票 is:unread',
      'subject:發票 is:unread',
      'subject:收據 is:unread',
      'subject:統一發票 is:unread',
      'subject:購買收據 is:unread',
      'subject:invoice is:unread',
      'subject:receipt is:unread',
      
      // Apple 相關
      'from:Apple subject:收據 is:unread',
      'from:no_reply@email.apple.com is:unread',
      
      // 電信公司
      'from:中華電信 is:unread',
      'subject:中華電信 is:unread',
      'subject:電信費 is:unread',
      'subject:話費 is:unread',
      
      // OpenAI 和其他訂閱服務
      'from:OpenAI is:unread',
      'subject:OpenAI is:unread',
      'subject:subscription is:unread',
      'subject:訂閱 is:unread',
      
      // 公用事業
      'subject:水費 is:unread',
      'subject:電費 is:unread',
      'subject:瓦斯費 is:unread',
      'subject:自來水 is:unread',
      'subject:台電 is:unread',
      'subject:utility is:unread',
      
      // 其他常見收據
      'subject:帳單 is:unread',
      'subject:繳費 is:unread',
      'subject:付款 is:unread',
      'subject:payment is:unread',
      'subject:bill is:unread'
    ];
    
    let totalProcessed = 0;
    let processedMessageIds = new Set();
    
    searchQueries.forEach((query, index) => {
      Logger.log(`\n🔍 搜尋 ${index + 1}/${searchQueries.length}: ${query}`);
      
      try {
        const threads = GmailApp.search(query, 0, 3);
        Logger.log(`找到 ${threads.length} 個郵件串`);
        
        threads.forEach(thread => {
          const messages = thread.getMessages();
          
          messages.forEach(message => {
            const messageId = message.getId();
            
            // 避免重複處理
            if (processedMessageIds.has(messageId)) {
              Logger.log(`⏭️ 跳過已處理的郵件: ${messageId}`);
              return;
            }
            
            if (message.isUnread()) {
              Logger.log(`📨 處理郵件: ${message.getSubject()}`);
              Logger.log(`📧 寄件者: ${message.getFrom()}`);
              
              try {
                const result = parseEmailReceiptComplete(message);
                if (result && result.amount > 0) {
                  saveEmailRecordComplete(result, message);
                  
                  // 確保郵件被標記為已讀
                  Utilities.sleep(500);
                  message.markRead();
                  Logger.log('✅ 郵件已標記為已讀');
                  
                  processedMessageIds.add(messageId);
                  totalProcessed++;
                  Logger.log('✅ 郵件處理完成');
                } else {
                  Logger.log('⚠️ 郵件解析失敗或金額為 0，跳過');
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
    
    Logger.log(`\n✅ 完整版處理完成，共處理 ${totalProcessed} 封郵件`);
    
  } catch (error) {
    Logger.log(`❌ 完整版處理失敗: ${error.toString()}`);
  }
}

/**
 * 完整的電子收據解析函數
 */
function parseEmailReceiptComplete(message) {
  try {
    const subject = message.getSubject();
    const htmlBody = message.getBody();
    const plainBody = message.getPlainBody();
    const sender = message.getFrom();
    const messageDate = message.getDate();
    
    Logger.log(`🔍 解析郵件: ${subject}`);
    Logger.log(`👤 寄件者: ${sender}`);
    
    let result = {
      date: Utilities.formatDate(messageDate, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      amount: 0,
      currency: 'TWD',
      category: '其他',
      description: subject,
      merchant: '',
      source: 'Email : 電子收據'  // 統一來源名稱
    };
    
    // 使用純文字內容進行解析
    let textToSearch = plainBody;
    if (!textToSearch || textToSearch.trim() === '') {
      textToSearch = htmlBody.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    }
    
    // 根據寄件者和內容進行分類處理
    if (sender.includes('Apple') || sender.includes('apple.com')) {
      result = parseAppleReceipt(textToSearch, result);
    } else if (sender.includes('中華電信') || subject.includes('中華電信') || subject.includes('電信費') || subject.includes('話費')) {
      result = parseChunghwaTelecomReceipt(textToSearch, result);
    } else if (sender.includes('OpenAI') || subject.includes('OpenAI')) {
      result = parseOpenAIReceipt(textToSearch, result);
    } else if (subject.includes('水費') || subject.includes('自來水')) {
      result = parseWaterBillReceipt(textToSearch, result);
    } else if (subject.includes('電費') || subject.includes('台電')) {
      result = parseElectricBillReceipt(textToSearch, result);
    } else if (subject.includes('電子發票') || subject.includes('統一發票')) {
      result = parseEInvoiceReceipt(textToSearch, result);
    } else {
      result = parseGeneralReceipt(textToSearch, result);
    }
    
    // 驗證和清理結果
    result = validateReceiptResult(result);
    
    Logger.log(`💰 解析結果: ${result.amount} ${result.currency} - ${result.description} (${result.category})`);
    
    return result;
    
  } catch (error) {
    Logger.log(`❌ 解析郵件失敗: ${error.toString()}`);
    return null;
  }
}

/**
 * Apple 收據解析
 */
function parseAppleReceipt(textToSearch, result) {
  Logger.log('🍎 解析 Apple 收據...');
  
  result.merchant = 'Apple';
  result.category = '育';
  
  // Apple 金額提取
  const amountPatterns = [
    /NT\$\s*([0-9,]+(?:\.[0-9]{1,2})?)/g,
    /總計\s*NT\$\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    /更新\s*NT\$\s*([0-9,]+(?:\.[0-9]{1,2})?)/i
  ];
  
  for (let pattern of amountPatterns) {
    const matches = textToSearch.match(pattern);
    if (matches && matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      const amount = parseFloat(lastMatch.replace('NT$', '').replace(/,/g, '').trim());
      if (amount > 0) {
        result.amount = amount;
        break;
      }
    }
  }
  
  // Apple 商品名稱提取
  if (textToSearch.includes('iCloud+')) {
    result.description = 'Apple - iCloud+ 訂閱';
  } else {
    result.description = 'Apple - 數位服務';
  }
  
  return result;
}

/**
 * 中華電信收據解析
 */
function parseChunghwaTelecomReceipt(textToSearch, result) {
  Logger.log('📱 解析中華電信收據...');
  
  result.merchant = '中華電信';
  result.category = '行';
  result.description = '中華電信 - 電信費用';
  
  // 中華電信金額提取
  const amountPatterns = [
    /應繳金額[：:\s]*([0-9,]+)/i,
    /本期帳單[：:\s]*([0-9,]+)/i,
    /總金額[：:\s]*([0-9,]+)/i,
    /NT\$\s*([0-9,]+)/i,
    /([0-9,]+)\s*元/g
  ];
  
  for (let pattern of amountPatterns) {
    const match = textToSearch.match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (amount > 0) {
        result.amount = amount;
        break;
      }
    }
  }
  
  return result;
}

/**
 * OpenAI 收據解析
 */
function parseOpenAIReceipt(textToSearch, result) {
  Logger.log('🤖 解析 OpenAI 收據...');
  
  result.merchant = 'OpenAI';
  result.category = '育';
  result.description = 'OpenAI - API 使用費';
  
  // OpenAI 金額提取
  const amountPatterns = [
    /\$([0-9,]+\.?[0-9]*)/g,
    /Total[：:\s]*\$([0-9,]+\.?[0-9]*)/i,
    /Amount[：:\s]*\$([0-9,]+\.?[0-9]*)/i
  ];
  
  for (let pattern of amountPatterns) {
    const matches = textToSearch.match(pattern);
    if (matches && matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      const amount = parseFloat(lastMatch.replace('$', '').replace(/,/g, ''));
      if (amount > 0) {
        result.amount = amount;
        result.currency = 'USD';
        break;
      }
    }
  }
  
  return result;
}

/**
 * 水費收據解析
 */
function parseWaterBillReceipt(textToSearch, result) {
  Logger.log('💧 解析水費收據...');
  
  result.merchant = '自來水公司';
  result.category = '住';
  result.description = '自來水費';
  
  // 水費金額提取
  const amountPatterns = [
    /應繳金額[：:\s]*([0-9,]+)/i,
    /本期費用[：:\s]*([0-9,]+)/i,
    /水費[：:\s]*([0-9,]+)/i,
    /([0-9,]+)\s*元/g
  ];
  
  for (let pattern of amountPatterns) {
    const match = textToSearch.match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (amount > 0) {
        result.amount = amount;
        break;
      }
    }
  }
  
  return result;
}

/**
 * 電費收據解析
 */
function parseElectricBillReceipt(textToSearch, result) {
  Logger.log('⚡ 解析電費收據...');
  
  result.merchant = '台灣電力公司';
  result.category = '住';
  result.description = '電費';
  
  // 電費金額提取
  const amountPatterns = [
    /應繳金額[：:\s]*([0-9,]+)/i,
    /本期電費[：:\s]*([0-9,]+)/i,
    /電費[：:\s]*([0-9,]+)/i,
    /([0-9,]+)\s*元/g
  ];
  
  for (let pattern of amountPatterns) {
    const match = textToSearch.match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (amount > 0) {
        result.amount = amount;
        break;
      }
    }
  }
  
  return result;
}

/**
 * 電子發票解析
 */
function parseEInvoiceReceipt(textToSearch, result) {
  Logger.log('🧾 解析電子發票...');
  
  result.category = '其他';
  
  // 電子發票金額提取
  const amountPatterns = [
    /金額[：:\s]*([0-9,]+)/i,
    /總金額[：:\s]*([0-9,]+)/i,
    /應付金額[：:\s]*([0-9,]+)/i,
    /NT\$\s*([0-9,]+)/i,
    /([0-9,]+)\s*元/g
  ];
  
  for (let pattern of amountPatterns) {
    const match = textToSearch.match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (amount > 0) {
        result.amount = amount;
        break;
      }
    }
  }
  
  // 商家名稱提取
  const merchantPatterns = [
    /商家[：:\s]*([^\n\r]+)/i,
    /店家[：:\s]*([^\n\r]+)/i,
    /賣方[：:\s]*([^\n\r]+)/i
  ];
  
  for (let pattern of merchantPatterns) {
    const match = textToSearch.match(pattern);
    if (match) {
      result.merchant = match[1].trim();
      result.description = `${result.merchant} - 電子發票`;
      break;
    }
  }
  
  return result;
}

/**
 * 一般收據解析
 */
function parseGeneralReceipt(textToSearch, result) {
  Logger.log('📄 解析一般收據...');
  
  // 一般金額提取
  const amountPatterns = [
    /\$([0-9,]+\.?[0-9]*)/g,
    /([0-9,]+\.?[0-9]*)\s*元/g,
    /金額[：:\s]*([0-9,]+)/i,
    /總計[：:\s]*([0-9,]+)/i,
    /Total[：:\s]*([0-9,]+)/i
  ];
  
  for (let pattern of amountPatterns) {
    const matches = textToSearch.match(pattern);
    if (matches && matches.length > 0) {
      const amounts = matches.map(match => {
        const cleanAmount = match.replace(/[\$元]/g, '').replace(/,/g, '').trim();
        return parseFloat(cleanAmount);
      }).filter(amount => !isNaN(amount) && amount > 0);
      
      if (amounts.length > 0) {
        result.amount = Math.max(...amounts);
        break;
      }
    }
  }
  
  return result;
}

/**
 * 驗證和清理結果
 */
function validateReceiptResult(result) {
  // 確保金額有效
  if (isNaN(result.amount) || result.amount <= 0) {
    result.amount = 0;
  }
  
  // 確保幣別有效
  const validCurrencies = ['TWD', 'USD', 'JPY', 'EUR', 'CNY'];
  if (!validCurrencies.includes(result.currency)) {
    result.currency = 'TWD';
  }
  
  // 確保類別有效
  const validCategories = ['食', '衣', '住', '行', '育', '樂', '醫療', '保險', '其他'];
  if (!validCategories.includes(result.category)) {
    result.category = '其他';
  }
  
  // 清理描述
  if (!result.description || result.description.trim() === '') {
    result.description = '電子收據';
  }
  
  return result;
}

/**
 * 完整版記錄儲存 - 修正 P 和 Q 欄位
 */
function saveEmailRecordComplete(data, message) {
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
    
    // 計算匯率
    const exchangeRate = getExchangeRateForCurrency(data.currency);
    
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
      '未確認',                    // P: STATUS - 修正為中文預設值
      data.source,                 // Q: SOURCE - 統一為 "Email : 電子收據"
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
    Logger.log(`💾 完整版記錄已儲存: ${data.amount} ${data.currency} - ${data.description}`);
    
  } catch (error) {
    Logger.log(`❌ 完整版儲存失敗: ${error.toString()}`);
    throw error;
  }
}

/**
 * 獲取匯率
 */
function getExchangeRateForCurrency(currency) {
  if (currency === 'TWD') return 1;
  
  // 預設匯率
  const defaultRates = {
    'USD': 31.5,
    'JPY': 0.21,
    'EUR': 34.2,
    'CNY': 4.3
  };
  
  return defaultRates[currency] || 1;
}

/**
 * 更新觸發器使用完整版處理
 */
function updateTriggerToCompleteVersion() {
  Logger.log('=== 更新觸發器為完整版 ===');
  
  try {
    // 刪除現有觸發器
    const existingTriggers = ScriptApp.getProjectTriggers();
    existingTriggers.forEach(trigger => {
      ScriptApp.deleteTrigger(trigger);
      Logger.log(`🗑️ 刪除觸發器: ${trigger.getHandlerFunction()}`);
    });
    
    // 建立完整版觸發器
    ScriptApp.newTrigger('processAllEmailReceiptsComplete')
      .timeBased()
      .everyMinutes(15)
      .create();
    
    Logger.log('✅ 建立完整版觸發器');
    
    // 測試新觸發器
    processAllEmailReceiptsComplete();
    
  } catch (error) {
    Logger.log(`❌ 更新觸發器失敗: ${error.toString()}`);
  }
}

/**
 * 修復現有記錄的 P 和 Q 欄位
 */
function fixExistingRecordColumns() {
  Logger.log('=== 修復現有記錄的 P 和 Q 欄位 ===');
  
  try {
    const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    const ss = SpreadsheetApp.openById(mainLedgerId);
    const sheet = ss.getSheetByName('All Records');
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    let fixedCount = 0;
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const status = row[15]; // P欄：STATUS
      const source = row[16]; // Q欄：SOURCE
      
      let needsUpdate = false;
      
      // 修正 P 欄位：將 "Active" 改為 "未確認"
      if (status === 'Active') {
        sheet.getRange(i + 1, 16).setValue('未確認'); // P欄
        needsUpdate = true;
      }
      
      // 修正 Q 欄位：統一來源名稱
      if (source && source.includes('Email') && source !== 'Email : 電子收據') {
        sheet.getRange(i + 1, 17).setValue('Email : 電子收據'); // Q欄
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        fixedCount++;
        Logger.log(`✅ 修復第 ${i + 1} 行記錄`);
      }
    }
    
    Logger.log(`✅ 共修復 ${fixedCount} 筆記錄的欄位`);
    
  } catch (error) {
    Logger.log(`❌ 修復欄位失敗: ${error.toString()}`);
  }
}

/**
 * 檢查未處理的收據郵件
 */
function checkUnprocessedReceipts() {
  Logger.log('=== 檢查未處理的收據郵件 ===');
  
  try {
    const searchQueries = [
      'subject:中華電信 is:unread',
      'subject:OpenAI is:unread',
      'subject:水費 is:unread',
      'subject:電費 is:unread',
      'subject:自來水 is:unread'
    ];
    
    searchQueries.forEach(query => {
      Logger.log(`\n🔍 檢查: ${query}`);
      
      const threads = GmailApp.search(query, 0, 5);
      Logger.log(`找到 ${threads.length} 個未讀郵件串`);
      
      threads.forEach(thread => {
        const messages = thread.getMessages();
        messages.forEach(message => {
          if (message.isUnread()) {
            Logger.log(`📨 未處理郵件: ${message.getSubject()}`);
            Logger.log(`📧 寄件者: ${message.getFrom()}`);
            Logger.log(`📅 日期: ${message.getDate()}`);
          }
        });
      });
    });
    
  } catch (error) {
    Logger.log(`❌ 檢查未處理郵件失敗: ${error.toString()}`);
  }
}

/**
 * 完整解決方案執行
 */
function runCompleteEmailReceiptSolution() {
  Logger.log('=== 執行完整電子收據解決方案 ===');
  
  try {
    // 1. 檢查未處理的郵件
    checkUnprocessedReceipts();
    
    // 2. 修復現有記錄的欄位
    fixExistingRecordColumns();
    
    // 3. 更新觸發器
    updateTriggerToCompleteVersion();
    
    Logger.log('=== 完整解決方案執行完成 ===');
    Logger.log('✅ 檢查項目：');
    Logger.log('  1. P 欄位已修正為 "未確認"');
    Logger.log('  2. Q 欄位已統一為 "Email : 電子收據"');
    Logger.log('  3. 觸發器已更新支援多種收據類型');
    Logger.log('  4. 系統現在支援：Apple、中華電信、OpenAI、水費、電費等收據');
    
  } catch (error) {
    Logger.log(`❌ 完整解決方案執行失敗: ${error.toString()}`);
  }
}