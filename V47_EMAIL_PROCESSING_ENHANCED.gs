// =================================================================================================
// V47.1 增強版電子發票處理 - 修正欄位和金額問題
// 最後更新：2025-07-27
// =================================================================================================

/**
 * 增強版郵件處理函數 - 修正所有已知問題
 */
function processAutomatedEmailsEnhanced() {
  Logger.log('🔄 開始處理自動郵件（增強版）...');
  
  try {
    // 更精確的搜尋條件
    const searchQueries = [
      'subject:電子發票 is:unread',
      'subject:發票 is:unread', 
      'subject:收據 is:unread',
      'subject:invoice is:unread',
      'subject:receipt is:unread',
      'from:Apple subject:收據 is:unread',
      'from:no_reply@email.apple.com is:unread',
      'subject:統一發票 is:unread',
      'subject:購買收據 is:unread'
    ];
    
    let totalProcessed = 0;
    let processedMessageIds = new Set(); // 避免重複處理
    
    searchQueries.forEach((query, index) => {
      Logger.log(`\n🔍 搜尋 ${index + 1}/${searchQueries.length}: ${query}`);
      
      try {
        const threads = GmailApp.search(query, 0, 5);
        Logger.log(`找到 ${threads.length} 個郵件串`);
        
        threads.forEach(thread => {
          const messages = thread.getMessages();
          
          messages.forEach(message => {
            const messageId = message.getId();
            
            // 避免重複處理同一封郵件
            if (processedMessageIds.has(messageId)) {
              Logger.log(`⏭️ 跳過已處理的郵件: ${messageId}`);
              return;
            }
            
            if (message.isUnread()) {
              Logger.log(`📨 處理郵件: ${message.getSubject()}`);
              Logger.log(`📧 寄件者: ${message.getFrom()}`);
              Logger.log(`📅 日期: ${message.getDate()}`);
              
              try {
                const result = processEmailEnhanced(message);
                if (result) {
                  saveEmailRecordEnhanced(result, message);
                  
                  // 確保郵件被標記為已讀
                  Utilities.sleep(1000); // 等待 1 秒確保寫入完成
                  message.markRead();
                  Logger.log('✅ 郵件已標記為已讀');
                  
                  processedMessageIds.add(messageId);
                  totalProcessed++;
                  Logger.log('✅ 郵件處理完成');
                } else {
                  Logger.log('⚠️ 郵件解析失敗，未處理');
                }
              } catch (emailError) {
                Logger.log(`❌ 處理單封郵件失敗: ${emailError.toString()}`);
                Logger.log(`❌ 錯誤堆疊: ${emailError.stack}`);
              }
            } else {
              Logger.log(`📖 郵件已讀，跳過: ${message.getSubject()}`);
            }
          });
        });
        
      } catch (queryError) {
        Logger.log(`❌ 搜尋查詢失敗: ${queryError.toString()}`);
      }
    });
    
    Logger.log(`\n✅ 增強版處理完成，共處理 ${totalProcessed} 封郵件`);
    
    // 發送處理摘要通知
    if (totalProcessed > 0) {
      sendProcessingSummary(totalProcessed);
    }
    
  } catch (error) {
    Logger.log(`❌ 增強版處理失敗: ${error.toString()}`);
    Logger.log(`❌ 錯誤堆疊: ${error.stack}`);
  }
}

/**
 * 增強版郵件內容解析
 */
