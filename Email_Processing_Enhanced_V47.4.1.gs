// =================================================================================================
// Email 處理系統 V47.4.1 - 整合台北自來水帳單 HTML 內文處理
// 版本：V47.4.1 - 2025-08-05
// 新增：台北自來水事業處電子帳單 HTML 內文直接解析功能
// =================================================================================================

/**
 * 🔄 V47.4.1 增強版 Email 自動處理主函數
 * 整合了台北自來水帳單 HTML 內文處理功能
 */
function processAutomatedEmailsV47_4_1() {
  return withPhase4ErrorHandling(() => {
    Logger.log('🔄 === V47.4.1 增強版 Email 自動處理開始 ===');
    
    try {
      // 獲取 Email Rules 配置
      const emailRules = getEmailRulesFromSheet();
      if (!emailRules || emailRules.length === 0) {
        Logger.log('⚠️ 沒有找到 Email 處理規則');
        return false;
      }
      
      Logger.log(`📋 載入了 ${emailRules.length} 條 Email 處理規則`);
      
      // 處理各種類型的郵件
      let processedCount = 0;
      
      // 1. 處理台北自來水帳單（新增）
      processedCount += processWaterBillEmails();
      
      // 2. 處理財政部電子發票
      processedCount += processGovernmentInvoiceEmails();
      
      // 3. 處理其他規則型郵件
      processedCount += processRuleBasedEmails(emailRules);
      
      Logger.log(`✅ === V47.4.1 Email 處理完成，共處理 ${processedCount} 封郵件 ===`);
      return processedCount > 0;
      
    } catch (error) {
      Logger.log(`❌ V47.4.1 Email 處理失敗: ${error.toString()}`);
      sendNotification('Email 自動處理失敗', error.toString(), 'ERROR');
      return false;
    }
  }, {}, 'processAutomatedEmailsV47_4_1');
}

/**
 * 🚰 處理台北自來水事業處電子帳單（新增功能）
 */
function processWaterBillEmails() {
  Logger.log('🚰 === 開始處理台北自來水事業處電子帳單 ===');
  
  try {
    // 搜尋台北自來水的郵件
    const searchQuery = 'from:ebill@water.gov.taipei subject:(臺北自來水事業處 OR 水費 OR 電子帳單) is:unread';
    const threads = GmailApp.search(searchQuery, 0, 10);
    
    Logger.log(`🔍 找到 ${threads.length} 封台北自來水帳單郵件`);
    
    let processedCount = 0;
    
    for (const thread of threads) {
      const messages = thread.getMessages();
      
      for (const message of messages) {
        try {
          Logger.log(`📧 處理郵件: ${message.getSubject()}`);
          
          // 獲取 HTML 內容
          const htmlBody = message.getBody();
          const subject = message.getSubject();
          const receivedDate = message.getDate();
          
          if (!htmlBody) {
            Logger.log('⚠️ 郵件沒有 HTML 內容，跳過');
            continue;
          }
          
          // 使用專門的水費帳單解析器
          const accountingData = parseWaterBillHtmlContent(htmlBody, subject, receivedDate);
          
          if (accountingData && accountingData.amount > 0) {
            // 寫入到 Google Sheets
            const writeSuccess = writeToSheet(accountingData, 'email_water_bill');
            
            if (writeSuccess) {
              // 標記為已讀
              message.markRead();
              processedCount++;
              
              Logger.log(`✅ 台北自來水帳單處理成功: ${accountingData.amount} 元`);
              
              // 發送通知
              sendNotification(
                '台北自來水帳單自動記帳', 
                `金額: ${accountingData.amount} 元\n項目: ${accountingData.item}\n日期: ${accountingData.date}`, 
                'INFO'
              );
            } else {
              Logger.log('❌ 寫入 Sheets 失敗');
            }
          } else {
            Logger.log('⚠️ 無法從 HTML 內容提取有效的帳單信息');
          }
          
        } catch (messageError) {
          Logger.log(`❌ 處理單封郵件失敗: ${messageError.toString()}`);
        }
      }
    }
    
    Logger.log(`🚰 台北自來水帳單處理完成，共處理 ${processedCount} 封`);
    return processedCount;
    
  } catch (error) {
    Logger.log(`❌ 台北自來水帳單處理失敗: ${error.toString()}`);
    return 0;
  }
}

