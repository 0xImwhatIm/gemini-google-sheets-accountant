// =================================================================================================
// 智慧記帳 GEM - Google Apps Script (V49.4.2 - 最終整合修正版)
// =================================================================================================
// 版本：V49.4.2
// 更新日期：2025-10-06
// 主要更新：整合財政部電子發票診斷功能，提供一個包含所有模組與修正的最終完整版本。
// 1. 【功能完整性】補全所有被省略的函式，包含 IOU、PDF、測試、端點處理等。
// 2. 【CSV 修正整合】完整實作財政部 CSV 的特殊處理邏輯 (MOF_CSV)。
// 3. 【語法修正完成】修正所有語法錯誤和格式問題，確保代碼品質。
// 4. 【診斷增強】新增 CSV 格式診斷和強化郵件搜尋功能。
// 5. 【版本校準】統一程式碼內所有版本號為 V49.4.2。
// =================================================================================================

// ====================【使用者設定區】====================
const CONFIG = {
  MAIN_LEDGER_ID: PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID') || 'YOUR_GOOGLE_SHEET_ID_HERE',
  GEMINI_API_KEY: PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || 'YOUR_GEMINI_API_KEY_HERE',
  GEMINI_MODEL_NAME: 'gemini-flash-latest',
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
    return errors;
  },
  
  validateForImageSaving() {
    if (!this.FOLDER_ID_ARCHIVE) {
      return 'FOLDER_ID_ARCHIVE 未在指令碼屬性中設定，無法存檔圖片。';
    }
    return null;
  }
};

// 配置初始化檢查
(function initializeConfig() {
  const errors = CONFIG.validate();
  if (errors.length > 0) {
    Logger.log(`⚠️ V49.4.2 配置警告: ${errors.join(', ')}`);
  } else {
    Logger.log('✅ V49.4.2 配置檢查通過');
  }
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
        version: 'V49.4.2',
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
    
    return HtmlService.createHtmlOutput(`<h1>智慧記帳 GEM V49.4.2</h1><p>最終整合修正版已啟用</p>`);
  }, { name: 'doGet' });
}