function processEmailEnhanced(message) {
  try {
    const subject = message.getSubject();
    const body = message.getBody();
    const plainBody = message.getPlainBody();
    const sender = message.getFrom();
    const messageDate = message.getDate();
    
    Logger.log(`🔍 解析郵件內容...`);
    Logger.log(`📧 主旨: ${subject}`);
    Logger.log(`👤 寄件者: ${sender}`);
    
    // 初始化結果
    let result = {
      date: Utilities.formatDate(messageDate, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      amount: 0,
      currency: 'TWD',
      category: '其他',
      description: subject,
      merchant: '',
      source: 'Email Enhanced'
    };
    
    // 根據寄件者和內容進行特殊處理
    if (sender.includes('Apple') || sender.includes('apple.com')) {
      result = processAppleReceipt(subject, body, plainBody, result);
    } else if (subject.includes('電子發票') || subject.includes('統一發票')) {
      result = processEInvoice(subject, body, plainBody, result);
    } else if (subject.includes('收據') || subject.includes('receipt')) {
      result = processGeneralReceipt(subject, body, plainBody, result);
    } else {
      result = processGenericEmail(subject, body, plainBody, result);
    }
    
    // 驗證和清理結果
    result = validateAndCleanResult(result);
    
    Logger.log(`💰 解析結果: 金額=${result.amount}, 幣別=${result.currency}, 類別=${result.category}`);
    Logger.log(`🏪 商家: ${result.merchant}, 描述: ${result.description}`);
    
    return result;
    
  } catch (error) {
    Logger.log(`❌ 解析郵件內容失敗: ${error.toString()}`);
    return null;
  }
}

/**
 * 處理 Apple 收據
 */
function processAppleReceipt(subject, body, plainBody, result) {
  Logger.log('🍎 處理 Apple 收據...');
  
  try {
    result.merchant = 'Apple';
    result.category = '育'; // 軟體/應用程式歸類為教育娛樂
    
    // 從純文字內容中提取金額
    const textToSearch = plainBody || body.replace(/<[^>]*>/g, ' ');
    
    // Apple 收據的金額模式
    const amountPatterns = [
      /總計[：:\s]*([A-Z]{3})\s*\$?([0-9,]+\.?[0-9]*)/i,
      /Total[：:\s]*([A-Z]{3})\s*\$?([0-9,]+\.?[0-9]*)/i,
      /\$([0-9,]+\.?[0-9]*)\s*([A-Z]{3})/i,
      /([A-Z]{3})\s*\$([0-9,]+\.?[0-9]*)/i,
      /NT\$([0-9,]+\.?[0-9]*)/i,
      /TWD\s*([0-9,]+\.?[0-9]*)/i
    ];
    
    for (let pattern of amountPatterns) {
      const match = textToSearch.match(pattern);
      if (match) {
        if (pattern.source.includes('NT\\$') || pattern.source.includes('TWD')) {
          result.amount = parseFloat(match[1].replace(/,/g, ''));
          result.currency = 'TWD';
        } else if (match[2]) {
          result.amount = parseFloat(match[2].replace(/,/g, ''));
          result.currency = match[1] || 'TWD';
        } else {
          result.amount = parseFloat(match[1].replace(/,/g, ''));
          result.currency = match[2] || 'TWD';
        }
        Logger.log(`💰 Apple 收據金額: ${result.amount} ${result.currency}`);
        break;
      }
    }
    
    // 提取商品名稱
    const itemPatterns = [
      /購買項目[：:\s]*([^\n\r]+)/i,
      /Item[：:\s]*([^\n\r]+)/i,
      /應用程式[：:\s]*([^\n\r]+)/i
    ];
    
    for (let pattern of itemPatterns) {
      const match = textToSearch.match(pattern);
      if (match) {
        result.description = `Apple - ${match[1].trim()}`;
        break;
      }
    }
    
    return result;
    
  } catch (error) {
    Logger.log(`❌ 處理 Apple 收據失敗: ${error.toString()}`);
    return result;
  }
}

/**
 * 處理電子發票
 */
function processEInvoice(subject, body, plainBody, result) {
  Logger.log('🧾 處理電子發票...');
  
  try {
    const textToSearch = plainBody || body.replace(/<[^>]*>/g, ' ');
    
    // 電子發票金額模式
    const amountPatterns = [
      /金額[：:\s]*\$?([0-9,]+\.?[0-9]*)/i,
      /總金額[：:\s]*\$?([0-9,]+\.?[0-9]*)/i,
      /應付金額[：:\s]*\$?([0-9,]+\.?[0-9]*)/i,
      /NT\$([0-9,]+\.?[0-9]*)/i,
      /\$([0-9,]+\.?[0-9]*)/
    ];
    
    for (let pattern of amountPatterns) {
      const match = textToSearch.match(pattern);
      if (match) {
        result.amount = parseFloat(match[1].replace(/,/g, ''));
        break;
      }
    }
    
    // 提取商家名稱
    const merchantPatterns = [
      /商家[：:\s]*([^\n\r]+)/i,
      /店家[：:\s]*([^\n\r]+)/i,
      /賣方[：:\s]*([^\n\r]+)/i
    ];
    
    for (let pattern of merchantPatterns) {
      const match = textToSearch.match(pattern);
      if (match) {
        result.merchant = match[1].trim();
        break;
      }
    }
    
    // 根據商家推測類別
    result.category = categorizeByMerchant(result.merchant);
    
    return result;
    
  } catch (error) {
    Logger.log(`❌ 處理電子發票失敗: ${error.toString()}`);
    return result;
  }
}

/**
 * 處理一般收據
 */
function processGeneralReceipt(subject, body, plainBody, result) {
  Logger.log('📄 處理一般收據...');
  
  try {
    const textToSearch = plainBody || body.replace(/<[^>]*>/g, ' ');
    
    // 一般金額模式
    const amountPatterns = [
      /\$([0-9,]+\.?[0-9]*)/,
      /([0-9,]+\.?[0-9]*)\s*元/,
      /金額[：:\s]*([0-9,]+\.?[0-9]*)/i,
      /([0-9,]+\.?[0-9]*)\s*TWD/i
    ];
    
    for (let pattern of amountPatterns) {
      const match = textToSearch.match(pattern);
      if (match) {
        result.amount = parseFloat(match[1].replace(/,/g, ''));
        break;
      }
    }
    
    return result;
    
  } catch (error) {
    Logger.log(`❌ 處理一般收據失敗: ${error.toString()}`);
    return result;
  }
}

/**
 * 處理一般郵件
 */
function processGenericEmail(subject, body, plainBody, result) {
  Logger.log('📧 處理一般郵件...');
  
  try {
    // 從主旨提取金額
    const subjectAmountMatch = subject.match(/(\d+(?:,\d{3})*(?:\.\d{2})?)/);
    if (subjectAmountMatch) {
      result.amount = parseFloat(subjectAmountMatch[1].replace(/,/g, ''));
    }
    
    return result;
    
  } catch (error) {
    Logger.log(`❌ 處理一般郵件失敗: ${error.toString()}`);
    return result;
  }
}

/**
 * 根據商家名稱推測類別
 */
function categorizeByMerchant(merchant) {
  if (!merchant) return '其他';
  
  const merchantLower = merchant.toLowerCase();
  
  if (merchantLower.includes('apple') || merchantLower.includes('app store')) return '育';
  if (merchantLower.includes('restaurant') || merchantLower.includes('餐廳') || merchantLower.includes('食')) return '食';
  if (merchantLower.includes('uber') || merchantLower.includes('taxi') || merchantLower.includes('transport')) return '行';
  if (merchantLower.includes('hotel') || merchantLower.includes('住宿')) return '住';
  if (merchantLower.includes('clothing') || merchantLower.includes('服飾')) return '衣';
  if (merchantLower.includes('hospital') || merchantLower.includes('醫院') || merchantLower.includes('藥局')) return '醫療';
  
  return '其他';
}

/**
 * 驗證和清理結果
 */
function validateAndCleanResult(result) {
  // 確保金額是有效數字
  if (isNaN(result.amount) || result.amount < 0) {
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
    result.description = '郵件記錄';
  }
  
  return result;
}

/**
 * 增強版記錄儲存 - 修正欄位對應
 */
function saveEmailRecordEnhanced(data, message) {
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
    const exchangeRate = getExchangeRateEnhanced(data.currency);
    
    // 正確的欄位對應
    const newRow = [
      data.date,                    // A: TIMESTAMP
      data.amount,                  // B: AMOUNT
      data.currency,                // C: CURRENCY
      exchangeRate,                 // D: EXCHANGE RATE
      '',                          // E: Amount (TWD) - 由公式計算 =B*D
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
    Logger.log('💾 記錄已儲存到 Google Sheets');
    Logger.log(`💾 儲存內容: ${data.date} | ${data.amount} ${data.currency} | ${data.category} | ${data.description}`);
    
  } catch (error) {
    Logger.log(`❌ 儲存記錄失敗: ${error.toString()}`);
    throw error;
  }
}

/**
 * 增強版匯率獲取
 */
function getExchangeRateEnhanced(currency) {
  if (currency === 'TWD') return 1;
  
  try {
    // 嘗試從 Google Finance 獲取即時匯率
    const response = UrlFetchApp.fetch(`https://api.exchangerate-api.com/v4/latest/${currency}`);
    const data = JSON.parse(response.getContentText());
    
    if (data.rates && data.rates.TWD) {
      Logger.log(`💱 獲取 ${currency} 即時匯率: ${data.rates.TWD}`);
      return data.rates.TWD;
    }
  } catch (error) {
    Logger.log(`⚠️ 無法獲取 ${currency} 即時匯率: ${error.toString()}`);
  }
  
  // 使用預設匯率
  const defaultRates = {
    'USD': 31.5,
    'JPY': 0.21,
    'EUR': 34.2,
    'CNY': 4.3
  };
  
  const rate = defaultRates[currency] || 1;
  Logger.log(`💱 使用 ${currency} 預設匯率: ${rate}`);
  return rate;
}

/**
 * 發送處理摘要
 */
function sendProcessingSummary(processedCount) {
  try {
    const message = `📧 電子發票處理摘要\n\n` +
                   `✅ 成功處理: ${processedCount} 封郵件\n` +
                   `📅 處理時間: ${new Date().toLocaleString('zh-TW')}\n` +
                   `🔄 下次處理: 15 分鐘後`;
    
    Logger.log(message);
    
    // 可以在這裡加入 Email 通知或其他通知方式
    
  } catch (error) {
    Logger.log(`❌ 發送摘要失敗: ${error.toString()}`);
  }
}

/**
 * 手動測試增強版郵件處理
 */
function manualTestEnhancedEmailProcessing() {
  Logger.log('=== 手動測試增強版郵件處理 ===');
  
  try {
    // 搜尋特定的測試郵件
    const testQueries = [
      'from:Apple subject:收據',
      'subject:電子發票',
      'subject:發票'
    ];
    
    testQueries.forEach(query => {
      Logger.log(`\n🔍 測試搜尋: ${query}`);
      
      const threads = GmailApp.search(query, 0, 2);
      Logger.log(`找到 ${threads.length} 個郵件串`);
      
      threads.forEach(thread => {
        const messages = thread.getMessages();
        
        messages.slice(0, 1).forEach(message => { // 只測試第一封
          Logger.log(`📨 測試郵件: ${message.getSubject()}`);
          
          try {
            const result = processEmailEnhanced(message);
            if (result) {
              Logger.log(`✅ 解析成功:`);
              Logger.log(`  - 日期: ${result.date}`);
              Logger.log(`  - 金額: ${result.amount}`);
              Logger.log(`  - 幣別: ${result.currency}`);
              Logger.log(`  - 類別: ${result.category}`);
              Logger.log(`  - 描述: ${result.description}`);
              Logger.log(`  - 商家: ${result.merchant}`);
            } else {
              Logger.log('❌ 解析失敗');
            }
          } catch (testError) {
            Logger.log(`❌ 測試失敗: ${testError.toString()}`);
          }
        });
      });
    });
    
    Logger.log('=== 手動測試完成 ===');
    
  } catch (error) {
    Logger.log(`❌ 手動測試失敗: ${error.toString()}`);
  }
}

/**
 * 批次標記郵件為已讀（修復遺留問題）
 */
function markProcessedEmailsAsRead() {
  Logger.log('=== 批次標記已處理郵件為已讀 ===');
  
  try {
    const searchQueries = [
      'subject:電子發票 is:unread',
      'subject:發票 is:unread',
      'subject:收據 is:unread',
      'from:Apple subject:收據 is:unread'
    ];
    
    let totalMarked = 0;
    
    searchQueries.forEach(query => {
      Logger.log(`\n🔍 搜尋: ${query}`);
      
      const threads = GmailApp.search(query, 0, 10);
      Logger.log(`找到 ${threads.length} 個未讀郵件串`);
      
      threads.forEach(thread => {
        const messages = thread.getMessages();
        
        messages.forEach(message => {
          if (message.isUnread()) {
            // 檢查是否已經在 Sheets 中有記錄
            const messageId = message.getId();
            if (isMessageAlreadyProcessed(messageId)) {
              message.markRead();
              totalMarked++;
              Logger.log(`✅ 標記為已讀: ${message.getSubject()}`);
            }
          }
        });
      });
    });
    
    Logger.log(`\n✅ 共標記 ${totalMarked} 封郵件為已讀`);
    
  } catch (error) {
    Logger.log(`❌ 批次標記失敗: ${error.toString()}`);
  }
}

/**
 * 檢查郵件是否已經被處理過
 */
function isMessageAlreadyProcessed(messageId) {
  try {
    const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    const ss = SpreadsheetApp.openById(mainLedgerId);
    const sheet = ss.getSheetByName('All Records');
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    // 檢查 META_DATA 欄位（U欄）是否包含此 messageId
    for (let i = 1; i < values.length; i++) {
      const metaData = values[i][20]; // U欄是第21欄（索引20）
      if (metaData && metaData.includes(messageId)) {
        return true;
      }
    }
    
    return false;
    
  } catch (error) {
    Logger.log(`❌ 檢查郵件處理狀態失敗: ${error.toString()}`);
    return false;
  }
}