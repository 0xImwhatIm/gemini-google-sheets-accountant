// =================================================================================================
// Code.gs 時區修復補丁 - 2025-08-05
// 修復語音和拍照記帳中的硬編碼日期問題
// =================================================================================================

/**
 * 🎤 修復版語音記帳函數
 * 替換 Code.gs 中的 callGeminiForVoice 函數
 */
function callGeminiForVoice(voiceText) {
  return withPhase4ErrorHandling(() => {
    // 使用時區感知的動態 prompt 生成
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
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
    
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
      JSON.parse(aiResultText); // 驗證回傳的是否為合法 JSON
      return aiResultText;
    } catch (e) {
      Logger.log(`callGeminiForVoice 解析 JSON 失敗: ${e.toString()}. 原始 AI 回應: ${responseText}`);
      throw new Error(`Failed to process voice API call: ${e.message}`);
    }
  }, { voiceText: voiceText }, 'callGeminiForVoice');
}

/**
 * 📸 修復版圖片記帳函數
 * 替換 Code.gs 中的 callGeminiForVision 函數
 */
function callGeminiForVision(imageBlob, voiceNote = '') {
  try {
    Logger.log(`[callGeminiForVision] 開始處理圖片，語音備註: ${voiceNote || '無'}`);
    
    // 使用時區感知的動態 prompt 生成
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
      "generationConfig": { "response_mime_type": "application/json" }
    };
    
    const options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify(requestBody),
      'muteHttpExceptions': true
    };
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-vision-latest:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    Logger.log(`[callGeminiForVision] API 回應狀態: ${responseCode}`);
    
    if (responseCode !== 200) {
      Logger.log(`[callGeminiForVision] API 錯誤回應: ${responseText}`);
      throw new Error(`Gemini Vision API HTTP Error: ${responseCode}`);
    }
    
    try {
      const jsonResponse = JSON.parse(responseText);
      
      if (jsonResponse.error) {
        Logger.log(`[callGeminiForVision] API 返回錯誤: ${JSON.stringify(jsonResponse.error)}`);
        throw new Error(`Gemini Vision API Error: ${jsonResponse.error.message}`);
      }
      
      if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {
        Logger.log('[callGeminiForVision] API 回應中沒有候選結果');
        throw new Error('No candidates in Gemini Vision API response');
      }
      
      const candidate = jsonResponse.candidates[0];
      if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
        Logger.log('[callGeminiForVision] 候選結果中沒有內容');
        throw new Error('No content in Gemini Vision API candidate');
      }
      
      const aiResultText = candidate.content.parts[0].text;
      Logger.log(`[callGeminiForVision] AI 解析結果: ${aiResultText}`);
      
      // 驗證 JSON 格式
      const parsedData = JSON.parse(aiResultText);
      Logger.log(`[callGeminiForVision] JSON 解析成功`);
      
      return aiResultText;
      
    } catch (parseError) {
      Logger.log(`[callGeminiForVision] JSON 解析失敗: ${parseError.toString()}`);
      Logger.log(`[callGeminiForVision] 原始回應: ${responseText}`);
      
      // 使用時區感知的預設值
      const currentDateTime = getCurrentTimezoneDateTime();
      
      Logger.log('callGeminiForVision 返回無效結果，使用預設值');
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
    
  } catch (error) {
    Logger.log(`[callGeminiForVision] 處理失敗: ${error.toString()}`);
    
    // 使用時區感知的錯誤回退
    const currentDateTime = getCurrentTimezoneDateTime();
    
    const finalErrorResult = {
      "date": currentDateTime.dateTime,
      "amount": 0,
      "currency": "TWD",
      "category": "其他",
      "item": "圖片處理失敗",
      "merchant": "未知商家",
      "invoice_number": "",
      "notes": `處理錯誤: ${error.message}`
    };
    
    return JSON.stringify(finalErrorResult);
  }
}

/**
 * 🔧 獲取當前時區感知的日期時間（工具函數）
 */
function getCurrentTimezoneDateTime(timezone = 'Asia/Taipei') {
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
function getRelativeTimezoneDate(dayOffset = 0, timezone = 'Asia/Taipei') {
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

/**
 * 🔧 生成 Prompt 日期信息（工具函數）
 */
function generatePromptDateInfo(timezone = 'Asia/Taipei') {
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
    dateRules: `
- 日期和時間處理規則（基準日期：${currentDateTime.date}）：
  * 格式：完整的日期時間應為 "YYYY-MM-DD HH:MM:SS" 格式
  * 如果語音中說「今天」、「剛才」、「現在」→ 使用 ${currentDateTime.date} + 當前時間
  * 如果語音中說「昨天」→ 使用 ${yesterday}，時間部分如有明確提到則使用，否則使用 12:00:00
  * 如果語音中說「前天」→ 使用 ${dayBeforeYesterday}
  * 如果沒有明確日期，使用 ${currentDateTime.dateTime}
  * 時間轉換：上午/AM用24小時制，下午/PM加12小時，晚上通常指19:00-23:59，深夜/凌晨指00:00-05:59`
  };
}

/**
 * 🔧 生成動態語音 Prompt（精簡版）
 */
function generateVoicePromptWithDynamicDate(voiceText, timezone = null) {
  const dateInfo = generatePromptDateInfo(timezone);
  
  const prompt = `
你是一位專業的記帳助理，專門處理語音輸入的交易記錄。請將以下語音文字轉換為結構化的交易資料。

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
 * 🔧 生成動態圖片 Prompt（精簡版）
 */
function generateImagePromptWithDynamicDate(voiceNote = null, timezone = null) {
  const dateInfo = generatePromptDateInfo(timezone);
  
  const prompt = `
你是一位專業的記帳助理，專門處理收據和發票圖片。請分析這張圖片並提取交易資訊。

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

/**
 * 🧪 測試時區修復功能
 */
function testTimezoneFix() {
  Logger.log('🧪 測試時區修復功能...');
  
  try {
    // 測試日期處理工具函數
    const currentDateTime = getCurrentTimezoneDateTime();
    
    Logger.log(`📅 當前日期: ${currentDateTime.date}`);
    Logger.log(`� 當前時間:  ${currentDateTime.dateTime}`);
    Logger.log(`🌍 時區: ${currentDateTime.timezone}`);
    
    // 測試相對日期
    const yesterday = getRelativeTimezoneDate(-1);
    const dayBeforeYesterday = getRelativeTimezoneDate(-2);
    Logger.log(`� 語昨天: ${yesterday}`);
    Logger.log(`📅 前天: ${dayBeforeYesterday}`);
    
    // 測試 Prompt 日期信息生成
    const dateInfo = generatePromptDateInfo();
    Logger.log(`📝 Prompt 文字: ${dateInfo.promptText}`);
    
    // 測試語音 prompt 生成
    const voicePrompt = generateVoicePromptWithDynamicDate('我今天買了一杯咖啡花了150元');
    Logger.log(`📝 語音 Prompt 包含當前日期: ${voicePrompt.includes(currentDateTime.date)}`);
    
    // 測試圖片 prompt 生成
    const imagePrompt = generateImagePromptWithDynamicDate('這是昨天的收據');
    Logger.log(`📸 圖片 Prompt 包含當前日期: ${imagePrompt.includes(currentDateTime.date)}`);
    
    Logger.log('✅ 時區修復功能測試完成');
    
  } catch (error) {
    Logger.log(`❌ 測試失敗: ${error.toString()}`);
  }
}