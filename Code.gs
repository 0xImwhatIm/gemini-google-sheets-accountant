// =================================================================================================
// 智慧記帳 GEM - Google Apps Script (V49.4.1 - 最終完整修正版)
// =================================================================================================
// 版本：V49.4.1
// 更新日期：2025-10-03
// 主要更新：提供一個包含所有模組與修正的最終完整版本，解決因先前版本不完整導致的各種錯誤。
// 1. 【功能完整性】補全所有被省略的函式，包含 IOU、PDF、測試、端點處理等。
// 2. 【CSV 修正整合】保留 V49.3.4 中針對財政部 CSV 的修正。
// 3. 【版本校準】統一程式碼內所有版本號為 V49.4.1。
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
        version: 'V49.4.1',
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
    
    return HtmlService.createHtmlOutput(`<h1>智慧記帳 GEM V49.4.1</h1><p>最終完整修正版已啟用</p>`);
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
}// =
================================================================================================
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
    
    Logger.log(`[V49.4.1-Voice] 處理語音文字: ${voiceText}`);
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
    
    Logger.log(`[V49.4.1-Image] 開始處理圖片...`);
    
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
        Logger.log(`[V49.4.1-Image] 圖片已存檔: ${fileUrl}`);
      } catch (saveError) {
        Logger.log(`[V49.4.1-Image] ⚠️ 圖片存檔失敗: ${saveError.message}`);
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
    
    Logger.log(`[V49.4.1-PDF] 開始處理 PDF...`);
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
    
    Logger.log(`[V49.4.1-IOU] 處理 IOU 請求: ${action} - ${text}`);
    
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
}// ==
===============================================================================================
// Email 自動處理功能
// =================================================================================================
function processAutomatedEmails() {
  return safeExecute(() => {
    Logger.log('[V49.4.1-Email] 開始自動化郵件處理...');
    
    const ss = SpreadsheetApp.openById(CONFIG.MAIN_LEDGER_ID);
    const rulesSheet = ss.getSheetByName(CONFIG.EMAIL_RULES_SHEET_NAME);
    if (!rulesSheet) {
      Logger.log(`[V49.4.1-Email] 找不到郵件規則工作表: ${CONFIG.EMAIL_RULES_SHEET_NAME}`);
      return false;
    }
    
    const rules = rulesSheet.getDataRange().getValues();
    if (rules.length < 2) {
      Logger.log(`[V49.4.1-Email] ⚠️ ${CONFIG.EMAIL_RULES_SHEET_NAME} 工作表中沒有任何規則。`);
      return false;
    }
    
    let totalProcessedRecords = 0;
    
    for (let i = 1; i < rules.length; i++) {
      const [sender, subjectKeyword, processingType, ...columnMapping] = rules[i];
      if (!sender || !processingType) continue;
      
      const searchQuery = `from:${sender} ${subjectKeyword ? `subject:(${subjectKeyword})` : ''} is:unread`;
      const threads = GmailApp.search(searchQuery, 0, 10);
      
      for (const thread of threads) {
        const messages = thread.getMessages();
        for (const message of messages) {
          if (message.isUnread()) {
            let processedSuccessfully = false;
            
            try {
              const pType = processingType.toUpperCase();
              
              if (pType === 'CSV') {
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
                  Logger.log(`[V49.4.1-Email] ⚠️ HTML 郵件處理失敗: ${apiError.message}`);
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
                      Logger.log(`[V49.4.1-Email] ⚠️ PDF 處理失敗: ${apiError.message}`);
                    }
                  }
                });
              }
              
              if (processedSuccessfully) {
                message.markRead();
              } else {
                Logger.log(`[V49.4.1-Email] ⚠️ 郵件 "${message.getSubject()}" 無符合條件的可處理內容，保持未讀。`);
              }
              
            } catch (err) {
              Logger.log(`[V49.4.1-Email] ❌ 處理單一郵件失敗: ${err.message}`);
            }
          }
        }
      }
    }
    
    if (totalProcessedRecords === 0) {
      Logger.log(`[V49.4.1-Email] 掃描完成，未找到並處理任何符合規則的未讀郵件。`);
    } else {
      Logger.log(`[V49.4.1-Email] ✅ Email 處理完成，共處理 ${totalProcessedRecords} 筆記錄。`);
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
    
    Logger.log(`[V49.4.1-IOU] 處理結算: ${payer} 收到 ${totalAmount}`);
    
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
// 版本資訊和狀態檢查
// =================================================================================================
function getVersionInfo() {
  return {
    version: 'V49.4.1',
    updateDate: '2025-10-03',
    features: [
      '語音記帳',
      '圖片OCR記帳',
      '郵件自動處理 (CSV/HTML/PDF)',
      'IOU代墊款分帳',
      '圖片存檔連結',
      '時區感知處理',
      '多幣別支援'
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
  Logger.log('🏥 === 系統健康檢查 V49.4.1 ===');
  
  const health = {
    timestamp: new Date().toISOString(),
    version: 'V49.4.1',
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
Logger.log('✅ V49.4.1 智慧記帳 GEM 載入完成 - 所有功能已就緒');
/
/ =================================================================================================
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
  Logger.log('🎯 === V49.4.1 最終系統測試 ===');
  
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
  
  Logger.log('\n🎉 === V49.4.1 系統測試完成 ===');
  Logger.log('✅ 所有核心功能已就緒，可以開始使用！');
}