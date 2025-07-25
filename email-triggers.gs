/**
 * 智慧記帳 GEM - 郵件觸發器管理
 * V47.0 修復版本
 */

function checkEmailTriggersFixed() {
  Logger.log('🔍 檢查現有觸發器...');
  
  try {
    // 直接從 Properties Service 讀取配置，避免 ConfigManager 問題
    const sheetId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    Logger.log('📋 使用的 Sheets ID: ' + sheetId);
    
    const triggers = ScriptApp.getProjectTriggers();
    const emailTriggers = triggers.filter(trigger => 
      trigger.getHandlerFunction() === 'processAutomatedEmails'
    );
    
    if (emailTriggers.length > 0) {
      Logger.log(`✅ 找到 ${emailTriggers.length} 個郵件處理觸發器`);
      emailTriggers.forEach((trigger, index) => {
        Logger.log(`   觸發器 ${index + 1}:`);
        Logger.log(`     類型: ${trigger.getEventType()}`);
        Logger.log(`     函數: ${trigger.getHandlerFunction()}`);
      });
    } else {
      Logger.log('❌ 沒有找到郵件處理觸發器');
      Logger.log('💡 請執行 setupEmailTriggerFixed() 來設定');
    }
    
    // 檢查所有觸發器
    Logger.log('');
    Logger.log('📋 所有專案觸發器：');
    triggers.forEach((trigger, index) => {
      Logger.log(`   ${index + 1}. 函數: ${trigger.getHandlerFunction()}`);
      Logger.log(`      類型: ${trigger.getEventType()}`);
    });
    
  } catch (error) {
    Logger.log(`❌ 檢查失敗: ${error.toString()}`);
  }
}

function setupEmailTriggerFixed() {
  Logger.log('⚙️ 設定郵件處理觸發器...');
  
  try {
    // 刪除現有的觸發器
    const triggers = ScriptApp.getProjectTriggers();
    let removedCount = 0;
    
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'processAutomatedEmails') {
        ScriptApp.deleteTrigger(trigger);
        removedCount++;
        Logger.log('🗑️ 刪除舊的觸發器');
      }
    });
    
    Logger.log(`📊 移除了 ${removedCount} 個舊觸發器`);
    
    // 建立新的觸發器（每 15 分鐘執行一次）
    const newTrigger = ScriptApp.newTrigger('processAutomatedEmails')
      .timeBased()
      .everyMinutes(15)
      .create();
    
    Logger.log('✅ 郵件處理觸發器已設定（每 15 分鐘執行一次）');
    Logger.log('🆔 觸發器 ID: ' + newTrigger.getUniqueId());
    
    // 驗證設定
    checkEmailTriggersFixed();
    
  } catch (error) {
    Logger.log(`❌ 設定觸發器失敗: ${error.toString()}`);
  }
}

function testEmailRulesFixed() {
  Logger.log('🧪 測試郵件規則設定...');
  
  try {
    // 直接從 Properties Service 讀取 Sheets ID
    const sheetId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    
    if (!sheetId) {
      Logger.log('❌ 找不到 MAIN_LEDGER_ID 配置');
      return;
    }
    
    // 檢查 EmailRules 工作表
    const ss = SpreadsheetApp.openById(sheetId);
    const rulesSheet = ss.getSheetByName('EmailRules');
    
    if (!rulesSheet) {
      Logger.log('❌ EmailRules 工作表不存在');
      Logger.log('💡 請確認您的 Google Sheets 中有 EmailRules 工作表');
      
      // 列出現有工作表
      const sheets = ss.getSheets();
      Logger.log('📋 現有工作表：');
      sheets.forEach(sheet => {
        Logger.log('   - ' + sheet.getName());
      });
      return;
    }
    
    const data = rulesSheet.getDataRange().getValues();
    Logger.log(`📊 EmailRules 工作表有 ${data.length - 1} 行資料`);
    
    if (data.length <= 1) {
      Logger.log('⚠️ EmailRules 工作表沒有規則資料');
      Logger.log('💡 請在 EmailRules 工作表中添加郵件處理規則');
      return;
    }
    
    // 顯示規則
    const headers = data[0];
    Logger.log('📋 標題列: ' + headers.join(' | '));
    Logger.log('');
    Logger.log('📋 郵件處理規則：');
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0]) { // 如果有規則名稱
        Logger.log(`${i}. ${row[0]} (${row[5] ? '啟用' : '停用'})`);
        Logger.log(`   寄件者: ${row[1] || '未設定'}`);
        Logger.log(`   主旨: ${row[2] || '未設定'}`);
        Logger.log(`   內容: ${row[3] || '未設定'}`);
        Logger.log(`   分類: ${row[4] || '未設定'}`);
        Logger.log(`   優先級: ${row[6] || '未設定'}`);
        Logger.log('');
      }
    }
    
  } catch (error) {
    Logger.log(`❌ 測試失敗: ${error.toString()}`);
  }
}