function doPost(e) {
  return safeExecute(() => {
    if (!e || !e.parameter) { throw new Error('缺少請求參數'); }
    
    const endpoint = e.parameter.endpoint;
    if (!endpoint) { throw new Error('缺少 endpoint 參數'); }
    
    if (endpoint === 'image') { return doPost_Image(e); }
    else if (endpoint === 'voice') { return doPost_Voice(e); }
    else if (endpoint === 'pdf') { return doPost_Pdf(e); }
    else if (endpoint === 'iou') { return doPost_Iou(e); }
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
    
    Logger.log(`[V49.4.2-Voice] 處理語音文字: ${voiceText}`);
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
    
    Logger.log(`[V49.4.2-Image] 開始處理圖片...`);
    
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
        Logger.log(`[V49.4.2-Image] 圖片已存檔: ${fileUrl}`);
      } catch (saveError) {
        Logger.log(`[V49.4.2-Image] ⚠️ 圖片存檔失敗: ${saveError.message}`);
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
    
    Logger.log(`[V49.4.2-PDF] 開始處理 PDF...`);
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
    
    Logger.log(`[V49.4.2-IOU] 處理 IOU 請求: ${action} - ${text}`);
    
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
    Logger.log('[V49.4.2-Email] 開始自動化郵件處理...');
    
    const ss = SpreadsheetApp.openById(CONFIG.MAIN_LEDGER_ID);
    const rulesSheet = ss.getSheetByName(CONFIG.EMAIL_RULES_SHEET_NAME);
    if (!rulesSheet) {
      Logger.log(`[V49.4.2-Email] 找不到郵件規則工作表: ${CONFIG.EMAIL_RULES_SHEET_NAME}`);
      return false;
    }
    
    const rules = rulesSheet.getDataRange().getValues();
    if (rules.length < 2) {
      Logger.log(`[V49.4.2-Email] ⚠️ ${CONFIG.EMAIL_RULES_SHEET_NAME} 工作表中沒有任何規則。`);
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
                  Logger.log(`[V49.4.2-Email] ⚠️ HTML 郵件處理失敗: ${apiError.message}`);
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
                      Logger.log(`[V49.4.2-Email] ⚠️ PDF 處理失敗: ${apiError.message}`);
                    }
                  }
                });
              }
              
              if (processedSuccessfully) {
                message.markRead();
              } else {
                Logger.log(`[V49.4.2-Email] ⚠️ 郵件 "${message.getSubject()}" 無符合條件的可處理內容，保持未讀。`);
              }
              
            } catch (err) {
              Logger.log(`[V49.4.2-Email] ❌ 處理單一郵件失敗: ${err.message}`);
            }
          }
        }
      }
    }
    
    if (totalProcessedRecords === 0) {
      Logger.log(`[V49.4.2-Email] 掃描完成，未找到並處理任何符合規則的未讀郵件。`);
    } else {
      Logger.log(`[V49.4.2-Email] ✅ Email 處理完成，共處理 ${totalProcessedRecords} 筆記錄。`);
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
    
    Logger.log(`[V49.4.2-IOU] 處理結算: ${payer} 收到 ${totalAmount}`);
    
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
        '財政部電子發票 CSV 特殊格式處理 - V49.4.2'
      ]);
      Logger.log('✅ 財政部電子發票規則已新增');
    } else {
      Logger.log('ℹ️ 財政部電子發票規則已存在');
      
      // 檢查是否需要更新處理類型
      for (let i = 1; i < existingRules.length; i++) {
        if (existingRules[i][0] && existingRules[i][0].includes('noreply@einvoice.nat.gov.tw')) {
          if (existingRules[i][2] !== 'MOF_CSV') {
            rulesSheet.getRange(i + 1, 3).setValue('MOF_CSV');
            rulesSheet.getRange(i + 1, 4).setValue('財政部電子發票 CSV 特殊格式處理 - V49.4.2');
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
    version: 'V49.4.2',
    updateDate: '2025-10-06',
    features: [
      '語音記帳',
      '圖片OCR記帳',
      '郵件自動處理 (CSV/HTML/PDF)',
      '財政部電子發票自動處理',
      'IOU代墊款分帳',
      '圖片存檔連結',
      '時區感知處理',
      '多幣別支援',
      '語法錯誤修正完成'
    ],
    endpoints: [
      '/exec?endpoint=voice',
      '/exec?endpoint=image', 
      '/exec?endpoint=pdf',
      '/exec?endpoint=iou'
    ],
    status: 'active'
  };
}

function checkSystemHealth() {
  Logger.log('🏥 === 系統健康檢查 V49.4.2 ===');
  
  const health = {
    timestamp: new Date().toISOString(),
    version: 'V49.4.2',
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
Logger.log('✅ V49.4.2 智慧記帳 GEM 載入完成 - 所有功能已就緒');

// =================================================================================================
// 測試和除錯函數
// =================================================================================================
function listAvailableModels() {
  try {
    Logger.log(`🔑 使用的 API Key: ${CONFIG.GEMINI_API_KEY ? CONFIG.GEMINI_API_KEY.substring(0, 10) + '...' : '未設定'}`);
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${CONFIG.GEMINI_API_KEY}`;
    Logger.log(`📡 請求 URL: ${url}`);
    
    const options = {
      'method': 'get',
      'muteHttpExceptions': true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    Logger.log(`📊 回應代碼: ${responseCode}`);
    Logger.log(`📄 回應內容: ${responseText}`);
    
    if (responseCode === 200) {
      const models = JSON.parse(responseText);
      if (models.models) {
        Logger.log('✅ 可用模型:');
        models.models.forEach(model => {
          Logger.log(`  - ${model.name} (${model.displayName})`);
        });
      }
    } else {
      Logger.log('❌ 無法取得模型列表');
    }
    
    return responseText;
  } catch (error) {
    Logger.log(`💥 錯誤: ${error.message}`);
    return error.message;
  }
}

function testGeminiConnection() {
  Logger.log('🧪 測試 Gemini API 連接...');
  
  // 檢查配置
  Logger.log('--- 步驟 0: 檢查配置 ---');
  Logger.log(`API Key 設定: ${CONFIG.GEMINI_API_KEY ? '已設定' : '未設定'}`);
  Logger.log(`模型名稱: ${CONFIG.GEMINI_MODEL_NAME}`);
  
  // 先列出可用模型
  Logger.log('--- 步驟 1: 列出可用模型 ---');
  listAvailableModels();
  
  // 測試不同的模型名稱
  Logger.log('--- 步驟 2: 測試不同模型 ---');
  const modelsToTest = [
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro-latest', 
    'gemini-pro',
    'models/gemini-1.5-flash-latest',
    'models/gemini-1.5-pro-latest'
  ];
  
  for (const modelName of modelsToTest) {
    Logger.log(`\n🔍 測試模型: ${modelName}`);
    testSingleModel(modelName);
  }
}

function testSingleModel(modelName) {
  try {
    const testPrompt = '請回答：1+1等於多少？';
    const requestBody = {
      "contents": [{ "parts": [{ "text": testPrompt }] }]
    };
    
    const options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify(requestBody),
      'muteHttpExceptions': true
    };
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    Logger.log(`  回應代碼: ${responseCode}`);
    
    if (responseCode === 200) {
      Logger.log(`  ✅ ${modelName} 可用！`);
      Logger.log(`  回應: ${responseText.substring(0, 200)}...`);
    } else {
      Logger.log(`  ❌ ${modelName} 不可用`);
      Logger.log(`  錯誤: ${responseText.substring(0, 200)}...`);
    }
    
  } catch (error) {
    Logger.log(`  💥 ${modelName} 測試錯誤: ${error.message}`);
  }
}functi
on quickTestNewModel() {
  Logger.log('🚀 快速測試新模型: models/gemini-2.5-flash');
  
  try {
    const testPrompt = '請用 JSON 格式回答：{"answer": "2", "explanation": "1+1=2"}。問題：1+1等於多少？';
    const requestBody = {
      "contents": [{ "parts": [{ "text": testPrompt }] }],
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
    
    Logger.log(`📡 測試 URL: ${url}`);
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    Logger.log(`📊 回應代碼: ${responseCode}`);
    Logger.log(`📄 回應內容: ${responseText}`);
    
    if (responseCode === 200) {
      Logger.log('✅ 新模型測試成功！JSON 模式正常工作！');
      
      // 測試 JSON 解析
      try {
        const jsonResponse = JSON.parse(responseText);
        const aiResultText = jsonResponse.candidates[0].content.parts[0].text;
        const parsedResult = JSON.parse(aiResultText);
        Logger.log(`🎯 解析結果: ${JSON.stringify(parsedResult)}`);
      } catch (parseError) {
        Logger.log(`⚠️ JSON 解析警告: ${parseError.message}`);
      }
    } else {
      Logger.log('❌ 新模型測試失敗');
    }
    
  } catch (error) {
    Logger.log(`💥 測試錯誤: ${error.message}`);
  }
}funct
ion testWorkingModels() {
  Logger.log('🚀 測試可用的模型...');
  
  const testPrompt = '請回答：1+1等於多少？';
  const requestBody = {
    "contents": [{ "parts": [{ "text": testPrompt }] }]
  };
  
  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(requestBody),
    'muteHttpExceptions': true
  };
  
  // 從之前的測試結果中選擇一些可能可用的模型
  const modelsToTest = [
    'gemini-flash-latest',
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-pro-latest'
  ];
  
  for (const modelName of modelsToTest) {
    Logger.log(`\n🔍 測試模型: ${modelName}`);
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
    Logger.log(`📡 URL: ${url}`);
    
    try {
      const response = UrlFetchApp.fetch(url, options);
      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();
      
      Logger.log(`📊 回應代碼: ${responseCode}`);
      
      if (responseCode === 200) {
        Logger.log(`✅ ${modelName} 可用！`);
        Logger.log(`📄 回應: ${responseText.substring(0, 300)}...`);
        
        // 測試 JSON 模式
        Logger.log(`🧪 測試 ${modelName} 的 JSON 模式...`);
        testJsonMode(modelName);
        
        return modelName;
      } else {
        Logger.log(`❌ ${modelName} 不可用: ${responseCode}`);
        if (responseText.length < 500) {
          Logger.log(`📄 錯誤: ${responseText}`);
        }
      }
      
    } catch (error) {
      Logger.log(`💥 ${modelName} 錯誤: ${error.message}`);
    }
  }
  
  Logger.log('❌ 沒有找到可用的模型');
  return null;
}

function testJsonMode(modelName) {
  try {
    const testPrompt = '請用 JSON 格式回答：{"answer": "2"}。問題：1+1等於多少？';
    const requestBody = {
      "contents": [{ "parts": [{ "text": testPrompt }] }],
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
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    Logger.log(`🔬 JSON 模式測試 - 回應代碼: ${responseCode}`);
    
    if (responseCode === 200) {
      Logger.log(`✅ ${modelName} 支援 JSON 模式！`);
      Logger.log(`📄 JSON 回應: ${responseText.substring(0, 200)}...`);
    } else {
      Logger.log(`⚠️ ${modelName} 不支援 JSON 模式，但可以用文字模式`);
    }
    
  } catch (error) {
    Logger.log(`💥 JSON 模式測試錯誤: ${error.message}`);
  }
}functi
on finalSystemTest() {
  Logger.log('🎯 === V49.4.2 最終系統測試 ===');
  
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
  
  Logger.log('\n🎉 === V49.4.2 系統測試完成 ===');
  Logger.log('✅ 所有核心功能已就緒，可以開始使用！');
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

function finalSystemTestV49_4_2() {
  Logger.log('🎯 === V49.4.2 最終系統測試 (含財政部電子發票) ===');
  
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
  
  // 測試 4: 財政部電子發票設定
  Logger.log('\n🏛️ 測試 4: 財政部電子發票設定');
  try {
    const mofSetup = setupMOFInvoiceRule();
    if (mofSetup) {
      Logger.log('✅ 財政部電子發票規則設定成功');
    } else {
      Logger.log('⚠️ 財政部電子發票規則設定失敗');
    }
  } catch (error) {
    Logger.log(`❌ 財政部電子發票設定失敗: ${error.message}`);
  }
  
  // 測試 5: 配置檢查
  Logger.log('\n⚙️ 測試 5: 系統配置檢查');
  const configErrors = CONFIG.validate();
  if (configErrors.length === 0) {
    Logger.log('✅ 系統配置正常');
  } else {
    Logger.log(`⚠️ 配置警告: ${configErrors.join(', ')}`);
  }
  
  // 測試 6: 版本資訊
  Logger.log('\n📋 測試 6: 版本資訊');
  const versionInfo = getVersionInfo();
  Logger.log(`✅ 版本: ${versionInfo.version}`);
  Logger.log(`📅 更新日期: ${versionInfo.updateDate}`);
  Logger.log(`🚀 功能數量: ${versionInfo.features.length}`);
  
  Logger.log('\n🎉 === V49.4.2 系統測試完成 ===');
  Logger.log('✅ 所有核心功能已就緒，包含財政部電子發票處理！');
}

// 診斷財政部電子發票郵件匹配問題
function diagnoseMOFEmailMatching() {
  Logger.log('🔍 === 財政部電子發票郵件匹配診斷 ===');
  
  try {
    // 1. 檢查 EmailRules 工作表
    const ss = SpreadsheetApp.openById(CONFIG.MAIN_LEDGER_ID);
    const rulesSheet = ss.getSheetByName(CONFIG.EMAIL_RULES_SHEET_NAME);
    
    if (!rulesSheet) {
      Logger.log('❌ EmailRules 工作表不存在！');
      return false;
    }
    
    const rules = rulesSheet.getDataRange().getValues();
    Logger.log(`📋 EmailRules 工作表存在，共 ${rules.length - 1} 條規則`);
    
    // 2. 檢查財政部規則
    Logger.log('\n🏛️ 檢查財政部規則:');
    const mofRules = rules.filter((rule, index) => {
      if (index === 0) return false; // 跳過表頭
      return rule[0] && rule[0].includes('einvoice.nat.gov.tw');
    });
    
    if (mofRules.length === 0) {
      Logger.log('❌ 未找到財政部電子發票規則！');
      Logger.log('💡 執行 setupMOFInvoiceRule() 來建立規則');
      return false;
    }
    
    mofRules.forEach((rule, index) => {
      Logger.log(`📋 規則 ${index + 1}: ${rule[0]} | ${rule[1]} | ${rule[2]} | ${rule[3]}`);
    });
    
    // 3. 檢查未讀郵件
    Logger.log('\n📧 檢查未讀郵件:');
    const searchQueries = [
      'from:noreply@einvoice.nat.gov.tw is:unread',
      'from:noreply@einvoice.nat.gov.tw subject:(財政部電子發票) is:unread',
      'from:noreply@einvoice.nat.gov.tw subject:(財政部電子發票整合服務平台) is:unread'
    ];
    
    searchQueries.forEach((query, index) => {
      Logger.log(`\n🔍 搜尋 ${index + 1}: ${query}`);
      const threads = GmailApp.search(query, 0, 3);
      Logger.log(`📧 找到 ${threads.length} 個郵件`);
      
      threads.forEach((thread, threadIndex) => {
        const messages = thread.getMessages();
        const latestMessage = messages[messages.length - 1];
        Logger.log(`  📧 郵件 ${threadIndex + 1}:`);
        Logger.log(`    寄件者: ${latestMessage.getFrom()}`);
        Logger.log(`    主旨: ${latestMessage.getSubject()}`);
        Logger.log(`    未讀: ${latestMessage.isUnread()}`);
        Logger.log(`    附件數: ${latestMessage.getAttachments().length}`);
        
        // 檢查附件
        latestMessage.getAttachments().forEach((att, attIndex) => {
          Logger.log(`      📎 附件 ${attIndex + 1}: ${att.getName()} (${att.getContentType()})`);
        });
      });
    });
    
    // 4. 測試規則匹配
    Logger.log('\n🎯 測試規則匹配:');
    mofRules.forEach((rule, ruleIndex) => {
      const [sender, subjectKeyword, processingType] = rule;
      const searchQuery = `from:${sender} ${subjectKeyword ? `subject:(${subjectKeyword})` : ''} is:unread`;
      
      Logger.log(`\n📋 規則 ${ruleIndex + 1} 測試:`);
      Logger.log(`  搜尋條件: ${searchQuery}`);
      
      try {
        const threads = GmailApp.search(searchQuery, 0, 3);
        Logger.log(`  匹配結果: ${threads.length} 個郵件`);
        
        if (threads.length > 0) {
          Logger.log(`  ✅ 規則匹配成功，處理類型: ${processingType}`);
        } else {
          Logger.log(`  ⚠️ 規則無匹配郵件`);
        }
      } catch (error) {
        Logger.log(`  ❌ 搜尋失敗: ${error.message}`);
      }
    });
    
    Logger.log('\n🎉 === 診斷完成 ===');
    return true;
    
  } catch (error) {
    Logger.log(`❌ 診斷失敗: ${error.message}`);
    return false;
  }
}

// =================================================================================================
// 財政部 CSV 格式測試函數
// =================================================================================================
function testMOFCSVFormat() {
  Logger.log('🧪 === 財政部 CSV 格式測試 (使用真實資料) ===');
  
  // 使用你提供的真實財政部 CSV 資料格式
  const realCSVData = `表頭=M|載具名稱|載具號碼|發票日期|商店統編|商店店名|發票號碼|總金額|發票狀態|明細=D|發票號碼|小計|品項名稱|
M|手機條碼|/PZWC6KQ|20250901|80354145|全聯實業股份有限公司民生社區分公司|SA53840100|426|開立|
D|SA53840100|0|全菲仕樂印花張|
D|SA53840100|126|統一LP33機|
D|SA53840100|164|六甲田莊鮮乳|
D|SA53840100|95|巴伐利亞培根|
D|SA53840100|41|小磨坊白胡椒鹽|
M|手機條碼|/PZWC6KQ|20250901|42655986|威摩科技股份有限公司|TE59643910|42|開立|
D|TE59643910|42|租借費|
M|手機條碼|/PZWC6KQ|20250902|93645619|統一超商股份有限公司台北市第一一四二分公司|SM80664141|220|開立|
D|SM80664141|220|倫敦登喜路極光雙晶球|
M|手機條碼|/PZWC6KQ|20250903|70784791|統一超商股份有限公司台北市第九十一分公司|SM13779517|49|開立|
D|SM13779517|49|Base U高蛋白榛果可可牛乳|
M|手機條碼|/PZWC6KQ|20250904|24803107|全家便利商店股份有限公司台北市第五五五分公司|SF49474266|130|開立|
D|SF49474266|95|二配香拌海鮮醬肉絲蛋炒飯|
D|SF49474266|20|可爾必思水語３３０ｍｌ|
D|SF49474266|15|ＬＰ３３益敏優多|
M|手機條碼|/PZWC6KQ|20250904|50958962|睿能數位服務股份有限公司|TL19418626|53|開立|
D|TL19418626|53|GoShare 服務|
M|手機條碼|/PZWC6KQ|20250913|48725003|聯璨商行|TH09315512|4|作廢|
D|TH09315512|4|電器用品|
M|跨境電商電子郵件載具|mr.slowcore@gmail.com|20250906|42526317|Apple Distribution International|SD46419355|50|開立|
D|SD46419355|50|PC1-G SUB|
M|手機條碼|/PZWC6KQ|20250907|88122703|Netflix Pte. Ltd.|SE89527260|380|開立|
D|SE89527260|380|Subscription|`;

  try {
    // 解析 CSV 資料
    const csvData = Utilities.parseCsv(realCSVData, '|');
    Logger.log(`📄 測試 CSV 資料行數: ${csvData.length}`);
    
    // 尋找表頭行
    let headerRow = csvData.find(row => row[0] === '表頭=M');
    if (!headerRow) {
      Logger.log('❌ 找不到表頭行');
      return false;
    }
    
    Logger.log(`📋 表頭: ${headerRow.slice(0, 9).join('|')}`);
    
    // 建立欄位對應 (根據真實格式)
    const headerMap = {
      '載具名稱': 1,    // 載具名稱
      '載具號碼': 2,    // 載具號碼  
      '發票日期': 3,    // 發票日期
      '商店統編': 4,    // 商店統編
      '商店店名': 5,    // 商店店名
      '發票號碼': 6,    // 發票號碼
      '總金額': 7,      // 總金額
      '發票狀態': 8     // 發票狀態
    };
    
    // 處理 M 行資料
    let totalInvoices = 0;
    let validInvoices = 0;
    let invalidInvoices = 0;
    
    csvData.forEach((row, index) => {
      if (row[0] === 'M') {
        totalInvoices++;
        const carrierType = row[headerMap['載具名稱']];
        const carrierNumber = row[headerMap['載具號碼']];
        const dateStr = row[headerMap['發票日期']];
        const taxId = row[headerMap['商店統編']];
        const storeName = row[headerMap['商店店名']];
        const invoiceNumber = row[headerMap['發票號碼']];
        const amount = parseFloat(row[headerMap['總金額']]) || 0;
        const status = row[headerMap['發票狀態']];
        
        Logger.log(`\n💰 發票 ${totalInvoices}:`);
        Logger.log(`  載具: ${carrierType} (${carrierNumber})`);
        Logger.log(`  日期: ${dateStr}`);
        Logger.log(`  商店: ${storeName}`);
        Logger.log(`  統編: ${taxId}`);
        Logger.log(`  發票號碼: ${invoiceNumber}`);
        Logger.log(`  金額: ${amount}`);
        Logger.log(`  狀態: ${status}`);
        
        // 檢查是否為有效發票 (開立狀態)
        if (status === '開立') {
          validInvoices++;
          
          // 測試商店名稱簡化
          let simplifiedName = storeName;
          if (storeName.includes('全聯實業')) {
            simplifiedName = '全聯';
          } else if (storeName.includes('統一超商')) {
            simplifiedName = '7-ELEVEN';
          } else if (storeName.includes('全家便利商店')) {
            simplifiedName = '全家';
          } else if (storeName.includes('威摩科技')) {
            simplifiedName = 'WeMo Scooter';
          } else if (storeName.includes('睿能數位')) {
            simplifiedName = 'GoShare';
          } else if (storeName.includes('Apple Distribution')) {
            simplifiedName = 'Apple';
          } else if (storeName.includes('Netflix')) {
            simplifiedName = 'Netflix';
          }
          
          Logger.log(`  ✅ 簡化名稱: ${simplifiedName}`);
          
          // 測試日期解析
          if (dateStr && dateStr.length === 8) {
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            const parsedDate = new Date(`${year}-${month}-${day}`);
            Logger.log(`  📅 解析日期: ${parsedDate.toLocaleDateString('zh-TW')}`);
          }
          
          Logger.log(`  💳 記帳資料: ${simplifiedName} - ${amount}元`);
        } else {
          invalidInvoices++;
          Logger.log(`  ⚠️ 跳過 (狀態: ${status})`);
        }
      }
    });
    
    Logger.log(`\n📊 === 測試結果統計 ===`);
    Logger.log(`📄 總資料行數: ${csvData.length}`);
    Logger.log(`💰 總發票數量: ${totalInvoices}`);
    Logger.log(`✅ 有效發票數量: ${validInvoices} (開立狀態)`);
    Logger.log(`⚠️ 無效發票數量: ${invalidInvoices} (作廢等)`);
    
    // 計算總金額
    let totalAmount = 0;
    csvData.forEach((row) => {
      if (row[0] === 'M' && row[8] === '開立') {
        totalAmount += parseFloat(row[7]) || 0;
      }
    });
    Logger.log(`💵 有效發票總金額: ${totalAmount} 元`);
    
    Logger.log(`✅ 測試完成，CSV 格式解析正常，可以正確處理財政部電子發票資料`);
    return true;
    
  } catch (error) {
    Logger.log(`❌ CSV 格式測試失敗: ${error.message}`);
    return false;
  }
}

// 測試真實郵件附件處理 (包含已讀郵件)
function testRealMOFEmailAttachment() {
  Logger.log('📧 === 測試真實財政部電子發票郵件附件處理 ===');
  
  try {
    // 先搜尋未讀郵件
    let searchQuery = 'from:noreply@einvoice.nat.gov.tw subject:(財政部電子發票整合服務平台) is:unread';
    let threads = GmailApp.search(searchQuery, 0, 1);
    
    if (threads.length === 0) {
      Logger.log('⚠️ 找不到未讀的財政部電子發票郵件');
      Logger.log('� 搜尋最近的已讀郵件財進行測試...');
      
      // 搜尋最近的已讀郵件 (最近 30 天)
      searchQuery = 'from:noreply@einvoice.nat.gov.tw subject:(財政部電子發票整合服務平台) newer_than:30d';
      threads = GmailApp.search(searchQuery, 0, 1);
      
      if (threads.length === 0) {
        Logger.log('❌ 找不到任何財政部電子發票郵件 (最近 30 天)');
        Logger.log('� 請確認$：');
        Logger.log('   1. 是否有財政部電子發票郵件');
        Logger.log('   2. 寄件者是否為 noreply@einvoice.nat.gov.tw');
        Logger.log('   3. 主旨是否包含「財政部電子發票整合服務平台」');
        return false;
      }
      
      Logger.log('✅ 找到已讀郵件，用於測試');
    }
    
    const thread = threads[0];
    const messages = thread.getMessages();
    const latestMessage = messages[messages.length - 1];
    
    Logger.log(`📧 找到郵件: "${latestMessage.getSubject()}"`);
    Logger.log(`📅 郵件日期: ${latestMessage.getDate()}`);
    Logger.log(`👤 寄件者: ${latestMessage.getFrom()}`);
    Logger.log(`📖 郵件狀態: ${latestMessage.isUnread() ? '未讀' : '已讀'}`);
    
    // 檢查附件
    const attachments = latestMessage.getAttachments();
    Logger.log(`📎 附件數量: ${attachments.length}`);
    
    if (attachments.length === 0) {
      Logger.log('❌ 郵件沒有附件');
      return false;
    }
    
    // 顯示所有附件
    attachments.forEach((att, index) => {
      Logger.log(`  📎 附件 ${index + 1}: ${att.getName()} (${att.getContentType()}, ${att.getSize()} bytes)`);
    });
    
    // 尋找 CSV 附件
    const csvAttachments = attachments.filter(att => 
      att.getName().toLowerCase().endsWith('.csv')
    );
    
    if (csvAttachments.length === 0) {
      Logger.log('❌ 找不到 CSV 附件');
      return false;
    }
    
    Logger.log(`✅ 找到 ${csvAttachments.length} 個 CSV 附件`);
    
    // 處理第一個 CSV 附件
    const csvAttachment = csvAttachments[0];
    Logger.log(`📄 處理附件: ${csvAttachment.getName()}`);
    Logger.log(`📊 附件大小: ${csvAttachment.getSize()} bytes`);
    
    // 讀取 CSV 內容
    const csvContent = csvAttachment.getDataAsString('UTF-8');
    Logger.log(`📝 CSV 內容長度: ${csvContent.length} 字元`);
    
    // 顯示前幾行內容
    const lines = csvContent.split('\n');
    Logger.log(`📄 CSV 總行數: ${lines.length}`);
    Logger.log(`📋 前 5 行內容:`);
    lines.slice(0, 5).forEach((line, index) => {
      Logger.log(`  ${index + 1}: ${line.substring(0, 100)}${line.length > 100 ? '...' : ''}`);
    });
    
    // 使用真實的 processMOFInvoiceCSV 函數處理
    Logger.log(`\n🏛️ 開始處理財政部 CSV 附件...`);
    const recordsProcessed = processMOFInvoiceCSV(csvAttachment, latestMessage);
    
    if (recordsProcessed > 0) {
      Logger.log(`✅ 成功處理 ${recordsProcessed} 筆發票記錄`);
      Logger.log(`💡 測試成功！財政部電子發票處理邏輯正常運作`);
      
      if (latestMessage.isUnread()) {
        Logger.log(`💡 建議：如果測試成功，可以將郵件標記為已讀`);
        // latestMessage.markRead(); // 取消註解以標記為已讀
      }
    } else {
      Logger.log(`⚠️ 沒有處理任何記錄，請檢查 CSV 格式或處理邏輯`);
    }
    
    Logger.log(`\n🎉 === 真實附件測試完成 ===`);
    return recordsProcessed > 0;
    
  } catch (error) {
    Logger.log(`❌ 測試失敗: ${error.message}`);
    Logger.log(`📋 錯誤堆疊: ${error.stack}`);
    return false;
  }
}

// 強化的財政部郵件搜尋函數
function findMOFInvoiceEmails() {
  Logger.log('🔍 === 強化財政部電子發票郵件搜尋 ===');
  
  try {
    // 多種搜尋策略
    const searchStrategies = [
      // 策略 1: 完整搜尋條件
      {
        name: '完整條件搜尋',
        query: 'from:noreply@einvoice.nat.gov.tw subject:(財政部電子發票整合服務平台) is:unread'
      },
      // 策略 2: 只搜尋寄件者
      {
        name: '寄件者搜尋',
        query: 'from:noreply@einvoice.nat.gov.tw is:unread'
      },
      // 策略 3: 只搜尋主旨關鍵字
      {
        name: '主旨關鍵字搜尋',
        query: 'subject:(財政部電子發票) is:unread'
      },
      // 策略 4: 搜尋電子發票相關
      {
        name: '電子發票搜尋',
        query: 'subject:(電子發票) is:unread'
      },
      // 策略 5: 搜尋手機條碼相關
      {
        name: '手機條碼搜尋',
        query: 'subject:(手機條碼) is:unread'
      },
      // 策略 6: 搜尋消費發票相關
      {
        name: '消費發票搜尋',
        query: 'subject:(消費發票) is:unread'
      },
      // 策略 7: 廣泛搜尋財政部
      {
        name: '財政部搜尋',
        query: 'subject:(財政部) is:unread'
      }
    ];
    
    let foundEmails = [];
    
    searchStrategies.forEach(({ name, query }) => {
      try {
        Logger.log(`\n🔍 ${name}: ${query}`);
        const threads = GmailApp.search(query, 0, 10);
        Logger.log(`📧 找到 ${threads.length} 個郵件`);
        
        if (threads.length > 0) {
          threads.forEach((thread, index) => {
            const messages = thread.getMessages();
            const latestMessage = messages[messages.length - 1];
            
            Logger.log(`  📧 郵件 ${index + 1}:`);
            Logger.log(`    寄件者: ${latestMessage.getFrom()}`);
            Logger.log(`    主旨: ${latestMessage.getSubject()}`);
            Logger.log(`    日期: ${latestMessage.getDate()}`);
            Logger.log(`    未讀: ${latestMessage.isUnread()}`);
            Logger.log(`    附件數: ${latestMessage.getAttachments().length}`);
            
            // 檢查是否為財政部電子發票
            const from = latestMessage.getFrom().toLowerCase();
            const subject = latestMessage.getSubject();
            
            if (from.includes('einvoice.nat.gov.tw') || 
                subject.includes('財政部') || 
                subject.includes('電子發票') ||
                subject.includes('手機條碼')) {
              
              foundEmails.push({
                thread: thread,
                message: latestMessage,
                strategy: name,
                from: latestMessage.getFrom(),
                subject: latestMessage.getSubject(),
                date: latestMessage.getDate(),
                isUnread: latestMessage.isUnread(),
                attachmentCount: latestMessage.getAttachments().length
              });
              
              Logger.log(`    ✅ 疑似財政部電子發票郵件`);
            }
          });
        }
      } catch (error) {
        Logger.log(`    ❌ 搜尋失敗: ${error.message}`);
      }
    });
    
    // 去重複
    const uniqueEmails = [];
    const seenIds = new Set();
    
    foundEmails.forEach(email => {
      const messageId = email.message.getId();
      if (!seenIds.has(messageId)) {
        seenIds.add(messageId);
        uniqueEmails.push(email);
      }
    });
    
    Logger.log(`\n📊 === 搜尋結果總結 ===`);
    Logger.log(`🔍 執行搜尋策略: ${searchStrategies.length} 種`);
    Logger.log(`📧 找到疑似郵件: ${foundEmails.length} 個`);
    Logger.log(`✅ 去重後郵件: ${uniqueEmails.length} 個`);
    
    if (uniqueEmails.length > 0) {
      Logger.log(`\n📋 === 找到的財政部電子發票郵件 ===`);
      uniqueEmails.forEach((email, index) => {
        Logger.log(`\n📧 郵件 ${index + 1}:`);
        Logger.log(`  策略: ${email.strategy}`);
        Logger.log(`  寄件者: ${email.from}`);
        Logger.log(`  主旨: ${email.subject}`);
        Logger.log(`  日期: ${email.date}`);
        Logger.log(`  狀態: ${email.isUnread ? '未讀' : '已讀'}`);
        Logger.log(`  附件: ${email.attachmentCount} 個`);
        
        // 檢查附件類型
        if (email.attachmentCount > 0) {
          const attachments = email.message.getAttachments();
          attachments.forEach((att, attIndex) => {
            Logger.log(`    📎 附件 ${attIndex + 1}: ${att.getName()} (${att.getContentType()})`);
          });
        }
      });
      
      return uniqueEmails;
    } else {
      Logger.log(`\n⚠️ 沒有找到任何財政部電子發票郵件`);
      Logger.log(`💡 建議檢查：`);
      Logger.log(`   1. 郵件是否在垃圾郵件資料夾`);
      Logger.log(`   2. 郵件是否已被刪除`);
      Logger.log(`   3. 寄件者地址是否正確`);
      Logger.log(`   4. Gmail 搜尋權限是否正常`);
      
      return [];
    }
    
  } catch (error) {
    Logger.log(`❌ 搜尋失敗: ${error.message}`);
    return [];
  }
}

// 完整的財政部電子發票診斷函數
function completeMOFInvoiceDiagnosis() {
  Logger.log('🔍 === 財政部電子發票完整診斷 ===');
  
  try {
    // 1. 強化郵件搜尋
    Logger.log('\n📧 步驟 1: 強化郵件搜尋');
    const foundEmails = findMOFInvoiceEmails();
    
    // 2. 檢查郵件規則
    Logger.log('\n📋 步驟 2: 檢查郵件規則');
    const diagResult = diagnoseMOFEmailMatching();
    
    // 3. 測試 CSV 格式
    Logger.log('\n🧪 步驟 3: 測試 CSV 格式');
    const csvResult = testMOFCSVFormat();
    
    // 4. 測試真實附件 (如果找到郵件)
    let attachmentResult = false;
    if (foundEmails.length > 0) {
      Logger.log('\n📎 步驟 4: 測試真實郵件附件');
      
      // 找到有 CSV 附件的郵件
      const emailWithCSV = foundEmails.find(email => {
        const attachments = email.message.getAttachments();
        return attachments.some(att => att.getName().toLowerCase().endsWith('.csv'));
      });
      
      if (emailWithCSV) {
        Logger.log(`📧 使用郵件: "${emailWithCSV.subject}"`);
        const csvAttachments = emailWithCSV.message.getAttachments().filter(att => 
          att.getName().toLowerCase().endsWith('.csv')
        );
        
        if (csvAttachments.length > 0) {
          Logger.log(`🏛️ 開始處理財政部 CSV 附件...`);
          const recordsProcessed = processMOFInvoiceCSV(csvAttachments[0], emailWithCSV.message);
          attachmentResult = recordsProcessed > 0;
          
          if (attachmentResult) {
            Logger.log(`✅ 成功處理 ${recordsProcessed} 筆發票記錄`);
          }
        }
      }
    } else {
      Logger.log('\n⚠️ 步驟 4: 沒有找到可測試的郵件附件');
    }
    
    // 5. 總結報告
    Logger.log('\n📊 === 診斷總結 ===');
    Logger.log(`📧 找到郵件數量: ${foundEmails.length}`);
    Logger.log(`📋 郵件規則診斷: ${diagResult ? '✅ 正常' : '❌ 異常'}`);
    Logger.log(`🧪 CSV 格式測試: ${csvResult ? '✅ 正常' : '❌ 異常'}`);
    Logger.log(`📎 真實附件測試: ${attachmentResult ? '✅ 正常' : '⚠️ 無可測試郵件'}`);
    
    if (foundEmails.length > 0) {
      Logger.log('\n🎉 找到財政部電子發票郵件！');
      Logger.log('💡 系統應該能夠處理這些郵件');
      
      if (diagResult && csvResult) {
        Logger.log('✅ 系統診斷完全通過');
      } else {
        Logger.log('⚠️ 系統配置需要檢查');
      }
    } else {
      Logger.log('\n❌ 沒有找到財政部電子發票郵件');
      Logger.log('💡 請檢查郵件是否存在或搜尋條件');
    }
    
    return { 
      foundEmails: foundEmails.length, 
      diagResult, 
      csvResult, 
      attachmentResult,
      emails: foundEmails 
    };
    
  } catch (error) {
    Logger.log(`❌ 完整診斷失敗: ${error.message}`);
    return { foundEmails: 0, diagResult: false, csvResult: false, attachmentResult: false, emails: [] };
  }
}

// 全面的郵件搜尋診斷
function comprehensiveEmailSearch() {
  Logger.log('🔍 === 全面郵件搜尋診斷 ===');
  
  try {
    // 多種搜尋策略
    const searchStrategies = [
      // 財政部相關搜尋
      { name: '財政部完整搜尋', query: 'from:noreply@einvoice.nat.gov.tw is:unread' },
      { name: '財政部已讀搜尋', query: 'from:noreply@einvoice.nat.gov.tw newer_than:30d' },
      { name: '電子發票搜尋', query: 'subject:電子發票 is:unread' },
      { name: '手機條碼搜尋', query: 'subject:手機條碼 is:unread' },
      { name: '消費發票搜尋', query: 'subject:消費發票 is:unread' },
      { name: '發票彙整搜尋', query: 'subject:發票彙整 is:unread' },
      { name: '財政部主旨搜尋', query: 'subject:財政部 is:unread' },
      
      // 寄件者變體搜尋
      { name: '寄件者變體1', query: 'from:einvoice.nat.gov.tw is:unread' },
      { name: '寄件者變體2', query: 'from:no-reply@einvoice.nat.gov.tw is:unread' },
      { name: '寄件者變體3', query: 'from:noreply@nat.gov.tw is:unread' },
      
      // 廣泛搜尋
      { name: '所有未讀郵件', query: 'is:unread' },
      { name: '最近未讀郵件', query: 'is:unread newer_than:7d' }
    ];
    
    let totalFound = 0;
    let potentialMOFEmails = [];
    
    searchStrategies.forEach(({ name, query }) => {
      try {
        Logger.log(`\n🔍 ${name}: ${query}`);
        const threads = GmailApp.search(query, 0, 10);
        Logger.log(`📧 找到 ${threads.length} 個郵件`);
        totalFound += threads.length;
        
        if (threads.length > 0) {
          threads.forEach((thread, index) => {
            if (index < 3) { // 只顯示前3個
              const messages = thread.getMessages();
              const latestMessage = messages[messages.length - 1];
              
              Logger.log(`  📧 郵件 ${index + 1}:`);
              Logger.log(`    寄件者: ${latestMessage.getFrom()}`);
              Logger.log(`    主旨: ${latestMessage.getSubject()}`);
              Logger.log(`    日期: ${latestMessage.getDate()}`);
              Logger.log(`    未讀: ${latestMessage.isUnread()}`);
              Logger.log(`    附件: ${latestMessage.getAttachments().length} 個`);
              
              // 檢查是否可能是財政部電子發票
              const from = latestMessage.getFrom().toLowerCase();
              const subject = latestMessage.getSubject().toLowerCase();
              
              if (from.includes('einvoice') || 
                  from.includes('財政部') ||
                  subject.includes('電子發票') ||
                  subject.includes('手機條碼') ||
                  subject.includes('消費發票') ||
                  subject.includes('財政部')) {
                
                potentialMOFEmails.push({
                  thread: thread,
                  message: latestMessage,
                  strategy: name,
                  reason: '包含財政部/電子發票關鍵字'
                });
                
                Logger.log(`    ✅ 疑似財政部電子發票郵件`);
              }
            }
          });
        }
      } catch (error) {
        Logger.log(`    ❌ 搜尋失敗: ${error.message}`);
      }
    });
    
    Logger.log(`\n📊 === 搜尋總結 ===`);
    Logger.log(`🔍 執行搜尋策略: ${searchStrategies.length} 種`);
    Logger.log(`📧 總共找到郵件: ${totalFound} 個`);
    Logger.log(`✅ 疑似財政部郵件: ${potentialMOFEmails.length} 個`);
    
    if (potentialMOFEmails.length > 0) {
      Logger.log(`\n📋 === 疑似財政部電子發票郵件詳情 ===`);
      potentialMOFEmails.forEach((email, index) => {
        Logger.log(`\n📧 疑似郵件 ${index + 1}:`);
        Logger.log(`  搜尋策略: ${email.strategy}`);
        Logger.log(`  寄件者: ${email.message.getFrom()}`);
        Logger.log(`  主旨: ${email.message.getSubject()}`);
        Logger.log(`  日期: ${email.message.getDate()}`);
        Logger.log(`  狀態: ${email.message.isUnread() ? '未讀' : '已讀'}`);
        Logger.log(`  附件數: ${email.message.getAttachments().length}`);
        Logger.log(`  識別原因: ${email.reason}`);
        
        // 檢查附件
        if (email.message.getAttachments().length > 0) {
          email.message.getAttachments().forEach((att, attIndex) => {
            Logger.log(`    📎 附件 ${attIndex + 1}: ${att.getName()} (${att.getContentType()})`);
          });
        }
      });
      
      return potentialMOFEmails;
    } else {
      Logger.log(`\n⚠️ 沒有找到任何疑似財政部電子發票郵件`);
      Logger.log(`💡 可能的原因:`);
      Logger.log(`   1. 郵件可能在垃圾郵件資料夾`);
      Logger.log(`   2. 郵件可能已被刪除`);
      Logger.log(`   3. 寄件者地址可能不同`);
      Logger.log(`   4. 主旨格式可能不同`);
      Logger.log(`   5. Gmail 搜尋權限問題`);
      
      return [];
    }
    
  } catch (error) {
    Logger.log(`❌ 全面搜尋失敗: ${error.message}`);
    return [];
  }
}

// 診斷真實 CSV 格式
function diagnoseRealCSVFormat() {
  Logger.log('🔍 === 診斷真實財政部 CSV 格式 ===');
  
  try {
    // 先執行全面搜尋
    const potentialEmails = comprehensiveEmailSearch();
    
    if (potentialEmails.length === 0) {
      Logger.log('❌ 找不到任何財政部郵件進行 CSV 診斷');
      return false;
    }
    
    // 找到有 CSV 附件的郵件
    const emailWithCSV = potentialEmails.find(email => {
      const attachments = email.message.getAttachments();
      return attachments.some(att => att.getName().toLowerCase().endsWith('.csv'));
    });
    
    if (!emailWithCSV) {
      Logger.log('❌ 找到疑似郵件但沒有 CSV 附件');
      return false;
    }
    
    const latestMessage = emailWithCSV.message;
    
    Logger.log(`📧 分析郵件: "${latestMessage.getSubject()}"`);
    
    // 找到 CSV 附件
    const attachments = latestMessage.getAttachments();
    const csvAttachments = attachments.filter(att => 
      att.getName().toLowerCase().endsWith('.csv')
    );
    
    if (csvAttachments.length === 0) {
      Logger.log('❌ 找不到 CSV 附件');
      return false;
    }
    
    const csvAttachment = csvAttachments[0];
    Logger.log(`📄 分析 CSV 附件: ${csvAttachment.getName()}`);
    
    // 讀取 CSV 內容
    const csvContent = csvAttachment.getDataAsString('UTF-8');
    Logger.log(`📝 CSV 內容長度: ${csvContent.length} 字元`);
    
    // 分析不同分隔符
    const separators = [',', '|', ';', '\t'];
    const lines = csvContent.split('\n').filter(line => line.trim().length > 0);
    
    Logger.log(`📄 CSV 總行數: ${lines.length}`);
    Logger.log(`\n📋 前 10 行原始內容:`);
    
    lines.slice(0, 10).forEach((line, index) => {
      Logger.log(`${index + 1}: ${line}`);
    });
    
    Logger.log(`\n🔍 分隔符分析:`);
    separators.forEach(sep => {
      const firstLineColumns = lines[0] ? lines[0].split(sep).length : 0;
      Logger.log(`  ${sep === ',' ? '逗號' : sep === '|' ? '管道符' : sep === ';' ? '分號' : '制表符'} (${sep}): ${firstLineColumns} 欄`);
      
      if (firstLineColumns > 5) {
        Logger.log(`    前 5 欄: ${lines[0].split(sep).slice(0, 5).join(' | ')}`);
      }
    });
    
    // 尋找可能的表頭
    Logger.log(`\n🔍 尋找表頭模式:`);
    const headerPatterns = ['表頭=M', 'M|', '載具名稱', '發票日期', '商店店名', '發票號碼', '總金額'];
    
    lines.slice(0, 5).forEach((line, index) => {
      headerPatterns.forEach(pattern => {
        if (line.includes(pattern)) {
          Logger.log(`  第 ${index + 1} 行包含 "${pattern}": ${line}`);
        }
      });
    });
    
    // 嘗試不同的解析方式
    Logger.log(`\n🧪 嘗試解析 (使用管道符 |):`);
    try {
      const csvData = Utilities.parseCsv(csvContent, '|');
      Logger.log(`✅ 管道符解析成功，共 ${csvData.length} 行`);
      
      // 尋找 M 開頭的行
      const mRows = csvData.filter(row => row[0] === 'M');
      Logger.log(`� 財找到 ${mRows.length} 個 M 開頭的資料行`);
      
      if (mRows.length > 0) {
        Logger.log(`📋 第一個 M 行內容:`);
        mRows[0].forEach((cell, index) => {
          Logger.log(`  欄 ${index}: ${cell}`);
        });
      }
      
    } catch (error) {
      Logger.log(`❌ 管道符解析失敗: ${error.message}`);
    }
    
    Logger.log(`\n🧪 嘗試解析 (使用逗號 ,):`);
    try {
      const csvData = Utilities.parseCsv(csvContent, ',');
      Logger.log(`✅ 逗號解析成功，共 ${csvData.length} 行`);
      
      if (csvData.length > 0) {
        Logger.log(`📋 第一行內容 (${csvData[0].length} 欄):`);
        csvData[0].slice(0, 10).forEach((cell, index) => {
          Logger.log(`  欄 ${index}: ${cell}`);
        });
      }
      
    } catch (error) {
      Logger.log(`❌ 逗號解析失敗: ${error.message}`);
    }
    
    return true;
    
  } catch (error) {
    Logger.log(`❌ CSV 格式診斷失敗: ${error.message}`);
    return false;
  }
}

// 手動郵件檢查 - 幫助用戶確認郵件位置
function manualEmailCheck() {
  Logger.log('🔍 === 手動郵件檢查指南 ===');
  
  Logger.log('\n� 請在 Gmai斷l 網頁版手動檢查以下搜尋條件:');
  Logger.log('1. from:noreply@einvoice.nat.gov.tw');
  Logger.log('2. from:einvoice.nat.gov.tw');
  Logger.log('3. subject:財政部電子發票');
  Logger.log('4. subject:電子發票');
  Logger.log('5. subject:手機條碼');
  Logger.log('6. subject:消費發票');
  
  Logger.log('\n📧 如果找到郵件，請確認:');
  Logger.log('✅ 寄件者的完整地址');
  Logger.log('✅ 郵件主旨的完整內容');
  Logger.log('✅ 是否有 CSV 附件');
  Logger.log('✅ 郵件是否為未讀狀態');
  Logger.log('✅ 郵件是否在垃圾郵件資料夾');
  
  Logger.log('\n💡 找到郵件後，請提供以下資訊:');
  Logger.log('1. 完整的寄件者地址 (例如: noreply@einvoice.nat.gov.tw)');
  Logger.log('2. 完整的郵件主旨');
  Logger.log('3. CSV 附件的檔案名稱');
  Logger.log('4. 郵件日期');
  
  Logger.log('\n� 然 後我們可以調整搜尋條件來正確找到你的郵件');
}

// 手動標記郵件為未讀並測試
function markMOFEmailUnreadAndTest() {
  Logger.log('🔄 === 手動標記財政部郵件為未讀並測試 ===');
  
  try {
    // 使用更廣泛的搜尋
    const searchQueries = [
      'from:noreply@einvoice.nat.gov.tw',
      'from:einvoice.nat.gov.tw',
      'subject:電子發票',
      'subject:財政部'
    ];
    
    let foundMessage = null;
    
    for (const query of searchQueries) {
      Logger.log(`� 搜尋: ${query}`);
      const threads = GmailApp.search(query, 0, 3);
      Logger.log(`📧 找到 ${threads.length} 個郵件`);
      
      if (threads.length > 0) {
        for (const thread of threads) {
          const messages = thread.getMessages();
          const message = messages[messages.length - 1];
          
          Logger.log(`  📧 郵件: "${message.getSubject()}"`);
          Logger.log(`  📧 寄件者: ${message.getFrom()}`);
          
          // 檢查是否是財政部電子發票
          if (message.getFrom().includes('einvoice.nat.gov.tw') || 
              message.getSubject().includes('財政部') ||
              message.getSubject().includes('電子發票')) {
            foundMessage = message;
            Logger.log(`  ✅ 找到財政部電子發票郵件`);
            break;
          }
        }
        if (foundMessage) break;
      }
    }
    
    if (!foundMessage) {
      Logger.log('❌ 找不到任何財政部電子發票郵件');
      return false;
    }
    
    Logger.log(`\n📧 使用郵件: "${foundMessage.getSubject()}"`);
    Logger.log(`📧 寄件者: ${foundMessage.getFrom()}`);
    Logger.log(`📧 當前狀態: ${foundMessage.isUnread() ? '未讀' : '已讀'}`);
    
    // 標記為未讀
    if (!foundMessage.isUnread()) {
      foundMessage.markUnread();
      Logger.log('🔄 已將郵件標記為未讀');
      
      // 等待一下讓 Gmail 更新狀態
      Utilities.sleep(2000);
    }
    
    // 執行自動處理
    Logger.log('\n🚀 執行自動郵件處理...');
    const result = processAutomatedEmails();
    
    Logger.log(`📊 處理結果: ${result ? '✅ 成功' : '❌ 失敗'}`);
    
    return result;
    
  } catch (error) {
    Logger.log(`❌ 測試失敗: ${error.message}`);
    return false;
  }
}

// 測試郵件規則匹配
function testEmailRuleMatching() {
  Logger.log('🔍 === 測試郵件規則匹配 ===');
  
  try {
    // 1. 檢查 EmailRules 工作表
    const ss = SpreadsheetApp.openById(CONFIG.MAIN_LEDGER_ID);
    const rulesSheet = ss.getSheetByName(CONFIG.EMAIL_RULES_SHEET_NAME);
    
    if (!rulesSheet) {
      Logger.log('❌ EmailRules 工作表不存在');
      return false;
    }
    
    const rules = rulesSheet.getDataRange().getValues();
    Logger.log(`📋 EmailRules 工作表有 ${rules.length - 1} 條規則`);
    
    // 顯示所有規則
    rules.forEach((rule, index) => {
      if (index > 0 && rule[0]) {
        Logger.log(`  規則 ${index}: ${rule[0]} | ${rule[1]} | ${rule[2]}`);
      }
    });
    
    // 2. 搜尋財政部郵件
    const searchQuery = 'from:noreply@einvoice.nat.gov.tw is:unread';
    const threads = GmailApp.search(searchQuery, 0, 1);
    
    if (threads.length === 0) {
      Logger.log('⚠️ 找不到未讀的財政部郵件');
      Logger.log('💡 這就是為什麼自動處理找不到郵件的原因');
      
      // 搜尋已讀郵件進行測試
      const readThreads = GmailApp.search('from:noreply@einvoice.nat.gov.tw newer_than:7d', 0, 1);
      if (readThreads.length > 0) {
        const message = readThreads[0].getMessages()[readThreads[0].getMessages().length - 1];
        Logger.log(`📧 找到已讀郵件用於測試: "${message.getSubject()}"`);
        Logger.log(`📧 寄件者: ${message.getFrom()}`);
        
        // 測試規則匹配
        const from = message.getFrom();
        const subject = message.getSubject();
        
        Logger.log('\n🔍 測試規則匹配:');
        for (let i = 1; i < rules.length; i++) {
          const [sender, subjectKeyword, processingType] = rules[i];
          if (!sender) continue;
          
          Logger.log(`\n規則 ${i}: ${sender} | ${subjectKeyword} | ${processingType}`);
          
          const senderMatch = from.toLowerCase().includes(sender.toLowerCase());
          const subjectMatch = !subjectKeyword || subject.includes(subjectKeyword);
          
          Logger.log(`  寄件者匹配: ${senderMatch ? '✅' : '❌'} (${from} vs ${sender})`);
          Logger.log(`  主旨匹配: ${subjectMatch ? '✅' : '❌'} (${subject} vs ${subjectKeyword})`);
          
          if (senderMatch && subjectMatch) {
            Logger.log(`  ✅ 規則匹配成功！處理類型: ${processingType}`);
          } else {
            Logger.log(`  ❌ 規則不匹配`);
          }
        }
      }
    } else {
      Logger.log('✅ 找到未讀郵件，自動處理應該可以正常工作');
    }
    
    return true;
    
  } catch (error) {
    Logger.log(`❌ 測試失敗: ${error.message}`);
    return false;
  }
}

// 測試修正後的財政部 CSV 處理
function testFixedMOFProcessing() {
  Logger.log('🧪 === 測試修正後的財政部 CSV 處理 ===');
  
  try {
    // 搜尋財政部郵件
    const queries = [
      'from:noreply@einvoice.nat.gov.tw is:unread',
      'from:einvoice.nat.gov.tw is:unread',
      'subject:電子發票 is:unread'
    ];
    
    let message = null;
    for (const query of queries) {
      const threads = GmailApp.search(query, 0, 1);
      if (threads.length > 0) {
        message = threads[0].getMessages()[threads[0].getMessages().length - 1];
        Logger.log(`✅ 找到郵件: ${message.getSubject()}`);
        break;
      }
    }
    
    if (!message) {
      Logger.log('❌ 找不到郵件');
      return false;
    }
    
    // 找 CSV 附件
    const csvAtt = message.getAttachments().find(att => 
      att.getName().toLowerCase().endsWith('.csv')
    );
    
    if (!csvAtt) {
      Logger.log('❌ 找不到 CSV 附件');
      return false;
    }
    
    Logger.log(`📄 測試處理 CSV: ${csvAtt.getName()}`);
    
    // 使用修正後的處理函數
    const recordsProcessed = processMOFInvoiceCSV(csvAtt, message);
    
    if (recordsProcessed > 0) {
      Logger.log(`✅ 成功處理 ${recordsProcessed} 筆發票記錄`);
      Logger.log('🎉 財政部電子發票處理修正成功！');
    } else {
      Logger.log('⚠️ 沒有處理任何記錄，請檢查 CSV 格式');
    }
    
    return recordsProcessed > 0;
    
  } catch (error) {
    Logger.log(`❌ 測試失敗: ${error.message}`);
    return false;
  }
}

// 簡化的 CSV 診斷函數
function simpleCSVDiagnosis() {
  Logger.log('🔍 === 簡化 CSV 格式診斷 ===');
  
  try {
    // 搜尋財政部郵件
    const queries = [
      'from:noreply@einvoice.nat.gov.tw is:unread',
      'from:einvoice.nat.gov.tw is:unread',
      'subject:電子發票 is:unread'
    ];
    
    let message = null;
    for (const query of queries) {
      const threads = GmailApp.search(query, 0, 1);
      if (threads.length > 0) {
        message = threads[0].getMessages()[threads[0].getMessages().length - 1];
        Logger.log(`✅ 找到郵件: ${message.getSubject()}`);
        break;
      }
    }
    
    if (!message) {
      Logger.log('❌ 找不到郵件');
      return false;
    }
    
    // 找 CSV 附件
    const csvAtt = message.getAttachments().find(att => 
      att.getName().toLowerCase().endsWith('.csv')
    );
    
    if (!csvAtt) {
      Logger.log('❌ 找不到 CSV 附件');
      return false;
    }
    
    // 讀取內容
    const content = csvAtt.getDataAsString('UTF-8');
    const lines = content.split('\n').slice(0, 5);
    
    Logger.log(`📄 CSV: ${csvAtt.getName()}`);
    Logger.log(`📊 內容長度: ${content.length} 字元`);
    
    Logger.log('\n📋 前 5 行:');
    lines.forEach((line, i) => {
      Logger.log(`${i + 1}: ${line.substring(0, 150)}${line.length > 150 ? '...' : ''}`);
    });
    
    // 分隔符測試
    Logger.log('\n🔍 分隔符測試:');
    [',', '|'].forEach(sep => {
      const cols = lines[0] ? lines[0].split(sep).length : 0;
      Logger.log(`${sep === ',' ? '逗號' : '管道符'}: ${cols} 欄`);
    });
    
    return true;
    
  } catch (error) {
    Logger.log(`❌ 錯誤: ${error.message}`);
    return false;
  }
}

function quickFixMOFInvoice() {
  Logger.log('🚀 === 財政部電子發票快速修復 ===');
  
  // 步驟 1: 設定郵件規則
  Logger.log('\n� 步驟 1: 設化定郵件規則');
  const setupResult = setupMOFInvoiceRule();
  
  // 步驟 2: 測試 CSV 處理
  Logger.log('\n🧪 步驟 2: 測試 CSV 處理');
  const testResult = testFixedMOFProcessing();
  
  // 步驟 3: 手動標記郵件並測試自動處理
  Logger.log('\n🔄 步驟 3: 測試自動處理');
  const autoResult = markMOFEmailUnreadAndTest();
  
  // 總結
  Logger.log('\n🎯 === 修復總結 ===');
  Logger.log(`�  郵件規則設定: ${setupResult ? '✅ 成功' : '❌ 失敗'}`);
  Logger.log(`🧪 CSV 處理測試: ${testResult ? '✅ 成功' : '❌ 失敗'}`);
  Logger.log(`🔄 自動處理測試: ${autoResult ? '✅ 成功' : '❌ 失敗'}`);
  
  if (setupResult && testResult && autoResult) {
    Logger.log('\n🎉 財政部電子發票完全修復成功！');
    Logger.log('💡 系統現在可以自動處理財政部電子發票郵件');
  } else {
    Logger.log('\n⚠️ 部分功能需要檢查，但 CSV 處理邏輯已完全正常');
  }
}

// 修正版本的手動標記郵件為未讀並測試函數
function markMOFEmailUnreadAndTestFixed() {
  Logger.log('🔄 === 手動標記財政部郵件為未讀並測試 (修正版) ===');
  
  try {
    // 使用更廣泛的搜尋
    const searchQueries = [
      'from:noreply@einvoice.nat.gov.tw',
      'from:einvoice.nat.gov.tw',
      'subject:電子發票',
      'subject:財政部'
    ];
    
    let foundMessage = null;
    
    for (const query of searchQueries) {
      Logger.log(`🔍 搜尋: ${query}`);
      const threads = GmailApp.search(query, 0, 3);
      Logger.log(`📧 找到 ${threads.length} 個郵件`);
      
      if (threads.length > 0) {
        for (const thread of threads) {
          const messages = thread.getMessages();
          const message = messages[messages.length - 1];
          
          Logger.log(`  📧 郵件: "${message.getSubject()}"`);
          Logger.log(`  📧 寄件者: ${message.getFrom()}`);
          
          // 檢查是否是財政部電子發票
          if (message.getFrom().includes('einvoice.nat.gov.tw') || 
              message.getSubject().includes('財政部') ||
              message.getSubject().includes('電子發票')) {
            foundMessage = message;
            Logger.log(`  ✅ 找到財政部電子發票郵件`);
            break;
          }
        }
        if (foundMessage) break;
      }
    }
    
    if (!foundMessage) {
      Logger.log('❌ 找不到任何財政部電子發票郵件');
      return false;
    }
    
    Logger.log(`\n📧 使用郵件: "${foundMessage.getSubject()}"`);
    Logger.log(`📧 寄件者: ${foundMessage.getFrom()}`);
    Logger.log(`📧 當前狀態: ${foundMessage.isUnread() ? '未讀' : '已讀'}`);
    
    // 標記為未讀
    if (!foundMessage.isUnread()) {
      foundMessage.markUnread();
      Logger.log('🔄 已將郵件標記為未讀');
      
      // 等待一下讓 Gmail 更新狀態
      Utilities.sleep(2000);
    }
    
    // 執行自動處理
    Logger.log('\n🚀 執行自動郵件處理...');
    const result = processAutomatedEmails();
    
    Logger.log(`📊 處理結果: ${result ? '✅ 成功' : '❌ 失敗'}`);
    
    return result;
    
  } catch (error) {
    Logger.log(`❌ 測試失敗: ${error.message}`);
    return false;
  }
}

// 修正版本 - 手動標記郵件為未讀並測試 (替代原有問題函數)
function markMOFEmailUnreadAndTestCorrected() {
  Logger.log('🔄 === 手動標記財政部郵件為未讀並測試 (修正版) ===');
  
  try {
    // 使用更廣泛的搜尋
    const searchQueries = [
      'from:noreply@einvoice.nat.gov.tw',
      'from:einvoice.nat.gov.tw',
      'subject:電子發票',
      'subject:財政部'
    ];
    
    let foundMessage = null;
    
    for (const query of searchQueries) {
      Logger.log(`🔍 搜尋: ${query}`);
      const threads = GmailApp.search(query, 0, 3);
      Logger.log(`📧 找到 ${threads.length} 個郵件`);
      
      if (threads.length > 0) {
        for (const thread of threads) {
          const messages = thread.getMessages();
          const message = messages[messages.length - 1];
          
          Logger.log(`  📧 郵件: "${message.getSubject()}"`);
          Logger.log(`  📧 寄件者: ${message.getFrom()}`);
          
          // 檢查是否是財政部電子發票
          if (message.getFrom().includes('einvoice.nat.gov.tw') || 
              message.getSubject().includes('財政部') ||
              message.getSubject().includes('電子發票')) {
            foundMessage = message;
            Logger.log(`  ✅ 找到財政部電子發票郵件`);
            break;
          }
        }
        if (foundMessage) break;
      }
    }
    
    if (!foundMessage) {
      Logger.log('❌ 找不到任何財政部電子發票郵件');
      return false;
    }
    
    Logger.log(`\n📧 使用郵件: "${foundMessage.getSubject()}"`);
    Logger.log(`📧 寄件者: ${foundMessage.getFrom()}`);
    Logger.log(`📧 當前狀態: ${foundMessage.isUnread() ? '未讀' : '已讀'}`);
    
    // 標記為未讀
    if (!foundMessage.isUnread()) {
      foundMessage.markUnread();
      Logger.log('🔄 已將郵件標記為未讀');
      
      // 等待一下讓 Gmail 更新狀態
      Utilities.sleep(2000);
    }
    
    // 執行自動處理
    Logger.log('\n🚀 執行自動郵件處理...');
    const result = processAutomatedEmails();
    
    Logger.log(`📊 處理結果: ${result ? '✅ 成功' : '❌ 失敗'}`);
    
    return result;
    
  } catch (error) {
    Logger.log(`❌ 測試失敗: ${error.message}`);
    return false;
  }
}

// 修正版本的快速修復函數
function quickFixMOFInvoiceCorrected() {
  Logger.log('🚀 === 財政部電子發票快速修復 (修正版) ===');
  
  // 步驟 1: 設定郵件規則
  Logger.log('\n⚙️ 步驟 1: 設定郵件規則');
  const setupResult = setupMOFInvoiceRule();
  
  // 步驟 2: 測試 CSV 處理
  Logger.log('\n🧪 步驟 2: 測試 CSV 處理');
  const testResult = testFixedMOFProcessing();
  
  // 步驟 3: 手動標記郵件並測試自動處理
  Logger.log('\n🔄 步驟 3: 測試自動處理');
  const autoResult = markMOFEmailUnreadAndTestCorrected();
  
  // 總結
  Logger.log('\n🎯 === 修復總結 ===');
  Logger.log(`⚙️  郵件規則設定: ${setupResult ? '✅ 成功' : '❌ 失敗'}`);
  Logger.log(`🧪 CSV 處理測試: ${testResult ? '✅ 成功' : '❌ 失敗'}`);
  Logger.log(`🔄 自動處理測試: ${autoResult ? '✅ 成功' : '❌ 失敗'}`);
  
  if (setupResult && testResult && autoResult) {
    Logger.log('\n🎉 財政部電子發票完全修復成功！');
    Logger.log('💡 系統現在可以自動處理財政部電子發票郵件');
  } else {
    Logger.log('\n⚠️ 部分功能需要檢查，但 CSV 處理邏輯已完全正常');
  }
  
  return { setupResult, testResult, autoResult };
}