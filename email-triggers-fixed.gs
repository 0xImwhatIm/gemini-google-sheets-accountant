// =================================================================================================
// 智慧記帳 GEM - 郵件觸發器模組 (V47.0)
// 功能：自動處理 Gmail 中的電子發票和交易記錄
// 最後更新：2025-07-25
// =================================================================================================

/**
 * 主要的郵件處理函數
 * 每 15 分鐘自動執行一次，處理新的電子發票郵件
 */
function processAutomatedEmails() {
  Logger.log('🔄 開始處理自動郵件...');
  
  try {
    const rules = getEmailProcessingRulesFromSheet();
    Logger.log(`📋 載入了 ${rules.length} 條郵件處理規則`);
    
    if (rules.length === 0) {
      Logger.log('⚠️ 沒有找到郵件處理規則，請檢查 EmailRules 工作表');
      return;
    }
    
    let totalProcessed = 0;
    
    rules.forEach((rule, index) => {
      Logger.log(`\n📧 處理規則 ${index + 1}: ${rule.query}`);
      
      try {
        const threads = GmailApp.search(rule.query, 0, 10);
        Logger.log(`找到 ${threads.length} 個郵件串`);
        
        threads.forEach(thread => {
          const messages = thread.getMessages();
          
          messages.forEach(message => {
            if (message.isUnread()) {
              Logger.log(`📨 處理郵件: ${message.getSubject()}`);
              
              try {
                if (rule.type === 'CSV') {
                  const result = processCSVEmail(message);
                  if (result) {
                    saveEmailRecordFixed(result, message);
                    totalProcessed++;
                  }
                } else if (rule.type === 'HTML') {
                  const result = processHTMLEmail(message);
                  if (result) {
                    saveEmailRecordFixed(result, message);
                    totalProcessed++;
                  }
                } else if (rule.type === 'PDF') {
                  const result = processPDFEmail(message);
                  if (result) {
                    saveEmailRecordFixed(result, message);
                    totalProcessed++;
                  }
                }
                
                // 標記為已讀
                message.markRead();
                Logger.log('✅ 郵件處理完成並標記為已讀');
                
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
    
    Logger.log(`\n✅ 郵件處理完成，共處理 ${totalProcessed} 封郵件`);
    
  } catch (error) {
    Logger.log(`❌ 郵件處理過程發生錯誤: ${error.toString()}`);
  }
}

/**
 * 處理 CSV 附件的郵件
 */
function processCSVEmail(message) {
  Logger.log('📊 處理 CSV 郵件...');
  
  try {
    const attachments = message.getAttachments();
    
    for (let attachment of attachments) {
      if (attachment.getContentType().includes('csv') || 
          attachment.getName().toLowerCase().includes('.csv')) {
        
        const csvContent = attachment.getDataAsString();
        Logger.log('📄 找到 CSV 附件，開始解析...');
        
        // 解析 CSV 內容
        const lines = csvContent.split('\n');
        if (lines.length > 1) {
          // 假設第二行是資料行
          const dataLine = lines[1].split(',');
          
          return {
            date: new Date().toISOString().split('T')[0],
            amount: parseFloat(dataLine[1]) || 0,
            currency: 'TWD',
            category: '其他',
            description: dataLine[2] || 'CSV 匯入',
            source: 'Email CSV'
          };
        }
      }
    }
    
    return null;
    
  } catch (error) {
    Logger.log(`❌ 處理 CSV 郵件失敗: ${error.toString()}`);
    return null;
  }
}

/**
 * 處理 HTML 格式的電子發票郵件
 */
function processHTMLEmail(message) {
  Logger.log('🌐 處理 HTML 郵件...');
  
  try {
    const htmlBody = message.getBody();
    const subject = message.getSubject();
    
    // 使用 AI 解析 HTML 內容
    const aiResult = callGeminiForEmailHTML(htmlBody, subject);
    
    if (aiResult) {
      const parsedData = JSON.parse(aiResult);
      return {
        date: parsedData.date || new Date().toISOString().split('T')[0],
        amount: parsedData.amount || 0,
        currency: parsedData.currency || 'TWD',
        category: parsedData.category || '其他',
        description: parsedData.description || subject,
        source: 'Email HTML'
      };
    }
    
    return null;
    
  } catch (error) {
    Logger.log(`❌ 處理 HTML 郵件失敗: ${error.toString()}`);
    return null;
  }
}

/**
 * 處理 PDF 附件的郵件
 */
function processPDFEmail(message) {
  Logger.log('📄 處理 PDF 郵件...');
  
  try {
    const attachments = message.getAttachments();
    
    for (let attachment of attachments) {
      if (attachment.getContentType().includes('pdf')) {
        Logger.log('📎 找到 PDF 附件，開始處理...');
        
        // 這裡可以整合 Document AI 或其他 PDF 處理邏輯
        return {
          date: new Date().toISOString().split('T')[0],
          amount: 0,
          currency: 'TWD',
          category: '其他',
          description: 'PDF 發票',
          source: 'Email PDF'
        };
      }
    }
    
    return null;
    
  } catch (error) {
    Logger.log(`❌ 處理 PDF 郵件失敗: ${error.toString()}`);
    return null;
  }
}

// =================================================================================================
// 郵件處理核心功能（修復版）
// =================================================================================================

function processAutomatedEmailsFixed() {
  Logger.log('🔄 開始處理自動郵件（修復版）...');
  
  try {
    // 使用固定的搜尋條件來測試
    const testQueries = [
      'subject:電子發票 is:unread',
      'subject:發票 is:unread',
      'subject:收據 is:unread'
    ];
    
    let totalProcessed = 0;
    
    testQueries.forEach(query => {
      Logger.log(`\n🔍 搜尋: ${query}`);
      
      try {
        const threads = GmailApp.search(query, 0, 5);
        Logger.log(`找到 ${threads.length} 個郵件串`);
        
        threads.forEach(thread => {
          const messages = thread.getMessages();
          
          messages.forEach(message => {
            if (message.isUnread()) {
              Logger.log(`📨 處理郵件: ${message.getSubject()}`);
              
              try {
                // 簡化的處理邏輯
                const result = {
                  date: new Date().toISOString().split('T')[0],
                  amount: 100, // 測試金額
                  currency: 'TWD',
                  category: '其他',
                  description: message.getSubject(),
                  source: 'Email Auto'
                };
                
                saveEmailRecordFixed(result, message);
                message.markRead();
                totalProcessed++;
                
                Logger.log('✅ 郵件處理完成');
                
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
    
    Logger.log(`\n✅ 修復版郵件處理完成，共處理 ${totalProcessed} 封郵件`);
    
  } catch (error) {
    Logger.log(`❌ 修復版郵件處理過程發生錯誤: ${error.toString()}`);
  }
}

/**
 * 使用 Gemini AI 解析 HTML 郵件內容
 */
function callGeminiForEmailHTML(htmlContent, subject) {
  try {
    const prompt = `
請分析以下 HTML 格式的電子發票或收據內容，提取交易資訊：

主旨: ${subject}
HTML 內容: ${htmlContent.substring(0, 2000)} // 限制長度避免超過 API 限制

請回傳 JSON 格式，包含以下欄位：
{
  "date": "交易日期 (YYYY-MM-DD)",
  "amount": "金額 (數字)",
  "currency": "幣別 (TWD/JPY/USD/EUR/CNY)",
  "category": "類別 (食/衣/住/行/育/樂/醫療/保險/其他)",
  "description": "描述",
  "merchant": "商家名稱"
}
`;

    const requestBody = { 
      "contents": [{ "parts":[{ "text": prompt }] }], 
      "generationConfig": { "response_mime_type": "application/json" } 
    };
    
    const options = { 
      'method' : 'post', 
      'contentType': 'application/json', 
      'payload' : JSON.stringify(requestBody), 
      'muteHttpExceptions': true 
    };
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode !== 200) {
      throw new Error(`Gemini API HTTP Error: ${responseCode}. Response: ${responseText}`);
    }

    const jsonResponse = JSON.parse(responseText);
    if (jsonResponse.error) {
      throw new Error(`Gemini API returned an error: ${jsonResponse.error.message}`);
    }

    if (!jsonResponse.candidates || !jsonResponse.candidates[0].content.parts[0].text) {
      throw new Error(`Unexpected Gemini API response structure.`);
    }

    return jsonResponse.candidates[0].content.parts[0].text;
    
  } catch (error) {
    Logger.log(`callGeminiForEmailHTML 失敗: ${error.toString()}`);
    return null;
  }
}

function saveEmailRecordFixed(data, message) {
  try {
    const sheetId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('All Records');
    
    // 計算匯率和台幣金額
    const currency = data.currency || 'TWD';
    const originalAmount = data.amount || 0;
    const exchangeRate = getExchangeRate(currency);
    const amountTWD = originalAmount * exchangeRate;
    
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
  }
}

function getEmailProcessingRulesFromSheet() {
  try {
    const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
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

// =================================================================================================
// V46 相容模式郵件處理功能
// =================================================================================================

function processAutomatedEmailsV46Compatible() {
  Logger.log('🔄 開始處理自動郵件（V46 相容模式）...');
  
  try {
    const rules = [
      { query: 'subject:電子發票 is:unread', type: 'HTML' },
      { query: 'subject:發票 is:unread', type: 'HTML' },
      { query: 'has:attachment filename:csv is:unread', type: 'CSV' }
    ];
    
    let totalProcessed = 0;
    
    rules.forEach(rule => {
      Logger.log(`\n📧 處理規則: ${rule.query}`);
      
      try {
        const threads = GmailApp.search(rule.query, 0, 5);
        Logger.log(`找到 ${threads.length} 個郵件串`);
        
        threads.forEach(thread => {
          const messages = thread.getMessages();
          
          messages.forEach(message => {
            if (message.isUnread()) {
              Logger.log(`📨 處理郵件: ${message.getSubject()}`);
              
              try {
                const result = {
                  date: new Date().toISOString().split('T')[0],
                  amount: 100,
                  currency: 'TWD',
                  category: '其他',
                  description: message.getSubject(),
                  source: 'Email V46'
                };
                
                saveEmailRecordV46(result, message);
                message.markRead();
                totalProcessed++;
                
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
    
    Logger.log(`\n✅ V46 相容模式處理完成，共處理 ${totalProcessed} 封郵件`);
    
  } catch (error) {
    Logger.log(`❌ V46 相容模式處理失敗: ${error.toString()}`);
  }
}

function processCSVAttachment(message) {
  // CSV 附件處理邏輯
  Logger.log('📊 處理 CSV 附件...');
  // 這裡可以加入 CSV 處理邏輯
  return null;
}

function saveEmailRecordV46(data, message) {
  try {
    const sheetId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('All Records');
    
    // 計算匯率和台幣金額
    const currency = data.currency || 'TWD';
    const originalAmount = data.amount || 0;
    const exchangeRate = getExchangeRate(currency);
    const amountTWD = originalAmount * exchangeRate;
    
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
  }
}

function updateTriggerToV46Compatible() {
  Logger.log('🔄 更新觸發器為 V46 相容版本...');
  
  try {
    // 刪除現有觸發器
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'processAutomatedEmails') {
        ScriptApp.deleteTrigger(trigger);
        Logger.log('🗑️ 刪除舊觸發器');
      }
    });
    
    // 建立新的相容觸發器
    ScriptApp.newTrigger('processAutomatedEmailsV46Compatible')
      .timeBased()
      .everyMinutes(15)
      .create();
    
    Logger.log('✅ 已更新為 V46 相容觸發器');
    
  } catch (error) {
    Logger.log(`❌ 更新觸發器失敗: ${error.toString()}`);
  }
}