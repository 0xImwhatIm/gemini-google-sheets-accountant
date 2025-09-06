// =================================================================================================
// 智慧記帳 GEM - Google Apps Script (V47.7 - 郵件處理修正版)
// =================================================================================================
// 版本：V47.7.0
// 更新日期：2025-09-06
// 主要更新：修正 Email 中 CSV 附件導入的帳目未自動計算台幣金額 (E欄) 的問題。
// 1. 【郵件處理修正】重寫 processAutomatedEmails 函數，使其調用最新的 writeToSheet 函數。
// 2. 【統一標準】確保來自 Email CSV 的記錄與語音、圖片記錄使用相同的欄位對應和計算邏輯。
// 3. 【功能保留】繼續保留 V47.6 的所有穩定功能。
// =================================================================================================

// ====================【使用者設定區】====================
// 請在此集中管理您的所有設定資訊
const CONFIG = {
  // --- 必要設定 ---
  MAIN_LEDGER_ID: PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID') || 'YOUR_GOOGLE_SHEET_ID_HERE',
  GEMINI_API_KEY: PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || 'YOUR_GEMINI_API_KEY_HERE',
  
  // --- 工作表名稱 ---
  SHEET_NAME: 'All Records',
  EMAIL_RULES_SHEET_NAME: 'EmailRules',
  SETTINGS_SHEET_NAME: 'Settings',
  IOU_EVENTS_SHEET_NAME: 'Events',
  IOU_PARTICIPANTS_SHEET_NAME: 'Participants',
  IOU_DEBTS_SHEET_NAME: 'Debts',
  
  // --- Google Drive 資料夾 ID (如果使用) ---
  FOLDER_ID_TO_PROCESS: PropertiesService.getScriptProperties().getProperty('FOLDER_ID_TO_PROCESS') || '',
  FOLDER_ID_ARCHIVE: PropertiesService.getScriptProperties().getProperty('FOLDER_ID_ARCHIVE') || '',
  FOLDER_ID_DUPLICATES: PropertiesService.getScriptProperties().getProperty('FOLDER_ID_DUPLICATES') || '',
  
  // --- 預設值與行為控制 ---
  DEFAULT_TIMEZONE: 'Asia/Taipei',
  DEFAULT_CURRENCY: 'TWD',
  BATCH_SIZE: 5,
  API_TIMEOUT: 30000,
  MAX_RETRY_ATTEMPTS: 3,
  
  // --- 配置驗證方法 ---
  validate() {
    const errors = [];
    if (!this.MAIN_LEDGER_ID || this.MAIN_LEDGER_ID === 'YOUR_GOOGLE_SHEET_ID_HERE') {
      errors.push('MAIN_LEDGER_ID 未設定');
    }
    if (!this.GEMINI_API_KEY || this.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
      errors.push('GEMINI_API_KEY 未設定');
    }
    return errors;
  }
};

// 配置初始化檢查
(function initializeConfig() {
  const errors = CONFIG.validate();
  if (errors.length > 0) {
    Logger.log(`⚠️ 配置警告: ${errors.join(', ')}`);
    Logger.log('請在 Google Apps Script 的「專案設定」→「指令碼屬性」中設定正確的值');
  } else {
    Logger.log('✅ V47.7 配置檢查通過');
  }
})();

// =================================================================================================
// 【V47.5 新增】簡化的錯誤處理系統
// =================================================================================================

/**
 * 簡化的安全執行函數，替代複雜的 Phase4 框架
 */