function removeAllEmailTriggers() {
  Logger.log('🗑️ 移除所有郵件處理觸發器...');
  
  const triggers = ScriptApp.getProjectTriggers();
  let removedCount = 0;
  
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'processAutomatedEmails') {
      ScriptApp.deleteTrigger(trigger);
      removedCount++;
    }
  });
  
  Logger.log(`✅ 已移除 ${removedCount} 個觸發器`);
}

// =================================================================================================
// 郵件處理核心功能（修復版）
// =================================================================================================

function processAutomatedEmailsFixed() {
  Logger.log('🔄 開始處理自動郵件...');
  
  try {
    // 讀取郵件處理規則
    const rules = getEmailProcessingRulesFromSheetFixed();
    if (!rules || rules.length === 0) {
      Logger.log('⚠️ 沒有找到郵件處理規則');
      return;
    }
    
    Logger.log(`📋 找到 ${rules.length} 條郵件處理規則`);
    
    // 處理每個規則
    rules.forEach((rule, index) => {
      if (!rule.IsActive) {
        Logger.log(`⏭️ 跳過未啟用的規則: ${rule.RuleName}`);
        return;
      }
      
      Logger.log(`🔍 處理規則 ${index + 1}: ${rule.RuleName}`);
      processEmailsByRuleFixed(rule);
    });
    
    Logger.log('✅ 郵件處理完成');
    
  } catch (error) {
    Logger.log(`❌ 郵件處理失敗: ${error.toString()}`);
    // 如果有 Phase4 錯誤處理，使用它
    if (typeof phase4ErrorHandler !== 'undefined') {
      phase4ErrorHandler.handleError(error, 'processAutomatedEmailsFixed');
    }
  }
}

function processEmailsByRuleFixed(rule) {
  try {
    // 建構搜尋查詢
    let searchQuery = '';
    
    if (rule.SenderPattern) {
      searchQuery += `from:${rule.SenderPattern} `;
    }
    
    if (rule.SubjectPattern) {
      searchQuery += `subject:${rule.SubjectPattern} `;
    }
    
    // 只搜尋最近 7 天的郵件
    searchQuery += 'newer_than:7d';
    
    Logger.log(`🔍 搜尋查詢: ${searchQuery}`);
    
    // 搜尋郵件
    const threads = GmailApp.search(searchQuery, 0, 10);
    Logger.log(`📧 找到 ${threads.length} 個郵件串`);
    
    threads.forEach(thread => {
      const messages = thread.getMessages();
      messages.forEach(message => {
        if (!message.isUnread()) return; // 只處理未讀郵件
        
        processEmailMessageFixed(message, rule);
      });
    });
    
  } catch (error) {
    Logger.log(`❌ 處理規則失敗 ${rule.RuleName}: ${error.toString()}`);
  }
}

