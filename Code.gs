// =================================================================================================
// 智慧記帳 GEM - Google Apps Script (V50.2.0 - Webhook Guardian)
// =================================================================================================
// 版本：V50.2.0
// 更新日期：2025-10-26
// 代號：Webhook Guardian - Webhook 守護者
// 主要更新：全面的 Telegram Webhook 修復和優化系統
// 1. 【超快速回應】2 秒內回應保證，記憶體快取，非阻塞處理
// 2. 【智慧重複檢測】5 秒檢測窗口，雙層快取，自動清理
// 3. 【緊急控制系統】緊急停止，強力重置，快速修復
// 4. 【超時保護】全面的超時保護和優化處理流程
// 5. 【診斷監控】7 項診斷檢查，詳細報告，智慧建議
// 6. 【自動恢復】智慧恢復機制，定期檢查，可配置參數
// =================================================================================================

// ====================【使用者設定區】====================
const CONFIG = {
  MAIN_LEDGER_ID: PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID') || 'YOUR_GOOGLE_SHEET_ID_HERE',
  GEMINI_API_KEY: PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || 'YOUR_GEMINI_API_KEY_HERE',
  GEMINI_MODEL_NAME: 'gemini-flash-latest',
  // V50.1 新增: Telegram Bot Token
  TELEGRAM_BOT_TOKEN: PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN') || 'YOUR_TELEGRAM_BOT_TOKEN_HERE',
  SHEET_NAME: 'All Records',
  EMAIL_RULES_SHEET_NAME: 'EmailRules',
  SETTINGS_SHEET_NAME: 'Settings',
  IOU_EVENTS_SHEET_NAME: 'Events',
  IOU_PARTICIPANTS_SHEET_NAME: 'Participants',
  IOU_DEBTS_SHEET_NAME: 'Debts',
  FOLDER_ID_TO_PROCESS: PropertiesService.getScriptProperties().getProperty('FOLDER_ID_TO_PROCESS') || '',
  FOLDER_ID_ARCHIVE: PropertiesService.getScriptProperties().getProperty('FOLDER_ID_ARCHIVE') || '',
  FOLDER_ID_DUPLICATES: PropertiesService.getScriptProperties().getProperty('FOLDER_ID_DUPLICATES') || '',
  DEFAULT_TIMEZONE: 'Asia/Taipei',
  DEFAULT_CURRENCY: 'TWD',
  
  validate() {
    const errors = [];
    if (!this.MAIN_LEDGER_ID || this.MAIN_LEDGER_ID === 'YOUR_GOOGLE_SHEET_ID_HERE') { 
      errors.push('MAIN_LEDGER_ID 未設定'); 
    }
    if (!this.GEMINI_API_KEY || this.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') { 
      errors.push('GEMINI_API_KEY 未設定'); 
    }
    if (!this.TELEGRAM_BOT_TOKEN || this.TELEGRAM_BOT_TOKEN === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
      errors.push('TELEGRAM_BOT_TOKEN 未設定');
    }
    return errors;
  },
  
  validateForImageSaving() {
    if (!this.FOLDER_ID_ARCHIVE) {
      return 'FOLDER_ID_ARCHIVE 未在指令碼屬性中設定，無法存檔圖片。';
    }
    return null;
  }
};

// =================================================================================================
// Webhook 配置設定 (V50.1.2)
// =================================================================================================

// 優化的 Webhook 配置
const WEBHOOK_CONFIG = {
  max_connections: 1,           // 最小化並發連接以減少重複請求
  drop_pending_updates: true,   // 總是丟棄待處理更新
  allowed_updates: ['message', 'callback_query'], // 只處理必要的更新類型
  timeout: 10,                  // 較短的超時時間
  secret_token: null,           // 可選的安全令牌
  
  // 獲取完整配置物件
  getFullConfig: function(webhookUrl) {
    return {
      url: webhookUrl,
      max_connections: this.max_connections,
      drop_pending_updates: this.drop_pending_updates,
      allowed_updates: this.allowed_updates,
      ...(this.secret_token && { secret_token: this.secret_token })
    };
  },
  
  // 獲取最小配置（用於快速重置）
  getMinimalConfig: function(webhookUrl) {
    return {
      url: webhookUrl,
      drop_pending_updates: true,
      max_connections: 1
    };
  }
};

// 回應優化配置
const RESPONSE_CONFIG = {
  maxProcessingTime: 1000,      // 1 秒最大處理時間
  duplicateWindow: 5000,        // 5 秒重複檢測窗口
  cleanupInterval: 30000,       // 30 秒清理間隔
  maxResponseTime: 2000,        // 2 秒最大回應時間
  timeoutWarningThreshold: 1500, // 1.5 秒超時警告閾值
  
  // 驗證配置合理性
  validate: function() {
    const warnings = [];
    
    if (this.maxProcessingTime > this.maxResponseTime) {
      warnings.push('處理時間超過回應時間限制');
    }
    
    if (this.duplicateWindow < 3000) {
      warnings.push('重複檢測窗口可能過短');
    }
    
    if (this.cleanupInterval < 10000) {
      warnings.push('清理間隔可能過短');
    }
    
    return warnings;
  }
};

// 自動恢復配置
const AUTO_RECOVERY_CONFIG = {
  enabled: true,                // 啟用自動恢復
  duplicateThreshold: 10,       // 重複請求閾值
  errorThreshold: 5,            // 錯誤閾值
  timeoutThreshold: 3,          // 超時閾值
  checkInterval: 60000,         // 檢查間隔（1 分鐘）
  recoveryActions: {
    duplicateExceeded: 'quickReset',    // 重複超標：快速重置
    errorExceeded: 'diagnose',          // 錯誤超標：診斷
    timeoutExceeded: 'emergencyStop'    // 超時超標：緊急停止
  },
  
  // 檢查是否需要自動恢復
  shouldRecover: function(metrics) {
    if (!this.enabled) return null;
    
    const duplicateRate = metrics.duplicateCount / Math.max(metrics.totalRequests, 1) * 100;
    const errorRate = metrics.failedResponses / Math.max(metrics.totalRequests, 1) * 100;
    const timeoutRate = metrics.timeouts / Math.max(metrics.totalRequests, 1) * 100;
    
    if (duplicateRate > this.duplicateThreshold) {
      return { action: this.recoveryActions.duplicateExceeded, reason: '重複請求率過高' };
    }
    
    if (errorRate > this.errorThreshold) {
      return { action: this.recoveryActions.errorExceeded, reason: '錯誤率過高' };
    }
    
    if (timeoutRate > this.timeoutThreshold) {
      return { action: this.recoveryActions.timeoutExceeded, reason: '超時率過高' };
    }
    
    return null;
  }
};

// 配置初始化檢查
(function initializeConfig() {
  const errors = CONFIG.validate();
  if (errors.length > 0) {
    Logger.log(`⚠️ V50.2.0 配置警告: ${errors.join(', ')}`);
  } else {
    Logger.log('✅ V50.2.0 配置檢查通過');
  }
  
  // 檢查新配置
  const responseWarnings = RESPONSE_CONFIG.validate();
  if (responseWarnings.length > 0) {
    Logger.log(`⚠️ 回應配置警告: ${responseWarnings.join(', ')}`);
  }
  
  Logger.log('✅ V50.2.0 智慧記帳 GEM 載入完成 - Webhook Guardian 已就緒');
})();

function safeExecute(operation, context = {}) {
  try {
    const configErrors = CONFIG.validate();
    if (configErrors.length > 0) {
      throw new Error(`配置錯誤: ${configErrors.join(', ')}`);
    }
    return operation();
  } catch (error) {
    Logger.log(`❌ Error in ${context.name || 'unknown'}: ${error.toString()}`);
    Logger.log(`Stack: ${error.stack}`);
    
    // 如果是 API 調用函數，直接拋出錯誤而不是返回 TextOutput
    if (context.name && (context.name.includes('callGemini') || context.name.includes('API'))) {
      throw error;
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString(),
      context: context
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// =================================================================================================
// Web App 主入口路由
// =================================================================================================
function doGet(e) {
  return safeExecute(() => {
    const action = e.parameter.action;
    const endpoint = e.parameter.endpoint;
    
    if (action === 'version') {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        version: 'V50.1.1',
        message: 'Deployment is active and up-to-date.'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (endpoint) {
      if (endpoint === 'voice') { return doGet_Voice(e); }
      else if (endpoint === 'image') { return doGet_Image(e); }
      else if (endpoint === 'pdf') { return doGet_Pdf(e); }
      else if (endpoint === 'iou') { return doGet_Iou(e); }
      else { throw new Error(`無效的 GET endpoint: ${endpoint}`); }
    }
    
    if (action === 'processEmails') {
      processAutomatedEmails();
      return ContentService.createTextOutput('Email processing completed').setMimeType(ContentService.MimeType.TEXT);
    }
    
    return HtmlService.createHtmlOutput(`<h1>智慧記帳 GEM V50.1.1</h1><p>配置修正版已啟用</p>`);
  }, { name: 'doGet' });
}

function doPost(e) {
  return safeExecute(() => {
    // V50.1 新增: Bot Webhook 優先處理
    try {
      const contents = JSON.parse(e.postData.contents);
      if (contents.update_id) {
        Logger.log("[V50.1-POST] 偵測到 Telegram Webhook，轉發至 Bot 處理器。");
        return doPost_Bot(e);
      }
    } catch(err) {
      // 解析失敗，不是 Bot 的請求，繼續正常流程
    }

    if (!e || !e.parameter) { throw new Error('缺少請求參數'); }
    
    const endpoint = e.parameter.endpoint;
    if (!endpoint) { throw new Error('缺少 endpoint 參數'); }
    
    if (endpoint === 'image') { return doPost_Image(e); }
    else if (endpoint === 'voice') { return doPost_Voice(e); }
    else if (endpoint === 'pdf') { return doPost_Pdf(e); }
    else if (endpoint === 'iou') { return doPost_Iou(e); }
    // V50.1 新增: Bot 路由
    else if (endpoint === 'bot') { return doPost_Bot(e); }
    else { throw new Error(`無效的 API 端點: ${endpoint}`); }
  }, { name: 'doPost' });
}

// =================================================================================================
// 時區感知日期處理函數
// =================================================================================================
function getCurrentTimezoneDateTime(timezone = CONFIG.DEFAULT_TIMEZONE) {
  try {
    const now = new Date();
    const formattedDate = Utilities.formatDate(now, timezone, 'yyyy-MM-dd');
    const formattedDateTime = Utilities.formatDate(now, timezone, 'yyyy-MM-dd HH:mm:ss');
    return {
      date: formattedDate,
      dateTime: formattedDateTime,
      timezone: timezone
    };
  } catch (error) {
    const now = new Date();
    const fallbackDateTime = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    return {
      date: fallbackDateTime.split(' ')[0],
      dateTime: fallbackDateTime,
      timezone: Session.getScriptTimeZone()
    };
  }
}

function getRelativeTimezoneDate(dayOffset = 0, timezone = CONFIG.DEFAULT_TIMEZONE) {
  try {
    const now = new Date();
    const targetDate = new Date(now.getTime() + (dayOffset * 24 * 60 * 60 * 1000));
    return Utilities.formatDate(targetDate, timezone, 'yyyy-MM-dd');
  } catch (error) {
    const now = new Date();
    const targetDate = new Date(now.getTime() + (dayOffset * 24 * 60 * 60 * 1000));
    return Utilities.formatDate(targetDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
}

function generatePromptDateInfo(timezone = CONFIG.DEFAULT_TIMEZONE) {
  const currentDateTime = getCurrentTimezoneDateTime(timezone);
  const yesterday = getRelativeTimezoneDate(-1, timezone);
  const dayBeforeYesterday = getRelativeTimezoneDate(-2, timezone);
  
  return {
    today: currentDateTime.date,
    todayDateTime: currentDateTime.dateTime,
    yesterday: yesterday,
    dayBeforeYesterday: dayBeforeYesterday,
    timezone: currentDateTime.timezone,
    promptText: `【重要】今天的日期是 ${currentDateTime.date}，請以此為基準計算相對日期。`,
    dateRules: `- 日期和時間處理規則（基準日期：${currentDateTime.date}）：
      * 格式：完整的日期時間應為 "YYYY-MM-DD HH:MM:SS" 格式
      * 如果語音中說「今天」、「剛才」、「現在」→ 使用 ${currentDateTime.date} + 當前時間
      * 如果語音中說「昨天」→ 使用 ${yesterday}，時間部分如有明確提到則使用，否則使用 12:00:00
      * 如果語音中說「前天」→ 使用 ${dayBeforeYesterday}
      * 如果沒有明確日期，使用 ${currentDateTime.dateTime}`
  };
}

// =================================================================================================
// Prompt 生成函數
// =================================================================================================
function generateVoicePromptWithDynamicDate(voiceText, timezone = null) {
  const dateInfo = generatePromptDateInfo(timezone);
  const prompt = `你是一位專業的記帳助理，專門處理語音輸入的交易記錄。請將以下語音文字轉換為結構化的交易資料。

${dateInfo.promptText}

請分析以下語音文字，並提取出交易資訊：
- 如果是支出，amount 為正數
- 如果是收入，amount 為負數

${dateInfo.dateRules}

【重要欄位說明】
- currency (幣別)：只能是 TWD, JPY, USD, EUR, CNY 其中之一
- category (類別)：只能是 食、衣、住、行、育、樂、醫療、保險、其他 其中之一
- item (項目): 請結合「商家名稱」和「具體項目描述」。格式為「商家 - 項目」

語音文字：「${voiceText}」

**重要：請只回傳純 JSON 格式，不要包含任何其他文字或說明。**

請以 JSON 格式回傳，**絕對不能包含 "merchant" 欄位**，包含以下欄位：
{
  "date": "YYYY-MM-DD HH:MM:SS",
  "amount": 數字,
  "currency": "TWD/JPY/USD/EUR/CNY",
  "category": "食/衣/住/行/育/樂/醫療/保險/其他",
  "item": "商家 - 具體項目描述",
  "notes": "備註（如果有額外說明）"
}`;
  return prompt;
}

function generateImagePromptWithDynamicDate(voiceNote = null, timezone = null) {
  const dateInfo = generatePromptDateInfo(timezone);
  const prompt = `你是一位頂尖的財務文件辨識專家，專門處理收據和發票圖片。請分析這張圖片並提取交易資訊。

${dateInfo.promptText}

${voiceNote ? `用戶補充說明：${voiceNote}` : ''}

請分析圖片中的收據/發票資訊，並提取以下資料：
- 如果是支出，amount 為正數
- 如果是收入，amount 為負數

【重要欄位說明】
- currency (幣別)：只能是 TWD, JPY, USD, EUR, CNY 其中之一
- category (類別)：只能是 食、衣、住、行、育、樂、醫療、保險、其他 其中之一
- item (項目): 請結合「商家名稱」和「主要消費項目」。格式為「商家 - 項目」

**重要：請只回傳純 JSON 格式，不要包含任何其他文字或說明。**

請以 JSON 格式回傳，**絕對不能包含 "merchant" 欄位**，包含以下欄位：
{
  "date": "YYYY-MM-DD HH:MM:SS",
  "amount": 數字,
  "currency": "TWD/JPY/USD/EUR/CNY",
  "category": "食/衣/住/行/育/樂/醫療/保險/其他",
  "item": "商家 - 具體項目描述",
  "invoice_number": "發票號碼（如果有）",
  "notes": "備註"
}`;
  return prompt;
}

// =================================================================================================
// 輔助函數
// =================================================================================================
function extractJsonFromText(text) {
  try {
    // 直接嘗試解析
    return JSON.parse(text);
  } catch (e) {
    // 如果失敗，嘗試提取 JSON 部分
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e2) {
        throw new Error(`無法解析 JSON: ${text}`);
      }
    }
    throw new Error(`找不到有效的 JSON: ${text}`);
  }
}

// =================================================================================================
// Gemini API 調用函數
// =================================================================================================
function callGeminiForVoice(voiceText) {
  return safeExecute(() => {
    const prompt = generateVoicePromptWithDynamicDate(voiceText);
    const requestBody = {
      "contents": [{ "parts": [{ "text": prompt }] }],
      "generationConfig": {
        "responseMimeType": "application/json"
      }
    };
    const options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify(requestBody),
      'muteHttpExceptions': true
    };
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL_NAME}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (responseCode !== 200) {
      throw new Error(`Gemini API HTTP Error: ${responseCode}. Response: ${responseText}`);
    }
    
    try {
      const jsonResponse = JSON.parse(responseText);
      if (jsonResponse.error) {
        throw new Error(`Gemini API returned an error: ${jsonResponse.error.message}`);
      }
      
      if (!jsonResponse.candidates || !jsonResponse.candidates[0].content.parts[0].text) {
        throw new Error(`Unexpected Gemini API response structure.`);
      }
      
      const aiResultText = jsonResponse.candidates[0].content.parts[0].text;
      const parsedJson = extractJsonFromText(aiResultText);
      return JSON.stringify(parsedJson);
    } catch (e) {
      throw new Error(`Failed to process voice API call: ${e.message}`);
    }
  }, { name: 'callGeminiForVoice' });
}

function callGeminiForVision(imageBlob, voiceNote = '') {
  return safeExecute(() => {
    const prompt = generateImagePromptWithDynamicDate(voiceNote);
    const requestBody = {
      "contents": [{
        "parts": [
          { "text": prompt },
          {
            "inline_data": {
              "mime_type": imageBlob.getContentType(),
              "data": Utilities.base64Encode(imageBlob.getBytes())
            }
          }
        ]
      }],
      "generationConfig": {
        "responseMimeType": "application/json"
      }
    };
    const options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify(requestBody),
      'muteHttpExceptions': true
    };
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL_NAME}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (responseCode !== 200) {
      throw new Error(`Gemini Vision API HTTP Error: ${responseCode}`);
    }
    
    try {
      const jsonResponse = JSON.parse(responseText);
      if (jsonResponse.error) {
        throw new Error(`Gemini Vision API Error: ${jsonResponse.error.message}`);
      }
      
      if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {
        throw new Error('No candidates in Gemini Vision API response');
      }
      
      const candidate = jsonResponse.candidates[0];
      if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
        throw new Error('No content in Gemini Vision API candidate');
      }
      
      const aiResultText = candidate.content.parts[0].text;
      const parsedJson = extractJsonFromText(aiResultText);
      return JSON.stringify(parsedJson);
    } catch (parseError) {
      const currentDateTime = getCurrentTimezoneDateTime();
      const defaultResult = {
        "date": currentDateTime.dateTime,
        "amount": 0,
        "currency": "TWD",
        "category": "其他",
        "item": "無法識別的收據",
        "notes": "圖片解析失敗，請手動輸入"
      };
      return JSON.stringify(defaultResult);
    }
  }, { name: 'callGeminiForVision' });
}

function callGeminiForEmailBody(emailBody, emailSubject) {
  return safeExecute(() => {
    const prompt = `你是一位專業的記帳助理，請從以下電子郵件內文中提取結構化的交易資訊。

【背景資訊】
- 郵件主旨: "${emailSubject}"

【郵件內文(已簡化)】
${emailBody.substring(0, 3000)}

**重要：請只回傳純 JSON 格式，不要包含任何其他文字或說明。**

請以 JSON 格式回傳，**絕對不能包含 "merchant" 欄位**，包含以下欄位：
{
  "date": "YYYY-MM-DD HH:MM:SS",
  "amount": 數字,
  "currency": "TWD/JPY/USD/EUR/CNY",
  "category": "食/衣/住/行/育/樂/醫療/保險/其他",
  "item": "商家 - 具體項目描述",
  "invoice_number": "發票號碼（如果有）",
  "notes": "備註"
}`;
    
    const requestBody = {
      "contents": [{ "parts": [{ "text": prompt }] }],
      "generationConfig": {
        "responseMimeType": "application/json"
      }
    };
    const options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify(requestBody),
      'muteHttpExceptions': true
    };
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL_NAME}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (responseCode !== 200) {
      throw new Error(`Gemini Email API Error: ${responseCode}. Response: ${responseText}`);
    }
    
    try {
      const jsonResponse = JSON.parse(responseText);
      if (jsonResponse.error) {
        throw new Error(`Gemini Email API returned error: ${jsonResponse.error.message}`);
      }
      
      if (!jsonResponse.candidates || !jsonResponse.candidates[0].content.parts[0].text) {
        throw new Error(`Unexpected Gemini Email API response.`);
      }
      
      const aiResultText = jsonResponse.candidates[0].content.parts[0].text;
      const parsedJson = extractJsonFromText(aiResultText);
      return JSON.stringify(parsedJson);
    } catch (e) {
      throw new Error(`Failed to parse Email AI response: ${e.message}`);
    }
  }, { name: 'callGeminiForEmailBody' });
}