function safeExecute(operation, context = {}) {
  try {
    // 配置驗證
    const configErrors = CONFIG.validate();
    if (configErrors.length > 0) {
      throw new Error(`配置錯誤: ${configErrors.join(', ')}`);
    }
    
    return operation();
  } catch (error) {
    Logger.log(`❌ Error in ${context.name || 'unknown'}: ${error.toString()}`);
    
    // 返回統一的錯誤回應
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString(),
      context: context
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// =================================================================================================
// 【V47.5 保留】時區感知日期處理函數
// =================================================================================================

/**
 * 🔧 獲取當前時區感知的日期時間（工具函數）
 */
function getCurrentTimezoneDateTime(timezone = CONFIG.DEFAULT_TIMEZONE) {
  try {
    const now = new Date();
    const formattedDate = Utilities.formatDate(now, timezone, 'yyyy-MM-dd');
    const formattedDateTime = Utilities.formatDate(now, timezone, 'yyyy-MM-dd HH:mm:ss');
    const formattedTime = Utilities.formatDate(now, timezone, 'HH:mm:ss');
    
    return {
      date: formattedDate,
      dateTime: formattedDateTime,
      time: formattedTime,
      timezone: timezone
    };
  } catch (error) {
    // Fallback
    const now = new Date();
    const fallbackDate = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const fallbackDateTime = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    
    return {
      date: fallbackDate,
      dateTime: fallbackDateTime,
      time: Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm:ss'),
      timezone: Session.getScriptTimeZone()
    };
  }
}

/**
 * 🔧 獲取相對日期（工具函數）
 */
function getRelativeTimezoneDate(dayOffset = 0, timezone = CONFIG.DEFAULT_TIMEZONE) {
  try {
    const now = new Date();
    const targetDate = new Date(now.getTime() + (dayOffset * 24 * 60 * 60 * 1000));
    return Utilities.formatDate(targetDate, timezone, 'yyyy-MM-dd');
  } catch (error) {
    // Fallback
    const now = new Date();
    const targetDate = new Date(now.getTime() + (dayOffset * 24 * 60 * 60 * 1000));
    return Utilities.formatDate(targetDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
}

/**
 * 🔧 生成 Prompt 日期信息（工具函數）
 */
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
      * 如果沒有明確日期，使用 ${currentDateTime.dateTime}
      * 時間轉換：上午/AM用24小時制，下午/PM加12小時，晚上通常指19:00-23:59，深夜/凌晨指00:00-05:59`
  };
}

// =================================================================================================
// 【V47.5 保留】Prompt 生成函數
// =================================================================================================

/**
 * 🔧 生成動態語音 Prompt（時區感知版）
 */
function generateVoicePromptWithDynamicDate(voiceText, timezone = null) {
  const dateInfo = generatePromptDateInfo(timezone);
  const prompt = `你是一位專業的記帳助理，專門處理語音輸入的交易記錄。請將以下語音文字轉換為結構化的交易資料。

${dateInfo.promptText}

請分析以下語音文字，並提取出交易資訊：
- 如果是支出，amount 為正數
- 如果是收入，amount 為負數

${dateInfo.dateRules}

【重要欄位說明】
- currency (幣別)：只能是 TWD, JPY, USD, EUR, CNY 其中之一，絕對不能填入商品名稱、類別或其他內容
- category (類別)：只能是 食、衣、住、行、育、樂、醫療、保險、其他 其中之一

【嚴格規則】
1. currency 欄位：如果語音中沒有明確提到外幣，一律填入 "TWD"
2. category 欄位：根據消費內容判斷類別，例如：
   - 咖啡、餐廳、食物 → "食"
   - 交通、加油、停車 → "行"
   - 衣服、鞋子、配件 → "衣"
   - 房租、水電、家具 → "住"
   - 書籍、課程、軟體 → "育"
   - 電影、遊戲、旅遊 → "樂"
   - 醫院、藥品、保健 → "醫療"
   - 保險費用 → "保險"
   - 其他無法分類 → "其他"

語音文字：「${voiceText}」

請以 JSON 格式回傳，包含以下欄位：
{
  "date": "YYYY-MM-DD HH:MM:SS",
  "amount": 數字,
  "currency": "TWD/JPY/USD/EUR/CNY",
  "category": "食/衣/住/行/育/樂/醫療/保險/其他",
  "item": "具體項目描述",
  "merchant": "商家名稱（如果有提到）",
  "notes": "備註（如果有額外說明）"
}`;

  return prompt;
}

/**
 * 🔧 生成動態圖片 Prompt（時區感知版）
 */
function generateImagePromptWithDynamicDate(voiceNote = null, timezone = null) {
  const dateInfo = generatePromptDateInfo(timezone);
  const prompt = `你是一位專業的記帳助理，專門處理收據和發票圖片。請分析這張圖片並提取交易資訊。

${dateInfo.promptText}

${voiceNote ? `用戶補充說明：${voiceNote}` : ''}

請分析圖片中的收據/發票資訊，並提取以下資料：
- 如果是支出，amount 為正數
- 如果是收入，amount 為負數
- 日期和時間處理（基準日期：${dateInfo.today}）：
  * 優先使用收據上的完整日期時間
  * 格式：YYYY-MM-DD HH:MM:SS
  * 如果收據只有日期沒有時間，補上 12:00:00
  * 如果收據沒有日期，使用 ${dateInfo.todayDateTime}
  * 如果有語音補充說明時間（如「這是昨天的收據」），以語音說明為準，昨天=${dateInfo.yesterday}

【重要欄位說明】
- currency (幣別)：只能是 TWD, JPY, USD, EUR, CNY 其中之一，絕對不能填入商品名稱、類別或其他內容
- category (類別)：只能是 食、衣、住、行、育、樂、醫療、保險、其他 其中之一

【嚴格規則】
1. currency 欄位：根據收據上的幣別符號判斷，如果看不清楚或沒有標示，預設為 "TWD"
2. category 欄位：根據商家類型和消費內容判斷類別
3. amount 欄位：必須是數字，不包含貨幣符號
4. date 欄位：必須是完整的日期時間格式

請以 JSON 格式回傳，包含以下欄位：
{
  "date": "YYYY-MM-DD HH:MM:SS",
  "amount": 數字,
  "currency": "TWD/JPY/USD/EUR/CNY",
  "category": "食/衣/住/行/育/樂/醫療/保險/其他",
  "item": "具體項目描述",
  "merchant": "商家名稱",
  "invoice_number": "發票號碼（如果有）",
  "notes": "備註"
}`;

  return prompt;
}

// =================================================================================================
// 【V47.5 修復】Gemini API 調用函數
// =================================================================================================

/**
 * 📞 語音記帳 Gemini API 調用
 */
function callGeminiForVoice(voiceText) {
  return safeExecute(() => {
    const prompt = generateVoicePromptWithDynamicDate(voiceText);
    
    const requestBody = {
      "contents": [{ "parts": [{ "text": prompt }] }],
      "generationConfig": { "response_mime_type": "application/json" }
    };
    
    const options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify(requestBody),
      'muteHttpExceptions': true
    };
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
    
    Logger.log(`[V47.7-Voice] 調用 Gemini API，語音內容: ${voiceText.substring(0, 50)}...`);
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    Logger.log(`[V47.7-Voice] API 回應狀態: ${responseCode}`);
    
    if (responseCode !== 200) {
      Logger.log(`[V47.7-Voice] API 錯誤回應: ${responseText}`);
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
      JSON.parse(aiResultText); // 驗證回傳的是否為合法 JSON
      
      Logger.log(`[V47.7-Voice] ✅ 語音處理成功`);
      return aiResultText;
      
    } catch (e) {
      Logger.log(`[V47.7-Voice] JSON 解析失敗: ${e.toString()}. 原始 AI 回應: ${responseText}`);
      throw new Error(`Failed to process voice API call: ${e.message}`);
    }
  }, { name: 'callGeminiForVoice', voiceText: voiceText });
}

/**
 * 📸 圖片記帳 Gemini API 調用（V47.5 修復版）
 */
function callGeminiForVision_V47_5_FINAL(imageBlob, voiceNote = '') {
  return safeExecute(() => {
    Logger.log(`[V47.7-Vision] 開始處理圖片，語音備註: ${voiceNote || '無'}`);
    
    const dateInfo = generatePromptDateInfo();
    const prompt = `你是一位專業的記帳助理，專門處理收據和發票圖片。請分析這張圖片並提取交易資訊。

${dateInfo.promptText}

${voiceNote ? `用戶補充說明：${voiceNote}` : ''}

請以 JSON 格式回傳，包含以下欄位：
{
  "date": "YYYY-MM-DD HH:MM:SS",
  "amount": 數字,
  "currency": "TWD/JPY/USD/EUR/CNY",
  "category": "食/衣/住/行/育/樂/醫療/保險/其他",
  "item": "具體項目描述",
  "merchant": "商家名稱",
  "invoice_number": "發票號碼（如果有）",
  "notes": "備註"
}`;
    
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
      "generationConfig": { "response_mime_type": "application/json" }
    };
    
    const options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify(requestBody),
      'muteHttpExceptions': true
    };
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
    
    Logger.log(`[V47.7-Vision] 使用 API 端點: gemini-1.5-flash-latest`);
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    Logger.log(`[V47.7-Vision] API 回應狀態: ${responseCode}`);
    
    if (responseCode !== 200) {
      Logger.log(`[V47.7-Vision] API 錯誤回應: ${responseText}`);
      throw new Error(`Gemini Vision API HTTP Error: ${responseCode}`);
    }
    
    try {
      const jsonResponse = JSON.parse(responseText);
      
      if (jsonResponse.error) {
        Logger.log(`[V47.7-Vision] API 返回錯誤: ${JSON.stringify(jsonResponse.error)}`);
        throw new Error(`Gemini Vision API Error: ${jsonResponse.error.message}`);
      }
      
      if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {
        Logger.log('[V47.7-Vision] API 回應中沒有候選結果');
        throw new Error('No candidates in Gemini Vision API response');
      }
      
      const candidate = jsonResponse.candidates[0];
      if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
        Logger.log('[V47.7-Vision] 候選結果中沒有內容');
        throw new Error('No content in Gemini Vision API candidate');
      }
      
      const aiResultText = candidate.content.parts[0].text;
      Logger.log(`[V47.7-Vision] AI 解析結果: ${aiResultText}`);
      
      // 驗證 JSON 格式
      const parsedData = JSON.parse(aiResultText);
      Logger.log(`[V47.7-Vision] ✅ JSON 解析成功`);
      
      return aiResultText;
      
    } catch (parseError) {
      Logger.log(`[V47.7-Vision] JSON 解析失敗: ${parseError.toString()}`);
      Logger.log(`[V47.7-Vision] 原始回應: ${responseText}`);
      
      // 使用時區感知的預設值
      const currentDateTime = getCurrentTimezoneDateTime();
      const defaultResult = {
        "date": currentDateTime.dateTime,
        "amount": 0,
        "currency": "TWD",
        "category": "其他",
        "item": "無法識別的收據",
        "merchant": "未知商家",
        "invoice_number": "",
        "notes": "圖片解析失敗，請手動輸入"
      };
      
      return JSON.stringify(defaultResult);
    }
  }, { name: 'callGeminiForVision', voiceNote: voiceNote });
}

// =================================================================================================
// 【V47.5 簡化】Web App 主入口路由
// =================================================================================================

/**
 * 處理 GET 請求的總路由
 */
function doGet(e) {
  return safeExecute(() => {
    const action = e.parameter.action;
    const endpoint = e.parameter.endpoint;
    
    Logger.log(`[V47.7-GET] 收到請求 - action: ${action}, endpoint: ${endpoint}`);
    
    // 🧪 V47.7 診斷端點
    if (endpoint === 'test') {
      Logger.log('[V47.7-TEST] 診斷端點被調用');
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        version: 'V47.7.0',
        message: '郵件處理修正版正常運行',
        timestamp: new Date().toISOString(),
        config: {
          hasMainLedgerId: !!CONFIG.MAIN_LEDGER_ID && CONFIG.MAIN_LEDGER_ID !== 'YOUR_GOOGLE_SHEET_ID_HERE',
          hasGeminiApiKey: !!CONFIG.GEMINI_API_KEY && CONFIG.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE',
          timezone: CONFIG.DEFAULT_TIMEZONE
        }
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 處理 endpoint 參數（支援 iOS 捷徑的 GET 請求）
    if (endpoint) {
      Logger.log(`[V47.7-GET] 處理 endpoint: ${endpoint}`);
      
      if (endpoint === 'voice') {
        return doGet_Voice(e);
      } else if (endpoint === 'image') {
        return doGet_Image(e);
      } else if (endpoint === 'pdf') {
        return doGet_Pdf(e);
      } else if (endpoint === 'iou') {
        return doGet_Iou(e);
      } else {
        throw new Error(`無效的 GET endpoint: ${endpoint}`);
      }
    }
    
    // 處理 action 參數
    if (action === 'processEmails') {
      processAutomatedEmails();
      return ContentService.createTextOutput('Email processing completed').setMimeType(ContentService.MimeType.TEXT);
    }
    
    // 預設回應
    return HtmlService.createHtmlOutput(`
      <h1>智慧記帳 GEM V47.7</h1>
      <p>郵件處理修正版已啟用</p>
      <p>支援的端點：voice, image, pdf, iou</p>
      <p>診斷端點：<a href="?endpoint=test">?endpoint=test</a></p>
    `);
  }, { name: 'doGet' });
}

/**
 * 處理 POST 請求的總路由
 */
function doPost(e) {
  return safeExecute(() => {
    // 檢查基本參數
    if (!e || !e.parameter) {
      throw new Error('缺少請求參數');
    }
    
    const endpoint = e.parameter.endpoint;
    
    // 檢查 endpoint 參數
    if (!endpoint) {
      throw new Error('缺少 endpoint 參數。請在 URL 中指定 ?endpoint=image, ?endpoint=voice, ?endpoint=pdf, 或 ?endpoint=iou');
    }
    
    Logger.log(`[V47.7-POST] 處理 endpoint: ${endpoint}`);
    
    // 路由到對應的處理函數
    if (endpoint === 'image') {
      return doPost_Image(e);
    } else if (endpoint === 'voice') {
      return doPost_Voice(e);
    } else if (endpoint === 'pdf') {
      return doPost_Pdf(e);
    } else if (endpoint === 'iou') {
      return doPost_Iou(e);
    } else {
      throw new Error(`無效的 API 端點: ${endpoint}。支援的端點: image, voice, pdf, iou`);
    }
  }, { name: 'doPost', endpoint: e.parameter ? e.parameter.endpoint : 'unknown' });
}

// =================================================================================================
// 【V47.5 保留】各端點處理函數
// =================================================================================================

/**
 * 處理語音記帳 GET 請求
 */
function doGet_Voice(e) {
  return safeExecute(() => {
    const text = e.parameter.text;
    
    if (!text) {
      throw new Error("缺少 text 參數。請在 URL 中加入 ?text=您的語音文字");
    }
    
    Logger.log(`[V47.7-Voice-GET] 處理語音文字: ${text.substring(0, 50)}...`);
    
    const aiResultText = callGeminiForVoice(text);
    const parsedData = JSON.parse(aiResultText);
    
    // 寫入到 Google Sheets
    const result = writeToSheet(parsedData, 'voice');
    
    return ContentService.createTextOutput(JSON.stringify({
      status: result ? 'success' : 'error',
      data: parsedData,
      message: result ? '語音記帳成功' : '語音記帳失敗'
    })).setMimeType(ContentService.MimeType.JSON);
  }, { name: 'doGet_Voice' });
}

/**
 * 處理語音記帳 POST 請求
 */
function doPost_Voice(e) {
  return safeExecute(() => {
    if (!e.postData || !e.postData.contents) {
      throw new Error("缺少 POST 資料。請確認使用 POST 方法發送資料");
    }
    
    let params;
    try {
      params = JSON.parse(e.postData.contents);
    } catch (parseError) {
      throw new Error("JSON 解析失敗。請檢查 POST 資料格式：" + parseError.message);
    }
    
    if (!params.text) {
      throw new Error("缺少 text 參數。請在 POST 資料中包含語音文字");
    }
    
    Logger.log(`[V47.7-Voice-POST] 處理語音文字: ${params.text.substring(0, 50)}...`);
    
    const aiResultText = callGeminiForVoice(params.text);
    const parsedData = JSON.parse(aiResultText);
    
    // 寫入到 Google Sheets
    const result = writeToSheet(parsedData, 'voice');
    
    return ContentService.createTextOutput(JSON.stringify({
      status: result ? 'success' : 'error',
      data: parsedData,
      message: result ? '語音記帳成功' : '語音記帳失敗'
    })).setMimeType(ContentService.MimeType.JSON);
  }, { name: 'doPost_Voice' });
}

/**
 * 處理圖片記帳 POST 請求
 */
function doPost_Image(e) {
  return safeExecute(() => {
    // 檢查 POST 資料是否存在
    if (!e.postData || !e.postData.contents) {
      throw new Error("缺少 POST 資料。請確認 iOS 捷徑設定正確，並使用 POST 方法發送資料");
    }
    
    let params;
    try {
      params = JSON.parse(e.postData.contents);
    } catch (parseError) {
      throw new Error("JSON 解析失敗。請檢查 POST 資料格式：" + parseError.message);
    }
    
    // 檢查必要參數
    if (!params.image) {
      throw new Error("缺少 image 參數。請確認 iOS 捷徑正確傳送 base64 編碼的圖片資料");
    }
    
    // 處理圖片資料
    let imageBlob;
    try {
      const imageData = params.image;
      const mimeType = params.mimeType || 'image/jpeg';
      imageBlob = Utilities.newBlob(Utilities.base64Decode(imageData), mimeType, params.filename || 'receipt.jpg');
    } catch (blobError) {
      throw new Error("圖片資料處理失敗：" + blobError.message);
    }
    
    Logger.log(`[V47.7-Image] 開始處理圖片記帳`);
    
    // 呼叫 AI 處理圖片
    const voiceNote = params.voiceNote || '';
    const aiResultText = callGeminiForVision_V47_5_FINAL(imageBlob, voiceNote);
    const parsedData = JSON.parse(aiResultText);
    
    // 寫入到 Google Sheets
    const result = writeToSheet(parsedData, 'image');
    
    return ContentService.createTextOutput(JSON.stringify({
      status: result ? 'success' : 'error',
      data: parsedData,
      message: result ? '圖片記帳成功' : '圖片記帳失敗'
    })).setMimeType(ContentService.MimeType.JSON);
  }, { name: 'doPost_Image' });
}

/**
 * 處理圖片記帳 GET 請求（不支援）
 */
function doGet_Image(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'error',
    message: '圖片處理不支援 GET 請求，請使用 POST 方法並傳送 base64 編碼的圖片資料'
  })).setMimeType(ContentService.MimeType.JSON);
}

// =================================================================================================
// 【V47.6 修正】Google Sheets 寫入與操作
// =================================================================================================

/**
 * 將解析後的資料寫入主帳本（恢復完整欄位）
 */
function writeToSheet(data, source = 'unknown') {
  return safeExecute(() => {
    Logger.log(`[V47.7-WriteSheet] 開始寫入資料，來源: ${source}`);
    
    const ss = SpreadsheetApp.openById(CONFIG.MAIN_LEDGER_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    
    if (!sheet) {
      throw new Error(`找不到工作表: ${CONFIG.SHEET_NAME}`);
    }
    
    const exchangeRate = getExchangeRate(data.currency);
    const amountTWD = (data.amount && exchangeRate) ? data.amount * exchangeRate : '';
    
    // V47.6 修正：恢復完整的 20 欄位對應結構
    const rowData = [
      data.date ? new Date(data.date) : new Date(), // A: 日期
      data.amount || '',                            // B: 金額
      data.currency || CONFIG.DEFAULT_CURRENCY,     // C: 幣別
      exchangeRate,                                 // D: 匯率
      amountTWD,                                    // E: 台幣金額
      data.category || '其他',                      // F: 類別
      data.item || '',                              // G: 項目
      data.merchant || '私人',                      // H: 商家/帳戶類型
      data.notes || '',                             // I: 備註
      '',                                           // J: 舊來源欄位 (清空)
      data.invoice_number || '',                    // K: 發票號碼
      '',                                           // L: 買方統編 (預留)
      '',                                           // M: 賣方統編 (預留)
      '',                                           // N: 收據編號 (預留)
      '',                                           // O: 預留
      '待確認',                                     // P: 狀態
      source,                                       // Q: 來源
      '',                                           // R: 預留
      '',                                           // S: OCR 完整文字 (預留)
      JSON.stringify(data)                          // T: 原始資料
    ];
    
    sheet.appendRow(rowData);
    
    Logger.log(`[V47.7-WriteSheet] ✅ 成功寫入記帳資料: ${data.item} - ${data.amount} ${data.currency}`);
    return true;
  }, { name: 'writeToSheet', source: source });
}

/**
 * 獲取匯率（可擴充為即時 API）
 */
function getExchangeRate(currency) {
  if (!currency || currency.toUpperCase() === 'TWD' || currency.toUpperCase() === 'NTD') {
    return 1;
  }
  
  // 預設匯率表
  const defaultRates = {
    'USD': 32.5,
    'JPY': 0.21,
    'EUR': 35.0,
    'CNY': 4.5
  };
  
  return defaultRates[currency.toUpperCase()] || 1;
}

// =================================================================================================
// 【V47.5 保留】IOU 代墊款處理功能
// =================================================================================================

/**
 * 處理 IOU GET 請求
 */
function doGet_Iou(e) {
  return safeExecute(() => {
    const text = e.parameter.text;
    
    if (!text) {
      throw new Error("缺少 text 參數。請在 URL 中加入 ?text=您的代墊款描述");
    }
    
    Logger.log(`[V47.7-IOU-GET] 處理代墊款: ${text.substring(0, 50)}...`);
    
    const aiResultText = callGeminiForIou(text);
    const parsedData = JSON.parse(aiResultText);
    
    let result;
    switch(parsedData.action) {
      case 'CREATE':
        const groupData = {
          totalAmount: parsedData.amount,
          item: parsedData.item,
          participants: [parsedData.counterparty],
          originalText: text
        };
        result = handleGroupSplit(groupData);
        break;
        
      case 'CREATE_GROUP':
        parsedData.originalText = text;
        result = handleGroupSplit(parsedData);
        break;
        
      case 'SETTLE':
        result = handleSettlement(parsedData);
        break;
        
      default:
        throw new Error(`未知的 IOU 動作: ${parsedData.action}`);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: result ? 'success' : 'error',
      data: parsedData,
      message: result ? 'IOU 處理成功' : 'IOU 處理失敗'
    })).setMimeType(ContentService.MimeType.JSON);
  }, { name: 'doGet_Iou' });
}

/**
 * 處理 IOU POST 請求
 */
function doPost_Iou(e) {
  return safeExecute(() => {
    if (!e.postData || !e.postData.contents) {
      throw new Error("缺少 POST 資料。請確認使用 POST 方法發送資料");
    }
    
    let params;
    try {
      params = JSON.parse(e.postData.contents);
    } catch (parseError) {
      throw new Error("JSON 解析失敗。請檢查 POST 資料格式：" + parseError.message);
    }
    
    if (!params.text) {
      throw new Error("缺少 text 參數。請在 POST 資料中包含代墊款描述");
    }
    
    Logger.log(`[V47.7-IOU-POST] 處理代墊款: ${params.text.substring(0, 50)}...`);
    
    const aiResultText = callGeminiForIou(params.text);
    const parsedData = JSON.parse(aiResultText);
    
    let result;
    switch(parsedData.action) {
      case 'CREATE':
        const groupData = {
          totalAmount: parsedData.amount,
          item: parsedData.item,
          participants: [parsedData.counterparty],
          originalText: params.text
        };
        result = handleGroupSplit(groupData);
        break;
        
      case 'CREATE_GROUP':
        parsedData.originalText = params.text;
        result = handleGroupSplit(parsedData);
        break;
        
      case 'SETTLE':
        result = handleSettlement(parsedData);
        break;
        
      default:
        throw new Error(`未知的 IOU 動作: ${parsedData.action}`);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: result ? 'success' : 'error',
      data: parsedData,
      message: result ? 'IOU 處理成功' : 'IOU 處理失敗'
    })).setMimeType(ContentService.MimeType.JSON);
  }, { name: 'doPost_Iou' });
}

/**
 * IOU 代墊款 Gemini API 調用
 */
function callGeminiForIou(text) {
  return safeExecute(() => {
    const prompt = `你是一位聰明的記帳助理，專門處理「代墊款項」。請判斷以下文字的意圖，並提取結構化資訊。

意圖判斷 (action):
- \`CREATE\`: 建立一筆**單人**代墊款。
- \`CREATE_GROUP\`: 建立一筆**多人**代墊款 (提到多個人名或「大家」、「均分」)。
- \`SETTLE\`: 結清已存在的代墊款 (提到「還我錢」、「付清了」)。

輸出格式：
1. 如果 action 是 "CREATE":
{ "action": "CREATE", "type": "Owes_Me/I_Owe", "counterparty": "對方名字", "item": "事由", "amount": 金額 }

2. 如果 action 是 "CREATE_GROUP":
{ "action": "CREATE_GROUP", "totalAmount": 總金額, "item": "事由", "participants": ["名字1", "名字2"], "splitType": "EVENLY" }

3. 如果 action 是 "SETTLE":
{ "action": "SETTLE", "counterparty": "還款人名字", "amount": 金額(可為null) }

範例：
- 輸入: "我幫小明代墊了 250 元的電影票"
- 輸出: { "action": "CREATE", "type": "Owes_Me", "counterparty": "小明", "item": "電影票", "amount": 250, "currency": "TWD" }

- 輸入: "小華把上次的餐費還我了"
- 輸出: { "action": "SETTLE", "counterparty": "小華", "amount": null, "currency": "TWD" }

現在，請處理以下文字：「${text}」`;
    
    const requestBody = {
      "contents": [{ "parts": [{ "text": prompt }] }],
      "generationConfig": { "response_mime_type": "application/json" }
    };
    
    const options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify(requestBody),
      'muteHttpExceptions': true
    };
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
    
    Logger.log(`[V47.7-IOU] 調用 Gemini API，IOU 內容: ${text.substring(0, 50)}...`);
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    Logger.log(`[V47.7-IOU] API 回應狀態: ${responseCode}`);
    
    if (responseCode !== 200) {
      Logger.log(`[V47.7-IOU] API 錯誤回應: ${responseText}`);
      throw new Error(`Gemini IOU API HTTP Error: ${responseCode}. Response: ${responseText}`);
    }
    
    try {
      const jsonResponse = JSON.parse(responseText);
      
      if (jsonResponse.error) {
        throw new Error(`Gemini IOU API returned an error: ${jsonResponse.error.message}`);
      }
      
      if (!jsonResponse.candidates || !jsonResponse.candidates[0].content.parts[0].text) {
        throw new Error(`Unexpected Gemini IOU API response structure.`);
      }
      
      const aiResultText = jsonResponse.candidates[0].content.parts[0].text;
      JSON.parse(aiResultText); // 驗證回傳的是否為合法 JSON
      
      Logger.log(`[V47.7-IOU] ✅ IOU 處理成功`);
      return aiResultText;
      
    } catch (e) {
      Logger.log(`[V47.7-IOU] JSON 解析失敗: ${e.toString()}. 原始 AI 回應: ${responseText}`);
      throw new Error(`Failed to process IOU API call: ${e.message}`);
    }
  }, { name: 'callGeminiForIou', text: text });
}

