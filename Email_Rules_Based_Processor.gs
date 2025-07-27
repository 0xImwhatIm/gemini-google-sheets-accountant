// =================================================================================================
// 基於 Email Rules 的電子收據處理器
// 最後更新：2025-07-27
// 根據用戶提供的 Email Rules 進行精確處理
// =================================================================================================

/**
 * 根據 Email Rules 檢查未處理的電子收據
 */
function checkUnprocessedReceiptsByRules() {
  Logger.log('=== 根據 Email Rules 檢查未處理收據 ===');
  
  try {
    // 根據用戶提供的 Email Rules 定義搜尋條件
    const emailRules = [
      {
        query: 'from:einvoice@einvoice.nat.gov.tw subject:彙整 is:unread',
        type: 'CSV',
        description: '財政部電子發票彙整'
      },
      {
        query: 'from:invoice@mail2.ei.com.tw subject:電子發票開立通知 is:unread',
        type: 'HTML',
        description: 'EI 電子發票通知'
      },
      {
        query: 'from:payonline@cathay-ins.com.tw subject:保費繳費成功通知 is:unread',
        type: 'HTML',
        description: '國泰保險繳費通知'
      },
      {
        query: 'from:info@travelinvoice.com.tw subject:開立通知 is:unread',
        type: 'HTML',
        description: '旅遊發票開立通知'
      },
      {
        query: 'from:costcotaiwan.service@l.tradevan.com.tw subject:電子發票購物明細 is:unread',
        type: 'PDF',
        description: 'Costco 電子發票'
      },
      {
        query: 'from:mailer@xsolla.com subject:收據 is:unread',
        type: 'HTML',
        description: 'Xsolla 收據'
      },
      {
        query: 'from:stats.spx@shopee.com subject:收款 is:unread',
        type: 'PDF',
        description: 'Shopee 收款憑證'
      },
      {
        query: 'from:payments-noreply@google.com subject:應付憑據 is:unread',
        type: 'PDF',
        description: 'Google 應付憑據'
      },
      {
        query: 'from:ebill@ebppsmtp.taipower.com.tw subject:繳費憑證 is:unread',
        type: 'PDF',
        description: '台電繳費憑證'
      },
      {
        query: 'from:invoice@cht.com.tw subject:電子發票 is:unread',
        type: 'HTML',
        description: '中華電信電子發票'
      },
      {
        query: 'from:no_reply@email.apple.com subject:發票通知 is:unread',
        type: 'HTML',
        description: 'Apple 發票通知'
      },
      {
        query: 'from:e-invoicevasc@uxb2b.com subject:電子發票 is:unread',
        type: 'HTML',
        description: 'VASC 電子發票'
      },
      {
        query: 'from:ebill@water.gov.taipei subject:電子繳費憑證 is:unread',
        type: 'PDF',
        description: '台北自來水繳費憑證'
      }
    ];
    
    let totalUnprocessed = 0;
    let unprocessedDetails = [];
    
    emailRules.forEach((rule, index) => {
      Logger.log(`\n🔍 檢查規則 ${index + 1}/${emailRules.length}: ${rule.description}`);
      Logger.log(`📧 搜尋條件: ${rule.query}`);
      
      try {
        const threads = GmailApp.search(rule.query, 0, 10);
        Logger.log(`找到 ${threads.length} 個未讀郵件串`);
        
        if (threads.length > 0) {
          threads.forEach(thread => {
            const messages = thread.getMessages();
            messages.forEach(message => {
              if (message.isUnread()) {
                totalUnprocessed++;
                const detail = {
                  rule: rule.description,
                  type: rule.type,
                  subject: message.getSubject(),
                  sender: message.getFrom(),
                  date: message.getDate(),
                  messageId: message.getId()
                };
                unprocessedDetails.push(detail);
                
                Logger.log(`📨 未處理: ${message.getSubject()}`);
                Logger.log(`📧 寄件者: ${message.getFrom()}`);
                Logger.log(`📅 日期: ${message.getDate()}`);
                Logger.log(`📋 類型: ${rule.type}`);
              }
            });
          });
        }
        
      } catch (queryError) {
        Logger.log(`❌ 搜尋規則失敗: ${queryError.toString()}`);
      }
    });
    
    Logger.log(`\n📊 檢查摘要:`);
    Logger.log(`總共找到 ${totalUnprocessed} 封未處理的電子收據`);
    
    if (totalUnprocessed > 0) {
      Logger.log(`\n📋 詳細清單:`);
      unprocessedDetails.forEach((detail, index) => {
        Logger.log(`${index + 1}. ${detail.rule} (${detail.type})`);
        Logger.log(`   主旨: ${detail.subject}`);
        Logger.log(`   寄件者: ${detail.sender}`);
        Logger.log(`   日期: ${detail.date}`);
      });
    } else {
      Logger.log(`✅ 所有電子收據都已處理完成！`);
    }
    
    return unprocessedDetails;
    
  } catch (error) {
    Logger.log(`❌ 檢查未處理收據失敗: ${error.toString()}`);
    return [];
  }
}