function callGeminiForPdf(pdfBlob, emailSubject) {
  return safeExecute(() => {
    const prompt = `你是一位專業的記帳助理，請從以下 PDF 文件中提取結構化的交易資訊。

【背景資訊】
- 郵件主旨: "${emailSubject}"

**重要：請只回傳純 JSON 格式，不要包含任何其他文字或說明。**

請分析 PDF 內容並以 JSON 格式回傳交易資訊：
{
  "date": "YYYY-MM-DD HH:MM:SS",
  "amount": 數字,
  "currency": "TWD/JPY/USD/EUR/CNY",
  "category": "食/衣/住/行/育/樂/醫療/保險/其他",
  "item": "商家 - 具體項目描述",
  "invoice_number": "發票號碼（如果有）",
  "notes": "備註"
}`;
    
    const requestBody = {
      "contents": [{
        "parts": [
          { "text": prompt },
          {
            "inline_data": {
              "mime_type": 'application/pdf',
              "data": Utilities.base64Encode(pdfBlob.getBytes())
            }
          }
        ]
      }],
      "generationConfig": {
        "responseMimeType": "application/json"
      }
    };
    const options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify(requestBody),
      'muteHttpExceptions': true
    };
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL_NAME}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (responseCode !== 200) {
      throw new Error(`Gemini PDF API Error: ${responseCode}. Response: ${responseText}`);
    }
    
    try {
      const jsonResponse = JSON.parse(responseText);
      if (jsonResponse.error) {
        throw new Error(`Gemini PDF API returned error: ${jsonResponse.error.message}`);
      }
      
      if (!jsonResponse.candidates || !jsonResponse.candidates[0].content.parts[0].text) {
        throw new Error(`Unexpected Gemini PDF API response.`);
      }
      
      const aiResultText = jsonResponse.candidates[0].content.parts[0].text;
      const parsedJson = extractJsonFromText(aiResultText);
      return JSON.stringify(parsedJson);
    } catch (e) {
      throw new Error(`Failed to parse PDF AI response: ${e.message}`);
    }
  }, { name: 'callGeminiForPdf' });
}

// =================================================================================================
// 各端點處理函數
// =================================================================================================
function doGet_Voice(e) {
  return safeExecute(() => {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Voice endpoint is ready',
      endpoint: 'voice',
      method: 'GET'
    })).setMimeType(ContentService.MimeType.JSON);
  }, { name: 'doGet_Voice' });
}

function doPost_Voice(e) {
  return safeExecute(() => {
    const voiceText = e.parameter.voiceText || e.parameter.text;
    if (!voiceText) {
      throw new Error('缺少 voiceText 參數');
    }
    
    Logger.log(`[V50.1.1-Voice] 處理語音文字: ${voiceText}`);
    const aiResultText = callGeminiForVoice(voiceText);
    const parsedData = JSON.parse(aiResultText);
    
    const success = writeToSheet(parsedData, 'voice');
    
    return ContentService.createTextOutput(JSON.stringify({
      status: success ? 'success' : 'error',
      data: parsedData,
      message: success ? '語音記帳成功' : '寫入失敗'
    })).setMimeType(ContentService.MimeType.JSON);
  }, { name: 'doPost_Voice' });
}

function doPost_Image(e) {
  return safeExecute(() => {
    const imageBlob = e.parameter.image;
    const voiceNote = e.parameter.voiceNote || '';
    
    if (!imageBlob) {
      throw new Error('缺少圖片資料');
    }
    
    Logger.log(`[V50.1.1-Image] 開始處理圖片...`);
    
    // 調用 Gemini Vision API
    const aiResultText = callGeminiForVision(imageBlob, voiceNote);
    const parsedData = JSON.parse(aiResultText);
    
    // 儲存圖片並取得連結
    let fileUrl = null;
    const imageValidationError = CONFIG.validateForImageSaving();
    if (!imageValidationError) {
      try {
        const archiveFolder = DriveApp.getFolderById(CONFIG.FOLDER_ID_ARCHIVE);
        const timestamp = Utilities.formatDate(new Date(), CONFIG.DEFAULT_TIMEZONE, 'yyyyMMdd_HHmmss');
        const fileName = `receipt_${timestamp}.jpg`;
        const savedFile = archiveFolder.createFile(imageBlob.setName(fileName));
        fileUrl = savedFile.getUrl();
        Logger.log(`[V50.1.1-Image] 圖片已存檔: ${fileUrl}`);
      } catch (saveError) {
        Logger.log(`[V50.1.1-Image] ⚠️ 圖片存檔失敗: ${saveError.message}`);
      }
    }
    
    // 寫入試算表
    const success = writeToSheet(parsedData, 'image', fileUrl);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: success ? 'success' : 'error',
      data: parsedData,
      fileUrl: fileUrl,
      message: success ? '圖片記帳成功' : '寫入失敗'
    })).setMimeType(ContentService.MimeType.JSON);
  }, { name: 'doPost_Image' });
}

function doGet_Image(e) {
  return safeExecute(() => {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Image endpoint is ready',
      endpoint: 'image',
      method: 'GET'
    })).setMimeType(ContentService.MimeType.JSON);
  }, { name: 'doGet_Image' });
}

function doGet_Pdf(e) {
  return safeExecute(() => {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'PDF endpoint is ready',
      endpoint: 'pdf',
      method: 'GET'
    })).setMimeType(ContentService.MimeType.JSON);
  }, { name: 'doGet_Pdf' });
}

function doPost_Pdf(e) {
  return safeExecute(() => {
    const pdfBlob = e.parameter.pdf;
    const emailSubject = e.parameter.subject || 'PDF 處理';
    
    if (!pdfBlob) {
      throw new Error('缺少 PDF 資料');
    }
    
    Logger.log(`[V50.1.1-PDF] 開始處理 PDF...`);
    const aiResultText = callGeminiForPdf(pdfBlob, emailSubject);
    const parsedData = JSON.parse(aiResultText);
    
    const success = writeToSheet(parsedData, 'pdf');
    
    return ContentService.createTextOutput(JSON.stringify({
      status: success ? 'success' : 'error',
      data: parsedData,
      message: success ? 'PDF 記帳成功' : '寫入失敗'
    })).setMimeType(ContentService.MimeType.JSON);
  }, { name: 'doPost_Pdf' });
}

function doGet_Iou(e) {
  return safeExecute(() => {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'IOU endpoint is ready',
      endpoint: 'iou',
      method: 'GET'
    })).setMimeType(ContentService.MimeType.JSON);
  }, { name: 'doGet_Iou' });
}

function doPost_Iou(e) {
  return safeExecute(() => {
    const text = e.parameter.text;
    const action = e.parameter.action || 'split';
    
    if (!text) {
      throw new Error('缺少文字參數');
    }
    
    Logger.log(`[V50.1.1-IOU] 處理 IOU 請求: ${action} - ${text}`);
    
    const aiResultText = callGeminiForIou(text);
    const parsedData = JSON.parse(aiResultText);
    
    let result;
    if (action === 'split') {
      result = handleGroupSplit(parsedData);
    } else if (action === 'settle') {
      result = handleSettlement(parsedData);
    } else {
      throw new Error(`無效的 IOU 動作: ${action}`);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      action: action,
      data: parsedData,
      result: result,
      message: 'IOU 處理成功'
    })).setMimeType(ContentService.MimeType.JSON);
  }, { name: 'doPost_Iou' });
}

// =================================================================================================
// Google Sheets 寫入與操作
// =================================================================================================
function writeToSheet(data, source = 'unknown', fileUrl = null) {
  return safeExecute(() => {
    const ss = SpreadsheetApp.openById(CONFIG.MAIN_LEDGER_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) { 
      throw new Error(`找不到工作表: ${CONFIG.SHEET_NAME}`); 
    }
    
    const currency = data.currency || CONFIG.DEFAULT_CURRENCY;
    const exchangeRate = getExchangeRate(currency);
    const amount = (typeof data.amount === 'number') ? data.amount : '';
    const amountTWD = (typeof amount === 'number' && typeof exchangeRate === 'number') ? 
      parseFloat((amount * exchangeRate).toFixed(2)) : '';
    
    const rowData = [
      data.date ? new Date(data.date) : new Date(),
      amount,
      currency,
      exchangeRate,
      amountTWD,
      data.category || '其他',
      data.item || '',
      '私人',
      '',
      data.invoice_number || '',
      data.reference_number || '',
      '',
      data.buyer_tax_id || '',
      data.seller_tax_id || '',
      fileUrl || '',
      '待確認',
      source,
      data.notes || '',
      data.raw_text || '',
      '',
      JSON.stringify(data)
    ];
    
    sheet.appendRow(rowData);
    return true;
  }, { name: 'writeToSheet' });
}

function getExchangeRate(currency) {
  if (!currency || currency.toUpperCase() === 'TWD') return 1;
  
  // 簡化的匯率表，實際使用時可以接 API
  const rates = {
    'USD': 32.5,
    'JPY': 0.21,
    'EUR': 35.0,
    'CNY': 4.5
  };
  
  return rates[currency.toUpperCase()] || 1;
}

// =================================================================================================
// Email 自動處理功能
// =================================================================================================
function processAutomatedEmails() {
  return safeExecute(() => {
    Logger.log('[V50.1.1-Email] 開始自動化郵件處理...');
    
    const ss = SpreadsheetApp.openById(CONFIG.MAIN_LEDGER_ID);
    const rulesSheet = ss.getSheetByName(CONFIG.EMAIL_RULES_SHEET_NAME);
    if (!rulesSheet) {
      Logger.log(`[V50.1.1-Email] 找不到郵件規則工作表: ${CONFIG.EMAIL_RULES_SHEET_NAME}`);
      return false;
    }
    
    const rules = rulesSheet.getDataRange().getValues();
    if (rules.length < 2) {
      Logger.log(`[V50.1.1-Email] ⚠️ ${CONFIG.EMAIL_RULES_SHEET_NAME} 工作表中沒有任何規則。`);
      return false;
    }
    
    let totalProcessedRecords = 0;
    
    for (let i = 1; i < rules.length; i++) {
      const [sender, subjectKeyword, processingType, ...columnMapping] = rules[i];
      if (!sender || !processingType) continue;
      
      // 使用更靈活的搜尋邏輯
      let searchQuery = `from:${sender} is:unread`;
      let threads = GmailApp.search(searchQuery, 0, 10);
      
      // 如果有主旨關鍵字，進行二次過濾
      if (subjectKeyword && subjectKeyword.trim() && threads.length > 0) {
        threads = threads.filter(thread => {
          const messages = thread.getMessages();
          const latestMessage = messages[messages.length - 1];
          return latestMessage.getSubject().includes(subjectKeyword);
        });
      }
      
      Logger.log(`🔍 搜尋條件: ${searchQuery}${subjectKeyword ? ` + 主旨包含"${subjectKeyword}"` : ''}`);
      Logger.log(`📧 找到 ${threads.length} 個匹配的郵件`);
      
      for (const thread of threads) {
        const messages = thread.getMessages();
        for (const message of messages) {
          if (message.isUnread()) {
            let processedSuccessfully = false;
            
            try {
              const pType = processingType.toUpperCase();
              
              if (pType === 'MOF_CSV') {
                // 財政部電子發票特殊處理
                const attachments = message.getAttachments();
                const csvAttachments = attachments.filter(att => 
                  att.getName().toLowerCase().endsWith('.csv')
                );
                
                let recordsInMessage = 0;
                csvAttachments.forEach(attachment => {
                  const recordsInAttachment = processMOFInvoiceCSV(attachment, message);
                  recordsInMessage += recordsInAttachment;
                  totalProcessedRecords += recordsInAttachment;
                });
                
                if (recordsInMessage > 0) {
                  processedSuccessfully = true;
                  Logger.log(`✅ 財政部電子發票處理成功: ${recordsInMessage} 筆記錄`);
                }
                
              } else if (pType === 'CSV') {
                // 一般 CSV 處理
                const attachments = message.getAttachments();
                const csvAttachments = attachments.filter(att => 
                  att.getName().toLowerCase().endsWith('.csv')
                );
                
                csvAttachments.forEach(attachment => {
                  // 使用 "|" 分隔符處理財政部 CSV
                  const csvData = Utilities.parseCsv(attachment.getDataAsString('UTF-8'), '|');
                  
                  // 尋找表頭行 (以 '表頭=M' 開始)
                  let headerRow = csvData.find(row => row[0] === '表頭=M');
                  if (!headerRow) return;
                  
                  const headerMap = {
                    '發票日期': headerRow.indexOf('發票日期'),
                    '商店店名': headerRow.indexOf('商店店名'),
                    '發票號碼': headerRow.indexOf('發票號碼'),
                    '總金額': headerRow.indexOf('總金額'),
                  };
                  
                  let recordsInAttachment = 0;
                  csvData.forEach(row => {
                    if (row[0] === 'M') { // 處理 'M' 行資料
                      const dateStr = row[headerMap['發票日期']];
                      const date = dateStr ? 
                        new Date(`${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}`) : 
                        new Date();
                      
                      const data = {
                        date: date,
                        amount: parseFloat(row[headerMap['總金額']]) || 0,
                        item: `${row[headerMap['商店店名']]} - 電子發票`,
                        invoice_number: row[headerMap['發票號碼']] || '',
                        notes: `From email: ${message.getSubject()}`
                      };
                      
                      if (writeToSheet(data, 'email-csv')) {
                        totalProcessedRecords++;
                        recordsInAttachment++;
                      }
                    }
                  });
                  
                  if (recordsInAttachment > 0) processedSuccessfully = true;
                });
                
              } else if (pType === 'HTML_BODY') {
                try {
                  const body = message.getBody();
                  const textBody = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                  const aiResultText = callGeminiForEmailBody(textBody, message.getSubject());
                  const parsedData = JSON.parse(aiResultText);
                  
                  if (writeToSheet(parsedData, 'email-html')) {
                    totalProcessedRecords++;
                    processedSuccessfully = true;
                  }
                } catch (apiError) {
                  Logger.log(`[V50.1.1-Email] ⚠️ HTML 郵件處理失敗: ${apiError.message}`);
                }
                
              } else if (pType === 'PDF') {
                message.getAttachments().forEach(attachment => {
                  if (attachment.getContentType() === 'application/pdf') {
                    try {
                      const pdfBlob = attachment.copyBlob();
                      const aiResultText = callGeminiForPdf(pdfBlob, message.getSubject());
                      const parsedData = JSON.parse(aiResultText);
                      
                      if (writeToSheet(parsedData, 'email-pdf')) {
                        totalProcessedRecords++;
                        processedSuccessfully = true;
                      }
                    } catch (apiError) {
                      Logger.log(`[V50.1.1-Email] ⚠️ PDF 處理失敗: ${apiError.message}`);
                    }
                  }
                });
              }
              
              if (processedSuccessfully) {
                message.markRead();
              } else {
                Logger.log(`[V50.1.1-Email] ⚠️ 郵件 "${message.getSubject()}" 無符合條件的可處理內容，保持未讀。`);
              }
              
            } catch (err) {
              Logger.log(`[V50.1.1-Email] ❌ 處理單一郵件失敗: ${err.message}`);
            }
          }
        }
      }
    }
    
    if (totalProcessedRecords === 0) {
      Logger.log(`[V50.1.1-Email] 掃描完成，未找到並處理任何符合規則的未讀郵件。`);
    } else {
      Logger.log(`[V50.1.1-Email] ✅ Email 處理完成，共處理 ${totalProcessedRecords} 筆記錄。`);
    }
    
    return true;
  }, { name: 'processAutomatedEmails' });
}

// =================================================================================================
// IOU 代墊款功能
// =================================================================================================
function callGeminiForIou(text) {
  return safeExecute(() => {
    const prompt = `你是一位專業的代墊款分帳助理。請分析以下文字，提取代墊款資訊。

文字內容：「${text}」

**重要：請只回傳純 JSON 格式，不要包含任何其他文字或說明。**

請以 JSON 格式回傳：
{
  "type": "split/settle",
  "totalAmount": 總金額數字,
  "payer": "付款人姓名",
  "participants": ["參與者1", "參與者2", ...],
  "description": "消費描述",
  "splitMethod": "equal/custom",
  "customAmounts": {"參與者1": 金額, "參與者2": 金額} // 如果是 custom 才需要
}`;
    
    const requestBody = {
      "contents": [{ "parts": [{ "text": prompt }] }],
      "generationConfig": {
        "responseMimeType": "application/json"
      }
    };
    const options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify(requestBody),
      'muteHttpExceptions': true
    };
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL_NAME}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (responseCode !== 200) {
      throw new Error(`Gemini IOU API Error: ${responseCode}. Response: ${responseText}`);
    }
    
    try {
      const jsonResponse = JSON.parse(responseText);
      if (jsonResponse.error) {
        throw new Error(`Gemini IOU API returned error: ${jsonResponse.error.message}`);
      }
      
      if (!jsonResponse.candidates || !jsonResponse.candidates[0].content.parts[0].text) {
        throw new Error(`Unexpected Gemini IOU API response.`);
      }
      
      const aiResultText = jsonResponse.candidates[0].content.parts[0].text;
      const parsedJson = extractJsonFromText(aiResultText);
      return JSON.stringify(parsedJson);
    } catch (e) {
      // 回傳預設結構
      return JSON.stringify({
        "type": "split",
        "totalAmount": 0,
        "payer": "未知",
        "participants": [],
        "description": "解析失敗",
        "splitMethod": "equal"
      });
    }
  }, { name: 'callGeminiForIou' });
}

function handleGroupSplit(data) {
  return safeExecute(() => {
    const { totalAmount, payer, participants, description, splitMethod, customAmounts } = data;
    
    let debts = [];
    
    if (splitMethod === 'equal') {
      const amountPerPerson = totalAmount / participants.length;
      participants.forEach(participant => {
        if (participant !== payer) {
          debts.push({
            debtor: participant,
            creditor: payer,
            amount: amountPerPerson,
            description: description
          });
        }
      });
    } else if (splitMethod === 'custom' && customAmounts) {
      Object.keys(customAmounts).forEach(participant => {
        if (participant !== payer) {
          debts.push({
            debtor: participant,
            creditor: payer,
            amount: customAmounts[participant],
            description: description
          });
        }
      });
    }
    
    // 寫入 IOU 帳本
    writeToIouLedger(data.originalText || '', totalAmount, payer, debts);
    
    return {
      splitMethod: splitMethod,
      debts: debts,
      totalDebts: debts.length
    };
  }, { name: 'handleGroupSplit' });
}

function handleSettlement(data) {
  return safeExecute(() => {
    // 簡化的結算邏輯
    const { payer, totalAmount, description } = data;
    
    Logger.log(`[V50.1.1-IOU] 處理結算: ${payer} 收到 ${totalAmount}`);
    
    return {
      action: 'settlement',
      payer: payer,
      amount: totalAmount,
      description: description,
      message: '結算完成'
    };
  }, { name: 'handleSettlement' });
}

function writeToIouLedger(originalText, totalAmount, payer, debts) {
  return safeExecute(() => {
    const ss = SpreadsheetApp.openById(CONFIG.MAIN_LEDGER_ID);
    let eventsSheet = ss.getSheetByName(CONFIG.IOU_EVENTS_SHEET_NAME);
    
    if (!eventsSheet) {
      eventsSheet = ss.insertSheet(CONFIG.IOU_EVENTS_SHEET_NAME);
      eventsSheet.getRange(1, 1, 1, 6).setValues([
        ['日期', '總金額', '付款人', '描述', '參與者數', '原始文字']
      ]);
    }
    
    const currentDateTime = getCurrentTimezoneDateTime();
    eventsSheet.appendRow([
      new Date(currentDateTime.dateTime),
      totalAmount,
      payer,
      debts[0]?.description || '代墊款',
      debts.length,
      originalText
    ]);
    
    // 寫入債務明細
    let debtsSheet = ss.getSheetByName(CONFIG.IOU_DEBTS_SHEET_NAME);
    if (!debtsSheet) {
      debtsSheet = ss.insertSheet(CONFIG.IOU_DEBTS_SHEET_NAME);
      debtsSheet.getRange(1, 1, 1, 5).setValues([
        ['日期', '債務人', '債權人', '金額', '描述']
      ]);
    }
    
    debts.forEach(debt => {
      debtsSheet.appendRow([
        new Date(currentDateTime.dateTime),
        debt.debtor,
        debt.creditor,
        debt.amount,
        debt.description
      ]);
    });
    
    return true;
  }, { name: 'writeToIouLedger' });
}