/**
 * 處理群組拆分並寫入 IOU 相關工作表
 */
function handleGroupSplit(data) {
  return safeExecute(() => {
    const me = "我";
    const totalAmount = data.totalAmount;
    const participants = data.participants;
    
    if (!totalAmount || !participants || participants.length === 0) {
      throw new Error("群組拆分資訊不完整。");
    }
    
    Logger.log(`[V47.7-GroupSplit] 處理群組拆分: ${totalAmount} 元，參與者: ${participants.join(', ')}`);
    
    let debts = [];
    if (data.splitType === 'EVENLY') {
      const totalPeople = participants.length + 1; // 包含付款人「我」
      const amountPerPerson = totalAmount / totalPeople;
      
      participants.forEach(person => {
        debts.push({ debtor: person, amount: amountPerPerson, item: data.item });
      });
    } else { // 預設為單人代墊
      debts.push({ debtor: participants[0], amount: totalAmount, item: data.item });
    }
    
    return writeToIouLedger(data.originalText, totalAmount, me, debts);
  }, { name: 'handleGroupSplit' });
}

/**
 * 處理結算並更新 IOU 工作表
 */
function handleSettlement(data) {
  return safeExecute(() => {
    const ss = SpreadsheetApp.openById(CONFIG.MAIN_LEDGER_ID);
    const debtsSheet = ss.getSheetByName(CONFIG.IOU_DEBTS_SHEET_NAME);
    
    if (!debtsSheet) {
      throw new Error(`找不到工作表: ${CONFIG.IOU_DEBTS_SHEET_NAME}`);
    }
    
    Logger.log(`[V47.7-Settlement] 處理結算: ${data.counterparty}，金額: ${data.amount || '全部'}`);
    
    const dataRange = debtsSheet.getDataRange();
    const values = dataRange.getValues();
    
    if (values.length < 2) {
      Logger.log('[V47.7-Settlement] 沒有找到債務記錄');
      return false;
    }
    
    const header = values[0];
    const debtorColIndex = header.indexOf('Debtor');
    const amountColIndex = header.indexOf('Amount');
    const statusColIndex = header.indexOf('Status');
    const settlementDateColIndex = header.indexOf('SettlementDate');
    
    // 從最新的記錄開始查找
    for (let i = values.length - 1; i > 0; i--) {
      const row = values[i];
      
      if (row[statusColIndex] === 'Unsettled' && row[debtorColIndex] === data.counterparty) {
        if (data.amount && Math.abs(parseFloat(row[amountColIndex]) - data.amount) > 0.01) {
          continue; // 金額不符，繼續尋找
        }
        
        // 找到符合的未結清款項
        debtsSheet.getRange(i + 1, statusColIndex + 1).setValue('Settled');
        debtsSheet.getRange(i + 1, settlementDateColIndex + 1).setValue(new Date());
        
        Logger.log(`[V47.7-Settlement] ✅ 成功結清與 ${data.counterparty} 的款項`);
        return true;
      }
    }
    
    Logger.log(`[V47.7-Settlement] 未找到符合條件的未結清款項`);
    return false;
  }, { name: 'handleSettlement' });
}