/**
 * 🏛️ 處理財政部電子發票郵件
 */
function processGovernmentInvoiceEmails() {
  Logger.log('🏛️ === 開始處理財政部電子發票 ===');
  
  try {
    const searchQuery = 'from:einvoice@einvoice.nat.gov.tw subject:彙整 is:unread';
    const threads = GmailApp.search(searchQuery, 0, 5);
    
    Logger.log(`🔍 找到 ${threads.length} 封財政部電子發票郵件`);
    
    let processedCount = 0;
    
    for (const thread of threads) {
      const messages = thread.getMessages();
      
      for (const message of messages) {
        try {
          Logger.log(`📧 處理財政部發票: ${message.getSubject()}`);
          
          let result = {
            date: Utilities.formatDate(message.getDate(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
            amount: 0,
            currency: 'TWD',
            category: '其他',
            item: '財政部 - 電子發票彙整',
            merchant: '財政部',
            source: 'email_government_invoice'
          };
          
          // 使用修復版的財政部發票處理器
          result = processGovernmentEInvoiceFinal(message, result);
          
          if (result.amount > 0) {
            const writeSuccess = writeToSheet(result, 'email_government_invoice');
            
            if (writeSuccess) {
              message.markRead();
              processedCount++;
              
              Logger.log(`✅ 財政部發票處理成功: ${result.amount} 元`);
              
              sendNotification(
                '財政部電子發票自動記帳', 
                `金額: ${result.amount} 元\n描述: ${result.item}`, 
                'INFO'
              );
            }
          }
          
        } catch (messageError) {
          Logger.log(`❌ 處理財政部發票失敗: ${messageError.toString()}`);
        }
      }
    }
    
    Logger.log(`🏛️ 財政部電子發票處理完成，共處理 ${processedCount} 封`);
    return processedCount;
    
  } catch (error) {
    Logger.log(`❌ 財政部電子發票處理失敗: ${error.toString()}`);
    return 0;
  }
}

/**
 * 📋 處理基於規則的其他郵件
 */
function processRuleBasedEmails(emailRules) {
  Logger.log('📋 === 開始處理規則型郵件 ===');
  
  try {
    let processedCount = 0;
    
    for (const rule of emailRules) {
      if (!rule.enabled || rule.senderEmail === 'ebill@water.gov.taipei') {
        // 跳過已停用的規則和水費帳單（已單獨處理）
        continue;
      }
      
      try {
        const searchQuery = `from:${rule.senderEmail} is:unread`;
        const threads = GmailApp.search(searchQuery, 0, 5);
        
        if (threads.length > 0) {
          Logger.log(`📧 處理規則: ${rule.name} (${threads.length} 封郵件)`);
          
          for (const thread of threads) {
            const messages = thread.getMessages();
            
            for (const message of messages) {
              try {
                const result = processEmailByRule(message, rule);
                
                if (result && result.amount > 0) {
                  const writeSuccess = writeToSheet(result, 'email_rule_based');
                  
                  if (writeSuccess) {
                    message.markRead();
                    processedCount++;
                    
                    Logger.log(`✅ 規則型郵件處理成功: ${rule.name} - ${result.amount} 元`);
                  }
                }
                
              } catch (messageError) {
                Logger.log(`❌ 規則型郵件處理失敗: ${messageError.toString()}`);
              }
            }
          }
        }
        
      } catch (ruleError) {
        Logger.log(`❌ 規則處理失敗 (${rule.name}): ${ruleError.toString()}`);
      }
    }
    
    Logger.log(`📋 規則型郵件處理完成，共處理 ${processedCount} 封`);
    return processedCount;
    
  } catch (error) {
    Logger.log(`❌ 規則型郵件處理失敗: ${error.toString()}`);
    return 0;
  }
}

/**
 * 📊 根據規則處理單封郵件
 */
function processEmailByRule(message, rule) {
  try {
    const result = {
      date: Utilities.formatDate(message.getDate(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      amount: 0,
      currency: rule.currency || 'TWD',
      category: rule.category || '其他',
      item: rule.defaultItem || '郵件自動記帳',
      merchant: rule.merchant || '未知商家',
      source: 'email_rule_based'
    };
    
    // 根據規則類型處理
    if (rule.processingMethod === 'attachment_pdf') {
      // 處理 PDF 附件
      result.amount = extractAmountFromPdfAttachment(message);
    } else if (rule.processingMethod === 'html_content') {
      // 處理 HTML 內容
      result.amount = extractAmountFromHtmlContent(message);
    } else {
      // 預設：從郵件內容提取
      result.amount = extractAmountFromEmailContent(message);
    }
    
    return result;
    
  } catch (error) {
    Logger.log(`❌ 規則處理失敗: ${error.toString()}`);
    return null;
  }
}

/**
 * 💰 從 HTML 內容提取金額（通用方法）
 */
function extractAmountFromHtmlContent(message) {
  try {
    const htmlBody = message.getBody();
    const textContent = htmlBody.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    
    const amountPatterns = [
      /金額[：:\s]*([0-9,]+)\s*元/,
      /應繳[：:\s]*([0-9,]+)\s*元/,
      /總計[：:\s]*([0-9,]+)\s*元/,
      /合計[：:\s]*([0-9,]+)\s*元/,
      /NT\$\s*([0-9,]+)/,
      /\$([0-9,]+)/
    ];
    
    for (const pattern of amountPatterns) {
      const match = textContent.match(pattern);
      if (match) {
        const amount = parseInt(match[1].replace(/,/g, ''));
        if (amount > 0 && amount < 1000000) {
          return amount;
        }
      }
    }
    
    return 0;
    
  } catch (error) {
    Logger.log(`❌ HTML 內容金額提取失敗: ${error.toString()}`);
    return 0;
  }
}

/**
 * 💰 從郵件內容提取金額（通用方法）
 */
function extractAmountFromEmailContent(message) {
  try {
    const plainBody = message.getPlainBody();
    const htmlBody = message.getBody();
    const textToSearch = plainBody || htmlBody.replace(/<[^>]*>/g, ' ');
    
    const amountPatterns = [
      /([0-9,]{1,8})\s*元/g,
      /NT\$\s*([0-9,]+)/g,
      /\$([0-9,]+)/g,
      /金額[：:\s]*([0-9,]+)/g
    ];
    
    let extractedAmounts = [];
    
    for (const pattern of amountPatterns) {
      const matches = textToSearch.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const cleanAmount = match.replace(/[^0-9]/g, '');
          const amount = parseFloat(cleanAmount);
          
          if (!isNaN(amount) && amount >= 1 && amount <= 500000) {
            extractedAmounts.push(amount);
          }
        });
      }
    }
    
    if (extractedAmounts.length > 0) {
      return Math.max(...extractedAmounts);
    }
    
    return 0;
    
  } catch (error) {
    Logger.log(`❌ 郵件內容金額提取失敗: ${error.toString()}`);
    return 0;
  }
}

/**
 * 💰 從 PDF 附件提取金額
 */
function extractAmountFromPdfAttachment(message) {
  try {
    const attachments = message.getAttachments();
    
    for (const attachment of attachments) {
      const fileName = attachment.getName().toLowerCase();
      
      if (fileName.includes('.pdf')) {
        Logger.log(`📄 發現 PDF 附件: ${fileName}`);
        
        // 注意：對於需要密碼的 PDF（如台北自來水），這裡會失敗
        // 這就是為什麼我們要用 HTML 內文處理的原因
        try {
          // 這裡可以實作 PDF 解析邏輯
          // 但對於加密的 PDF，會失敗
          Logger.log('⚠️ PDF 可能需要密碼，建議使用 HTML 內文處理');
          return 0;
        } catch (pdfError) {
          Logger.log(`❌ PDF 處理失敗（可能需要密碼）: ${pdfError.toString()}`);
          return 0;
        }
      }
    }
    
    return 0;
    
  } catch (error) {
    Logger.log(`❌ PDF 附件處理失敗: ${error.toString()}`);
    return 0;
  }
}

/**
 * 📋 從 Google Sheets 獲取 Email 處理規則
 */
function getEmailRulesFromSheet() {
  try {
    const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
    const emailRulesSheet = ss.getSheetByName(EMAIL_RULES_SHEET_NAME);
    
    if (!emailRulesSheet) {
      Logger.log(`⚠️ 找不到 Email Rules 工作表: ${EMAIL_RULES_SHEET_NAME}`);
      return [];
    }
    
    const data = emailRulesSheet.getDataRange().getValues();
    const rules = [];
    
    // 跳過標題行
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      if (row[0] && row[4] !== false) { // 寄件者存在且未停用
        rules.push({
          senderEmail: row[0],
          keywords: row[1] || '',
          category: row[2] || '其他',
          processingMethod: row[3] || 'email_content',
          enabled: row[4] !== false,
          name: row[5] || row[0],
          processingType: row[6] || 'email_content',
          specialFlags: row[7] || ''
        });
      }
    }
    
    return rules;
    
  } catch (error) {
    Logger.log(`❌ 獲取 Email 規則失敗: ${error.toString()}`);
    return [];
  }
}