function processEmailMessageFixed(message, rule) {
  try {
    const subject = message.getSubject();
    const body = message.getPlainBody();
    const htmlBody = message.getBody();
    const date = message.getDate();
    
    Logger.log(`📨 處理郵件: ${subject}`);
    
    // 使用 Gemini AI 解析郵件內容
    const extractedData = parseEmailWithGeminiFixed(subject, body, htmlBody, rule);
    
    if (extractedData) {
      // 儲存到 Google Sheets
      saveEmailRecordFixed(extractedData, message);
      
      // 標記為已讀
      message.markRead();
      
      Logger.log(`✅ 郵件處理完成: ${subject}`);
    }
    
  } catch (error) {
    Logger.log(`❌ 處理郵件失敗: ${error.toString()}`);
  }
}

function parseEmailWithGeminiFixed(subject, body, htmlBody, rule) {
  try {
    const prompt = `
請分析這封郵件並提取交易資訊：

主旨: ${subject}
內容: ${body}
分類規則: ${rule.Category}

請提取以下資訊並回傳 JSON 格式：
{
  "amount": 金額（數字），
  "currency": "幣別",
  "category": "${rule.Category}",
  "description": "交易描述",
  "date": "交易日期 (YYYY-MM-DD)",
  "source": "Email"
}

如果無法提取有效的交易資訊，請回傳 null。
`;

    // 使用現有的 Gemini API 呼叫函數
    const response = callGeminiAPI ? callGeminiAPI(prompt) : null;
    if (response) {
      return JSON.parse(response);
    }
    return null;
    
  } catch (error) {
    Logger.log(`❌ Gemini 解析失敗: ${error.toString()}`);
    return null;
  }
}

function saveEmailRecordFixed(data, message) {
  try {
    const sheetId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('All Records');
    
    const newRow = [
      data.date,
      data.amount,
      data.currency,
      data.category,
      data.description,
      data.source,
      'Active',
      message.getSubject(), // RawText
      '', // FileUrl
      '', // Translation
      JSON.stringify({
        messageId: message.getId(),
        sender: message.getFrom(),
        receivedDate: message.getDate().toISOString()
      }) // MetaData
    ];
    
    sheet.appendRow(newRow);
    Logger.log('💾 記錄已儲存到 Google Sheets');
    
  } catch (error) {
    Logger.log(`❌ 儲存記錄失敗: ${error.toString()}`);
  }
}

function getEmailProcessingRulesFromSheetFixed() {
  try {
    const sheetId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    const ss = SpreadsheetApp.openById(sheetId);
    const rulesSheet = ss.getSheetByName('EmailRules');
    
    if (!rulesSheet) {
      Logger.log('❌ EmailRules 工作表不存在');
      return [];
    }
    
    const data = rulesSheet.getDataRange().getValues();
    const headers = data[0];
    const rules = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rule = {};
      
      headers.forEach((header, index) => {
        rule[header] = row[index];
      });
      
      if (rule.RuleName) {
        rules.push(rule);
      }
    }
    
    return rules;
    
  } catch (error) {
    Logger.log(`❌ 讀取郵件規則失敗: ${error.toString()}`);
    return [];
  }
}
// =====
============================================================================================
// V46 相容模式郵件處理功能
// =================================================================================================

function processAutomatedEmailsV46Compatible() {
  Logger.log('🔄 開始處理自動郵件（V46 相容模式）...');
  
  try {
    // 讀取 V46 格式的郵件處理規則
    const rules = getEmailRulesV46Format();
    if (!rules || rules.length === 0) {
      Logger.log('⚠️ 沒有找到郵件處理規則');
      return;
    }
    
    Logger.log(`📋 找到 ${rules.length} 條郵件處理規則`);
    
    // 處理每個規則
    rules.forEach((rule, index) => {
      Logger.log(`🔍 處理規則 ${index + 1}: ${rule.Query}`);
      processEmailsByQueryV46(rule);
    });
    
    Logger.log('✅ 郵件處理完成');
    
  } catch (error) {
    Logger.log(`❌ 郵件處理失敗: ${error.toString()}`);
  }
}