/**
 * 將 IOU 資料寫入相關工作表
 */
function writeToIouLedger(originalText, totalAmount, payer, debts) {
  return safeExecute(() => {
    const ss = SpreadsheetApp.openById(CONFIG.MAIN_LEDGER_ID);
    const eventsSheet = ss.getSheetByName(CONFIG.IOU_EVENTS_SHEET_NAME);
    const participantsSheet = ss.getSheetByName(CONFIG.IOU_PARTICIPANTS_SHEET_NAME);
    const debtsSheet = ss.getSheetByName(CONFIG.IOU_DEBTS_SHEET_NAME);
    
    if (!eventsSheet || !participantsSheet || !debtsSheet) {
      throw new Error('找不到必要的 IOU 工作表');
    }
    
    const eventId = `EVT-${new Date().getTime()}`;
    const now = new Date();
    
    Logger.log(`[V47.7-IOU-Ledger] 寫入 IOU 記錄，事件 ID: ${eventId}`);
    
    // 1. 寫入 Events
    eventsSheet.appendRow([eventId, originalText, totalAmount, now, originalText]);
    
    // 2. 寫入 Participants
    participantsSheet.appendRow([`PTP-${new Date().getTime()}`, eventId, payer, totalAmount]);
    
    // 3. 寫入 Debts
    debts.forEach(debt => {
      const debtId = `DBT-${new Date().getTime()}-${Math.random().toString(36).substr(2, 5)}`;
      debtsSheet.appendRow([debtId, eventId, payer, debt.debtor, debt.amount, debt.item, 'Unsettled', '']);
    });
    
    Logger.log(`[V47.7-IOU-Ledger] ✅ 成功寫入 IOU 記錄`);
    return true;
  }, { name: 'writeToIouLedger' });
}