/**
 * 🧪 測試 V47.4.1 Email 處理系統
 */
function testEmailProcessingV47_4_1() {
  Logger.log('🧪 === 測試 V47.4.1 Email 處理系統 ===');
  
  try {
    // 1. 測試台北自來水帳單處理
    Logger.log('🚰 測試台北自來水帳單處理...');
    testWaterBillParsing();
    
    // 2. 測試完整的 Email 處理流程
    Logger.log('📧 測試完整 Email 處理流程...');
    const processedCount = processAutomatedEmailsV47_4_1();
    
    Logger.log(`✅ 測試完成，處理了 ${processedCount} 封郵件`);
    
    if (processedCount > 0) {
      Logger.log('🎉 V47.4.1 Email 處理系統測試成功！');
    } else {
      Logger.log('⚠️ 沒有找到需要處理的郵件');
    }
    
  } catch (error) {
    Logger.log(`❌ 測試失敗: ${error.toString()}`);
  }
  
  Logger.log('=== V47.4.1 Email 處理系統測試結束 ===');
}

/**
 * 🔧 設定 V47.4.1 Email 處理觸發器
 */
function setupEmailProcessingTriggerV47_4_1() {
  Logger.log('🔧 設定 V47.4.1 Email 處理觸發器...');
  
  try {
    // 刪除舊的觸發器
    const existingTriggers = ScriptApp.getProjectTriggers();
    existingTriggers.forEach(trigger => {
      const functionName = trigger.getHandlerFunction();
      if (functionName.includes('processAutomatedEmails') || 
          functionName.includes('processReceiptsByEmailRules')) {
        ScriptApp.deleteTrigger(trigger);
        Logger.log(`🗑️ 刪除舊觸發器: ${functionName}`);
      }
    });
    
    // 建立新的 V47.4.1 觸發器
    ScriptApp.newTrigger('processAutomatedEmailsV47_4_1')
      .timeBased()
      .everyMinutes(15)
      .create();
    
    Logger.log('✅ V47.4.1 Email 處理觸發器已建立（每15分鐘執行一次）');
    
    // 測試觸發器
    Logger.log('🧪 測試新觸發器...');
    processAutomatedEmailsV47_4_1();
    
    Logger.log('🎉 V47.4.1 Email 處理系統已完全設定完成！');
    
  } catch (error) {
    Logger.log(`❌ 觸發器設定失敗: ${error.toString()}`);
  }
}

