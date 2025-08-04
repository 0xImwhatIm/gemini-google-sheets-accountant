// =================================================================================================
// V47 Email 處理增強版 - 2025-08-04
// 專門修復郵件解析失敗問題，特別是財政部電子發票彙整
// =================================================================================================

/**
 * 🔧 增強版 Email Rules 處理器
 * 修復金額解析失敗和財政部電子發票識別問題
 */
function processReceiptsByEmailRulesEnhanced() {
  Logger.log('🔄 增強版 Email Rules 處理器啟動...');
  
  try {
    const emailRules = [
      {
        query: 'from:einvoice@einvoice.nat.gov.tw subject:彙整 is:unread',
        type: 'CSV',
        processor: 'processGovernmentEInvoiceEnhanced',
        description: '財政部電子發票彙整'
      },
      {
        query: 'from:invoice@mail2.ei.com.tw subject:電子發票開立通知 is:unread',
        type: 'HTML',
        processor: 'processEIInvoiceEnhanced',
        description: 'EI 電子發票通知'
      },
      {
        query: 'from:no_reply@email.apple.com subject:發票通知 is:unread',
        type: 'HTML',
        processor: 'processAppleInvoiceEnhanced',
        description: 'Apple 發票通知'
      },
      {
        query: 'from:invoice@cht.com.tw subject:電子發票 is:unread',
        type: 'HTML',
        processor: 'processCHTInvoiceEnhanced',
        description: '中華電信電子發票'
      },
      {
        query: 'from:payonline@cathay-ins.com.tw subject:保費繳費成功通知 is:unread',
        type: 'HTML',
        processor: 'processCathayInsuranceEnhanced',
        description: '國泰保險繳費通知'
      },
      {
        query: 'from:ebill@ebppsmtp.taipower.com.tw subject:繳費憑證 is:unread',
        type: 'PDF',
        processor: 'processTaipowerBillEnhanced',
        description: '台電繳費憑證'
      },
      {
        query: 'from:payments-noreply@google.com subject:應付憑據 is:unread',
        type: 'PDF',
        processor: 'processGooglePaymentEnhanced',
        description: 'Google 應付憑據'
      }
    ];
    
    let totalProcessed = 0;
    let processedMessageIds = new Set();
    
    emailRules.forEach((rule, index) => {
      Logger.log(`\n🔍 處理規則 ${index + 1}/${emailRules.length}: ${rule.description}`);
      Logger.log(`📧 搜尋條件: ${rule.query}`);
      
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
              Logger.log(`📧 寄件者: ${message.getFrom()}`);
              Logger.log(`📅 日期: ${message.getDate()}`);
              
              try {
                const result = processEmailByRuleEnhanced(message, rule);
                
                Logger.log(`💰 解析結果: 金額=${result ? result.amount : 'null'}, 描述=${result ? result.description : 'null'}`);
                
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
                  
                  // 詳細診斷
                  if (!result) {
                    Logger.log('❌ 解析結果為 null');
                  } else if (result.amount <= 0) {
                    Logger.log(`❌ 金額無效: ${result.amount}`);
                  }
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
    
    Logger.log(`\n✅ 增強版處理完成，共處理 ${totalProcessed} 封郵件`);
    
  } catch (error) {
    Logger.log(`❌ 增強版處理失敗: ${error.toString()}`);
  }
}

/**
 * 增強版郵件處理邏輯
 */
function processEmailByRuleEnhanced(message, rule) {
  try {
    const subject = message.getSubject();
    const htmlBody = message.getBody();
    const plainBody = message.getPlainBody();
    const sender = message.getFrom();
    const messageDate = message.getDate();
    
    Logger.log(`🔍 開始解析郵件: ${rule.processor}`);
    Logger.log(`📧 主旨: ${subject}`);
    Logger.log(`📧 寄件者: ${sender}`);
    
    let result = {
      date: Utilities.formatDate(messageDate, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      amount: 0,
      currency: 'TWD',
      category: '其他',
      description: subject,
      merchant: '',
      source: 'Email : 電子收據'
    };
    
    // 根據不同的處理器進行解析
    switch (rule.processor) {
      case 'processGovernmentEInvoiceEnhanced':
        result = processGovernmentEInvoiceEnhanced(message, result);
        break;
      case 'processAppleInvoiceEnhanced':
        result = processAppleInvoiceEnhanced(message, result);
        break;
      case 'processCHTInvoiceEnhanced':
        result = processCHTInvoiceEnhanced(message, result);
        break;
      case 'processTaipowerBillEnhanced':
        result = processTaipowerBillEnhanced(message, result);
        break;
      case 'processCathayInsuranceEnhanced':
        result = processCathayInsuranceEnhanced(message, result);
        break;
      case 'processGooglePaymentEnhanced':
        result = processGooglePaymentEnhanced(message, result);
        break;
      case 'processEIInvoiceEnhanced':
        result = processEIInvoiceEnhanced(message, result);
        break;
      default:
        result = processGeneralReceiptEnhanced(message, result);
        break;
    }
    
    Logger.log(`💰 處理結果: 金額=${result.amount}, 商家=${result.merchant}, 分類=${result.category}`);
    
    return validateReceiptResultEnhanced(result);
    
  } catch (error) {
    Logger.log(`❌ 增強版郵件處理失敗: ${error.toString()}`);
    return null;
  }
}

/**
 * 🏛️ 財政部電子發票彙整處理（增強版）
 * 這是最重要的功能，必須正確處理 CSV 附件
 */
function processGovernmentEInvoiceEnhanced(message, result) {
  Logger.log('🏛️ 處理財政部電子發票彙整（增強版）...');
  
  try {
    result.merchant = '財政部';
    result.category = '其他';
    result.description = '財政部 - 電子發票彙整';
    
    // 檢查附件
    const attachments = message.getAttachments();
    Logger.log(`📎 找到 ${attachments.length} 個附件`);
    
    let totalAmount = 0;
    let invoiceCount = 0;
    
    attachments.forEach((attachment, index) => {
      const fileName = attachment.getName();
      Logger.log(`📎 附件 ${index + 1}: ${fileName}`);
      
      if (fileName.toLowerCase().includes('.csv')) {
        Logger.log('📊 處理 CSV 附件...');
        
        try {
          const csvContent = attachment.getDataAsString('UTF-8');
          Logger.log(`📊 CSV 內容長度: ${csvContent.length} 字元`);
          
          // 解析 CSV 內容
          const lines = csvContent.split('\n');
          Logger.log(`📊 CSV 行數: ${lines.length}`);
          
          // 跳過標題行，從第二行開始處理
          for (let i = 1; i < lines.length && i < 50; i++) { // 限制處理行數避免超時
            const line = lines[i].trim();
            if (line) {
              // CSV 格式通常是：日期,發票號碼,商家,金額,稅額,總計
              const columns = line.split(',');
              
              if (columns.length >= 4) {
                // 嘗試從不同欄位提取金額
                for (let col = 2; col < columns.length; col++) {
                  const cellValue = columns[col].replace(/["\s]/g, '');
                  const amount = parseFloat(cellValue);
                  
                  if (!isNaN(amount) && amount > 0) {
                    totalAmount += amount;
                    invoiceCount++;
                    Logger.log(`💰 找到金額: ${amount} (第 ${i + 1} 行, 第 ${col + 1} 欄)`);
                    break; // 找到金額後跳出內層迴圈
                  }
                }
              }
            }
          }
          
          Logger.log(`📊 CSV 解析完成: 總金額=${totalAmount}, 發票數量=${invoiceCount}`);
          
        } catch (csvError) {
          Logger.log(`❌ CSV 解析失敗: ${csvError.toString()}`);
        }
      }
    });
    
    // 如果 CSV 解析成功，使用總金額
    if (totalAmount > 0) {
      result.amount = totalAmount;
      result.description = `財政部 - 電子發票彙整 (${invoiceCount} 張發票)`;
      Logger.log(`✅ 財政部發票處理成功: ${totalAmount} 元, ${invoiceCount} 張發票`);
    } else {
      // 如果 CSV 解析失敗，嘗試從郵件內容提取
      Logger.log('⚠️ CSV 解析失敗，嘗試從郵件內容提取...');
      
      const plainBody = message.getPlainBody();
      const htmlBody = message.getBody();
      const textToSearch = plainBody || htmlBody.replace(/<[^>]*>/g, ' ');
      
      // 財政部郵件的金額模式
      const amountPatterns = [
        /總金額[：:\s]*([0-9,]+)/i,
        /合計[：:\s]*([0-9,]+)/i,
        /總計[：:\s]*([0-9,]+)/i,
        /金額[：:\s]*([0-9,]+)/i,
        /([0-9,]+)\s*元/g,
        /NT\$\s*([0-9,]+)/i
      ];
      
      for (let pattern of amountPatterns) {
        const matches = textToSearch.match(pattern);
        if (matches && matches.length > 0) {
          const amounts = matches.map(match => {
            const cleanAmount = match.replace(/[總金額合計：:\sNT\$元]/g, '').replace(/,/g, '');
            return parseFloat(cleanAmount);
          }).filter(amount => !isNaN(amount) && amount > 0);
          
          if (amounts.length > 0) {
            result.amount = Math.max(...amounts);
            Logger.log(`✅ 從郵件內容提取金額: ${result.amount}`);
            break;
          }
        }
      }
    }
    
    return result;
    
  } catch (error) {
    Logger.log(`❌ 財政部發票處理失敗: ${error.toString()}`);
    return result;
  }
}

/**
 * 🍎 Apple 發票通知處理（增強版）
 */
function processAppleInvoiceEnhanced(message, result) {
  Logger.log('🍎 處理 Apple 發票通知（增強版）...');
  
  try {
    result.merchant = 'Apple';
    result.category = '育';
    
    const plainBody = message.getPlainBody();
    const htmlBody = message.getBody();
    const textToSearch = plainBody || htmlBody.replace(/<[^>]*>/g, ' ');
    
    Logger.log(`📄 郵件內容長度: ${textToSearch.length} 字元`);
    
    // Apple 金額提取模式
    const amountPatterns = [
      /NT\$\s*([0-9,]+(?:\.[0-9]{1,2})?)/g,
      /總計\s*NT\$\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
      /Total\s*NT\$\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
      /金額\s*NT\$\s*([0-9,]+(?:\.[0-9]{1,2})?)/i
    ];
    
    for (let pattern of amountPatterns) {
      const matches = textToSearch.match(pattern);
      if (matches && matches.length > 0) {
        Logger.log(`🔍 找到匹配: ${matches}`);
        
        const amounts = matches.map(match => {
          const cleanAmount = match.replace(/[NT\$總計Total金額\s]/g, '').replace(/,/g, '');
          return parseFloat(cleanAmount);
        }).filter(amount => !isNaN(amount) && amount > 0);
        
        if (amounts.length > 0) {
          result.amount = Math.max(...amounts);
          Logger.log(`✅ Apple 金額提取成功: ${result.amount}`);
          break;
        }
      }
    }
    
    // 根據內容判斷服務類型
    if (textToSearch.includes('iCloud+') || textToSearch.includes('iCloud')) {
      result.description = 'Apple - iCloud+ 訂閱';
    } else if (textToSearch.includes('App Store')) {
      result.description = 'Apple - App Store 購買';
    } else {
      result.description = 'Apple - 數位服務';
    }
    
    return result;
    
  } catch (error) {
    Logger.log(`❌ Apple 發票處理失敗: ${error.toString()}`);
    return result;
  }
}

/**
 * 📱 中華電信發票處理（增強版）
 */
function processCHTInvoiceEnhanced(message, result) {
  Logger.log('📱 處理中華電信發票（增強版）...');
  
  try {
    result.merchant = '中華電信';
    result.category = '行';
    result.description = '中華電信 - 電信服務';
    
    const plainBody = message.getPlainBody();
    const htmlBody = message.getBody();
    const textToSearch = plainBody || htmlBody.replace(/<[^>]*>/g, ' ');
    
    const amountPatterns = [
      /應繳金額[：:\s]*([0-9,]+)/i,
      /總金額[：:\s]*([0-9,]+)/i,
      /本期費用[：:\s]*([0-9,]+)/i,
      /NT\$\s*([0-9,]+)/i,
      /([0-9,]+)\s*元/g
    ];
    
    for (let pattern of amountPatterns) {
      const matches = textToSearch.match(pattern);
      if (matches && matches.length > 0) {
        const amounts = matches.map(match => {
          const cleanAmount = match.replace(/[應繳金額總本期費用：:\sNT\$元]/g, '').replace(/,/g, '');
          return parseFloat(cleanAmount);
        }).filter(amount => !isNaN(amount) && amount > 0);
        
        if (amounts.length > 0) {
          result.amount = Math.max(...amounts);
          Logger.log(`✅ 中華電信金額提取成功: ${result.amount}`);
          break;
        }
      }
    }
    
    return result;
    
  } catch (error) {
    Logger.log(`❌ 中華電信發票處理失敗: ${error.toString()}`);
    return result;
  }
}

/**
 * ⚡ 台電繳費憑證處理（增強版）
 */
function processTaipowerBillEnhanced(message, result) {
  Logger.log('⚡ 處理台電繳費憑證（增強版）...');
  
  try {
    result.merchant = '台灣電力公司';
    result.category = '住';
    result.description = '台電 - 電費';
    
    const plainBody = message.getPlainBody();
    const htmlBody = message.getBody();
    const textToSearch = plainBody || htmlBody.replace(/<[^>]*>/g, ' ');
    
    const amountPatterns = [
      /應繳金額[：:\s]*([0-9,]+)/i,
      /本期電費[：:\s]*([0-9,]+)/i,
      /繳費金額[：:\s]*([0-9,]+)/i,
      /總金額[：:\s]*([0-9,]+)/i,
      /([0-9,]+)\s*元/g
    ];
    
    for (let pattern of amountPatterns) {
      const matches = textToSearch.match(pattern);
      if (matches && matches.length > 0) {
        const amounts = matches.map(match => {
          const cleanAmount = match.replace(/[應繳金額本期電費繳總：:\s元]/g, '').replace(/,/g, '');
          return parseFloat(cleanAmount);
        }).filter(amount => !isNaN(amount) && amount > 0);
        
        if (amounts.length > 0) {
          result.amount = Math.max(...amounts);
          Logger.log(`✅ 台電金額提取成功: ${result.amount}`);
          break;
        }
      }
    }
    
    return result;
    
  } catch (error) {
    Logger.log(`❌ 台電繳費處理失敗: ${error.toString()}`);
    return result;
  }
}

/**
 * 🛡️ 國泰保險繳費通知處理（增強版）
 */
function processCathayInsuranceEnhanced(message, result) {
  Logger.log('🛡️ 處理國泰保險繳費通知（增強版）...');
  
  try {
    result.merchant = '國泰人壽';
    result.category = '保險';
    result.description = '國泰人壽 - 保險費';
    
    const plainBody = message.getPlainBody();
    const htmlBody = message.getBody();
    const textToSearch = plainBody || htmlBody.replace(/<[^>]*>/g, ' ');
    
    const amountPatterns = [
      /保費金額[：:\s]*([0-9,]+)/i,
      /繳費金額[：:\s]*([0-9,]+)/i,
      /應繳保費[：:\s]*([0-9,]+)/i,
      /總金額[：:\s]*([0-9,]+)/i,
      /NT\$\s*([0-9,]+)/i,
      /([0-9,]+)\s*元/g
    ];
    
    for (let pattern of amountPatterns) {
      const matches = textToSearch.match(pattern);
      if (matches && matches.length > 0) {
        const amounts = matches.map(match => {
          const cleanAmount = match.replace(/[保費金額繳應總：:\sNT\$元]/g, '').replace(/,/g, '');
          return parseFloat(cleanAmount);
        }).filter(amount => !isNaN(amount) && amount > 0);
        
        if (amounts.length > 0) {
          result.amount = Math.max(...amounts);
          Logger.log(`✅ 國泰保險金額提取成功: ${result.amount}`);
          break;
        }
      }
    }
    
    return result;
    
  } catch (error) {
    Logger.log(`❌ 國泰保險處理失敗: ${error.toString()}`);
    return result;
  }
}

/**
 * 🔍 Google 應付憑據處理（增強版）
 */
function processGooglePaymentEnhanced(message, result) {
  Logger.log('🔍 處理 Google 應付憑據（增強版）...');
  
  try {
    result.merchant = 'Google';
    result.category = '育';
    result.description = 'Google - 雲端服務';
    
    const plainBody = message.getPlainBody();
    const htmlBody = message.getBody();
    const textToSearch = plainBody || htmlBody.replace(/<[^>]*>/g, ' ');
    
    const amountPatterns = [
      /\$([0-9,]+\.?[0-9]*)/g,
      /Total[：:\s]*\$([0-9,]+\.?[0-9]*)/i,
      /Amount[：:\s]*\$([0-9,]+\.?[0-9]*)/i,
      /USD\s*([0-9,]+\.?[0-9]*)/i
    ];
    
    for (let pattern of amountPatterns) {
      const matches = textToSearch.match(pattern);
      if (matches && matches.length > 0) {
        const amounts = matches.map(match => {
          const cleanAmount = match.replace(/[\$TotalAmount：:\sUSD]/g, '').replace(/,/g, '');
          return parseFloat(cleanAmount);
        }).filter(amount => !isNaN(amount) && amount > 0);
        
        if (amounts.length > 0) {
          result.amount = Math.max(...amounts);
          result.currency = 'USD';
          Logger.log(`✅ Google 金額提取成功: ${result.amount} USD`);
          break;
        }
      }
    }
    
    return result;
    
  } catch (error) {
    Logger.log(`❌ Google 應付憑據處理失敗: ${error.toString()}`);
    return result;
  }
}

/**
 * 📧 EI 電子發票通知處理（增強版）
 */
function processEIInvoiceEnhanced(message, result) {
  Logger.log('📧 處理 EI 電子發票通知（增強版）...');
  
  try {
    result.merchant = 'EI 電子發票';
    result.category = '其他';
    result.description = 'EI - 電子發票';
    
    const plainBody = message.getPlainBody();
    const htmlBody = message.getBody();
    const textToSearch = plainBody || htmlBody.replace(/<[^>]*>/g, ' ');
    
    const amountPatterns = [
      /總金額[：:\s]*([0-9,]+)/i,
      /發票金額[：:\s]*([0-9,]+)/i,
      /金額[：:\s]*([0-9,]+)/i,
      /NT\$\s*([0-9,]+)/i,
      /([0-9,]+)\s*元/g
    ];
    
    for (let pattern of amountPatterns) {
      const matches = textToSearch.match(pattern);
      if (matches && matches.length > 0) {
        const amounts = matches.map(match => {
          const cleanAmount = match.replace(/[總發票金額：:\sNT\$元]/g, '').replace(/,/g, '');
          return parseFloat(cleanAmount);
        }).filter(amount => !isNaN(amount) && amount > 0);
        
        if (amounts.length > 0) {
          result.amount = Math.max(...amounts);
          Logger.log(`✅ EI 發票金額提取成功: ${result.amount}`);
          break;
        }
      }
    }
    
    return result;
    
  } catch (error) {
    Logger.log(`❌ EI 發票處理失敗: ${error.toString()}`);
    return result;
  }
}

/**
 * 📄 一般收據處理（增強版）
 */
function processGeneralReceiptEnhanced(message, result) {
  Logger.log('📄 處理一般收據（增強版）...');
  
  try {
    const plainBody = message.getPlainBody();
    const htmlBody = message.getBody();
    const textToSearch = plainBody || htmlBody.replace(/<[^>]*>/g, ' ');
    
    const amountPatterns = [
      /金額[：:\s]*([0-9,]+)/i,
      /總計[：:\s]*([0-9,]+)/i,
      /總金額[：:\s]*([0-9,]+)/i,
      /NT\$\s*([0-9,]+)/i,
      /([0-9,]+)\s*元/g,
      /\$([0-9,]+\.?[0-9]*)/g
    ];
    
    for (let pattern of amountPatterns) {
      const matches = textToSearch.match(pattern);
      if (matches && matches.length > 0) {
        const amounts = matches.map(match => {
          const cleanAmount = match.replace(/[金額總計：:\sNT\$元]/g, '').replace(/,/g, '');
          return parseFloat(cleanAmount);
        }).filter(amount => !isNaN(amount) && amount > 0);
        
        if (amounts.length > 0) {
          result.amount = Math.max(...amounts);
          Logger.log(`✅ 一般收據金額提取成功: ${result.amount}`);
          break;
        }
      }
    }
    
    return result;
    
  } catch (error) {
    Logger.log(`❌ 一般收據處理失敗: ${error.toString()}`);
    return result;
  }
}

/**
 * 增強版結果驗證
 */
function validateReceiptResultEnhanced(result) {
  if (!result) {
    Logger.log('❌ 結果為 null');
    return null;
  }
  
  if (isNaN(result.amount) || result.amount <= 0) {
    Logger.log(`❌ 金額無效: ${result.amount}`);
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
  
  Logger.log(`✅ 驗證完成: 金額=${result.amount}, 幣別=${result.currency}, 分類=${result.category}`);
  
  return result;
}

/**
 * 🧪 測試財政部電子發票處理
 */
function testGovernmentEInvoiceProcessing() {
  Logger.log('🧪 測試財政部電子發票處理...');
  
  try {
    const threads = GmailApp.search('from:einvoice@einvoice.nat.gov.tw subject:彙整 is:unread', 0, 1);
    
    if (threads.length > 0) {
      const message = threads[0].getMessages()[0];
      Logger.log(`📧 測試郵件: ${message.getSubject()}`);
      
      const rule = {
        processor: 'processGovernmentEInvoiceEnhanced',
        type: 'CSV',
        description: '財政部電子發票彙整'
      };
      
      const result = processEmailByRuleEnhanced(message, rule);
      
      if (result && result.amount > 0) {
        Logger.log(`✅ 測試成功: 金額=${result.amount}, 描述=${result.description}`);
      } else {
        Logger.log('❌ 測試失敗: 無法提取金額');
      }
      
      return result;
      
    } else {
      Logger.log('⚠️ 找不到財政部電子發票郵件');
      return null;
    }
    
  } catch (error) {
    Logger.log(`❌ 測試失敗: ${error.toString()}`);
    return null;
  }
}

/**
 * 🔄 更新觸發器使用增強版處理器
 */
function updateTriggerToEnhancedProcessor() {
  Logger.log('🔄 更新觸發器使用增強版處理器...');
  
  try {
    // 刪除現有觸發器
    const existingTriggers = ScriptApp.getProjectTriggers();
    existingTriggers.forEach(trigger => {
      ScriptApp.deleteTrigger(trigger);
      Logger.log(`🗑️ 刪除觸發器: ${trigger.getHandlerFunction()}`);
    });
    
    // 建立增強版觸發器
    ScriptApp.newTrigger('processReceiptsByEmailRulesEnhanced')
      .timeBased()
      .everyMinutes(15)
      .create();
    
    Logger.log('✅ 建立增強版 Email 處理觸發器');
    
    // 測試新觸發器
    processReceiptsByEmailRulesEnhanced();
    
    Logger.log('✅ 觸發器更新完成');
    
  } catch (error) {
    Logger.log(`❌ 更新觸發器失敗: ${error.toString()}`);
  }
}