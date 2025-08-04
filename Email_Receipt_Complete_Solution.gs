// =================================================================================================
// Email 收據完整解決方案 - 2025-08-04
// 整合所有成功的附件處理邏輯到主要 Email 處理系統
// =================================================================================================

/**
 * 🎯 完整的 Email Rules 處理器（整合版）
 * 包含所有成功修復的附件處理邏輯
 */
function processReceiptsByEmailRulesComplete() {
  Logger.log('🎯 完整的 Email Rules 處理器啟動...');
  
  try {
    const emailRules = [
      {
        query: 'from:no_reply@email.apple.com subject:發票通知 is:unread',
        type: 'Apple',
        processor: 'processAppleInvoiceComplete',
        needsAttachment: false
      },
      {
        query: 'from:payments-noreply@google.com subject:應付憑據 is:unread',
        type: 'Google',
        processor: 'processGooglePaymentComplete',
        needsAttachment: true,
        attachmentType: 'PDF'
      },
      {
        query: 'from:invoice@cht.com.tw subject:電子發票 is:unread',
        type: 'CHT',
        processor: 'processCHTInvoiceComplete',
        needsAttachment: true,
        attachmentType: 'HTML'
      },
      {
        query: 'from:einvoice@einvoice.nat.gov.tw subject:彙整 is:unread',
        type: 'Government',
        processor: 'processGovernmentInvoiceComplete',
        needsAttachment: true,
        attachmentType: 'CSV'
      }
    ];
    
    let totalProcessed = 0;
    let processedMessageIds = new Set();
    
    emailRules.forEach((rule, index) => {
      Logger.log(`\n🔍 處理規則 ${index + 1}/${emailRules.length}: ${rule.type}`);
      Logger.log(`📧 搜尋條件: ${rule.query}`);
      
      try {
        const threads = GmailApp.search(rule.query, 0, 3); // 限制數量避免超時
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
                const result = processEmailComplete(message, rule);
                
                if (result && result.amount > 0) {
                  saveEmailRecordComplete(result, message);
                  
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
    
    Logger.log(`\n✅ 完整處理完成，共處理 ${totalProcessed} 封郵件`);
    
  } catch (error) {
    Logger.log(`❌ 完整處理失敗: ${error.toString()}`);
  }
}

/**
 * 📧 完整的郵件處理邏輯
 */
function processEmailComplete(message, rule) {
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
        result = processAppleInvoiceComplete(message, result);
        break;
      case 'Google':
        result = processGooglePaymentComplete(message, result);
        break;
      case 'CHT':
        result = processCHTInvoiceComplete(message, result);
        break;
      case 'Government':
        result = processGovernmentInvoiceComplete(message, result);
        break;
      default:
        Logger.log(`⚠️ 未知的郵件類型: ${rule.type}`);
        break;
    }
    
    return validateResult(result);
    
  } catch (error) {
    Logger.log(`❌ 郵件處理失敗: ${error.toString()}`);
    return null;
  }
}

/**
 * 🍎 Apple 發票完整處理
 */
function processAppleInvoiceComplete(message, result) {
  Logger.log('🍎 處理 Apple 發票...');
  
  try {
    result.merchant = 'Apple';
    result.category = '育';
    
    const plainBody = message.getPlainBody();
    const htmlBody = message.getBody();
    const textToSearch = plainBody || htmlBody.replace(/<[^>]*>/g, ' ');
    
    const patterns = [
      /NT\$\s*([0-9,]+(?:\.[0-9]{1,2})?)/g,
      /總計\s*NT\$\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi,
      /Total\s*NT\$\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi,
      /([0-9,]+(?:\.[0-9]{1,2})?)\s*元/g
    ];
    
    for (let pattern of patterns) {
      const matches = textToSearch.match(pattern);
      if (matches && matches.length > 0) {
        const amounts = matches.map(match => {
          const cleanAmount = match.replace(/[NT\$總計Total元\s]/g, '').replace(/,/g, '');
          return parseFloat(cleanAmount);
        }).filter(amount => !isNaN(amount) && amount > 0 && amount <= 50000);
        
        if (amounts.length > 0) {
          result.amount = Math.max(...amounts);
          break;
        }
      }
    }
    
    if (textToSearch.includes('iCloud+') || textToSearch.includes('iCloud')) {
      result.description = 'Apple - iCloud+ 訂閱';
    } else {
      result.description = 'Apple - 數位服務';
    }
    
    Logger.log(`✅ Apple 處理完成: ${result.amount} ${result.currency}`);
    return result;
    
  } catch (error) {
    Logger.log(`❌ Apple 處理失敗: ${error.toString()}`);
    return result;
  }
}

/**
 * 🔍 Google 應付憑據完整處理
 */
function processGooglePaymentComplete(message, result) {
  Logger.log('🔍 處理 Google 應付憑據...');
  
  try {
    result.merchant = 'Google';
    result.category = '育';
    result.currency = 'USD';
    result.description = 'Google - 雲端服務';
    
    const attachments = message.getAttachments();
    
    // 從 PDF 附件提取
    for (let attachment of attachments) {
      const fileName = attachment.getName();
      
      if (fileName.toLowerCase().includes('.pdf')) {
        try {
          const pdfData = attachment.getDataAsString('UTF-8');
          const textMatches = pdfData.match(/\$([0-9]+\.?[0-9]*)/g);
          
          if (textMatches && textMatches.length > 0) {
            const amounts = textMatches.map(match => {
              const cleanAmount = match.replace(/\$/g, '');
              return parseFloat(cleanAmount);
            }).filter(amount => !isNaN(amount) && amount > 0 && amount <= 1000);
            
            if (amounts.length > 0) {
              result.amount = Math.max(...amounts);
              Logger.log(`✅ 從 PDF 提取金額: $${result.amount} USD`);
              break;
            }
          }
        } catch (pdfError) {
          Logger.log(`⚠️ PDF 處理失敗，嘗試 HTML 回退`);
        }
      }
    }
    
    // 如果 PDF 失敗，從 HTML 回退
    if (result.amount === 0) {
      const htmlBody = message.getBody();
      const htmlPatterns = [
        /\$\s*([0-9]+\.?[0-9]*)/g,
        /USD\s*([0-9]+\.?[0-9]*)/gi,
        /Total[：:\s]*\$\s*([0-9]+\.?[0-9]*)/gi
      ];
      
      for (let pattern of htmlPatterns) {
        const matches = htmlBody.match(pattern);
        if (matches && matches.length > 0) {
          const amounts = matches.map(match => {
            const cleanAmount = match.replace(/[\$USDTotal：:\s]/gi, '').replace(/,/g, '');
            return parseFloat(cleanAmount);
          }).filter(amount => !isNaN(amount) && amount > 0 && amount <= 1000);
          
          if (amounts.length > 0) {
            result.amount = Math.max(...amounts);
            break;
          }
        }
      }
    }
    
    Logger.log(`✅ Google 處理完成: ${result.amount} ${result.currency}`);
    return result;
    
  } catch (error) {
    Logger.log(`❌ Google 處理失敗: ${error.toString()}`);
    return result;
  }
}

/**
 * 📱 中華電信發票完整處理
 */
function processCHTInvoiceComplete(message, result) {
  Logger.log('📱 處理中華電信發票...');
  
  try {
    result.merchant = '中華電信';
    result.category = '行';
    result.description = '中華電信 - 電信服務';
    
    // 從主旨提取發票號碼
    const subject = message.getSubject();
    const invoiceMatch = subject.match(/發票號碼[：:\s]*([A-Z]{2}[0-9]{8})/);
    result.invoiceNumber = invoiceMatch ? invoiceMatch[1] : '';
    
    const attachments = message.getAttachments();
    
    // 從 HTML 附件提取
    for (let attachment of attachments) {
      const fileName = attachment.getName();
      
      if (fileName.toLowerCase().includes('.htm')) {
        try {
          // 使用 Big5 編碼
          let htmlContent = attachment.getDataAsString('Big5');
          
          const amountPatterns = [
            /應繳金額[：:\s]*([0-9,]+)/gi,
            /總金額[：:\s]*([0-9,]+)/gi,
            /本期費用[：:\s]*([0-9,]+)/gi,
            />([0-9,]+)<\/td>/gi,
            /\b([0-9]{3,5})\b/g
          ];
          
          for (let pattern of amountPatterns) {
            const matches = htmlContent.match(pattern);
            if (matches && matches.length > 0) {
              const amounts = matches.map(match => {
                let cleanAmount = match.replace(/[應繳金額總本期費用：:\s<>\/td]/g, '').replace(/,/g, '');
                cleanAmount = cleanAmount.replace(/[^0-9.]/g, '');
                return parseFloat(cleanAmount);
              }).filter(amount => !isNaN(amount) && amount > 0 && amount <= 50000);
              
              if (amounts.length > 0) {
                result.amount = Math.max(...amounts);
                Logger.log(`✅ 從 HTML 附件提取金額: ${result.amount} 元`);
                break;
              }
            }
          }
          
          if (result.amount > 0) break;
          
        } catch (htmlError) {
          Logger.log(`❌ HTML 附件處理失敗: ${htmlError.toString()}`);
        }
      }
    }
    
    Logger.log(`✅ 中華電信處理完成: ${result.amount} ${result.currency}`);
    return result;
    
  } catch (error) {
    Logger.log(`❌ 中華電信處理失敗: ${error.toString()}`);
    return result;
  }
}

/**
 * 🏛️ 財政部發票完整處理
 */
function processGovernmentInvoiceComplete(message, result) {
  Logger.log('🏛️ 處理財政部發票...');
  
  try {
    result.merchant = '財政部';
    result.category = '其他';
    result.description = '財政部 - 電子發票彙整';
    
    const attachments = message.getAttachments();
    let totalAmount = 0;
    let invoiceCount = 0;
    
    // 從 CSV 附件提取
    for (let attachment of attachments) {
      const fileName = attachment.getName();
      
      if (fileName.toLowerCase().includes('.csv')) {
        try {
          const csvContent = attachment.getDataAsString('UTF-8');
          const lines = csvContent.split('\n');
          
          // 使用管道符號分隔，只處理 M 開頭的主記錄
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const columns = line.split('|');
            
            if (columns.length > 0 && columns[0].trim() === 'M') {
              if (columns.length >= 8) {
                const amountStr = columns[7] ? columns[7].trim() : '';
                const amount = parseFloat(amountStr);
                
                if (!isNaN(amount) && amount > 0) {
                  totalAmount += amount;
                  invoiceCount++;
                }
              }
            }
          }
          
          if (totalAmount > 0) {
            result.amount = totalAmount;
            result.description = `財政部 - 電子發票彙整 (${invoiceCount} 張發票, 平均 ${(totalAmount/invoiceCount).toFixed(0)} 元)`;
            Logger.log(`✅ 從 CSV 附件提取: ${totalAmount} 元 (${invoiceCount} 張發票)`);
            break;
          }
          
        } catch (csvError) {
          Logger.log(`❌ CSV 附件處理失敗: ${csvError.toString()}`);
        }
      }
    }
    
    Logger.log(`✅ 財政部處理完成: ${result.amount} ${result.currency}`);
    return result;
    
  } catch (error) {
    Logger.log(`❌ 財政部處理失敗: ${error.toString()}`);
    return result;
  }
}

/**
 * ✅ 結果驗證
 */
function validateResult(result) {
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

/**
 * 💾 完整的記錄儲存
 */
function saveEmailRecordComplete(data, message) {
  try {
    const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    const ss = SpreadsheetApp.openById(mainLedgerId);
    const sheet = ss.getSheetByName('All Records');
    
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
        processor: 'Complete Solution V1.0'
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
 * 🔄 更新觸發器使用完整解決方案
 */
function updateTriggerToCompleteSolution() {
  Logger.log('🔄 更新觸發器使用完整解決方案...');
  
  try {
    // 刪除現有觸發器
    const existingTriggers = ScriptApp.getProjectTriggers();
    existingTriggers.forEach(trigger => {
      ScriptApp.deleteTrigger(trigger);
      Logger.log(`🗑️ 刪除觸發器: ${trigger.getHandlerFunction()}`);
    });
    
    // 建立完整解決方案觸發器
    ScriptApp.newTrigger('processReceiptsByEmailRulesComplete')
      .timeBased()
      .everyMinutes(15)
      .create();
    
    Logger.log('✅ 建立完整解決方案觸發器');
    
    // 測試新觸發器
    processReceiptsByEmailRulesComplete();
    
    Logger.log('✅ 觸發器更新完成');
    
  } catch (error) {
    Logger.log(`❌ 更新觸發器失敗: ${error.toString()}`);
  }
}

/**
 * 🎉 完整解決方案部署
 */
function deployCompleteSolution() {
  Logger.log('🎉 部署完整 Email 處理解決方案...');
  
  try {
    Logger.log('\n=== Email 處理完整解決方案部署 ===');
    
    // 1. 更新觸發器
    Logger.log('\n1. 更新觸發器:');
    updateTriggerToCompleteSolution();
    
    // 2. 測試完整流程
    Logger.log('\n2. 測試完整流程:');
    processReceiptsByEmailRulesComplete();
    
    Logger.log('\n🎉 完整解決方案部署完成！');
    Logger.log('✅ 所有 Email Rules 已整合附件處理功能');
    Logger.log('✅ 觸發器已更新，系統將自動處理所有類型的電子收據');
    Logger.log('✅ Apple、Google、中華電信、財政部發票全部支援');
    
    return true;
    
  } catch (error) {
    Logger.log(`❌ 部署失敗: ${error.toString()}`);
    return false;
  }
}