// =================================================================================================
// 【V47.4.1 新增】台北自來水帳單專用 Email Rules 自動設定
// =================================================================================================

/**
 * 🚰 自動添加台北自來水帳單處理規則到 Email Rules
 */
function addWaterBillRuleToEmailRules() {
  Logger.log('🚰 自動添加台北自來水帳單處理規則...');
  
  try {
    const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
    let emailRulesSheet = ss.getSheetByName(EMAIL_RULES_SHEET_NAME);
    
    // 如果 Email Rules 工作表不存在，創建它
    if (!emailRulesSheet) {
      emailRulesSheet = ss.insertSheet(EMAIL_RULES_SHEET_NAME);
      
      // 添加標題行
      emailRulesSheet.appendRow([
        'Sender Email',
        'Keywords', 
        'Category',
        'Processing Method',
        'Enabled',
        'Rule Name',
        'Processing Type',
        'Special Flags'
      ]);
      
      Logger.log(`✅ 創建了新的 Email Rules 工作表`);
    }
    
    // 檢查是否已存在台北自來水規則
    const existingData = emailRulesSheet.getDataRange().getValues();
    const waterRuleExists = existingData.some(row => 
      row[0] && row[0].includes('ebill@water.gov.taipei')
    );
    
    if (!waterRuleExists) {
      // 添加台北自來水帳單規則
      const waterBillRule = [
        'ebill@water.gov.taipei',                    // Sender Email
        '臺北自來水事業處,水費,電子帳單',              // Keywords
        '住',                                       // Category
        'html_content_extraction',                  // Processing Method
        true,                                       // Enabled
        '台北自來水事業處電子帳單',                   // Rule Name
        'html_content',                             // Processing Type
        'skip_pdf_attachments'                      // Special Flags
      ];
      
      emailRulesSheet.appendRow(waterBillRule);
      Logger.log('✅ 台北自來水帳單規則已添加到 Email Rules');
    } else {
      Logger.log('ℹ️ 台北自來水帳單規則已存在，跳過添加');
    }
    
    // 同時添加其他常見的帳單規則（如果不存在）
    const commonRules = [
      [
        'einvoice@einvoice.nat.gov.tw',
        '電子發票,彙整',
        '其他',
        'csv_attachment',
        true,
        '財政部電子發票彙整',
        'attachment_csv',
        'government_invoice'
      ]
    ];
    
    for (const rule of commonRules) {
      const ruleExists = existingData.some(row => 
        row[0] && row[0].includes(rule[0])
      );
      
      if (!ruleExists) {
        emailRulesSheet.appendRow(rule);
        Logger.log(`✅ 添加規則: ${rule[5]}`);
      }
    }
    
    Logger.log('🎉 Email Rules 設定完成！');
    return true;
    
  } catch (error) {
    Logger.log(`❌ Email Rules 設定失敗: ${error.toString()}`);
    return false;
  }
}