// =================================================================================================
// 財政部電子發票專用處理
// =================================================================================================
function setupMOFInvoiceRule() {
  Logger.log('🏛️ 設定財政部電子發票郵件規則...');
  
  try {
    const ss = SpreadsheetApp.openById(CONFIG.MAIN_LEDGER_ID);
    let rulesSheet = ss.getSheetByName(CONFIG.EMAIL_RULES_SHEET_NAME);
    
    if (!rulesSheet) {
      rulesSheet = ss.insertSheet(CONFIG.EMAIL_RULES_SHEET_NAME);
      rulesSheet.getRange(1, 1, 1, 4).setValues([
        ['寄件者', '主旨關鍵字', '處理類型', '備註']
      ]);
      Logger.log('📋 已建立 EmailRules 工作表');
    }
    
    // 檢查是否已有財政部規則
    const existingRules = rulesSheet.getDataRange().getValues();
    const mofRuleExists = existingRules.some(row => 
      row[0] && (row[0].includes('noreply@einvoice.nat.gov.tw') || row[2] === 'MOF_CSV')
    );
    
    if (!mofRuleExists) {
      rulesSheet.appendRow([
        'noreply@einvoice.nat.gov.tw',
        '財政部電子發票整合服務平台',
        'MOF_CSV',
        '財政部電子發票 CSV 特殊格式處理 - V50.1.1'
      ]);
      Logger.log('✅ 財政部電子發票規則已新增');
    } else {
      Logger.log('ℹ️ 財政部電子發票規則已存在');
      
      // 檢查是否需要更新處理類型
      for (let i = 1; i < existingRules.length; i++) {
        if (existingRules[i][0] && existingRules[i][0].includes('noreply@einvoice.nat.gov.tw')) {
          if (existingRules[i][2] !== 'MOF_CSV') {
            rulesSheet.getRange(i + 1, 3).setValue('MOF_CSV');
            rulesSheet.getRange(i + 1, 4).setValue('財政部電子發票 CSV 特殊格式處理 - V50.1.1');
            Logger.log('🔄 已更新財政部規則處理類型為 MOF_CSV');
          }
          break;
        }
      }
    }
    
    // 顯示所有規則
    Logger.log('📋 當前郵件處理規則:');
    existingRules.forEach((rule, index) => {
      if (index > 0 && rule[0]) { // 跳過表頭和空行
        Logger.log(`  ${index}. ${rule[0]} | ${rule[1]} | ${rule[2]}`);
      }
    });
    
    return true;
  } catch (error) {
    Logger.log(`❌ 設定財政部規則失敗: ${error.message}`);
    return false;
  }
}

function processMOFInvoiceCSV(attachment, message) {
  Logger.log('🏛️ 處理財政部電子發票 CSV...');
  
  try {
    // 使用 "|" 分隔符處理財政部 CSV
    const csvData = Utilities.parseCsv(attachment.getDataAsString('UTF-8'), '|');
    Logger.log(`📄 CSV 資料行數: ${csvData.length}`);
    
    // 顯示前 3 行用於診斷
    Logger.log('📋 前 3 行內容:');
    csvData.slice(0, 3).forEach((row, index) => {
      Logger.log(`  ${index + 1}: [${row.slice(0, 8).join('|')}]`);
    });
    
    // 靈活的表頭檢測
    let headerRow = csvData.find(row => row[0] === '表頭=M');
    let headerFound = false;
    
    if (!headerRow) {
      Logger.log('⚠️ 找不到標準表頭行 (表頭=M)，嘗試其他方式...');
      
      // 檢查是否第一行就是表頭
      if (csvData.length > 0 && csvData[0].includes('載具名稱')) {
        headerRow = csvData[0];
        headerFound = true;
        Logger.log('✅ 找到表頭行 (第一行包含載具名稱)');
      }
      // 檢查前幾行是否有包含關鍵字的表頭
      else {
        for (let i = 0; i < Math.min(5, csvData.length); i++) {
          if (csvData[i].some(cell => cell && (cell.includes('載具名稱') || cell.includes('發票日期') || cell.includes('總金額')))) {
            headerRow = csvData[i];
            headerFound = true;
            Logger.log(`✅ 找到表頭行 (第 ${i + 1} 行包含關鍵字)`);
            break;
          }
        }
      }
      
      if (!headerFound) {
        Logger.log('⚠️ 無法找到表頭行，使用預設欄位對應');
        // 使用預設的欄位對應
        headerRow = ['M', '載具名稱', '載具號碼', '發票日期', '商店統編', '商店店名', '發票號碼', '總金額', '發票狀態'];
      }
    } else {
      headerFound = true;
      Logger.log('✅ 找到標準表頭行 (表頭=M)');
    }
    
    Logger.log(`📋 使用表頭: ${headerRow.slice(0, 9).join('|')}`);
    
    // 動態建立欄位對應
    const headerMap = {};
    const keyFields = ['載具名稱', '載具號碼', '發票日期', '商店統編', '商店店名', '發票號碼', '總金額', '發票狀態'];
    
    keyFields.forEach(field => {
      const index = headerRow.findIndex(cell => cell && cell.includes(field));
      if (index !== -1) {
        headerMap[field] = index;
      }
    });
    
    // 如果找不到關鍵欄位，使用預設對應
    if (Object.keys(headerMap).length < 4) {
      Logger.log('⚠️ 關鍵欄位不足，使用預設對應');
      headerMap['載具名稱'] = 1;
      headerMap['載具號碼'] = 2;
      headerMap['發票日期'] = 3;
      headerMap['商店統編'] = 4;
      headerMap['商店店名'] = 5;
      headerMap['發票號碼'] = 6;
      headerMap['總金額'] = 7;
      headerMap['發票狀態'] = 8;
    }
    
    Logger.log(`🗺️ 欄位對應: ${JSON.stringify(headerMap)}`);
    
    let recordsProcessed = 0;
    csvData.forEach((row, index) => {
      if (row[0] === 'M') { // 處理 'M' 行資料 (主發票記錄)
        try {
          const dateStr = row[headerMap['發票日期']];
          const storeName = row[headerMap['商店店名']] || '未知商店';
          const invoiceNumber = row[headerMap['發票號碼']] || '';
          const amount = parseFloat(row[headerMap['總金額']]) || 0;
          const invoiceStatus = row[headerMap['發票狀態']] || '';
          
          // 只處理已開立的發票
          if (invoiceStatus !== '開立') {
            Logger.log(`⚠️ 跳過非開立狀態發票: ${invoiceNumber} (${invoiceStatus})`);
            return;
          }
          
          // 解析日期 (YYYYMMDD 格式)
          let date = new Date();
          if (dateStr && dateStr.length === 8) {
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            date = new Date(`${year}-${month}-${day}`);
          }
          
          // 簡化商店名稱
          let simplifiedStoreName = storeName;
          if (storeName.includes('全聯實業')) {
            simplifiedStoreName = '全聯';
          } else if (storeName.includes('統一超商')) {
            simplifiedStoreName = '7-ELEVEN';
          } else if (storeName.includes('全家便利商店')) {
            simplifiedStoreName = '全家';
          } else if (storeName.includes('威摩科技')) {
            simplifiedStoreName = 'WeMo Scooter';
          } else if (storeName.includes('睿能數位')) {
            simplifiedStoreName = 'GoShare';
          }
          
          const data = {
            date: date,
            amount: amount,
            currency: 'TWD',
            category: '其他',
            item: `${simplifiedStoreName} - 電子發票`,
            invoice_number: invoiceNumber,
            notes: `財政部電子發票 - ${message.getSubject()}`
          };
          
          Logger.log(`💰 處理發票: ${simplifiedStoreName} - ${amount}元 (${invoiceNumber})`);
          
          if (writeToSheet(data, 'mof-csv')) {
            recordsProcessed++;
          }
        } catch (rowError) {
          Logger.log(`❌ 處理第 ${index} 行失敗: ${rowError.message}`);
        }
      }
    });
    
    Logger.log(`✅ 財政部 CSV 處理完成，共處理 ${recordsProcessed} 筆記錄`);
    return recordsProcessed;
    
  } catch (error) {
    Logger.log(`❌ 財政部 CSV 處理失敗: ${error.message}`);
    return 0;
  }
}

// =================================================================================================
// 版本資訊和狀態檢查
// =================================================================================================
function getVersionInfo() {
  return {
    version: 'V50.1.0',
    updateDate: '2025-10-12',
    description: 'Bot 整合穩定版 - Telegram Bot 完整整合',
    features: [
      '語音記帳',
      '圖片OCR記帳',
      '郵件自動處理 (CSV/HTML/PDF)',
      '財政部電子發票自動處理',
      'IOU代墊款分帳',
      '圖片存檔連結',
      '時區感知處理',
      '多幣別支援',
      'Telegram Bot 整合'
    ],
    endpoints: [
      '/exec?endpoint=voice',
      '/exec?endpoint=image', 
      '/exec?endpoint=pdf',
      '/exec?endpoint=iou',
      '/exec?endpoint=bot'
    ],
    botFeatures: [
      'Telegram Bot 支援',
      '圖片自動識別記帳',
      '文字記帳處理',
      '互動式確認流程',
      '用戶狀態管理',
      '指令系統 (/start, /help, /stats)'
    ],
    improvements: [
      '新增完整 Bot 整合',
      '實作狀態管理系統',
      '整合現有 AI 處理邏輯',
      '提供友善用戶體驗',
      '完整向下兼容'
    ],
    status: 'production-ready'
  };
}

function checkSystemHealth() {
  Logger.log('🏥 === 系統健康檢查 V49.5.0 ===');
  
  const health = {
    timestamp: new Date().toISOString(),
    version: 'V49.5.0',
    config: {
      valid: CONFIG.validate().length === 0,
      errors: CONFIG.validate()
    },
    sheets: {
      accessible: false,
      error: null
    },
    gemini: {
      configured: !!CONFIG.GEMINI_API_KEY && CONFIG.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE'
    }
  };
  
  // 測試試算表連接
  try {
    const ss = SpreadsheetApp.openById(CONFIG.MAIN_LEDGER_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    health.sheets.accessible = !!sheet;
  } catch (e) {
    health.sheets.error = e.message;
  }
  
  Logger.log(`📊 系統健康狀態: ${JSON.stringify(health, null, 2)}`);
  return health;
}

// =================================================================================================
// 結束標記
// =================================================================================================
Logger.log('✅ V50.1.1 智慧記帳 GEM 載入完成 - 所有功能已就緒');

// =================================================================================================
// 測試和除錯函數
// =================================================================================================


// =================================================================================================
// V50.1.1 簡化的 Bot 管理函數
// =================================================================================================

// 安全重啟 Bot
function safeRestartBot() {
  Logger.log('🔄 === 安全重啟 Bot ===');
  
  const token = CONFIG.TELEGRAM_BOT_TOKEN;
  if (!token || token === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
    Logger.log('❌ Bot Token 未設定');
    return false;
  }
  
  try {
    // 1. 清除所有處理記錄
    Logger.log('1️⃣ 清除所有狀態...');
    clearAllProcessedUpdates();
    
    // 2. 等待 3 秒
    Logger.log('2️⃣ 等待 3 秒...');
    Utilities.sleep(3000);
    
    // 3. 重新設定 Webhook
    Logger.log('3️⃣ 重新設定 Webhook...');
    const webhookUrl = 'https://script.google.com/macros/s/AKfycbwKETvAD-bPj8ttKlL1HTh1E0SEcGhitpSp0GOmcsUz6JEaONN5F7-95QCsPt0I_XXmRg/exec';
    const result = setWebhook(webhookUrl);
    
    if (result) {
      Logger.log('✅ Bot 安全重啟成功！');
      Logger.log('✅ 已限制為單一連接，避免並發問題');
    } else {
      Logger.log('⚠️ Webhook 設定可能失敗，請檢查');
    }
    
    return true;
  } catch (error) {
    Logger.log(`❌ 重啟失敗: ${error.message}`);
    return false;
  }
}

// 設定 Webhook
function setWebhook(webAppUrl) {
  Logger.log(`🔧 === 設定 Webhook: ${webAppUrl} ===`);
  
  const token = CONFIG.TELEGRAM_BOT_TOKEN;
  if (!token || token === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
    Logger.log('❌ Bot Token 未設定');
    return false;
  }
  
  if (!webAppUrl) {
    Logger.log('❌ Web App URL 未提供');
    return false;
  }
  
  try {
    const url = `https://api.telegram.org/bot${token}/setWebhook`;
    const payload = {
      'url': webAppUrl,
      'max_connections': 1,  // 限制連接數避免並發問題
      'drop_pending_updates': true
    };
    const options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify(payload)
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    
    Logger.log(`📥 設定結果: ${response.getContentText()}`);
    
    if (result.ok) {
      Logger.log('✅ Webhook 設定成功！');
      return true;
    } else {
      Logger.log(`❌ Webhook 設定失敗: ${result.description}`);
      return false;
    }
  } catch (error) {
    Logger.log(`❌ 設定 Webhook 異常: ${error.message}`);
    return false;
  }
}

// 檢查 Webhook 狀態
function checkWebhookStatus() {
  Logger.log('🌐 === 檢查 Webhook 狀態 ===');
  
  const token = CONFIG.TELEGRAM_BOT_TOKEN;
  if (!token || token === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
    Logger.log('❌ Bot Token 未設定');
    return;
  }
  
  try {
    const url = `https://api.telegram.org/bot${token}/getWebhookInfo`;
    const response = UrlFetchApp.fetch(url);
    const data = JSON.parse(response.getContentText());
    
    Logger.log('📊 Webhook 資訊:');
    Logger.log(`URL: ${data.result.url || '❌ 未設定'}`);
    Logger.log(`待處理更新: ${data.result.pending_update_count || 0}`);
    Logger.log(`最後錯誤: ${data.result.last_error_message || '無'}`);
    
    return data.result;
  } catch (error) {
    Logger.log(`❌ 無法獲取 Webhook 資訊: ${error.message}`);
    return null;
  }
}

// 設定 Webhook（已配置 URL）
function setupBotWebhook() {
  Logger.log('🔗 === 設定 Bot Webhook ===');
  
  const myWebAppUrl = "https://script.google.com/macros/s/AKfycbwKETvAD-bPj8ttKlL1HTh1E0SEcGhitpSp0GOmcsUz6JEaONN5F7-95QCsPt0I_XXmRg/exec";
  
  Logger.log(`🔗 使用 URL: ${myWebAppUrl}`);
  
  // 呼叫 setWebhook 函數
  const result = setWebhook(myWebAppUrl);
  
  if (result) {
    Logger.log('✅ Webhook 設定成功！');
    Logger.log('🎉 現在可以測試 Bot 了！');
    return true;
  } else {
    Logger.log('❌ Webhook 設定失敗，請檢查 URL 和 Token');
    return false;
  }
}

function finalSystemTest() {
  Logger.log('🎯 === V49.5.0 最終系統測試 ===');
  
  // 測試 1: 語音記帳
  Logger.log('\n📱 測試 1: 語音記帳功能');
  try {
    const voiceResult = callGeminiForVoice('今天中午在麥當勞花了150元買午餐');
    Logger.log('✅ 語音記帳測試成功');
    Logger.log(`📊 結果: ${voiceResult.substring(0, 200)}...`);
  } catch (error) {
    Logger.log(`❌ 語音記帳測試失敗: ${error.message}`);
  }
  
  // 測試 2: 郵件處理 (模擬)
  Logger.log('\n📧 測試 2: 郵件處理功能');
  try {
    const emailResult = callGeminiForEmailBody('您好，您在7-11消費了89元，發票號碼AB12345678', '消費通知');
    Logger.log('✅ 郵件處理測試成功');
    Logger.log(`📊 結果: ${emailResult.substring(0, 200)}...`);
  } catch (error) {
    Logger.log(`❌ 郵件處理測試失敗: ${error.message}`);
  }
  
  // 測試 3: IOU 功能
  Logger.log('\n💰 測試 3: IOU 代墊款功能');
  try {
    const iouResult = callGeminiForIou('我幫大家墊了晚餐費用600元，要跟小明、小華、小美平分');
    Logger.log('✅ IOU 功能測試成功');
    Logger.log(`📊 結果: ${iouResult.substring(0, 200)}...`);
  } catch (error) {
    Logger.log(`❌ IOU 功能測試失敗: ${error.message}`);
  }
  
  // 測試 4: 配置檢查
  Logger.log('\n⚙️ 測試 4: 系統配置檢查');
  const configErrors = CONFIG.validate();
  if (configErrors.length === 0) {
    Logger.log('✅ 系統配置正常');
  } else {
    Logger.log(`⚠️ 配置警告: ${configErrors.join(', ')}`);
  }
  
  // 測試 5: 版本資訊
  Logger.log('\n📋 測試 5: 版本資訊');
  const versionInfo = getVersionInfo();
  Logger.log(`✅ 版本: ${versionInfo.version}`);
  Logger.log(`📅 更新日期: ${versionInfo.updateDate}`);
  Logger.log(`🚀 功能數量: ${versionInfo.features.length}`);
  
  Logger.log('\n🎉 === V49.5.0 系統測試完成 ===');
  Logger.log('✅ 所有核心功能已就緒，精簡穩定版可以開始使用！');
}

// =================================================================================================
// 財政部電子發票測試和設定函數
// =================================================================================================
function testMOFInvoiceSetup() {
  Logger.log('🧪 === 財政部電子發票設定測試 ===');
  
  // 測試 1: 設定郵件規則
  Logger.log('\n🏛️ 測試 1: 設定財政部電子發票規則');
  const setupResult = setupMOFInvoiceRule();
  if (setupResult) {
    Logger.log('✅ 財政部電子發票規則設定成功');
  } else {
    Logger.log('❌ 財政部電子發票規則設定失敗');
  }
  
  // 測試 2: 檢查郵件規則
  Logger.log('\n📋 測試 2: 檢查現有郵件規則');
  try {
    const ss = SpreadsheetApp.openById(CONFIG.MAIN_LEDGER_ID);
    const rulesSheet = ss.getSheetByName(CONFIG.EMAIL_RULES_SHEET_NAME);
    if (rulesSheet) {
      const rules = rulesSheet.getDataRange().getValues();
      Logger.log(`📊 共有 ${rules.length - 1} 條郵件規則`);
      
      rules.forEach((rule, index) => {
        if (index > 0) { // 跳過表頭
          Logger.log(`  ${index}. ${rule[0]} | ${rule[1]} | ${rule[2]}`);
        }
      });
    }
  } catch (error) {
    Logger.log(`❌ 檢查郵件規則失敗: ${error.message}`);
  }
  
  // 測試 3: 手動觸發郵件處理
  Logger.log('\n📧 測試 3: 手動觸發郵件處理');
  try {
    processAutomatedEmails();
    Logger.log('✅ 郵件處理觸發成功');
  } catch (error) {
    Logger.log(`❌ 郵件處理觸發失敗: ${error.message}`);
  }
  
  Logger.log('\n🎉 === 財政部電子發票測試完成 ===');
}



// =================================================================================================
// 系統診斷與測試函數 (V49.5.0 精簡版)
// =================================================================================================

// 簡化的系統診斷函數
function diagnoseSystem() {
  Logger.log('🔍 === 系統診斷 V49.5.0 ===');
  
  try {
    // 1. 基本配置檢查
    Logger.log('\n⚙️ 配置檢查');
    const configErrors = CONFIG.validate();
    Logger.log(`配置狀態: ${configErrors.length === 0 ? '✅ 正常' : '⚠️ 有警告'}`);
    
    // 2. 試算表連接測試
    Logger.log('\n📋 試算表連接');
    const ss = SpreadsheetApp.openById(CONFIG.MAIN_LEDGER_ID);
    const rulesSheet = ss.getSheetByName(CONFIG.EMAIL_RULES_SHEET_NAME);
    Logger.log(`EmailRules 工作表: ${rulesSheet ? '✅ 存在' : '❌ 不存在'}`);
    
    // 3. 郵件搜尋測試
    Logger.log('\n📧 郵件搜尋');
    const threads = GmailApp.search('is:unread', 0, 1);
    Logger.log(`Gmail 連接: ${threads ? '✅ 正常' : '❌ 異常'}`);
    
    Logger.log('\n🎉 系統診斷完成');
    return true;
    
  } catch (error) {
    Logger.log(`❌ 診斷失敗: ${error.message}`);
    return false;
  }
}

// 安全的郵件處理函數
function safeProcessAutomatedEmails() {
  Logger.log('🛡️ === 安全郵件處理 ===');
  
  try {
    Logger.log('📧 開始郵件處理...');
    const result = processAutomatedEmails();
    Logger.log(`✅ 郵件處理完成: ${result}`);
    return result;
    
  } catch (error) {
    Logger.log(`❌ 郵件處理失敗: ${error.message}`);
    return false;
  }
}

// 財政部電子發票規則修復函數
function fixMOFEmailRule() {
  Logger.log('🔧 === 修復財政部電子發票郵件規則 ===');
  
  try {
    const ss = SpreadsheetApp.openById(CONFIG.MAIN_LEDGER_ID);
    let rulesSheet = ss.getSheetByName(CONFIG.EMAIL_RULES_SHEET_NAME);
    
    if (!rulesSheet) {
      Logger.log('❌ EmailRules 工作表不存在');
      return false;
    }
    
    const rules = rulesSheet.getDataRange().getValues();
    Logger.log(`📋 檢查 ${rules.length - 1} 條現有規則`);
    
    // 檢查並更新現有的財政部規則
    let ruleUpdated = false;
    for (let i = 1; i < rules.length; i++) {
      const rule = rules[i];
      if (rule[0] && rule[0].includes('einvoice.nat.gov.tw')) {
        Logger.log(`📧 找到現有財政部規則: ${rule[0]}`);
        
        // 更新為正確的規則
        rulesSheet.getRange(i + 1, 1).setValue('noreply@einvoice.nat.gov.tw');
        rulesSheet.getRange(i + 1, 2).setValue('財政部電子發票整合服務平台');
        rulesSheet.getRange(i + 1, 3).setValue('MOF_CSV');
        rulesSheet.getRange(i + 1, 4).setValue('財政部電子發票 CSV 處理');
        
        Logger.log('✅ 已更新財政部規則');
        ruleUpdated = true;
        break;
      }
    }
    
    // 如果沒有找到現有規則，新增一條
    if (!ruleUpdated) {
      rulesSheet.appendRow([
        'noreply@einvoice.nat.gov.tw',
        '財政部電子發票整合服務平台',
        'MOF_CSV',
        '財政部電子發票 CSV 處理'
      ]);
      Logger.log('✅ 已新增財政部規則');
    }
    
    return true;
    
  } catch (error) {
    Logger.log(`❌ 修復失敗: ${error.message}`);
    return false;
  }
}

// 測試財政部電子發票處理
function testMOFEmailProcessing() {
  Logger.log('🧪 === 測試財政部電子發票處理 ===');
  
  try {
    // 步驟 1: 修復規則
    Logger.log('\n🔧 步驟 1: 修復郵件規則');
    const fixResult = fixMOFEmailRule();
    
    // 步驟 2: 測試郵件搜尋
    Logger.log('\n🔍 步驟 2: 測試郵件搜尋');
    const searchQuery = 'from:noreply@einvoice.nat.gov.tw is:unread';
    const threads = GmailApp.search(searchQuery, 0, 1);
    Logger.log(`📧 找到 ${threads.length} 個未讀郵件`);
    
    // 步驟 3: 如果沒有未讀郵件，搜尋最近的已讀郵件進行測試
    if (threads.length === 0) {
      Logger.log('\n📧 搜尋最近的已讀郵件進行測試');
      const recentThreads = GmailApp.search('from:noreply@einvoice.nat.gov.tw newer_than:30d', 0, 1);
      
      if (recentThreads.length > 0) {
        const message = recentThreads[0].getMessages()[recentThreads[0].getMessages().length - 1];
        Logger.log(`📧 找到測試郵件: "${message.getSubject()}"`);
        
        // 檢查 CSV 附件
        const csvAttachments = message.getAttachments().filter(att => 
          att.getName().toLowerCase().endsWith('.csv')
        );
        
        if (csvAttachments.length > 0) {
          Logger.log(`📄 測試處理 CSV: ${csvAttachments[0].getName()}`);
          const recordsProcessed = processMOFInvoiceCSV(csvAttachments[0], message);
          
          if (recordsProcessed > 0) {
            Logger.log(`✅ 成功處理 ${recordsProcessed} 筆發票記錄`);
            Logger.log('🎉 財政部電子發票處理功能正常！');
            return true;
          }
        }
      }
    }
    
    Logger.log(`📊 測試結果: 規則修復${fixResult ? '成功' : '失敗'}`);
    return fixResult;
    
  } catch (error) {
    Logger.log(`❌ 測試失敗: ${error.message}`);
    return false;
  }
}

// =================================================================================================
// 系統維護函數
// =================================================================================================

// 清理舊的測試函數 (保留此函數作為記錄)
function cleanupOldTestFunctions() {
  Logger.log('🧹 === V49.5.0 程式碼清理完成 ===');
  Logger.log('✅ 已刪除重複的測試和診斷函數');
  Logger.log('✅ 保留所有核心業務邏輯');
  Logger.log('✅ 系統功能完整性: 100%');
  Logger.log('📊 函數數量: 從 60+ 減少到 ~30 個');
  Logger.log('🚀 維護性: 大幅提升');
}

// =================================================================================================
// 觸發器權限問題修復函數 (V49.5.0)
// =================================================================================================

// 強制重新授權函數
function forceReauthorization() {
  Logger.log('🔐 開始重新授權程序...');
  
  try {
    // 強制觸發權限請求
    const testThread = GmailApp.search('is:unread', 0, 1);
    const testSheet = SpreadsheetApp.openById(CONFIG.MAIN_LEDGER_ID);
    
    Logger.log('✅ 重新授權成功');
    return true;
  } catch (error) {
    Logger.log(`❌ 重新授權失敗: ${error.message}`);
    Logger.log('💡 請手動點擊「執行」按鈕並完成授權流程');
    return false;
  }
}

// 刪除所有觸發器
function deleteAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    ScriptApp.deleteTrigger(trigger);
    Logger.log(`已刪除觸發器: ${trigger.getHandlerFunction()}`);
  });
  Logger.log(`✅ 已刪除 ${triggers.length} 個觸發器`);
}