// =================================================================================================
// 【V47.5 保留】PDF 和其他功能的佔位符
// =================================================================================================

/**
 * 處理 PDF GET 請求（佔位符）
 */
function doGet_Pdf(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'error',
    message: 'PDF 處理功能尚未在 V47.7 中實現'
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * 處理 PDF POST 請求（佔位符）
 */
function doPost_Pdf(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'error',
    message: 'PDF 處理功能尚未在 V47.7 中實現'
  })).setMimeType(ContentService.MimeType.JSON);
}

// =================================================================================================
// 【V47.7 修正】Email 自動處理功能
// =================================================================================================

/**
 * 自動處理 Email 的主函數（恢復核心功能）
 */
function processAutomatedEmails() {
  return safeExecute(() => {
    Logger.log('[V47.7-Email] 開始自動化郵件處理...');
    
    const ss = SpreadsheetApp.openById(CONFIG.MAIN_LEDGER_ID);
    const rulesSheet = ss.getSheetByName(CONFIG.EMAIL_RULES_SHEET_NAME);
    
    if (!rulesSheet) {
      Logger.log(`[V47.7-Email] 找不到郵件規則工作表: ${CONFIG.EMAIL_RULES_SHEET_NAME}，處理中止。`);
      return false;
    }
    
    const rules = rulesSheet.getDataRange().getValues();
    let totalProcessed = 0;
    
    // 從第二行開始讀取規則 (第一行為標題)
    for (let i = 1; i < rules.length; i++) {
      const rule = rules[i];
      const [sender, subjectKeyword, attachmentType, ...columnMapping] = rule;
      
      if (!sender || !attachmentType) continue; // 跳過無效規則
      
      const searchQuery = `from:${sender} ${subjectKeyword ? `subject:(${subjectKeyword})` : ''} is:unread has:attachment`;
      Logger.log(`[V47.7-Email] 正在使用規則搜尋郵件: "${searchQuery}"`);
      
      const threads = GmailApp.search(searchQuery);
      
      for (const thread of threads) {
        const messages = thread.getMessages();
        
        for (const message of messages) {
          if (message.isUnread()) {
            const attachments = message.getAttachments();
            
            for (const attachment of attachments) {
              if (attachment.getContentType() === 'text/csv') {
                Logger.log(`[V47.7-Email] 找到 CSV 附件: ${attachment.getName()}`);
                
                const csvData = Utilities.parseCsv(attachment.getDataAsString('UTF-8'));
                
                // 假設 CSV 第一行為標題
                for(let j = 1; j < csvData.length; j++) {
                  const row = csvData[j];
                  
                  const data = {
                    date: row[columnMapping.indexOf('date')] || new Date(),
                    amount: parseFloat(row[columnMapping.indexOf('amount')]) || 0,
                    currency: row[columnMapping.indexOf('currency')] || 'TWD',
                    category: row[columnMapping.indexOf('category')] || '其他',
                    item: row[columnMapping.indexOf('item')] || '來自CSV匯入',
                    merchant: row[columnMapping.indexOf('merchant')] || '未知商家',
                    notes: `From email: ${message.getSubject()}`
                  };
                  
                  writeToSheet(data, 'email-csv');
                  totalProcessed++;
                }
              }
            }
            
            message.markRead();
          }
        }
      }
    }
    
    Logger.log(`[V47.7-Email] ✅ Email 處理完成，共處理 ${totalProcessed} 筆記錄。`);
    return true;
  }, { name: 'processAutomatedEmails' });
}