/**
 * 🎯 V47.4.1 完整設定流程
 * 一鍵設定所有 Email 處理功能，包括台北自來水帳單
 */
function setupCompleteEmailSystemV47_4_1() {
  Logger.log('🎯 === V47.4.1 完整 Email 系統設定開始 ===');
  
  try {
    // 1. 添加 Email Rules
    Logger.log('📋 步驟 1: 設定 Email Rules...');
    const rulesSuccess = addWaterBillRuleToEmailRules();
    
    if (!rulesSuccess) {
      throw new Error('Email Rules 設定失敗');
    }
    
    // 2. 設定觸發器
    Logger.log('⏰ 步驟 2: 設定觸發器...');
    setupEmailProcessingTriggerV47_4_1();
    
    // 3. 測試系統
    Logger.log('🧪 步驟 3: 測試系統...');
    testEmailProcessingV47_4_1();
    
    Logger.log('🎉 === V47.4.1 完整 Email 系統設定完成 ===');
    Logger.log('✅ 台北自來水帳單 HTML 內文處理功能已啟用');
    Logger.log('✅ 財政部電子發票處理功能已啟用');
    Logger.log('✅ 自動觸發器已設定（每15分鐘執行一次）');
    Logger.log('✅ 系統測試已完成');
    
    // 發送設定完成通知
    sendNotification(
      'V47.4.1 Email 系統設定完成',
      '台北自來水帳單 HTML 內文處理功能已啟用\n系統將自動處理 ebill@water.gov.taipei 的郵件',
      'INFO'
    );
    
    return true;
    
  } catch (error) {
    Logger.log(`❌ V47.4.1 Email 系統設定失敗: ${error.toString()}`);
    sendNotification('Email 系統設定失敗', error.toString(), 'ERROR');
    return false;
  }
}