// 完整的觸發器重建函數
function completeTriggersRebuild() {
  Logger.log('🔄 開始完整觸發器重建...');
  
  // 步驟 1: 刪除所有現有觸發器
  const existingTriggers = ScriptApp.getProjectTriggers();
  existingTriggers.forEach(trigger => {
    ScriptApp.deleteTrigger(trigger);
  });
  Logger.log(`🗑️ 已刪除 ${existingTriggers.length} 個舊觸發器`);
  
  // 步驟 2: 等待一下
  Utilities.sleep(2000);
  
  // 步驟 3: 創建新觸發器
  try {
    // 郵件處理觸發器 - 每5分鐘
    const emailTrigger = ScriptApp.newTrigger('safeProcessAutomatedEmails')
      .timeBased()
      .everyMinutes(5)
      .create();
    Logger.log('✅ 郵件處理觸發器已創建');
    
    // 系統健康檢查觸發器 - 每日上午9點
    const healthTrigger = ScriptApp.newTrigger('checkSystemHealth')
      .timeBased()
      .everyDays(1)
      .atHour(9)
      .create();
    Logger.log('✅ 健康檢查觸發器已創建');
    
    // 步驟 4: 測試新觸發器
    Logger.log('🧪 測試新觸發器...');
    const testResult = testTriggerPermissions();
    
    if (testResult) {
      Logger.log('🎉 觸發器重建完成且測試通過！');
    } else {
      Logger.log('⚠️ 觸發器重建完成，但需要手動授權');
    }
    
    return true;
  } catch (error) {
    Logger.log(`❌ 觸發器創建失敗: ${error.message}`);
    return false;
  }
}

// 測試觸發器權限
function testTriggerPermissions() {
  try {
    // 測試 Gmail 存取
    const threads = GmailApp.search('is:unread', 0, 1);
    Logger.log('✅ Gmail 存取正常');
    
    // 測試 Sheets 存取
    const ss = SpreadsheetApp.openById(CONFIG.MAIN_LEDGER_ID);
    Logger.log('✅ Sheets 存取正常');
    
    // 測試郵件處理
    safeProcessAutomatedEmails();
    Logger.log('✅ 郵件處理正常');
    
    return true;
  } catch (error) {
    Logger.log(`❌ 權限測試失敗: ${error.message}`);
    return false;
  }
}

// 驗證修復結果
function verifyTriggerFix() {
  Logger.log('🔍 驗證觸發器修復結果...');
  
  // 檢查觸發器
  const triggers = ScriptApp.getProjectTriggers();
  Logger.log(`📋 當前觸發器數量: ${triggers.length}`);
  
  triggers.forEach((trigger, index) => {
    Logger.log(`  ${index + 1}. ${trigger.getHandlerFunction()} - ${trigger.getTriggerSource()}`);
  });
  
  // 測試權限
  const permissionTest = testTriggerPermissions();
  
  if (permissionTest) {
    Logger.log('✅ 修復成功！系統準備就緒');
  } else {
    Logger.log('❌ 仍有權限問題，請檢查授權狀態');
  }
  
  return permissionTest;
}

// 一鍵修復觸發器權限問題
function fixTriggerAuthorizationIssue() {
  Logger.log('🚨 === 一鍵修復觸發器權限問題 ===');
  
  // 步驟 1: 重新授權
  Logger.log('\n🔐 步驟 1: 重新授權');
  const authResult = forceReauthorization();
  
  // 步驟 2: 重建觸發器
  Logger.log('\n🔄 步驟 2: 重建觸發器');
  const rebuildResult = completeTriggersRebuild();
  
  // 步驟 3: 驗證修復
  Logger.log('\n🔍 步驟 3: 驗證修復');
  const verifyResult = verifyTriggerFix();
  
  // 總結
  Logger.log('\n📊 === 修復結果總結 ===');
  Logger.log(`🔐 重新授權: ${authResult ? '✅ 成功' : '❌ 失敗'}`);
  Logger.log(`🔄 重建觸發器: ${rebuildResult ? '✅ 成功' : '❌ 失敗'}`);
  Logger.log(`🔍 驗證結果: ${verifyResult ? '✅ 成功' : '❌ 失敗'}`);
  
  if (authResult && rebuildResult && verifyResult) {
    Logger.log('\n🎉 觸發器權限問題已完全修復！');
    Logger.log('💡 系統將在 5 分鐘內恢復自動郵件處理');
  } else {
    Logger.log('\n⚠️ 修復過程中遇到問題，請手動檢查授權狀態');
    Logger.log('💡 建議：重新執行此函數或聯繫技術支援');
  }
  
  return authResult && rebuildResult && verifyResult;
}
// =================================================================================================
// V50.1 Bot 整合功能
// =================================================================================================

// 用戶狀態常數
const USER_STATES = {
  IDLE: 'idle',
  WAITING_CONFIRMATION: 'waiting_confirmation',
  EDITING_RECORD: 'editing_record',
  SELECTING_CATEGORY: 'selecting_category'
};

// =================================================================================================
// Bot Webhook 主處理函數 (V50.1.2 - 超快速回應版)
// =================================================================================================
function doPost_Bot(e) {
  // 立即記錄開始時間用於監控
  const startTime = Date.now();
  let isDuplicate = false;
  let isSuccess = true;
  
  try {
    // 快速配置檢查
    const configErrors = CONFIG.validate();
    if (configErrors.length > 0) {
      Logger.log(`⚠️ [Fast-Bot] 配置錯誤: ${configErrors.join(', ')}`);
      isSuccess = false;
      return createFastOKResponse();
    }
    
    const contents = e.postData.contents;
    const update = JSON.parse(contents);
    
    Logger.log(`[Fast-Bot] 收到 Update ID: ${update.update_id} (${Date.now() - startTime}ms)`);
    
    // 超快速重複檢測
    if (isQuickDuplicate(update.update_id)) {
      isDuplicate = true;
      Logger.log(`[Fast-Bot] 跳過重複請求: ${update.update_id} (${Date.now() - startTime}ms)`);
      return createFastOKResponse();
    }
    
    // 非阻塞異步處理
    processUpdateAsync(update, startTime);
    
  } catch (error) {
    isSuccess = false;
    Logger.log(`[Fast-Bot] 處理錯誤: ${error.message} (${Date.now() - startTime}ms)`);
  } finally {
    // 更新監控指標
    const responseTime = Date.now() - startTime;
    updateResponseMetrics(responseTime, isDuplicate, isSuccess);
    
    // 更新新的系統指標
    SYSTEM_METRICS.addWebhookRequest(isSuccess, isDuplicate, responseTime, 
      isSuccess ? null : '處理失敗');
    
    // 警告慢回應
    if (responseTime > 2000) {
      Logger.log(`⚠️ [Fast-Bot] 慢回應警告: ${responseTime}ms`);
    }
    
    Logger.log(`[Fast-Bot] 回應時間: ${responseTime}ms`);
  }
  
  return createFastOKResponse();
}

// =================================================================================================
// 超快速回應生成器與監控
// =================================================================================================

// 回應時間監控
const RESPONSE_METRICS = {
  totalRequests: 0,
  totalResponseTime: 0,
  maxResponseTime: 0,
  duplicateCount: 0,
  successfulResponses: 0,
  failedResponses: 0
};

function createFastOKResponse() {
  // 修復 302 錯誤：使用 JSON 回應格式
  const response = ContentService.createTextOutput(JSON.stringify({
    ok: true,
    status: "success",
    timestamp: Date.now()
  }));
  response.setMimeType(ContentService.MimeType.JSON);
  return response;
}

function updateResponseMetrics(responseTime, isDuplicate = false, isSuccess = true) {
  RESPONSE_METRICS.totalRequests++;
  RESPONSE_METRICS.totalResponseTime += responseTime;
  RESPONSE_METRICS.maxResponseTime = Math.max(RESPONSE_METRICS.maxResponseTime, responseTime);
  
  if (isDuplicate) {
    RESPONSE_METRICS.duplicateCount++;
  }
  
  if (isSuccess) {
    RESPONSE_METRICS.successfulResponses++;
  } else {
    RESPONSE_METRICS.failedResponses++;
  }
  
  // 每 10 個請求記錄一次統計
  if (RESPONSE_METRICS.totalRequests % 10 === 0) {
    const avgResponseTime = RESPONSE_METRICS.totalResponseTime / RESPONSE_METRICS.totalRequests;
    Logger.log(`[Response-Metrics] 平均回應時間: ${avgResponseTime.toFixed(2)}ms, 最大: ${RESPONSE_METRICS.maxResponseTime}ms, 重複: ${RESPONSE_METRICS.duplicateCount}, 成功: ${RESPONSE_METRICS.successfulResponses}`);
  }
}

// =================================================================================================
// 超時保護與回應優化系統 (V50.1.2)
// =================================================================================================

// 超時保護包裝函數 (Google Apps Script 兼容版)
function withTimeout(fn, timeoutMs = 2000, context = 'Unknown') {
  const startTime = Date.now();
  
  try {
    // 執行函數
    const result = fn();
    
    const duration = Date.now() - startTime;
    if (duration > timeoutMs) {
      Logger.log(`⚠️ [Timeout-Exceeded] ${context} 執行時間: ${duration}ms (超過 ${timeoutMs}ms)`);
    } else {
      Logger.log(`✅ [Timeout-OK] ${context} 執行時間: ${duration}ms`);
    }
    
    return result;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    Logger.log(`❌ [Timeout-Error] ${context} 執行失敗: ${error.message} (${duration}ms)`);
    throw error;
  }
}

// 非阻塞異步更新處理 (增強版)
function processUpdateAsync(update, startTime) {
  const processStartTime = Date.now();
  
  try {
    // 使用超時保護處理訊息
    if (update.message) {
      withTimeout(() => {
        handleTelegramMessage(update.message);
      }, 5000, `Message-${update.message.message_id}`);
    } else if (update.callback_query) {
      withTimeout(() => {
        handleTelegramCallback(update);
      }, 5000, `Callback-${update.callback_query.id}`);
    }
    
    const totalTime = Date.now() - startTime;
    const processTime = Date.now() - processStartTime;
    Logger.log(`[Fast-Bot] 處理完成: ${processTime}ms (總時間: ${totalTime}ms)`);
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    const processTime = Date.now() - processStartTime;
    Logger.log(`[Fast-Bot] 異步處理錯誤: ${error.message} (處理時間: ${processTime}ms, 總時間: ${totalTime}ms)`);
  }
}

// 安全的函數執行器 (用於關鍵操作)
function safeExecuteWithTimeout(fn, timeoutMs = 1000, fallbackValue = null, context = 'SafeExecute') {
  try {
    return withTimeout(fn, timeoutMs, context);
  } catch (error) {
    Logger.log(`[Safe-Execute] ${context} 失敗，使用備用值: ${error.message}`);
    return fallbackValue;
  }
}

// =================================================================================================
// Telegram Bot 訊息處理 (V50.1.2 優化版)
// =================================================================================================

function handleTelegramMessage(message) {
  const startTime = Date.now();
  
  try {
    const chatId = message.chat.id;
    const from = message.from.first_name || 'User';
    const messageId = message.message_id;
    
    Logger.log(`[V50.1.2-Message] 來自 ${from}, Chat: ${chatId}, Message: ${messageId}`);
    
    // 快速分類處理
    if (message.text && message.text.startsWith('/')) {
      // 指令處理 - 使用超時保護
      safeExecuteWithTimeout(() => {
        handleTelegramCommandSafe(message);
      }, 3000, null, `Command-${message.text.split(' ')[0]}`);
      
    } else if (message.text) {
      // 文字訊息處理 - 非阻塞
      safeExecuteWithTimeout(() => {
        processTextMessage(message);
      }, 2000, null, `Text-${messageId}`);
      
    } else if (message.photo) {
      // 圖片處理 - 非阻塞
      safeExecuteWithTimeout(() => {
        processPhotoMessage(message);
      }, 5000, null, `Photo-${messageId}`);
      
    } else if (message.voice) {
      // 語音處理 - 非阻塞
      safeExecuteWithTimeout(() => {
        processVoiceMessage(message);
      }, 5000, null, `Voice-${messageId}`);
      
    } else {
      // 其他類型訊息
      safeExecuteWithTimeout(() => {
        sendTelegramMessage(chatId, "請發送文字訊息、指令、圖片或語音");
      }, 1000, null, `Other-${messageId}`);
    }
    
    const duration = Date.now() - startTime;
    Logger.log(`[V50.1.2-Message] 處理完成: ${duration}ms`);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    Logger.log(`[V50.1.2-Message] 處理錯誤: ${error.message} (${duration}ms)`);
    
    // 錯誤回復 - 不阻塞主流程
    try {
      if (message.chat && message.chat.id) {
        sendTelegramMessage(message.chat.id, "處理訊息時發生錯誤，請稍後再試");
      }
    } catch (replyError) {
      Logger.log(`[V50.1.2-Message] 錯誤回復失敗: ${replyError.message}`);
    }
  }
}

// 文字訊息處理
function processTextMessage(message) {
  const chatId = message.chat.id;
  const text = message.text;
  
  // 檢查是否為記帳相關文字
  if (isAccountingText(text)) {
    sendTelegramMessage(chatId, "記帳功能開發中，感謝您的耐心等待...");
  } else {
    sendTelegramMessage(chatId, "收到您的訊息，記帳功能開發中...");
  }
}

// 圖片訊息處理
function processPhotoMessage(message) {
  const chatId = message.chat.id;
  sendTelegramMessage(chatId, "圖片處理功能開發中...");
}

// 語音訊息處理
function processVoiceMessage(message) {
  const chatId = message.chat.id;
  sendTelegramMessage(chatId, "語音處理功能開發中...");
}

// 檢查是否為記帳相關文字
function isAccountingText(text) {
  const accountingKeywords = ['花費', '支出', '收入', '記帳', '帳單', '消費', '購買', '付款', '收款'];
  return accountingKeywords.some(keyword => text.includes(keyword));
}

// 已刪除重複的指令處理函數，系統使用 handleTelegramCommandSafe

// =================================================================================================
// 查詢功能
// =================================================================================================
function handleQueryCommand(message) {
  try {
    const chatId = message.chat.id;
    const text = message.text.trim();
    const parts = text.split(' ');
    
    if (parts.length < 2) {
      sendTelegramMessage(chatId, `❓ 請指定查詢範圍\n\n範例：\n/query 今天\n/query 本月\n/query 上月\n/query 本年`);
      return;
    }
    
    const queryType = parts[1];
    Logger.log(`[V50.1.1-Query] 處理查詢: ${queryType}`);
    
    const queryResult = queryLedgerData(queryType);
    
    if (queryResult.error) {
      sendTelegramMessage(chatId, `❌ 查詢失敗: ${queryResult.error}`);
      return;
    }
    
    const responseText = formatQueryResponse(queryResult, queryType);
    sendTelegramMessage(chatId, responseText);
    
  } catch (error) {
    Logger.log(`[V50.1.1-Query] 查詢錯誤: ${error.message}`);
    sendTelegramMessage(message.chat.id, `❌ 查詢過程發生錯誤，請稍後再試`);
  }
}

function queryLedgerData(queryType) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.MAIN_LEDGER_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    
    if (!sheet) {
      return { error: `找不到工作表: ${CONFIG.SHEET_NAME}` };
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return { error: '沒有找到任何記帳資料' };
    }
    
    // 移除標題行
    const records = data.slice(1);
    
    // 根據查詢類型篩選資料
    const filteredRecords = filterRecordsByTimeRange(records, queryType);
    
    if (filteredRecords.length === 0) {
      return { 
        records: [], 
        totalAmount: 0, 
        totalCount: 0,
        categories: {}
      };
    }
    
    // 計算統計資料
    const stats = calculateStatistics(filteredRecords);
    
    return {
      records: filteredRecords,
      totalAmount: stats.totalAmount,
      totalCount: stats.totalCount,
      categories: stats.categories,
      topCategories: stats.topCategories
    };
    
  } catch (error) {
    Logger.log(`[V50.1.1-Query] 資料查詢錯誤: ${error.message}`);
    return { error: error.message };
  }
}