// =================================================================================================
// 【V47.5 新增】測試和診斷函數
// =================================================================================================

/**
 * V47.7 配置測試函數
 */
function testV47_7_Configuration() {
  Logger.log('🧪 === V47.7 配置測試開始 ===');
  
  try {
    // 1. 配置驗證測試
    Logger.log('📋 測試 1: 配置驗證');
    const configErrors = CONFIG.validate();
    if (configErrors.length > 0) {
      Logger.log(`❌ 配置錯誤: ${configErrors.join(', ')}`);
    } else {
      Logger.log('✅ 配置驗證通過');
    }
    
    // 2. 時區功能測試
    Logger.log('📋 測試 2: 時區感知功能');
    const dateInfo = generatePromptDateInfo();
    Logger.log(`✅ 當前日期: ${dateInfo.today}`);
    Logger.log(`✅ 昨天日期: ${dateInfo.yesterday}`);
    Logger.log(`✅ 時區: ${dateInfo.timezone}`);
    
    // 3. Google Sheets 連接測試
    Logger.log('� 測試 的3: Google Sheets 連接');
    if (CONFIG.MAIN_LEDGER_ID && CONFIG.MAIN_LEDGER_ID !== 'YOUR_GOOGLE_SHEET_ID_HERE') {
      try {
        const ss = SpreadsheetApp.openById(CONFIG.MAIN_LEDGER_ID);
        const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
        if (sheet) {
          Logger.log('✅ Google Sheets 連接成功');
        } else {
          Logger.log(`❌ 找不到工作表: ${CONFIG.SHEET_NAME}`);
        }
      } catch (sheetError) {
        Logger.log(`❌ Google Sheets 連接失敗: ${sheetError.message}`);
      }
    } else {
      Logger.log('❌ MAIN_LEDGER_ID 未設定');
    }
    
    Logger.log('🎉 === V47.7 配置測試完成 ===');
    
    return {
      success: true,
      message: 'V47.7 配置測試完成',
      configErrors: configErrors,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    Logger.log('💥 配置測試過程中發生錯誤：' + error.message);
    return {
      success: false,
      message: error.message,
      timestamp: new Date().toISOString()
    };
  }
}