/**
 * 根據 Email Rules 處理電子收據
 */
function processReceiptsByEmailRules() {
  Logger.log('🔄 根據 Email Rules 處理電子收據...');
  
  try {
    const emailRules = [
      {
        query: 'from:einvoice@einvoice.nat.gov.tw subject:彙整 is:unread',
        type: 'CSV',
        processor: 'processGovernmentEInvoice'
      },
      {
        query: 'from:invoice@mail2.ei.com.tw subject:電子發票開立通知 is:unread',
        type: 'HTML',
        processor: 'processEIInvoice'
      },
      {
        query: 'from:payonline@cathay-ins.com.tw subject:保費繳費成功通知 is:unread',
        type: 'HTML',
        processor: 'processCathayInsurance'
      },
      {
        query: 'from:info@travelinvoice.com.tw subject:開立通知 is:unread',
        type: 'HTML',
        processor: 'processTravelInvoice'
      },
      {
        query: 'from:costcotaiwan.service@l.tradevan.com.tw subject:電子發票購物明細 is:unread',
        type: 'PDF',
        processor: 'processCostcoInvoice'
      },
      {
        query: 'from:mailer@xsolla.com subject:收據 is:unread',
        type: 'HTML',
        processor: 'processXsollaReceipt'
      },
      {
        query: 'from:stats.spx@shopee.com subject:收款 is:unread',
        type: 'PDF',
        processor: 'processShopeeReceipt'
      },
      {
        query: 'from:payments-noreply@google.com subject:應付憑據 is:unread',
        type: 'PDF',
        processor: 'processGooglePayment'
      },
      {
        query: 'from:ebill@ebppsmtp.taipower.com.tw subject:繳費憑證 is:unread',
        type: 'PDF',
        processor: 'processTaipowerBill'
      },
      {
        query: 'from:invoice@cht.com.tw subject:電子發票 is:unread',
        type: 'HTML',
        processor: 'processCHTInvoice'
      },
      {
        query: 'from:no_reply@email.apple.com subject:發票通知 is:unread',
        type: 'HTML',
        processor: 'processAppleInvoice'
      },
      {
        query: 'from:e-invoicevasc@uxb2b.com subject:電子發票 is:unread',
        type: 'HTML',
        processor: 'processVASCInvoice'
      },
      {
        query: 'from:ebill@water.gov.taipei subject:電子繳費憑證 is:unread',
        type: 'PDF',
        processor: 'processTaipeiWaterBill'
      }
    ];
    
    let totalProcessed = 0;
    let processedMessageIds = new Set();
    
    emailRules.forEach((rule, index) => {
      Logger.log(`\n🔍 處理規則 ${index + 1}/${emailRules.length}: ${rule.processor}`);
      
      try {
        const threads = GmailApp.search(rule.query, 0, 5);
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
                const result = processEmailByRule(message, rule);
                if (result && result.amount > 0) {
                  saveEmailRecordWithCorrectStatus(result, message);
                  
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
                Logger.log(`❌ 處理郵件失敗: ${emailError.toString()}`);
              }
            }
          });
        });
        
      } catch (ruleError) {
        Logger.log(`❌ 處理規則失敗: ${ruleError.toString()}`);
      }
    });
    
    Logger.log(`\n✅ 根據 Email Rules 處理完成，共處理 ${totalProcessed} 封郵件`);
    
  } catch (error) {
    Logger.log(`❌ Email Rules 處理失敗: ${error.toString()}`);
  }
}

/**
 * 根據規則處理單封郵件
 */