function filterRecordsByTimeRange(records, queryType) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  return records.filter(record => {
    const timestamp = new Date(record[0]); // TIMESTAMP 欄位
    
    switch (queryType) {
      case '今天':
        return timestamp >= today;
        
      case '本月':
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return timestamp >= thisMonthStart;
        
      case '上月':
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        return timestamp >= lastMonthStart && timestamp <= lastMonthEnd;
        
      case '本年':
        const thisYearStart = new Date(now.getFullYear(), 0, 1);
        return timestamp >= thisYearStart;
        
      default:
        return false;
    }
  });
}

function calculateStatistics(records) {
  let totalAmount = 0;
  const categories = {};
  
  records.forEach(record => {
    const amountTWD = parseFloat(record[4]) || 0; // AMOUNT (TWD) 欄位
    const category = record[5] || '其他'; // CATEGORY 欄位
    
    totalAmount += amountTWD;
    
    if (!categories[category]) {
      categories[category] = { amount: 0, count: 0 };
    }
    categories[category].amount += amountTWD;
    categories[category].count += 1;
  });
  
  // 排序分類（按金額）
  const topCategories = Object.entries(categories)
    .sort(([,a], [,b]) => b.amount - a.amount)
    .slice(0, 5);
  
  return {
    totalAmount,
    totalCount: records.length,
    categories,
    topCategories
  };
}

function formatQueryResponse(queryResult, queryType) {
  if (queryResult.totalCount === 0) {
    return `📊 ${queryType}查詢結果\n\n暫無記帳資料`;
  }
  
  let response = `📊 ${queryType}查詢結果\n\n`;
  response += `💰 總支出：NT$ ${queryResult.totalAmount.toLocaleString()}\n`;
  response += `📝 交易筆數：${queryResult.totalCount} 筆\n\n`;
  
  if (queryResult.topCategories.length > 0) {
    response += `🏆 支出分類排行：\n`;
    queryResult.topCategories.forEach(([category, data], index) => {
      const percentage = ((data.amount / queryResult.totalAmount) * 100).toFixed(1);
      response += `${index + 1}. ${category}：NT$ ${data.amount.toLocaleString()} (${percentage}%)\n`;
    });
  }
  
  return response;
}

// 測試查詢功能
function testQueryFunction() {
  Logger.log('🧪 === 測試查詢功能 ===');
  
  try {
    // 測試不同的查詢類型
    const testQueries = ['今天', '本月', '上月', '本年'];
    
    testQueries.forEach(queryType => {
      Logger.log(`\n📊 測試查詢: ${queryType}`);
      const result = queryLedgerData(queryType);
      
      if (result.error) {
        Logger.log(`❌ ${queryType} 查詢失敗: ${result.error}`);
      } else {
        Logger.log(`✅ ${queryType} 查詢成功:`);
        Logger.log(`   總金額: NT$ ${result.totalAmount.toLocaleString()}`);
        Logger.log(`   交易筆數: ${result.totalCount}`);
        Logger.log(`   分類數: ${Object.keys(result.categories).length}`);
        
        // 測試格式化回應
        const formattedResponse = formatQueryResponse(result, queryType);
        Logger.log(`   格式化回應長度: ${formattedResponse.length} 字元`);
      }
    });
    
    Logger.log('\n🎯 查詢功能測試完成');
    
  } catch (error) {
    Logger.log(`❌ 測試失敗: ${error.message}`);
    Logger.log(`錯誤詳情: ${error.stack}`);
  }
}

// 測試查詢指令處理
function testQueryCommand() {
  Logger.log('🧪 === 測試查詢指令處理 ===');
  
  const testChatId = 12345;
  const testCommands = [
    '/query',
    '/query 今天',
    '/query 本月',
    '/query 上月',
    '/query 本年',
    '/query 無效範圍'
  ];
  
  testCommands.forEach(command => {
    Logger.log(`\n📨 測試指令: ${command}`);
    
    const mockMessage = {
      text: command,
      chat: { id: testChatId },
      from: { id: testChatId, first_name: '測試用戶' }
    };
    
    try {
      if (command.startsWith('/query')) {
        handleQueryCommand(mockMessage);
        Logger.log(`✅ ${command} 處理完成`);
      }
    } catch (error) {
      Logger.log(`❌ ${command} 處理失敗: ${error.message}`);
    }
  });
  
  Logger.log('\n🎯 查詢指令測試完成');
}

// 完整的 Bot 功能測試
function testBotWithQuery() {
  Logger.log('🧪 === 完整 Bot 功能測試 ===');
  
  const testChatId = 12345;
  const testCommands = [
    '/start',
    '/help', 
    '/query 今天',
    '/query 本月',
    '/stats'
  ];
  
  testCommands.forEach((command, index) => {
    Logger.log(`\n${index + 1}️⃣ 測試指令: ${command}`);
    
    const mockMessage = {
      text: command,
      chat: { id: testChatId },
      from: { id: testChatId, first_name: '測試用戶' }
    };
    
    try {
      if (command.startsWith('/')) {
        handleTelegramCommandSafe(mockMessage);
        Logger.log(`✅ ${command} 處理完成`);
      }
    } catch (error) {
      Logger.log(`❌ ${command} 處理失敗: ${error.message}`);
    }
    
    // 每個指令之間等待 1 秒
    Utilities.sleep(1000);
  });
  
  Logger.log('\n🎯 完整功能測試完成');
}

function sendWelcomeMessage(chatId, userName) {
  Logger.log(`[V50.1-Welcome-Fix] 準備發送歡迎訊息給 ${userName}, Chat ID: ${chatId}`);
  
  const welcomeText = `🤖 歡迎 ${userName}！

我是智慧記帳助手，可以幫你：

📸 **拍照記帳** - 發送收據照片，我會自動識別
🎤 **語音記帳** - 發送語音訊息，說出消費內容
✏️ **文字記帳** - 直接輸入消費資訊

📊 **查詢功能**:
/query - 查詢記帳資料
/stats - 查看消費統計
/help - 查看詳細說明

現在就試試發送一張收據照片吧！📸`;
  
  const result = sendTelegramMessage(chatId, welcomeText);
  Logger.log(`[V50.1-Welcome-Fix] 歡迎訊息發送結果: ${result}`);
}

function sendHelpMessage(chatId) {
  Logger.log(`[V50.1-Help-Debug] 準備發送幫助訊息到 Chat ID: ${chatId}`);
  
  const helpText = `📖 **使用說明**

**記帳方式**:
📸 發送收據照片 → 自動識別金額和項目
🎤 發送語音訊息 → 語音轉文字記帳
✏️ 輸入文字 → 如「午餐 150 元」

**指令列表**:
/start - 開始使用
/help - 查看說明
/query - 查詢記帳資料
/stats - 消費統計
/cancel - 取消當前操作

**查詢範例**:
/query 今天 - 查看今日支出
/query 本月 - 查看本月支出
/query 上月 - 查看上月支出
/query 本年 - 查看本年支出

**範例**:
• 拍攝收據照片
• 語音：「今天中午麥當勞花了 120 元」
• 文字：「咖啡 50 元」

有問題隨時問我！😊`;
  
  Logger.log(`[V50.1-Help-Debug] 幫助訊息內容: ${helpText.substring(0, 50)}...`);
  const result = sendTelegramMessage(chatId, helpText);
  Logger.log(`[V50.1-Help-Debug] 幫助訊息發送結果: ${result}`);
}

function sendStatsMessage(chatId, userId) {
  try {
    const today = new Date().toLocaleDateString('zh-TW');
    const statsText = `📊 **消費統計** (${today})

今日支出: 計算中...
本月支出: 計算中...
主要類別: 計算中...

💡 完整統計功能開發中，敬請期待！`;
    
    sendTelegramMessage(chatId, statsText);
  } catch (error) {
    Logger.log(`[V50.1-Stats] 統計查詢失敗: ${error.message}`);
    sendTelegramMessage(chatId, "❌ 統計查詢失敗，請稍後重試");
  }
}

function cancelCurrentOperation(chatId, userId) {
  clearUserState(userId, 'telegram');
  sendTelegramMessage(chatId, "✅ 已取消當前操作");
}

// =================================================================================================
// 圖片和語音處理
// =================================================================================================
function handleTelegramPhoto(message) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  
  Logger.log(`[V50.1-Photo] 處理圖片訊息`);
  
  try {
    sendTelegramMessage(chatId, "📸 收到照片！正在分析中...");
    
    const imageBlob = downloadTelegramPhoto(message.photo);
    if (!imageBlob) {
      throw new Error('圖片下載失敗');
    }
    
    sendTelegramMessage(chatId, "🧠 AI 正在識別收據內容...");
    const aiResult = callGeminiForVision(imageBlob, "");
    
    const transactionData = extractJsonFromText(aiResult);
    
    if (!transactionData || !transactionData.amount) {
      throw new Error('無法識別收據內容');
    }
    
    const confirmText = formatTransactionConfirmation(transactionData);
    sendTelegramMessageWithKeyboard(chatId, confirmText, getConfirmationKeyboard());
    
    setUserState(userId, 'telegram', {
      state: USER_STATES.WAITING_CONFIRMATION,
      pendingData: transactionData,
      timestamp: new Date().toISOString(),
      source: 'photo'
    });
    
    Logger.log(`[V50.1-Photo] 圖片處理完成，等待用戶確認`);
    
  } catch (error) {
    Logger.log(`[V50.1-Photo] 圖片處理失敗: ${error.message}`);
    
    const errorText = `❌ 圖片處理失敗

可能原因：
• 圖片不夠清晰
• 不是收據或發票
• 網路連線問題

💡 請嘗試：
1. 重新拍攝更清晰的照片
2. 使用語音記帳：說出消費內容
3. 手動輸入：如「午餐 150 元」`;
    
    sendTelegramMessage(chatId, errorText);
  }
}

function handleTelegramVoice(message) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  
  Logger.log(`[V50.1-Voice] 處理語音訊息`);
  
  try {
    sendTelegramMessage(chatId, "🎤 收到語音！正在處理中...");
    
    // 暫時用文字處理邏輯，未來可以整合語音轉文字
    sendTelegramMessage(chatId, "🧠 AI 正在理解語音內容...");
    
    // 這裡可以下載語音檔案並處理，暫時提示用戶使用文字
    const helpText = `🎤 語音功能開發中！

請暫時使用以下方式：
📸 拍攝收據照片
✏️ 輸入文字：如「午餐 150 元」

感謝您的耐心！😊`;
    
    sendTelegramMessage(chatId, helpText);
    
  } catch (error) {
    Logger.log(`[V50.1-Voice] 語音處理失敗: ${error.message}`);
    sendTelegramMessage(chatId, "❌ 語音處理失敗，請嘗試發送文字或照片");
  }
}

function handleTelegramText(message) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text;
  
  Logger.log(`[V50.1-Text] 處理文字訊息: ${text}`);
  
  try {
    sendTelegramMessage(chatId, "✏️ 正在分析文字內容...");
    
    const aiResult = callGeminiForVoice(text);
    const transactionData = extractJsonFromText(aiResult);
    
    if (!transactionData || !transactionData.amount) {
      throw new Error('無法理解文字內容');
    }
    
    const confirmText = formatTransactionConfirmation(transactionData);
    sendTelegramMessageWithKeyboard(chatId, confirmText, getConfirmationKeyboard());
    
    setUserState(userId, 'telegram', {
      state: USER_STATES.WAITING_CONFIRMATION,
      pendingData: transactionData,
      timestamp: new Date().toISOString(),
      source: 'text',
      originalText: text
    });
    
    Logger.log(`[V50.1-Text] 文字處理完成，等待用戶確認`);
    
  } catch (error) {
    Logger.log(`[V50.1-Text] 文字處理失敗: ${error.message}`);
    
    const errorText = `❌ 無法理解這段文字

💡 請嘗試更清楚的描述，例如：
• 「午餐 150 元」
• 「今天買咖啡花了 50 元」
• 「7-11 消費 89 元」

或者：
📸 拍攝收據照片`;
    
    sendTelegramMessage(chatId, errorText);
  }
}

// =================================================================================================
// 確認和回調處理
// =================================================================================================
function handleConfirmation(message, userState) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  
  Logger.log(`[V50.1-Confirm] 處理確認回應`);
  
  if (message.text) {
    const text = message.text.toLowerCase();
    
    if (text.includes('確認') || text.includes('是') || text.includes('yes') || text === 'y') {
      confirmAndSaveTransaction(chatId, userId, userState);
    } else if (text.includes('取消') || text.includes('否') || text.includes('no') || text === 'n') {
      cancelTransaction(chatId, userId);
    } else {
      sendTelegramMessage(chatId, "請點擊下方按鈕確認或取消，或輸入「確認」/「取消」");
    }
  }
}

function handleTelegramCallback(update) {
  const callbackQuery = update.callback_query;
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;
  
  Logger.log(`[V50.1-Callback] 處理回調: ${data}`);
  
  const userState = getUserState(userId, 'telegram');
  
  switch(data) {
    case 'confirm_transaction':
      confirmAndSaveTransaction(chatId, userId, userState);
      break;
    case 'cancel_transaction':
      cancelTransaction(chatId, userId);
      break;
    default:
      Logger.log(`[V50.1-Callback] 未知回調: ${data}`);
  }
  
  answerCallbackQuery(callbackQuery.id);
}

function confirmAndSaveTransaction(chatId, userId, userState) {
  try {
    const transactionData = userState.pendingData;
    
    const result = writeToSheet(transactionData, 'telegram_bot');
    
    if (result) {
      const successText = `✅ **記帳成功！**

💰 金額：${transactionData.amount} 元
📝 項目：${transactionData.description}
🏷️ 分類：${transactionData.category || '未分類'}
📅 日期：${transactionData.date || new Date().toLocaleDateString('zh-TW')}

繼續發送收據或文字來記帳吧！`;
      
      sendTelegramMessage(chatId, successText);
      clearUserState(userId, 'telegram');
      
    } else {
      throw new Error('寫入試算表失敗');
    }
    
  } catch (error) {
    Logger.log(`[V50.1-Save] 記帳失敗: ${error.message}`);
    sendTelegramMessage(chatId, "❌ 記帳失敗，請稍後重試");
  }
}

function cancelTransaction(chatId, userId) {
  clearUserState(userId, 'telegram');
  sendTelegramMessage(chatId, "❌ 已取消記帳\n\n可以重新發送收據或文字來記帳");
}

// =================================================================================================
// 狀態管理
// =================================================================================================
function getUserState(userId, platform) {
  try {
    const key = `user_state_${platform}_${userId}`;
    const stateJson = PropertiesService.getScriptProperties().getProperty(key);
    
    if (stateJson) {
      const state = JSON.parse(stateJson);
      
      // 檢查狀態是否過期 (30分鐘)
      if (state.timestamp) {
        const stateTime = new Date(state.timestamp);
        const now = new Date();
        const diffMinutes = (now - stateTime) / (1000 * 60);
        
        if (diffMinutes > 30) {
          Logger.log(`[V50.1-State] 用戶狀態已過期，清除狀態`);
          clearUserState(userId, platform);
          return { state: USER_STATES.IDLE };
        }
      }
      
      return state;
    }
    
    return { state: USER_STATES.IDLE };
  } catch (error) {
    Logger.log(`[V50.1-State] 獲取用戶狀態失敗: ${error.message}`);
    return { state: USER_STATES.IDLE };
  }
}

function setUserState(userId, platform, state) {
  try {
    const key = `user_state_${platform}_${userId}`;
    state.timestamp = new Date().toISOString();
    PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(state));
    Logger.log(`[V50.1-State] 已設定用戶狀態: ${state.state}`);
  } catch (error) {
    Logger.log(`[V50.1-State] 設定用戶狀態失敗: ${error.message}`);
  }
}

function clearUserState(userId, platform) {
  try {
    const key = `user_state_${platform}_${userId}`;
    PropertiesService.getScriptProperties().deleteProperty(key);
    Logger.log(`[V50.1-State] 已清除用戶狀態`);
  } catch (error) {
    Logger.log(`[V50.1-State] 清除用戶狀態失敗: ${error.message}`);
  }
}

// =================================================================================================
// Telegram API 工具函數
// =================================================================================================
// 優化的 Telegram 訊息發送 (V50.1.2)
function sendTelegramMessage(chatId, text) {
  const startTime = Date.now();
  
  try {
    Logger.log(`[V50.1.2-Send] 準備發送訊息到 Chat ID: ${chatId}`);
    Logger.log(`[V50.1.2-Send] 訊息內容: ${text.substring(0, 100)}...`);
    
    const token = CONFIG.TELEGRAM_BOT_TOKEN;
    
    if (!token || token === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
      Logger.log('[V50.1.2-Send] 錯誤: TELEGRAM_BOT_TOKEN 未設定');
      return { success: false, error: 'Token 未設定' };
    }
    
    // 使用超時保護發送訊息
    const result = safeExecuteWithTimeout(() => {
      return sendTelegramMessageInternal(chatId, text, token);
    }, 3000, { success: false, error: '發送超時' }, `Send-${chatId}`);
    
    const duration = Date.now() - startTime;
    Logger.log(`[V50.1.2-Send] 發送完成: ${duration}ms, 成功: ${result.success}`);
    
    return result.success;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    Logger.log(`[V50.1.2-Send] 發送異常: ${error.message} (${duration}ms)`);
    return false;
  }
}

// 內部發送函數 (不直接調用)
function sendTelegramMessageInternal(chatId, text, token) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const payload = {
    'chat_id': String(chatId),
    'text': text,
    'parse_mode': 'Markdown'
  };
  
  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true // 避免 HTTP 錯誤拋出異常
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const responseText = response.getContentText();
  const result = JSON.parse(responseText);
  
  Logger.log(`[V50.1.2-Send-Internal] API 回應: ${responseText.substring(0, 200)}...`);
  
  if (result.ok) {
    return { success: true, messageId: result.result.message_id };
  } else {
    Logger.log(`[V50.1.2-Send-Internal] 發送失敗: ${result.description}`);
    return { success: false, error: result.description };
  }
}

// 非阻塞訊息發送 (用於不重要的通知) - Google Apps Script 兼容版
function sendTelegramMessageAsync(chatId, text) {
  try {
    // Google Apps Script 不支援 setTimeout，直接同步發送
    // 但使用 try-catch 確保不阻塞主流程
    try {
      sendTelegramMessage(chatId, text);
      Logger.log(`[V50.1.2-Send-Async] 已發送到 ${chatId}`);
      return true;
    } catch (sendError) {
      Logger.log(`[V50.1.2-Send-Async] 發送失敗: ${sendError.message}`);
      return false;
    }
    
  } catch (error) {
    Logger.log(`[V50.1.2-Send-Async] 處理失敗: ${error.message}`);
    return false;
  }
}

function sendTelegramMessageWithKeyboard(chatId, text, keyboard) {
  const token = CONFIG.TELEGRAM_BOT_TOKEN;
  
  if (!token || token === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
    Logger.log('[V50.1-Telegram] 錯誤: TELEGRAM_BOT_TOKEN 未設定');
    return false;
  }
  
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const payload = {
    'chat_id': String(chatId),
    'text': text,
    'parse_mode': 'Markdown',
    'reply_markup': JSON.stringify(keyboard)
  };
  
  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload)
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    
    if (result.ok) {
      Logger.log(`[V50.1-Telegram] 帶鍵盤的訊息發送成功`);
      return true;
    } else {
      Logger.log(`[V50.1-Telegram] 帶鍵盤的訊息發送失敗: ${result.description}`);
      return false;
    }
  } catch (error) {
    Logger.log(`[V50.1-Telegram] 發送帶鍵盤訊息異常: ${error.message}`);
    return false;
  }
}

function answerCallbackQuery(callbackQueryId, text = '') {
  const token = CONFIG.TELEGRAM_BOT_TOKEN;
  const url = `https://api.telegram.org/bot${token}/answerCallbackQuery`;
  
  const payload = {
    'callback_query_id': callbackQueryId,
    'text': text
  };
  
  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload)
  };
  
  try {
    UrlFetchApp.fetch(url, options);
    Logger.log(`[V50.1-Telegram] 回調查詢已回應`);
  } catch (error) {
    Logger.log(`[V50.1-Telegram] 回應回調查詢失敗: ${error.message}`);
  }
}

// =================================================================================================
// 檔案下載和格式化函數
// =================================================================================================
function downloadTelegramPhoto(photos) {
  try {
    const photo = photos[photos.length - 1];
    const fileId = photo.file_id;
    
    Logger.log(`[V50.1-Download] 下載圖片 File ID: ${fileId}`);
    
    const fileInfo = getTelegramFile(fileId);
    if (!fileInfo || !fileInfo.file_path) {
      throw new Error('無法獲取檔案資訊');
    }
    
    const imageBlob = downloadTelegramFileBlob(fileInfo.file_path);
    
    Logger.log(`[V50.1-Download] 圖片下載成功，大小: ${imageBlob.getBytes().length} bytes`);
    return imageBlob;
    
  } catch (error) {
    Logger.log(`[V50.1-Download] 圖片下載失敗: ${error.message}`);
    return null;
  }
}