function getEmailRulesV46Format() {
  try {
    const sheetId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    const ss = SpreadsheetApp.openById(sheetId);
    const rulesSheet = ss.getSheetByName('EmailRules');
    
    if (!rulesSheet) {
      Logger.log('❌ EmailRules 工作表不存在');
      return [];
    }
    
    const data = rulesSheet.getDataRange().getValues();
    const rules = [];
    
    // 跳過標題列，從第二行開始
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0]) { // 如果有查詢語法
        rules.push({
          Query: row[0],
          Type: row[1] || 'HTML',
          IsActive: true // 假設都是啟用的，您可以根據需要調整
        });
      }
    }
    
    return rules;
    
  } catch (error) {
    Logger.log(`❌ 讀取郵件規則失敗: ${error.toString()}`);
    return [];
  }
}

function processEmailsByQueryV46(rule) {
  try {
    // 直接使用您的 Gmail 搜尋語法
    const searchQuery = rule.Query;
    
    Logger.log(`🔍 搜尋查詢: ${searchQuery}`);
    
    // 搜尋郵件
    const threads = GmailApp.search(searchQuery, 0, 10);
    Logger.log(`📧 找到 ${threads.length} 個郵件串`);
    
    threads.forEach(thread => {
      const messages = thread.getMessages();
      messages.forEach(message => {
        if (!message.isUnread()) return; // 只處理未讀郵件
        
        processEmailMessageV46(message, rule);
      });
    });
    
  } catch (error) {
    Logger.log(`❌ 處理規則失敗: ${error.toString()}`);
  }
}

function processEmailMessageV46(message, rule) {
  try {
    const subject = message.getSubject();
    const body = message.getPlainBody();
    const date = message.getDate();
    
    Logger.log(`📨 處理郵件: ${subject}`);
    
    // 根據郵件類型決定處理方式
    let extractedData = null;
    
    if (rule.Type === 'PDF') {
      // 處理 PDF 附件
      extractedData = processPDFAttachment(message);
    } else if (rule.Type === 'HTML') {
      // 處理 HTML 郵件內容
      extractedData = parseHTMLEmail(message);
    } else if (rule.Type === 'CSV') {
      // 處理 CSV 附件
      extractedData = processCSVAttachment(message);
    }
    
    if (extractedData) {
      // 儲存到 Google Sheets
      saveEmailRecordV46(extractedData, message);
      
      // 標記為已讀
      message.markRead();
      
      Logger.log(`✅ 郵件處理完成: ${subject}`);
    }
    
  } catch (error) {
    Logger.log(`❌ 處理郵件失敗: ${error.toString()}`);
  }
}

function parseHTMLEmail(message) {
  try {
    const subject = message.getSubject();
    const htmlBody = message.getBody();
    const plainBody = message.getPlainBody();
    
    // 使用 Gemini AI 解析郵件內容
    const prompt = `
請分析這封郵件並提取交易資訊：

主旨: ${subject}
內容: ${plainBody}

請提取以下資訊並回傳 JSON 格式：
{
  "amount": 金額（數字，支出為正數，收入為負數），
  "currency": "幣別",
  "category": "推測的分類",
  "description": "交易描述",
  "date": "交易日期 (YYYY-MM-DD)",
  "source": "Email"
}

如果無法提取有效的交易資訊，請回傳 null。
`;

    // 使用 Gemini API
    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) {
      Logger.log('⚠️ 沒有設定 Gemini API Key，跳過 AI 解析');
      return null;
    }
    
    const response = callGeminiAPI(prompt);
    if (response) {
      return JSON.parse(response);
    }
    
    return null;
    
  } catch (error) {
    Logger.log(`❌ HTML 郵件解析失敗: ${error.toString()}`);
    return null;
  }
}

function processPDFAttachment(message) {
  // PDF 附件處理邏輯
  Logger.log('📄 處理 PDF 附件...');
  // 這裡可以加入 PDF 處理邏輯
  return null;
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
    
    const newRow = [
      data.date,
      data.amount,
      data.currency,
      data.category,
      data.description,
      data.source,
      'Active',
      message.getSubject(), // RawText
      '', // FileUrl
      '', // Translation
      JSON.stringify({
        messageId: message.getId(),
        sender: message.getFrom(),
        receivedDate: message.getDate().toISOString()
      }) // MetaData
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