function processEmailByRule(message, rule) {
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
      category: '其他',
      description: subject,
      merchant: '',
      source: 'Email : 電子收據'
    };
    
    const textToSearch = plainBody || htmlBody.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    
    // 根據不同的處理器進行解析
    switch (rule.processor) {
      case 'processAppleInvoice':
        result = processAppleInvoiceSpecific(textToSearch, result);
        break;
      case 'processCHTInvoice':
        result = processCHTInvoiceSpecific(textToSearch, result);
        break;
      case 'processTaipowerBill':
        result = processTaipowerBillSpecific(textToSearch, result);
        break;
      case 'processTaipeiWaterBill':
        result = processTaipeiWaterBillSpecific(textToSearch, result);
        break;
      case 'processCathayInsurance':
        result = processCathayInsuranceSpecific(textToSearch, result);
        break;
      case 'processGooglePayment':
        result = processGooglePaymentSpecific(textToSearch, result);
        break;
      default:
        result = processGeneralReceiptSpecific(textToSearch, result);
        break;
    }
    
    return validateReceiptResultFinal(result);
    
  } catch (error) {
    Logger.log(`❌ 根據規則處理郵件失敗: ${error.toString()}`);
    return null;
  }
}

/**
 * Apple 發票通知處理
 */
function processAppleInvoiceSpecific(textToSearch, result) {
  Logger.log('🍎 處理 Apple 發票通知...');
  
  result.merchant = 'Apple';
  result.category = '育';
  
  // Apple 金額提取（與之前相同的邏輯）
  const amountPatterns = [
    /NT\$\s*([0-9,]+(?:\.[0-9]{1,2})?)/g,
    /總計\s*NT\$\s*([0-9,]+(?:\.[0-9]{1,2})?)/i
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
  
  if (textToSearch.includes('iCloud+')) {
    result.description = 'Apple - iCloud+ 訂閱';
  } else {
    result.description = 'Apple - 數位服務';
  }
  
  return result;
}

/**
 * 中華電信發票處理
 */
function processCHTInvoiceSpecific(textToSearch, result) {
  Logger.log('📱 處理中華電信發票...');
  
  result.merchant = '中華電信';
  result.category = '行';
  result.description = '中華電信 - 電信服務';
  
  const amountPatterns = [
    /應繳金額[：:\s]*([0-9,]+)/i,
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
 * 台電繳費憑證處理
 */
function processTaipowerBillSpecific(textToSearch, result) {
  Logger.log('⚡ 處理台電繳費憑證...');
  
  result.merchant = '台灣電力公司';
  result.category = '住';
  result.description = '台電 - 電費';
  
  const amountPatterns = [
    /應繳金額[：:\s]*([0-9,]+)/i,
    /本期電費[：:\s]*([0-9,]+)/i,
    /繳費金額[：:\s]*([0-9,]+)/i,
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
 * 台北自來水繳費憑證處理
 */
function processTaipeiWaterBillSpecific(textToSearch, result) {
  Logger.log('💧 處理台北自來水繳費憑證...');
  
  result.merchant = '台北自來水事業處';
  result.category = '住';
  result.description = '台北自來水 - 水費';
  
  const amountPatterns = [
    /應繳金額[：:\s]*([0-9,]+)/i,
    /本期費用[：:\s]*([0-9,]+)/i,
    /繳費金額[：:\s]*([0-9,]+)/i,
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
 * 國泰保險繳費通知處理
 */
function processCathayInsuranceSpecific(textToSearch, result) {
  Logger.log('🛡️ 處理國泰保險繳費通知...');
  
  result.merchant = '國泰人壽';
  result.category = '保險';
  result.description = '國泰人壽 - 保險費';
  
  const amountPatterns = [
    /保費金額[：:\s]*([0-9,]+)/i,
    /繳費金額[：:\s]*([0-9,]+)/i,
    /應繳保費[：:\s]*([0-9,]+)/i,
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
 * Google 應付憑據處理
 */
function processGooglePaymentSpecific(textToSearch, result) {
  Logger.log('🔍 處理 Google 應付憑據...');
  
  result.merchant = 'Google';
  result.category = '育';
  result.description = 'Google - 雲端服務';
  
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
 * 一般收據處理
 */
function processGeneralReceiptSpecific(textToSearch, result) {
  Logger.log('📄 處理一般收據...');
  
  const amountPatterns = [
    /金額[：:\s]*([0-9,]+)/i,
    /總計[：:\s]*([0-9,]+)/i,
    /NT\$\s*([0-9,]+)/i,
    /([0-9,]+)\s*元/g,
    /\$([0-9,]+\.?[0-9]*)/g
  ];
  
  for (let pattern of amountPatterns) {
    const matches = textToSearch.match(pattern);
    if (matches && matches.length > 0) {
      const amounts = matches.map(match => {
        const cleanAmount = match.replace(/[金額總計NT\$元]/g, '').replace(/[：:\s]/g, '').replace(/,/g, '');
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
 * 驗證結果
 */
function validateReceiptResultFinal(result) {
  if (isNaN(result.amount) || result.amount <= 0) {
    result.amount = 0;
  }
  
  const validCurrencies = ['TWD', 'USD', 'JPY', 'EUR', 'CNY'];
  if (!validCurrencies.includes(result.currency)) {
    result.currency = 'TWD';
  }
  
  const validCategories = ['食', '衣', '住', '行', '育', '樂', '醫療', '保險', '其他'];
  if (!validCategories.includes(result.category)) {
    result.category = '其他';
  }
  
  return result;
}

/**
 * 儲存記錄（修正 P 欄位為「待確認」）
 */
function saveEmailRecordWithCorrectStatus(data, message) {
  try {
    const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    const ss = SpreadsheetApp.openById(mainLedgerId);
    const sheet = ss.getSheetByName('All Records');
    
    const exchangeRate = data.currency === 'TWD' ? 1 : (data.currency === 'USD' ? 31.5 : 1);
    
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
      '待確認',                    // P: STATUS - 修正為「待確認」
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
    Logger.log(`💾 記錄已儲存: ${data.amount} ${data.currency} - ${data.description}`);
    
  } catch (error) {
    Logger.log(`❌ 儲存記錄失敗: ${error.toString()}`);
    throw error;
  }
}

/**
 * 修復現有記錄的狀態欄位
 */
function fixExistingStatusColumn() {
  Logger.log('=== 修復現有記錄的狀態欄位 ===');
  
  try {
    const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    const ss = SpreadsheetApp.openById(mainLedgerId);
    const sheet = ss.getSheetByName('All Records');
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    let fixedCount = 0;
    
    for (let i = 1; i < values.length; i++) {
      const status = values[i][15]; // P欄：STATUS
      
      // 將 "Active" 或 "未確認" 改為 "待確認"
      if (status === 'Active' || status === '未確認') {
        sheet.getRange(i + 1, 16).setValue('待確認'); // P欄
        fixedCount++;
        Logger.log(`✅ 修復第 ${i + 1} 行狀態為「待確認」`);
      }
    }
    
    Logger.log(`✅ 共修復 ${fixedCount} 筆記錄的狀態欄位`);
    
  } catch (error) {
    Logger.log(`❌ 修復狀態欄位失敗: ${error.toString()}`);
  }
}

/**
 * 更新觸發器使用 Email Rules 處理
 */
function updateTriggerToEmailRules() {
  Logger.log('=== 更新觸發器使用 Email Rules ===');
  
  try {
    const existingTriggers = ScriptApp.getProjectTriggers();
    existingTriggers.forEach(trigger => {
      ScriptApp.deleteTrigger(trigger);
      Logger.log(`🗑️ 刪除觸發器: ${trigger.getHandlerFunction()}`);
    });
    
    ScriptApp.newTrigger('processReceiptsByEmailRules')
      .timeBased()
      .everyMinutes(15)
      .create();
    
    Logger.log('✅ 建立 Email Rules 觸發器');
    
    // 測試新觸發器
    processReceiptsByEmailRules();
    
  } catch (error) {
    Logger.log(`❌ 更新觸發器失敗: ${error.toString()}`);
  }
}

/**
 * 完整的 Email Rules 解決方案
 */
function runEmailRulesCompleteSolution() {
  Logger.log('=== 執行完整 Email Rules 解決方案 ===');
  
  try {
    // 1. 檢查未處理的收據
    const unprocessedReceipts = checkUnprocessedReceiptsByRules();
    
    // 2. 修復現有記錄的狀態欄位
    fixExistingStatusColumn();
    
    // 3. 更新觸發器
    updateTriggerToEmailRules();
    
    Logger.log('=== Email Rules 解決方案執行完成 ===');
    Logger.log('✅ 檢查結果：');
    Logger.log(`  - 找到 ${unprocessedReceipts.length} 封未處理的電子收據`);
    Logger.log('  - P 欄位已修正為「待確認」');
    Logger.log('  - Q 欄位統一為「Email : 電子收據」');
    Logger.log('  - 觸發器已更新支援所有 Email Rules');
    
    return unprocessedReceipts;
    
  } catch (error) {
    Logger.log(`❌ Email Rules 解決方案執行失敗: ${error.toString()}`);
    return [];
  }
}