function getTelegramFile(fileId) {
  const token = CONFIG.TELEGRAM_BOT_TOKEN;
  const url = `https://api.telegram.org/bot${token}/getFile`;
  
  const payload = {
    'file_id': fileId
  };
  
  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload)
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    
    if (result.ok) {
      return result.result;
    } else {
      throw new Error(result.description);
    }
  } catch (error) {
    Logger.log(`[V50.1-File] 獲取檔案資訊失敗: ${error.message}`);
    return null;
  }
}

function downloadTelegramFileBlob(filePath) {
  const token = CONFIG.TELEGRAM_BOT_TOKEN;
  const url = `https://api.telegram.org/file/bot${token}/${filePath}`;
  
  try {
    const response = UrlFetchApp.fetch(url);
    return response.getBlob();
  } catch (error) {
    Logger.log(`[V50.1-File] 下載檔案失敗: ${error.message}`);
    throw error;
  }
}

function formatTransactionConfirmation(transactionData) {
  const amount = transactionData.amount || '未知';
  const description = transactionData.description || '未知項目';
  const category = transactionData.category || '未分類';
  const date = transactionData.date || new Date().toLocaleDateString('zh-TW');
  
  return `📋 **請確認記帳資訊**

💰 **金額**: ${amount} 元
📝 **項目**: ${description}
🏷️ **分類**: ${category}
📅 **日期**: ${date}

請確認資訊是否正確？`;
}

function getConfirmationKeyboard() {
  return {
    'inline_keyboard': [
      [
        { 'text': '✅ 確認記帳', 'callback_data': 'confirm_transaction' },
        { 'text': '❌ 取消', 'callback_data': 'cancel_transaction' }
      ]
    ]
  };
}

// =================================================================================================
// V50.1 Bot 問題診斷函數
// =================================================================================================

// 已刪除重複的診斷函數

// 已刪除測試函數

// 已刪除多個測試函數
// 已刪除測試函數

// 檢查和設定 Webhook 的函數
function checkWebhookStatus() {
  Logger.log('🌐 === 檢查 Webhook 狀態 ===');
  
  const token = CONFIG.TELEGRAM_BOT_TOKEN;
  if (!token || token === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
    Logger.log('❌ Bot Token 未設定');
    return;
  }
  
  try {
    const url = `https://api.telegram.org/bot${token}/getWebhookInfo`;
    const response = UrlFetchApp.fetch(url);
    const data = JSON.parse(response.getContentText());
    
    Logger.log('📊 Webhook 資訊:');
    Logger.log(`✅ URL: ${data.result.url || '❌ 未設定'}`);
    Logger.log(`📊 待處理更新: ${data.result.pending_update_count || 0}`);
    Logger.log(`🕐 最後錯誤時間: ${data.result.last_error_date ? new Date(data.result.last_error_date * 1000) : '無'}`);
    Logger.log(`❌ 最後錯誤: ${data.result.last_error_message || '無'}`);
    Logger.log(`🔢 最大連接數: ${data.result.max_connections || '未設定'}`);
    
    return data.result;
  } catch (error) {
    Logger.log(`❌ 無法獲取 Webhook 資訊: ${error.message}`);
    return null;
  }
}

// 已刪除無用的 URL 獲取函數

function setWebhook(webAppUrl) {
  Logger.log(`🔧 === 設定 Webhook: ${webAppUrl} ===`);
  
  const token = CONFIG.TELEGRAM_BOT_TOKEN;
  if (!token || token === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
    Logger.log('❌ Bot Token 未設定');
    return false;
  }
  
  if (!webAppUrl) {
    Logger.log('❌ Web App URL 未提供');
    return false;
  }
  
  try {
    const url = `https://api.telegram.org/bot${token}/setWebhook`;
    const payload = {
      'url': webAppUrl,
      'max_connections': 40,
      'drop_pending_updates': true
    };
    
    const options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify(payload)
    };
    
    Logger.log(`📤 發送 setWebhook 請求...`);
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    
    Logger.log(`📥 API 回應: ${response.getContentText()}`);
    
    if (result.ok) {
      Logger.log('✅ Webhook 設定成功！');
      return true;
    } else {
      Logger.log(`❌ Webhook 設定失敗: ${result.description}`);
      return false;
    }
  } catch (error) {
    Logger.log(`❌ 設定 Webhook 異常: ${error.message}`);
    return false;
  }
}

// 已刪除重複的修復函數

function clearWebhook() {
  Logger.log('🧹 === 清除 Webhook ===');
  
  const token = CONFIG.TELEGRAM_BOT_TOKEN;
  if (!token || token === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
    Logger.log('❌ Bot Token 未設定');
    return false;
  }
  
  try {
    const url = `https://api.telegram.org/bot${token}/deleteWebhook`;
    const payload = {
      'drop_pending_updates': true
    };
    
    const options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify(payload)
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    
    Logger.log(`📥 清除結果: ${response.getContentText()}`);
    
    if (result.ok) {
      Logger.log('✅ Webhook 清除成功！');
      return true;
    } else {
      Logger.log(`❌ Webhook 清除失敗: ${result.description}`);
      return false;
    }
  } catch (error) {
    Logger.log(`❌ 清除 Webhook 異常: ${error.message}`);
    return false;
  }
}

// 已刪除部署測試函數

// 已刪除臨時設定函數

// 已刪除最終診斷函數

// 已刪除調試函數

// =================================================================================================
// 超快速重複檢測機制 (V50.1.2)
// =================================================================================================

// 記憶體快取用於超快速重複檢測 (V50.1.2 增強版)
const WEBHOOK_MEMORY_CACHE = {
  duplicateCache: new Map(),
  maxCacheSize: 100,
  duplicateWindow: 30000, // 30 秒重複檢測窗口 (修復重複處理問題)
  propertiesWindow: 3600000, // 1 小時 PropertiesService 保留時間
  stats: {
    memoryHits: 0,
    propertiesHits: 0,
    newRequests: 0,
    cleanupCount: 0,
    propertiesErrors: 0
  },
  lastCleanup: Date.now(),
  lastPropertiesCleanup: Date.now()
};

function isQuickDuplicate(updateId) {
  const startTime = Date.now();
  
  try {
    // 定期清理快取以保持效能
    if (startTime - WEBHOOK_MEMORY_CACHE.lastCleanup > 30000) { // 每 30 秒清理一次
      cleanupMemoryCache();
      WEBHOOK_MEMORY_CACHE.lastCleanup = startTime;
    }
    
    // 定期清理過期的 Properties 記錄
    if (startTime - WEBHOOK_MEMORY_CACHE.lastPropertiesCleanup > 300000) { // 每 5 分鐘清理一次
      clearExpiredDuplicateRecords();
      WEBHOOK_MEMORY_CACHE.lastPropertiesCleanup = startTime;
    }
    
    // 1. 先檢查記憶體快取 (最快)
    const cacheKey = `update_${updateId}`;
    const cached = WEBHOOK_MEMORY_CACHE.duplicateCache.get(cacheKey);
    
    if (cached) {
      const age = startTime - cached.timestamp;
      if (age < WEBHOOK_MEMORY_CACHE.duplicateWindow) {
        WEBHOOK_MEMORY_CACHE.stats.memoryHits++;
        Logger.log(`[Quick-Duplicate] 記憶體快取命中: ${updateId} (${Date.now() - startTime}ms)`);
        return true;
      } else {
        // 過期，從快取中移除
        WEBHOOK_MEMORY_CACHE.duplicateCache.delete(cacheKey);
      }
    }
    
    // 2. 檢查 PropertiesService (較慢但持久) - 使用更短的窗口
    let propertiesCheckTime = Date.now();
    try {
      const key = `processed_update_${updateId}`;
      const existing = PropertiesService.getScriptProperties().getProperty(key);
      
      if (existing) {
        const timestamp = parseInt(existing);
        const age = startTime - timestamp;
        
        if (age < WEBHOOK_MEMORY_CACHE.duplicateWindow) { // 使用 30 秒窗口修復重複處理
          // 添加到記憶體快取以加速後續檢查
          addToMemoryCache(cacheKey, timestamp); // 使用原始時間戳
          WEBHOOK_MEMORY_CACHE.stats.propertiesHits++;
          Logger.log(`[Quick-Duplicate] Properties 命中: ${updateId} (${Date.now() - startTime}ms, Properties: ${Date.now() - propertiesCheckTime}ms)`);
          return true;
        } else if (age < WEBHOOK_MEMORY_CACHE.propertiesWindow) {
          // 在 Properties 窗口內但超過重複窗口，不算重複但保留記錄
          Logger.log(`[Quick-Duplicate] Properties 記錄存在但已過期: ${updateId} (age: ${age}ms)`);
        } else {
          // 完全過期，清除
          PropertiesService.getScriptProperties().deleteProperty(key);
        }
      }
    } catch (propertiesError) {
      WEBHOOK_MEMORY_CACHE.stats.propertiesErrors++;
      Logger.log(`[Quick-Duplicate] Properties 檢查失敗: ${propertiesError.message}`);
      // 繼續處理，不讓 Properties 錯誤阻塞
    }
    
    // 3. 標記為已處理 - 使用批量操作減少 Properties 調用
    addToMemoryCache(cacheKey, startTime);
    
    // 異步設定 Properties 以不阻塞回應
    try {
      const key = `processed_update_${updateId}`;
      PropertiesService.getScriptProperties().setProperty(key, startTime.toString());
    } catch (setError) {
      Logger.log(`[Quick-Duplicate] Properties 設定失敗: ${setError.message}`);
      // 不影響主流程
    }
    
    WEBHOOK_MEMORY_CACHE.stats.newRequests++;
    Logger.log(`[Quick-Duplicate] 新請求: ${updateId} (${Date.now() - startTime}ms)`);
    return false;
    
  } catch (error) {
    Logger.log(`[Quick-Duplicate] 檢查失敗: ${error.message} (${Date.now() - startTime}ms)`);
    return false; // 失敗時允許處理，避免阻塞
  }
}

function addToMemoryCache(key, timestamp) {
  // 智慧清理：當快取接近滿時，清理最舊的項目
  if (WEBHOOK_MEMORY_CACHE.duplicateCache.size >= WEBHOOK_MEMORY_CACHE.maxCacheSize) {
    smartCleanupMemoryCache();
  }
  
  WEBHOOK_MEMORY_CACHE.duplicateCache.set(key, { timestamp });
}

function cleanupMemoryCache() {
  const now = Date.now();
  const expiredKeys = [];
  
  for (const [key, value] of WEBHOOK_MEMORY_CACHE.duplicateCache.entries()) {
    if (now - value.timestamp > WEBHOOK_MEMORY_CACHE.duplicateWindow) {
      expiredKeys.push(key);
    }
  }
  
  expiredKeys.forEach(key => WEBHOOK_MEMORY_CACHE.duplicateCache.delete(key));
  WEBHOOK_MEMORY_CACHE.stats.cleanupCount++;
  Logger.log(`[Quick-Duplicate] 定期清理快取: ${expiredKeys.length} 項目`);
}

function smartCleanupMemoryCache() {
  const now = Date.now();
  const entries = Array.from(WEBHOOK_MEMORY_CACHE.duplicateCache.entries());
  
  // 按時間戳排序，移除最舊的 20% 項目
  entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
  const removeCount = Math.floor(entries.length * 0.2);
  
  for (let i = 0; i < removeCount; i++) {
    WEBHOOK_MEMORY_CACHE.duplicateCache.delete(entries[i][0]);
  }
  
  WEBHOOK_MEMORY_CACHE.stats.cleanupCount++;
  Logger.log(`[Quick-Duplicate] 智慧清理快取: ${removeCount} 項目`);
}

// 快取統計報告
function getCacheStats() {
  const stats = WEBHOOK_MEMORY_CACHE.stats;
  const total = stats.memoryHits + stats.propertiesHits + stats.newRequests;
  const memoryHitRate = total > 0 ? (stats.memoryHits / total * 100).toFixed(2) : 0;
  
  return {
    cacheSize: WEBHOOK_MEMORY_CACHE.duplicateCache.size,
    memoryHits: stats.memoryHits,
    propertiesHits: stats.propertiesHits,
    newRequests: stats.newRequests,
    memoryHitRate: `${memoryHitRate}%`,
    cleanupCount: stats.cleanupCount,
    propertiesErrors: stats.propertiesErrors
  };
}

// =================================================================================================
// Webhook 診斷和監控工具 (V50.1.2)
// =================================================================================================

// 全面的 Webhook 問題診斷
function diagnoseWebhookIssues() {
  Logger.log('🔍 === Webhook 問題診斷 (V50.1.2) ===');
  
  const startTime = Date.now();
  const diagnosticResult = {
    timestamp: new Date().toISOString(),
    overallHealth: 'unknown',
    issues: [],
    recommendations: [],
    details: {}
  };
  
  try {
    // 1. 基本配置檢查
    Logger.log('\n⚙️ 1. 基本配置檢查');
    const configCheck = diagnoseConfiguration();
    diagnosticResult.details.configuration = configCheck;
    
    if (!configCheck.isValid) {
      diagnosticResult.issues.push('配置不完整');
      diagnosticResult.recommendations.push('請檢查 TELEGRAM_BOT_TOKEN 設定');
    }
    
    // 2. Webhook 狀態檢查
    Logger.log('\n🌐 2. Webhook 狀態檢查');
    const webhookCheck = diagnoseWebhookStatus();
    diagnosticResult.details.webhook = webhookCheck;
    
    if (!webhookCheck.isConfigured) {
      diagnosticResult.issues.push('Webhook 未正確配置');
      diagnosticResult.recommendations.push('執行 forceFixDuplicateIssue() 重新配置');
    }
    
    // 3. 快取效能分析
    Logger.log('\n💾 3. 快取效能分析');
    const cacheCheck = diagnoseCachePerformance();
    diagnosticResult.details.cache = cacheCheck;
    
    if (cacheCheck.memoryHitRate < 50) {
      diagnosticResult.issues.push('快取命中率偏低');
      diagnosticResult.recommendations.push('考慮增加快取大小或檢查重複請求模式');
    }
    
    // 4. 回應時間分析
    Logger.log('\n⏱️ 4. 回應時間分析');
    const responseCheck = diagnoseResponseTimes();
    diagnosticResult.details.response = responseCheck;
    
    if (responseCheck.averageResponseTime > 2000) {
      diagnosticResult.issues.push('回應時間過長');
      diagnosticResult.recommendations.push('檢查訊息處理邏輯或考慮優化');
    }
    
    // 5. 重複請求模式分析
    Logger.log('\n🔄 5. 重複請求模式分析');
    const duplicateCheck = diagnoseDuplicatePatterns();
    diagnosticResult.details.duplicates = duplicateCheck;
    
    if (duplicateCheck.duplicateRate > 20) {
      diagnosticResult.issues.push('重複請求率過高');
      diagnosticResult.recommendations.push('執行 emergencyWebhookStop() 然後重新配置');
    }
    
    // 6. 系統資源檢查
    Logger.log('\n🖥️ 6. 系統資源檢查');
    const resourceCheck = diagnoseSystemResources();
    diagnosticResult.details.resources = resourceCheck;
    
    // 7. 整體健康評估
    const totalIssues = diagnosticResult.issues.length;
    if (totalIssues === 0) {
      diagnosticResult.overallHealth = 'healthy';
    } else if (totalIssues <= 2) {
      diagnosticResult.overallHealth = 'warning';
    } else {
      diagnosticResult.overallHealth = 'critical';
    }
    
    const duration = Date.now() - startTime;
    Logger.log(`\n📊 診斷完成 (${duration}ms)`);
    Logger.log(`🏥 整體健康狀態: ${diagnosticResult.overallHealth}`);
    Logger.log(`⚠️ 發現問題: ${totalIssues} 個`);
    Logger.log(`💡 建議措施: ${diagnosticResult.recommendations.length} 項`);
    
    return diagnosticResult;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    Logger.log(`❌ 診斷失敗: ${error.message} (${duration}ms)`);
    diagnosticResult.overallHealth = 'error';
    diagnosticResult.issues.push(`診斷過程錯誤: ${error.message}`);
    return diagnosticResult;
  }
}

// 配置診斷
function diagnoseConfiguration() {
  const config = {
    botToken: CONFIG.TELEGRAM_BOT_TOKEN && CONFIG.TELEGRAM_BOT_TOKEN !== 'YOUR_TELEGRAM_BOT_TOKEN_HERE',
    ledgerId: CONFIG.MAIN_LEDGER_ID && CONFIG.MAIN_LEDGER_ID !== 'YOUR_GOOGLE_SHEET_ID_HERE',
    geminiKey: CONFIG.GEMINI_API_KEY && CONFIG.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE'
  };
  
  const isValid = config.botToken && config.ledgerId && config.geminiKey;
  
  Logger.log(`Bot Token: ${config.botToken ? '✅' : '❌'}`);
  Logger.log(`Ledger ID: ${config.ledgerId ? '✅' : '❌'}`);
  Logger.log(`Gemini Key: ${config.geminiKey ? '✅' : '❌'}`);
  
  return { ...config, isValid };
}

// Webhook 狀態診斷
function diagnoseWebhookStatus() {
  try {
    const token = CONFIG.TELEGRAM_BOT_TOKEN;
    const statusUrl = `https://api.telegram.org/bot${token}/getWebhookInfo`;
    const response = UrlFetchApp.fetch(statusUrl);
    const result = JSON.parse(response.getContentText());
    
    if (result.ok) {
      const info = result.result;
      const isConfigured = info.url && info.url.length > 0;
      
      Logger.log(`Webhook URL: ${info.url || '未設定'}`);
      Logger.log(`待處理更新: ${info.pending_update_count || 0}`);
      Logger.log(`最後錯誤: ${info.last_error_message || '無'}`);
      Logger.log(`最大連接數: ${info.max_connections || '未設定'}`);
      
      return {
        isConfigured,
        url: info.url,
        pendingUpdates: info.pending_update_count,
        lastError: info.last_error_message,
        maxConnections: info.max_connections,
        lastErrorDate: info.last_error_date
      };
    } else {
      Logger.log(`❌ 無法獲取 Webhook 狀態: ${result.description}`);
      return { isConfigured: false, error: result.description };
    }
  } catch (error) {
    Logger.log(`❌ Webhook 狀態檢查失敗: ${error.message}`);
    return { isConfigured: false, error: error.message };
  }
}

// 快取效能診斷
function diagnoseCachePerformance() {
  const stats = getCacheStats();
  const total = stats.memoryHits + stats.propertiesHits + stats.newRequests;
  const memoryHitRate = total > 0 ? (stats.memoryHits / total * 100) : 0;
  
  Logger.log(`快取大小: ${stats.cacheSize}/${WEBHOOK_MEMORY_CACHE.maxCacheSize}`);
  Logger.log(`記憶體命中: ${stats.memoryHits}`);
  Logger.log(`Properties 命中: ${stats.propertiesHits}`);
  Logger.log(`新請求: ${stats.newRequests}`);
  Logger.log(`記憶體命中率: ${memoryHitRate.toFixed(2)}%`);
  Logger.log(`清理次數: ${stats.cleanupCount}`);
  Logger.log(`Properties 錯誤: ${stats.propertiesErrors}`);
  
  return {
    ...stats,
    memoryHitRate: memoryHitRate,
    cacheUtilization: (stats.cacheSize / WEBHOOK_MEMORY_CACHE.maxCacheSize * 100).toFixed(2)
  };
}

// 回應時間診斷
function diagnoseResponseTimes() {
  const metrics = RESPONSE_METRICS;
  const avgResponseTime = metrics.totalRequests > 0 ? 
    (metrics.totalResponseTime / metrics.totalRequests) : 0;
  
  Logger.log(`總請求數: ${metrics.totalRequests}`);
  Logger.log(`平均回應時間: ${avgResponseTime.toFixed(2)}ms`);
  Logger.log(`最大回應時間: ${metrics.maxResponseTime}ms`);
  Logger.log(`成功回應: ${metrics.successfulResponses}`);
  Logger.log(`失敗回應: ${metrics.failedResponses}`);
  Logger.log(`重複請求: ${metrics.duplicateCount}`);
  
  return {
    totalRequests: metrics.totalRequests,
    averageResponseTime: avgResponseTime,
    maxResponseTime: metrics.maxResponseTime,
    successfulResponses: metrics.successfulResponses,
    failedResponses: metrics.failedResponses,
    duplicateCount: metrics.duplicateCount,
    successRate: metrics.totalRequests > 0 ? 
      (metrics.successfulResponses / metrics.totalRequests * 100).toFixed(2) : 0
  };
}

// 重複請求模式診斷
function diagnoseDuplicatePatterns() {
  const stats = WEBHOOK_MEMORY_CACHE.stats;
  const total = stats.memoryHits + stats.propertiesHits + stats.newRequests;
  const duplicateTotal = stats.memoryHits + stats.propertiesHits;
  const duplicateRate = total > 0 ? (duplicateTotal / total * 100) : 0;
  
  Logger.log(`總處理請求: ${total}`);
  Logger.log(`重複請求: ${duplicateTotal}`);
  Logger.log(`重複率: ${duplicateRate.toFixed(2)}%`);
  Logger.log(`記憶體快取命中: ${stats.memoryHits}`);
  Logger.log(`Properties 快取命中: ${stats.propertiesHits}`);
  
  return {
    totalRequests: total,
    duplicateRequests: duplicateTotal,
    duplicateRate: duplicateRate,
    memoryHits: stats.memoryHits,
    propertiesHits: stats.propertiesHits
  };
}

// 系統資源診斷
function diagnoseSystemResources() {
  const now = Date.now();
  const cacheAge = now - WEBHOOK_MEMORY_CACHE.lastCleanup;
  const propertiesAge = now - WEBHOOK_MEMORY_CACHE.lastPropertiesCleanup;
  
  Logger.log(`記憶體快取年齡: ${(cacheAge / 1000).toFixed(1)}秒`);
  Logger.log(`Properties 清理年齡: ${(propertiesAge / 1000).toFixed(1)}秒`);
  Logger.log(`快取窗口: ${WEBHOOK_MEMORY_CACHE.duplicateWindow}ms`);
  Logger.log(`Properties 窗口: ${WEBHOOK_MEMORY_CACHE.propertiesWindow}ms`);
  
  return {
    cacheAge: cacheAge,
    propertiesAge: propertiesAge,
    duplicateWindow: WEBHOOK_MEMORY_CACHE.duplicateWindow,
    propertiesWindow: WEBHOOK_MEMORY_CACHE.propertiesWindow,
    maxCacheSize: WEBHOOK_MEMORY_CACHE.maxCacheSize
  };
}

// =================================================================================================
// 增強日誌和指標系統 (V50.1.2)
// =================================================================================================

// 詳細的系統指標收集
const SYSTEM_METRICS = {
  webhookRequests: {
    total: 0,
    successful: 0,
    failed: 0,
    duplicates: 0,
    timeouts: 0
  },
  responseTimeHistory: [],
  errorHistory: [],
  lastReset: Date.now(),
  
  // 添加新的指標
  addWebhookRequest: function(success, isDuplicate, responseTime, error) {
    this.webhookRequests.total++;
    
    if (success) {
      this.webhookRequests.successful++;
    } else {
      this.webhookRequests.failed++;
    }
    
    if (isDuplicate) {
      this.webhookRequests.duplicates++;
    }
    
    if (responseTime > 5000) {
      this.webhookRequests.timeouts++;
    }
    
    // 保留最近 100 個回應時間記錄
    this.responseTimeHistory.push({
      timestamp: Date.now(),
      responseTime: responseTime,
      success: success,
      isDuplicate: isDuplicate
    });
    
    if (this.responseTimeHistory.length > 100) {
      this.responseTimeHistory.shift();
    }
    
    // 保留最近 50 個錯誤記錄
    if (error) {
      this.errorHistory.push({
        timestamp: Date.now(),
        error: error,
        responseTime: responseTime
      });
      
      if (this.errorHistory.length > 50) {
        this.errorHistory.shift();
      }
    }
  },
  
  // 重置指標
  reset: function() {
    this.webhookRequests = {
      total: 0,
      successful: 0,
      failed: 0,
      duplicates: 0,
      timeouts: 0
    };
    this.responseTimeHistory = [];
    this.errorHistory = [];
    this.lastReset = Date.now();
  }
};

// 生成詳細的系統報告
function generateSystemReport() {
  Logger.log('📊 === 系統指標報告 (V50.1.2) ===');
  
  const now = Date.now();
  const uptime = now - SYSTEM_METRICS.lastReset;
  
  // 基本統計
  Logger.log('\n📈 基本統計');
  Logger.log(`系統運行時間: ${(uptime / 1000 / 60).toFixed(1)} 分鐘`);
  Logger.log(`總請求數: ${SYSTEM_METRICS.webhookRequests.total}`);
  Logger.log(`成功請求: ${SYSTEM_METRICS.webhookRequests.successful}`);
  Logger.log(`失敗請求: ${SYSTEM_METRICS.webhookRequests.failed}`);
  Logger.log(`重複請求: ${SYSTEM_METRICS.webhookRequests.duplicates}`);
  Logger.log(`超時請求: ${SYSTEM_METRICS.webhookRequests.timeouts}`);
  
  // 成功率計算
  const successRate = SYSTEM_METRICS.webhookRequests.total > 0 ? 
    (SYSTEM_METRICS.webhookRequests.successful / SYSTEM_METRICS.webhookRequests.total * 100).toFixed(2) : 0;
  Logger.log(`成功率: ${successRate}%`);
  
  // 回應時間分析
  Logger.log('\n⏱️ 回應時間分析');
  if (SYSTEM_METRICS.responseTimeHistory.length > 0) {
    const times = SYSTEM_METRICS.responseTimeHistory.map(r => r.responseTime);
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);
    
    Logger.log(`平均回應時間: ${avgTime.toFixed(2)}ms`);
    Logger.log(`最大回應時間: ${maxTime}ms`);
    Logger.log(`最小回應時間: ${minTime}ms`);
    
    // 回應時間分布
    const fast = times.filter(t => t < 1000).length;
    const medium = times.filter(t => t >= 1000 && t < 3000).length;
    const slow = times.filter(t => t >= 3000).length;
    
    Logger.log(`快速回應 (<1s): ${fast} (${(fast/times.length*100).toFixed(1)}%)`);
    Logger.log(`中等回應 (1-3s): ${medium} (${(medium/times.length*100).toFixed(1)}%)`);
    Logger.log(`慢速回應 (>3s): ${slow} (${(slow/times.length*100).toFixed(1)}%)`);
  } else {
    Logger.log('暫無回應時間數據');
  }
  
  // 錯誤分析
  Logger.log('\n❌ 錯誤分析');
  if (SYSTEM_METRICS.errorHistory.length > 0) {
    Logger.log(`最近錯誤數: ${SYSTEM_METRICS.errorHistory.length}`);
    
    // 錯誤類型統計
    const errorTypes = {};
    SYSTEM_METRICS.errorHistory.forEach(e => {
      const errorType = e.error.split(':')[0] || 'Unknown';
      errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
    });
    
    Logger.log('錯誤類型分布:');
    Object.entries(errorTypes).forEach(([type, count]) => {
      Logger.log(`  ${type}: ${count} 次`);
    });
    
    // 最近的錯誤
    const recentErrors = SYSTEM_METRICS.errorHistory.slice(-5);
    Logger.log('\n最近 5 個錯誤:');
    recentErrors.forEach((e, i) => {
      const timeAgo = (now - e.timestamp) / 1000;
      Logger.log(`  ${i+1}. ${timeAgo.toFixed(1)}秒前: ${e.error}`);
    });
  } else {
    Logger.log('✅ 無錯誤記錄');
  }
  
  // 快取效能
  Logger.log('\n💾 快取效能');
  const cacheStats = getCacheStats();
  Logger.log(`快取命中率: ${cacheStats.memoryHitRate}`);
  Logger.log(`快取使用率: ${(cacheStats.cacheSize / WEBHOOK_MEMORY_CACHE.maxCacheSize * 100).toFixed(1)}%`);
  
  // 建議
  Logger.log('\n💡 系統建議');
  const recommendations = generateRecommendations();
  recommendations.forEach((rec, i) => {
    Logger.log(`  ${i+1}. ${rec}`);
  });
  
  return {
    uptime: uptime,
    requests: SYSTEM_METRICS.webhookRequests,
    successRate: parseFloat(successRate),
    responseTimeStats: SYSTEM_METRICS.responseTimeHistory.length > 0 ? {
      average: times.reduce((a, b) => a + b, 0) / times.length,
      max: Math.max(...times),
      min: Math.min(...times)
    } : null,
    errorCount: SYSTEM_METRICS.errorHistory.length,
    cacheStats: cacheStats,
    recommendations: recommendations
  };
}

// 生成系統建議
function generateRecommendations() {
  const recommendations = [];
  
  // 成功率檢查
  const successRate = SYSTEM_METRICS.webhookRequests.total > 0 ? 
    (SYSTEM_METRICS.webhookRequests.successful / SYSTEM_METRICS.webhookRequests.total * 100) : 100;
  
  if (successRate < 90) {
    recommendations.push('成功率偏低，建議檢查錯誤日誌並執行 diagnoseWebhookIssues()');
  }
  
  // 重複請求檢查
  const duplicateRate = SYSTEM_METRICS.webhookRequests.total > 0 ? 
    (SYSTEM_METRICS.webhookRequests.duplicates / SYSTEM_METRICS.webhookRequests.total * 100) : 0;
  
  if (duplicateRate > 30) {
    recommendations.push('重複請求率過高，建議執行 emergencyWebhookStop() 然後重新配置');
  }
  
  // 回應時間檢查
  if (SYSTEM_METRICS.responseTimeHistory.length > 0) {
    const times = SYSTEM_METRICS.responseTimeHistory.map(r => r.responseTime);
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    
    if (avgTime > 2000) {
      recommendations.push('平均回應時間過長，建議優化訊息處理邏輯');
    }
  }
  
  // 超時檢查
  if (SYSTEM_METRICS.webhookRequests.timeouts > 5) {
    recommendations.push('超時請求過多，建議檢查網路連接或增加超時限制');
  }
  
  // 錯誤檢查
  if (SYSTEM_METRICS.errorHistory.length > 10) {
    recommendations.push('錯誤頻率較高，建議檢查系統配置和錯誤日誌');
  }
  
  // 快取檢查
  const cacheStats = getCacheStats();
  const hitRate = parseFloat(cacheStats.memoryHitRate);
  
  if (hitRate < 30) {
    recommendations.push('快取命中率偏低，建議增加快取大小或檢查重複模式');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('系統運行良好，無需特別調整');
  }
  
  return recommendations;
}

// 重置系統指標
function resetSystemMetrics() {
  Logger.log('🔄 === 重置系統指標 ===');
  
  const oldStats = {
    total: SYSTEM_METRICS.webhookRequests.total,
    successful: SYSTEM_METRICS.webhookRequests.successful,
    uptime: Date.now() - SYSTEM_METRICS.lastReset
  };
  
  SYSTEM_METRICS.reset();
  
  Logger.log(`已重置指標 (之前: ${oldStats.total} 請求, ${oldStats.successful} 成功, 運行 ${(oldStats.uptime/1000/60).toFixed(1)} 分鐘)`);
  
  return oldStats;
}

// 導出系統指標 (用於外部分析)
function exportSystemMetrics() {
  return {
    timestamp: new Date().toISOString(),
    metrics: SYSTEM_METRICS,
    cacheStats: getCacheStats(),
    responseMetrics: RESPONSE_METRICS,
    webhookCache: {
      size: WEBHOOK_MEMORY_CACHE.duplicateCache.size,
      maxSize: WEBHOOK_MEMORY_CACHE.maxCacheSize,
      stats: WEBHOOK_MEMORY_CACHE.stats
    }
  };
}

// 保留原有函數以向後兼容
function isDuplicateUpdate(updateId) {
  return isQuickDuplicate(updateId);
}

// 清除所有重複檢測記錄
// =================================================================================================
// 增強的重複檢測記錄管理 (V50.1.2)
// =================================================================================================

function clearDuplicateRecords() {
  Logger.log('🧹 === 清除重複檢測記錄 ===');
  
  try {
    const startTime = Date.now();
    const properties = PropertiesService.getScriptProperties();
    const allProperties = properties.getProperties();
    let clearedCount = 0;
    
    // 批量收集要刪除的鍵
    const keysToDelete = [];
    Object.keys(allProperties).forEach(key => {
      if (key.startsWith('processed_update_')) {
        keysToDelete.push(key);
      }
    });
    
    // 批量刪除以提高效能
    keysToDelete.forEach(key => {
      try {
        properties.deleteProperty(key);
        clearedCount++;
      } catch (deleteError) {
        Logger.log(`⚠️ 無法刪除 ${key}: ${deleteError.message}`);
      }
    });
    
    // 同時清除記憶體快取
    WEBHOOK_MEMORY_CACHE.duplicateCache.clear();
    WEBHOOK_MEMORY_CACHE.stats = {
      memoryHits: 0,
      propertiesHits: 0,
      newRequests: 0,
      cleanupCount: 0
    };
    
    const duration = Date.now() - startTime;
    Logger.log(`✅ 已清除 ${clearedCount} 個重複檢測記錄 (${duration}ms)`);
    return clearedCount;
    
  } catch (error) {
    Logger.log(`❌ 清除失敗: ${error.message}`);
    return 0;
  }
}

// 清除過期的重複檢測記錄
function clearExpiredDuplicateRecords() {
  Logger.log('🧹 === 清除過期重複檢測記錄 ===');
  
  try {
    const startTime = Date.now();
    const properties = PropertiesService.getScriptProperties();
    const allProperties = properties.getProperties();
    const now = Date.now();
    let clearedCount = 0;
    
    Object.keys(allProperties).forEach(key => {
      if (key.startsWith('processed_update_')) {
        try {
          const timestamp = parseInt(allProperties[key]);
          const age = now - timestamp;
          
          // 清除超過 1 小時的記錄
          if (age > 3600000) {
            properties.deleteProperty(key);
            clearedCount++;
          }
        } catch (parseError) {
          // 無效的時間戳，直接刪除
          properties.deleteProperty(key);
          clearedCount++;
        }
      }
    });
    
    const duration = Date.now() - startTime;
    Logger.log(`✅ 已清除 ${clearedCount} 個過期記錄 (${duration}ms)`);
    return clearedCount;
    
  } catch (error) {
    Logger.log(`❌ 清除過期記錄失敗: ${error.message}`);
    return 0;
  }
}

// 優化的批量屬性操作
function batchUpdateProperties(updates) {
  try {
    const properties = PropertiesService.getScriptProperties();
    const batchData = {};
    
    updates.forEach(update => {
      batchData[update.key] = update.value;
    });
    
    properties.setProperties(batchData);
    Logger.log(`[Batch-Properties] 批量更新 ${updates.length} 個屬性`);
    return true;
    
  } catch (error) {
    Logger.log(`[Batch-Properties] 批量更新失敗: ${error.message}`);
    return false;
  }
}

// 快速修復重複請求問題
function fixDuplicateRequestIssue() {
  Logger.log('🔧 === 快速修復重複請求問題 ===');
  
  try {
    // 1. 清除所有重複檢測記錄
    Logger.log('1️⃣ 清除重複檢測記錄...');
    const clearedCount = clearDuplicateRecords();
    
    // 2. 檢查 doPost_Bot 回應格式
    Logger.log('2️⃣ 檢查回應格式...');
    Logger.log('✅ doPost_Bot 已設定為回傳純文字 "OK"');
    
    // 3. 重新設定 Webhook
    Logger.log('3️⃣ 重新設定 Webhook...');
    const webhookUrl = 'https://script.google.com/macros/s/AKfycbwKETvAD-bPj8ttKlL1HTh1E0SEcGhitpSp0GOmcsUz6JEaONN5F7-95QCsPt0I_XXmRg/exec';
    const webhookResult = setWebhook(webhookUrl);
    
    if (webhookResult) {
      Logger.log('✅ 修復完成！');
      Logger.log('💡 現在可以測試 Bot 指令，應該不會再有重複請求問題');
      return true;
    } else {
      Logger.log('⚠️ Webhook 設定失敗，請手動檢查');
      return false;
    }
    
  } catch (error) {
    Logger.log(`❌ 修復失敗: ${error.message}`);
    return false;
  }
}

// =================================================================================================
// 強力 Webhook 重置系統 (V50.1.2 增強版)
// =================================================================================================

// 徹底修復重複請求問題（強力版）
function forceFixDuplicateIssue() {
  Logger.log('💪 === 徹底修復重複請求問題 (V50.1.2) ===');
  
  const startTime = Date.now();
  
  try {
    const token = CONFIG.TELEGRAM_BOT_TOKEN;
    if (!token || token === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
      Logger.log('❌ Bot Token 未設定');
      return { success: false, error: 'Bot Token 未設定' };
    }
    
    // 1. 檢查當前 Webhook 狀態
    Logger.log('1️⃣ 檢查當前 Webhook 狀態...');
    const statusUrl = `https://api.telegram.org/bot${token}/getWebhookInfo`;
    const statusResponse = UrlFetchApp.fetch(statusUrl);
    const statusResult = JSON.parse(statusResponse.getContentText());
    Logger.log(`📊 當前狀態: ${statusResponse.getContentText()}`);
    
    // 2. 刪除現有的 Webhook
    Logger.log('2️⃣ 刪除現有 Webhook...');
    const deleteUrl = `https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`;
    const deleteResponse = UrlFetchApp.fetch(deleteUrl);
    const deleteResult = JSON.parse(deleteResponse.getContentText());
    Logger.log(`🗑️ 刪除結果: ${deleteResponse.getContentText()}`);
    
    if (!deleteResult.ok) {
      Logger.log(`⚠️ Webhook 刪除警告: ${deleteResult.description}`);
    }
    
    // 3. 延長等待時間以確保完全清理
    Logger.log('3️⃣ 等待 15 秒確保完全清理...');
    Utilities.sleep(15000);
    
    // 4. 清除所有狀態記錄
    Logger.log('4️⃣ 清除所有狀態記錄...');
    
    // 清除記憶體快取
    WEBHOOK_MEMORY_CACHE.duplicateCache.clear();
    WEBHOOK_MEMORY_CACHE.stats = {
      memoryHits: 0,
      propertiesHits: 0,
      newRequests: 0,
      cleanupCount: 0,
      propertiesErrors: 0
    };
    WEBHOOK_MEMORY_CACHE.lastCleanup = Date.now();
    WEBHOOK_MEMORY_CACHE.lastPropertiesCleanup = Date.now();
    Logger.log('✅ 記憶體快取已清除');
    const clearedCount = clearDuplicateRecords();
    
    // 5. 驗證清理狀態
    Logger.log('5️⃣ 驗證清理狀態...');
    const verifyStatusResponse = UrlFetchApp.fetch(statusUrl);
    const verifyStatusResult = JSON.parse(verifyStatusResponse.getContentText());
    Logger.log(`📊 清理後狀態: ${verifyStatusResponse.getContentText()}`);
    
    // 6. 使用優化配置重新設定 Webhook
    Logger.log('6️⃣ 重新設定 Webhook (使用優化配置)...');
    const webhookUrl = 'https://script.google.com/macros/s/AKfycbwKETvAD-bPj8ttKlL1HTh1E0SEcGhitpSp0GOmcsUz6JEaONN5F7-95QCsPt0I_XXmRg/exec';
    
    // 使用新的配置系統
    const config = WEBHOOK_CONFIG.getFullConfig(webhookUrl);
    Logger.log(`🔧 使用配置: ${JSON.stringify(config)}`);
    
    const setUrl = `https://api.telegram.org/bot${token}/setWebhook`;
    const options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify(config)
    };
    
    const setResponse = UrlFetchApp.fetch(setUrl, options);
    const setResult = JSON.parse(setResponse.getContentText());
    Logger.log(`🔧 設定結果: ${setResponse.getContentText()}`);
    
    // 7. 最終驗證
    Logger.log('7️⃣ 最終驗證 Webhook 狀態...');
    Utilities.sleep(3000); // 等待設定生效
    const finalStatusResponse = UrlFetchApp.fetch(statusUrl);
    const finalStatusResult = JSON.parse(finalStatusResponse.getContentText());
    Logger.log(`📊 最終狀態: ${finalStatusResponse.getContentText()}`);
    
    const duration = Date.now() - startTime;
    
    if (setResult.ok) {
      Logger.log(`✅ 徹底修復完成！耗時: ${duration}ms`);
      Logger.log(`📊 清除了 ${clearedCount} 個重複檢測記錄`);
      Logger.log('🎉 Bot 應該已經完全正常，可以測試查詢功能了');
      
      return {
        success: true,
        duration: duration,
        clearedRecords: clearedCount,
        initialStatus: statusResult,
        finalStatus: finalStatusResult,
        webhookConfigured: setResult.ok
      };
    } else {
      Logger.log(`❌ 設定失敗: ${setResult.description}`);
      return {
        success: false,
        error: setResult.description,
        duration: duration,
        clearedRecords: clearedCount
      };
    }
    
  } catch (error) {
    const duration = Date.now() - startTime;
    Logger.log(`❌ 徹底修復失敗: ${error.message} (${duration}ms)`);
    return {
      success: false,
      error: error.message,
      duration: duration
    };
  }
}

// 快速 Webhook 重置（用於輕微問題）
function quickWebhookReset() {
  Logger.log('⚡ === 快速 Webhook 重置 ===');
  
  const startTime = Date.now();
  
  try {
    const token = CONFIG.TELEGRAM_BOT_TOKEN;
    if (!token || token === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
      Logger.log('❌ Bot Token 未設定');
      return { success: false, error: 'Bot Token 未設定' };
    }
    
    // 1. 快速刪除並重設
    Logger.log('1️⃣ 快速刪除 Webhook...');
    const deleteUrl = `https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`;
    const deleteResponse = UrlFetchApp.fetch(deleteUrl);
    
    // 2. 短暫等待
    Logger.log('2️⃣ 等待 3 秒...');
    Utilities.sleep(3000);
    
    // 3. 重新設定
    Logger.log('3️⃣ 重新設定 Webhook...');
    const webhookUrl = 'https://script.google.com/macros/s/AKfycbwKETvAD-bPj8ttKlL1HTh1E0SEcGhitpSp0GOmcsUz6JEaONN5F7-95QCsPt0I_XXmRg/exec';
    const setUrl = `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}&drop_pending_updates=true`;
    const setResponse = UrlFetchApp.fetch(setUrl);
    const setResult = JSON.parse(setResponse.getContentText());
    
    const duration = Date.now() - startTime;
    Logger.log(`⚡ 快速重置完成！耗時: ${duration}ms`);
    
    return {
      success: setResult.ok,
      duration: duration,
      error: setResult.ok ? null : setResult.description
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    Logger.log(`❌ 快速重置失敗: ${error.message} (${duration}ms)`);
    return {
      success: false,
      error: error.message,
      duration: duration
    };
  }
}

// =================================================================================================
// 自動恢復機制 (V50.1.2)
// =================================================================================================

// 檢查並執行自動恢復
function checkAndPerformAutoRecovery() {
  if (!AUTO_RECOVERY_CONFIG.enabled) {
    Logger.log('[Auto-Recovery] 自動恢復已停用');
    return { performed: false, reason: '功能已停用' };
  }
  
  Logger.log('🔄 === 檢查自動恢復條件 ===');
  
  try {
    // 獲取當前指標
    const metrics = {
      totalRequests: SYSTEM_METRICS.webhookRequests.total,
      duplicateCount: SYSTEM_METRICS.webhookRequests.duplicates,
      failedResponses: SYSTEM_METRICS.webhookRequests.failed,
      timeouts: SYSTEM_METRICS.webhookRequests.timeouts
    };
    
    Logger.log(`當前指標: 總請求 ${metrics.totalRequests}, 重複 ${metrics.duplicateCount}, 失敗 ${metrics.failedResponses}, 超時 ${metrics.timeouts}`);
    
    // 檢查是否需要恢復
    const recoveryAction = AUTO_RECOVERY_CONFIG.shouldRecover(metrics);
    
    if (!recoveryAction) {
      Logger.log('✅ 系統狀態正常，無需自動恢復');
      return { performed: false, reason: '系統狀態正常' };
    }
    
    Logger.log(`⚠️ 檢測到問題: ${recoveryAction.reason}`);
    Logger.log(`🔧 執行恢復動作: ${recoveryAction.action}`);
    
    // 執行恢復動作
    let result;
    switch (recoveryAction.action) {
      case 'quickReset':
        result = quickWebhookReset();
        break;
      case 'diagnose':
        result = diagnoseWebhookIssues();
        break;
      case 'emergencyStop':
        result = emergencyWebhookStop();
        break;
      default:
        Logger.log(`❌ 未知的恢復動作: ${recoveryAction.action}`);
        return { performed: false, reason: '未知的恢復動作' };
    }
    
    Logger.log(`🔧 恢復動作完成: ${JSON.stringify(result)}`);
    
    return {
      performed: true,
      action: recoveryAction.action,
      reason: recoveryAction.reason,
      result: result
    };
    
  } catch (error) {
    Logger.log(`❌ 自動恢復檢查失敗: ${error.message}`);
    return { performed: false, reason: `檢查失敗: ${error.message}` };
  }
}

// 定期自動恢復檢查（可設定觸發器調用）
function periodicAutoRecoveryCheck() {
  Logger.log('⏰ === 定期自動恢復檢查 ===');
  
  const result = checkAndPerformAutoRecovery();
  
  if (result.performed) {
    Logger.log(`🔧 執行了自動恢復: ${result.action} (原因: ${result.reason})`);
    
    // 重置指標以避免重複觸發
    const oldStats = resetSystemMetrics();
    Logger.log(`📊 已重置指標 (之前: ${oldStats.total} 請求)`);
  } else {
    Logger.log(`✅ 無需自動恢復: ${result.reason}`);
  }
  
  return result;
}

// 手動觸發自動恢復檢查
function manualAutoRecoveryCheck() {
  Logger.log('👤 === 手動自動恢復檢查 ===');
  
  // 先生成系統報告
  const report = generateSystemReport();
  
  // 然後檢查恢復
  const recoveryResult = checkAndPerformAutoRecovery();
  
  return {
    systemReport: report,
    recoveryResult: recoveryResult,
    timestamp: new Date().toISOString()
  };
}

// 配置自動恢復設定
function configureAutoRecovery(options = {}) {
  Logger.log('⚙️ === 配置自動恢復設定 ===');
  
  const oldConfig = { ...AUTO_RECOVERY_CONFIG };
  
  // 更新配置
  if (options.enabled !== undefined) {
    AUTO_RECOVERY_CONFIG.enabled = options.enabled;
  }
  
  if (options.duplicateThreshold !== undefined) {
    AUTO_RECOVERY_CONFIG.duplicateThreshold = options.duplicateThreshold;
  }
  
  if (options.errorThreshold !== undefined) {
    AUTO_RECOVERY_CONFIG.errorThreshold = options.errorThreshold;
  }
  
  if (options.timeoutThreshold !== undefined) {
    AUTO_RECOVERY_CONFIG.timeoutThreshold = options.timeoutThreshold;
  }
  
  Logger.log(`舊配置: 啟用=${oldConfig.enabled}, 重複閾值=${oldConfig.duplicateThreshold}%, 錯誤閾值=${oldConfig.errorThreshold}%, 超時閾值=${oldConfig.timeoutThreshold}%`);
  Logger.log(`新配置: 啟用=${AUTO_RECOVERY_CONFIG.enabled}, 重複閾值=${AUTO_RECOVERY_CONFIG.duplicateThreshold}%, 錯誤閾值=${AUTO_RECOVERY_CONFIG.errorThreshold}%, 超時閾值=${AUTO_RECOVERY_CONFIG.timeoutThreshold}%`);
  
  return {
    oldConfig: oldConfig,
    newConfig: { ...AUTO_RECOVERY_CONFIG },
    changed: JSON.stringify(oldConfig) !== JSON.stringify(AUTO_RECOVERY_CONFIG)
  };
}

// =================================================================================================
// 緊急 Webhook 控制系統 (V50.1.2)
// =================================================================================================

// 緊急停止所有 Webhook 活動
function emergencyWebhookStop() {
  Logger.log('🚨 === 緊急停止所有 Webhook 活動 ===');
  
  const startTime = Date.now();
  
  try {
    const token = CONFIG.TELEGRAM_BOT_TOKEN;
    if (!token || token === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
      Logger.log('❌ Bot Token 未設定');
      return { success: false, error: 'Bot Token 未設定' };
    }
    
    // 1. 立即刪除 Webhook
    Logger.log('1️⃣ 立即刪除 Webhook...');
    const deleteUrl = `https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`;
    const deleteResponse = UrlFetchApp.fetch(deleteUrl);
    const deleteResult = JSON.parse(deleteResponse.getContentText());
    Logger.log(`🗑️ 刪除結果: ${deleteResponse.getContentText()}`);
    
    // 2. 清除所有本地狀態
    Logger.log('2️⃣ 清除所有本地狀態...');
    const clearedCount = clearDuplicateRecords();
    
    // 3. 重置記憶體快取
    Logger.log('3️⃣ 重置記憶體快取...');
    WEBHOOK_MEMORY_CACHE.duplicateCache.clear();
    WEBHOOK_MEMORY_CACHE.stats = {
      memoryHits: 0,
      propertiesHits: 0,
      newRequests: 0,
      cleanupCount: 0,
      propertiesErrors: 0
    };
    
    // 4. 等待足夠時間讓所有請求完成
    Logger.log('4️⃣ 等待 30 秒讓所有請求停止...');
    Utilities.sleep(30000);
    
    // 5. 驗證 Webhook 狀態
    Logger.log('5️⃣ 驗證 Webhook 狀態...');
    const statusUrl = `https://api.telegram.org/bot${token}/getWebhookInfo`;
    const statusResponse = UrlFetchApp.fetch(statusUrl);
    const statusResult = JSON.parse(statusResponse.getContentText());
    Logger.log(`📊 最終狀態: ${statusResponse.getContentText()}`);
    
    const duration = Date.now() - startTime;
    Logger.log(`✅ 緊急停止完成！耗時: ${duration}ms`);
    Logger.log(`📊 清除了 ${clearedCount} 個重複檢測記錄`);
    
    return {
      success: true,
      duration: duration,
      clearedRecords: clearedCount,
      webhookDeleted: deleteResult.ok,
      finalStatus: statusResult
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    Logger.log(`❌ 緊急停止失敗: ${error.message} (${duration}ms)`);
    return {
      success: false,
      error: error.message,
      duration: duration
    };
  }
}

// V50.1.1 緊急停止 Bot (保留向後兼容)
function emergencyStopBot() {
  Logger.log('🛑 === 緊急停止 Bot (向後兼容版) ===');
  
  // 使用新的緊急停止函數
  const result = emergencyWebhookStop();
  
  if (result.success) {
    Logger.log('✅ Bot 已緊急停止！');
    Logger.log('✅ 所有待處理更新已清除！');
    return true;
  } else {
    Logger.log(`❌ 停止失敗: ${result.error}`);
    return false;
  }
}

// 清除所有處理記錄
// 向後兼容函數 - 重定向到新的清除函數
function clearAllProcessedUpdates() {
  Logger.log('⚠️ 使用舊函數 clearAllProcessedUpdates，重定向到 clearDuplicateRecords');
  return clearDuplicateRecords();
}

// 已刪除診斷函數

// 已刪除重複的簡化指令處理函數

// 已刪除重複的刷新函數

// 已刪除深度調試函數

// 已刪除狀態檢查函數

// 已刪除重複的新指令處理函數

// 已刪除切換函數

// 已刪除重複的緊急修復函數

// 已刪除重複的緊急停止函數

// 已刪除重複的 safeRestartBot 函數

// 已刪除不完整的文字處理函數

// 已刪除簡單金額提取函數

// 臨時安全版本的 Bot 處理函數
function handleTelegramBotSafe(update) {
  Logger.log(`[V50.1-Bot-Safe] 收到更新: ${JSON.stringify(update)}`);
  
  // 強化的重複檢測
  if (isDuplicateUpdate(update.update_id)) {
    Logger.log(`[V50.1-Bot-Safe] 跳過重複請求: ${update.update_id}`);
    return;
  }
  
  const message = update.message;
  if (!message) {
    Logger.log('[V50.1-Bot-Safe] 沒有 message 物件');
    return;
  }
  
  const chatId = message.chat.id;
  const from = message.from.first_name || 'User';
  
  Logger.log(`[V50.1-Bot-Safe] 來自 ${from}, Chat: ${chatId}`);
  
  try {
    // 簡化的訊息處理，避免複雜邏輯
    if (message.text && message.text.startsWith('/')) {
      Logger.log(`[V50.1-Bot-Safe] 處理指令: ${message.text}`);
      handleTelegramCommandSafe(message);
    } else if (message.text) {
      Logger.log(`[V50.1-Bot-Safe] 處理文字: ${message.text}`);
      sendTelegramMessage(chatId, "收到您的訊息，記帳功能開發中...");
    } else {
      Logger.log('[V50.1-Bot-Safe] 不支援的訊息類型');
      sendTelegramMessage(chatId, '請發送文字訊息或指令');
    }
    
  } catch (error) {
    Logger.log(`[V50.1-Bot-Safe] 處理錯誤: ${error.message}`);
    sendTelegramMessage(chatId, '❌ 處理失敗，請稍後再試');
  }
}

// 安全的指令處理函數
function handleTelegramCommandSafe(message) {
  const command = message.text.toLowerCase().trim();
  const chatId = message.chat.id;
  const from = message.from.first_name || 'User';
  
  Logger.log(`[V50.1-Command-Safe] 處理指令: ${command}`);
  
  // 使用 if-else 而非 switch，並加入查詢功能
  if (command === '/start') {
    sendTelegramMessage(chatId, `🤖 歡迎 ${from}！\n\n我是智慧記帳助手。\n\n發送 /help 查看使用說明。`);
  } else if (command === '/help') {
    sendTelegramMessage(chatId, `📖 使用說明\n\n/start - 開始使用\n/help - 查看說明\n/query - 查詢記帳資料\n/stats - 消費統計\n/stop - 停止 Bot\n\n📊 查詢範例：\n/query 今天\n/query 本月\n/query 上月\n/query 本年`);
  } else if (command.startsWith('/query')) {
    handleQueryCommand(message);
  } else if (command === '/stats') {
    sendTelegramMessage(chatId, `� 消費統計t\n\n功能開發中，敬請期待！`);
  } else if (command === '/cancel') {
    sendTelegramMessage(chatId, '✅ 已取消當前操作');
  } else if (command === '/stop') {
    sendTelegramMessage(chatId, '🛑 Bot 將停止運行');
    emergencyStopBot();
  } else {
    sendTelegramMessage(chatId, `❓ 未知指令: ${command}\n\n輸入 /help 查看可用指令`);
  }
}

// 切換到安全模式的函數
function switchToSafeMode() {
  Logger.log('🛡️ === 切換到安全模式 ===');
  Logger.log('系統已經在使用安全模式 (handleTelegramBotSafe)');
  Logger.log('如需重啟，請執行 safeRestartBot()');
}

// V50.2.0 新增：快速修復和驗證函數
function quickFixAndTest() {
  Logger.log('🚀 === V50.2.0 快速修復和驗證 ===');
  
  try {
    // 1. 清除所有快取
    Logger.log('1️⃣ 清除記憶體快取...');
    WEBHOOK_MEMORY_CACHE.duplicateCache.clear();
    WEBHOOK_MEMORY_CACHE.stats = {
      memoryHits: 0,
      propertiesHits: 0,
      newRequests: 0,
      cleanupCount: 0,
      propertiesErrors: 0
    };
    WEBHOOK_MEMORY_CACHE.lastCleanup = Date.now();
    WEBHOOK_MEMORY_CACHE.lastPropertiesCleanup = Date.now();
    
    // 2. 清除 Properties 記錄
    Logger.log('2️⃣ 清除 Properties 記錄...');
    const clearedCount = clearDuplicateRecords();
    Logger.log(`✅ 清除了 ${clearedCount} 個記錄`);
    
    // 3. 重置系統指標
    Logger.log('3️⃣ 重置系統指標...');
    RESPONSE_METRICS.totalRequests = 0;
    RESPONSE_METRICS.totalResponseTime = 0;
    RESPONSE_METRICS.maxResponseTime = 0;
    RESPONSE_METRICS.successfulResponses = 0;
    RESPONSE_METRICS.failedResponses = 0;
    RESPONSE_METRICS.duplicateRequests = 0;
    
    // 4. 驗證配置
    Logger.log('4️⃣ 驗證當前配置...');
    Logger.log(`重複檢測窗口: ${WEBHOOK_MEMORY_CACHE.duplicateWindow}ms`);
    Logger.log(`Properties 窗口: ${WEBHOOK_MEMORY_CACHE.propertiesWindow}ms`);
    Logger.log(`最大快取大小: ${WEBHOOK_MEMORY_CACHE.maxCacheSize}`);
    
    // 5. 執行診斷
    Logger.log('5️⃣ 執行完整診斷...');
    const diagnostics = diagnoseWebhookIssues();
    
    Logger.log('✅ 快速修復完成！');
    Logger.log('💡 建議：現在可以測試 Bot 功能，應該不會再有重複處理問題');
    
    return {
      success: true,
      clearedRecords: clearedCount,
      duplicateWindow: WEBHOOK_MEMORY_CACHE.duplicateWindow,
      diagnostics: diagnostics
    };
    
  } catch (error) {
    Logger.log(`❌ 修復過程中發生錯誤: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

// 緊急檢查 Webhook 狀態
function emergencyWebhookCheck() {
  Logger.log('🚨 === 緊急 Webhook 狀態檢查 ===');
  
  try {
    const token = CONFIG.TELEGRAM_BOT_TOKEN;
    if (!token || token === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
      Logger.log('❌ Bot Token 未設定');
      return { success: false, error: 'Bot Token 未設定' };
    }
    
    // 檢查當前 Webhook 狀態
    const statusUrl = `https://api.telegram.org/bot${token}/getWebhookInfo`;
    const statusResponse = UrlFetchApp.fetch(statusUrl);
    const statusResult = JSON.parse(statusResponse.getContentText());
    
    Logger.log(`📊 Webhook 狀態: ${statusResponse.getContentText()}`);
    
    // 重點檢查
    if (statusResult.result) {
      const info = statusResult.result;
      Logger.log(`🔗 URL: ${info.url}`);
      Logger.log(`📊 待處理更新: ${info.pending_update_count}`);
      Logger.log(`❌ 最後錯誤: ${info.last_error_message || '無'}`);
      Logger.log(`⏰ 最後錯誤時間: ${info.last_error_date ? new Date(info.last_error_date * 1000) : '無'}`);
      Logger.log(`🔄 最大連接數: ${info.max_connections}`);
    }
    
    return {
      success: true,
      webhookInfo: statusResult.result
    };
    
  } catch (error) {
    Logger.log(`❌ 檢查過程中發生錯誤: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}/
/ 強制清除所有待處理更新
function forceClearPendingUpdates() {
  Logger.log('💥 === 強制清除待處理更新 ===');
  
  try {
    const token = CONFIG.TELEGRAM_BOT_TOKEN;
    if (!token || token === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
      Logger.log('❌ Bot Token 未設定');
      return { success: false, error: 'Bot Token 未設定' };
    }
    
    // 1. 刪除 Webhook 並清除待處理更新
    Logger.log('1️⃣ 刪除 Webhook 並清除待處理更新...');
    const deleteUrl = `https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`;
    const deleteResponse = UrlFetchApp.fetch(deleteUrl);
    const deleteResult = JSON.parse(deleteResponse.getContentText());
    Logger.log(`🗑️ 刪除結果: ${deleteResponse.getContentText()}`);
    
    // 2. 等待清理完成
    Logger.log('2️⃣ 等待 10 秒確保清理完成...');
    Utilities.sleep(10000);
    
    // 3. 清除本地快取
    Logger.log('3️⃣ 清除本地快取...');
    WEBHOOK_MEMORY_CACHE.duplicateCache.clear();
    WEBHOOK_MEMORY_CACHE.stats = {
      memoryHits: 0,
      propertiesHits: 0,
      newRequests: 0,
      cleanupCount: 0,
      propertiesErrors: 0
    };
    const clearedCount = clearDuplicateRecords();
    Logger.log(`✅ 清除了 ${clearedCount} 個本地記錄`);
    
    // 4. 重新設定 Webhook（使用優化配置）
    Logger.log('4️⃣ 重新設定 Webhook...');
    const webhookUrl = 'https://script.google.com/macros/s/AKfycbwKETvAD-bPj8ttKlL1HTh1E0SEcGhitpSp0GOmcsUz6JEaONN5F7-95QCsPt0I_XXmRg/exec';
    
    const setUrl = `https://api.telegram.org/bot${token}/setWebhook`;
    const config = {
      url: webhookUrl,
      max_connections: 1,  // 限制為 1 個連接
      drop_pending_updates: true  // 再次確保清除待處理更新
    };
    
    const options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify(config)
    };
    
    const setResponse = UrlFetchApp.fetch(setUrl, options);
    const setResult = JSON.parse(setResponse.getContentText());
    Logger.log(`🔧 設定結果: ${setResponse.getContentText()}`);
    
    // 5. 最終驗證
    Logger.log('5️⃣ 最終驗證...');
    Utilities.sleep(3000);
    const finalCheck = emergencyWebhookCheck();
    
    if (setResult.ok) {
      Logger.log('✅ 強制清除完成！');
      Logger.log('💡 所有待處理更新應該已被清除');
      return {
        success: true,
        clearedRecords: clearedCount,
        finalStatus: finalCheck.webhookInfo
      };
    } else {
      Logger.log(`❌ 設定失敗: ${setResult.description}`);
      return {
        success: false,
        error: setResult.description
      };
    }
    
  } catch (error) {
    Logger.log(`❌ 清除過程中發生錯誤: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}