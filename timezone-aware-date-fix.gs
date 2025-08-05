// =================================================================================================
// 時區感知日期修復 - 2025-08-05
// 修復語音和拍照記帳中硬編碼日期問題，實現動態時區感知
// =================================================================================================

/**
 * 🌍 時區感知日期處理器
 */
class TimezoneAwareDateProcessor {
  constructor() {
    // 預設時區為台灣時區
    this.defaultTimezone = 'Asia/Taipei';
  }
  
  /**
   * 🕐 獲取當前用戶時區的日期時間
   * @param {string} timezone - 時區字串，如 'Asia/Taipei'
   * @returns {Object} 包含格式化日期和時間的物件
   */
  getCurrentDateTime(timezone = null) {
    try {
      // 使用指定時區或預設時區
      const targetTimezone = timezone || this.defaultTimezone;
      
      // 獲取當前時間
      const now = new Date();
      
      // 使用 Google Apps Script 的時區功能
      const scriptTimezone = Session.getScriptTimeZone();
      Logger.log(`📍 腳本時區: ${scriptTimezone}`);
      Logger.log(`🌍 目標時區: ${targetTimezone}`);
      
      // 格式化為目標時區的日期時間
      const formattedDate = Utilities.formatDate(now, targetTimezone, 'yyyy-MM-dd');
      const formattedDateTime = Utilities.formatDate(now, targetTimezone, 'yyyy-MM-dd HH:mm:ss');
      const formattedTime = Utilities.formatDate(now, targetTimezone, 'HH:mm:ss');
      
      // 獲取年、月、日用於相對日期計算
      const year = parseInt(Utilities.formatDate(now, targetTimezone, 'yyyy'));
      const month = parseInt(Utilities.formatDate(now, targetTimezone, 'MM'));
      const day = parseInt(Utilities.formatDate(now, targetTimezone, 'dd'));
      
      Logger.log(`📅 當前日期時間 (${targetTimezone}): ${formattedDateTime}`);
      
      return {
        date: formattedDate,
        dateTime: formattedDateTime,
        time: formattedTime,
        year: year,
        month: month,
        day: day,
        timezone: targetTimezone,
        timestamp: now.getTime()
      };
      
    } catch (error) {
      Logger.log(`❌ 獲取時區日期失敗: ${error.toString()}`);
      
      // 回退到系統預設時區
      const now = new Date();
      const fallbackDate = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      const fallbackDateTime = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      
      return {
        date: fallbackDate,
        dateTime: fallbackDateTime,
        time: Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm:ss'),
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
        timezone: Session.getScriptTimeZone(),
        timestamp: now.getTime()
      };
    }
  }
  
  /**
   * 📅 計算相對日期
   * @param {number} dayOffset - 日期偏移量（-1 = 昨天，0 = 今天，1 = 明天）
   * @param {string} timezone - 時區
   * @returns {string} 格式化的日期字串
   */
  getRelativeDate(dayOffset = 0, timezone = null) {
    try {
      const targetTimezone = timezone || this.defaultTimezone;
      const now = new Date();
      
      // 計算目標日期
      const targetDate = new Date(now.getTime() + (dayOffset * 24 * 60 * 60 * 1000));
      
      // 格式化為目標時區的日期
      const formattedDate = Utilities.formatDate(targetDate, targetTimezone, 'yyyy-MM-dd');
      
      Logger.log(`📅 相對日期 (偏移${dayOffset}天): ${formattedDate}`);
      
      return formattedDate;
      
    } catch (error) {
      Logger.log(`❌ 計算相對日期失敗: ${error.toString()}`);
      
      // 回退邏輯
      const now = new Date();
      const targetDate = new Date(now.getTime() + (dayOffset * 24 * 60 * 60 * 1000));
      return Utilities.formatDate(targetDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
  }
  
  /**
   * 🌐 嘗試從用戶位置獲取時區（模擬實現）
   * 注意：Google Apps Script 無法直接獲取用戶 GPS，這裡提供框架
   * @returns {string} 時區字串
   */
  detectUserTimezone() {
    try {
      // 方法 1: 從腳本時區推測（最可靠）
      const scriptTimezone = Session.getScriptTimeZone();
      Logger.log(`🔍 檢測到腳本時區: ${scriptTimezone}`);
      
      // 方法 2: 從用戶語言設定推測（如果可用）
      try {
        const userLocale = Session.getActiveUser().getEmail();
        Logger.log(`👤 用戶信息: ${userLocale}`);
        
        // 根據常見的地區推測時區
        if (userLocale.includes('.tw') || userLocale.includes('taiwan')) {
          return 'Asia/Taipei';
        } else if (userLocale.includes('.jp') || userLocale.includes('japan')) {
          return 'Asia/Tokyo';
        } else if (userLocale.includes('.cn') || userLocale.includes('china')) {
          return 'Asia/Shanghai';
        }
      } catch (userError) {
        Logger.log(`⚠️ 無法獲取用戶信息: ${userError.toString()}`);
      }
      
      // 方法 3: 使用腳本設定的時區
      return scriptTimezone || this.defaultTimezone;
      
    } catch (error) {
      Logger.log(`❌ 時區檢測失敗: ${error.toString()}`);
      return this.defaultTimezone;
    }
  }
  
  /**
   * 📝 生成動態的 AI Prompt 日期部分
   * @param {string} timezone - 時區
   * @returns {Object} 包含日期信息的物件
   */
  generatePromptDateInfo(timezone = null) {
    const currentDateTime = this.getCurrentDateTime(timezone);
    const yesterday = this.getRelativeDate(-1, timezone);
    const dayBeforeYesterday = this.getRelativeDate(-2, timezone);
    
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
}

/**
 * 🔧 修復語音記帳的 AI Prompt
 * @param {string} voiceText - 語音文字
 * @param {string} timezone - 時區（可選）
 * @returns {string} 修復後的 prompt
 */
function generateVoicePromptWithDynamicDate(voiceText, timezone = null) {
  const dateProcessor = new TimezoneAwareDateProcessor();
  const dateInfo = dateProcessor.generatePromptDateInfo(timezone);
  
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

  Logger.log(`📝 生成動態語音 Prompt (時區: ${dateInfo.timezone})`);
  Logger.log(`📅 基準日期: ${dateInfo.today}`);
  
  return prompt;
}

/**
 * 🔧 修復拍照記帳的 AI Prompt
 * @param {string} voiceNote - 語音補充說明（可選）
 * @param {string} timezone - 時區（可選）
 * @returns {string} 修復後的 prompt
 */
function generateImagePromptWithDynamicDate(voiceNote = null, timezone = null) {
  const dateProcessor = new TimezoneAwareDateProcessor();
  const dateInfo = dateProcessor.generatePromptDateInfo(timezone);
  
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

  Logger.log(`📸 生成動態圖片 Prompt (時區: ${dateInfo.timezone})`);
  Logger.log(`📅 基準日期: ${dateInfo.today}`);
  
  return prompt;
}

/**
 * 🧪 測試時區感知日期處理
 */
function testTimezoneAwareDateProcessor() {
  Logger.log('🧪 測試時區感知日期處理...');
  
  try {
    const processor = new TimezoneAwareDateProcessor();
    
    // 測試 1: 獲取當前日期時間
    Logger.log('\n=== 測試 1: 當前日期時間 ===');
    const currentDateTime = processor.getCurrentDateTime();
    Logger.log(`📅 今天: ${currentDateTime.date}`);
    Logger.log(`🕐 現在: ${currentDateTime.dateTime}`);
    Logger.log(`🌍 時區: ${currentDateTime.timezone}`);
    
    // 測試 2: 相對日期計算
    Logger.log('\n=== 測試 2: 相對日期計算 ===');
    const yesterday = processor.getRelativeDate(-1);
    const dayBeforeYesterday = processor.getRelativeDate(-2);
    Logger.log(`📅 昨天: ${yesterday}`);
    Logger.log(`📅 前天: ${dayBeforeYesterday}`);
    
    // 測試 3: 時區檢測
    Logger.log('\n=== 測試 3: 時區檢測 ===');
    const detectedTimezone = processor.detectUserTimezone();
    Logger.log(`🔍 檢測到的時區: ${detectedTimezone}`);
    
    // 測試 4: 生成 Prompt 日期信息
    Logger.log('\n=== 測試 4: Prompt 日期信息 ===');
    const dateInfo = processor.generatePromptDateInfo();
    Logger.log(`📝 Prompt 文字: ${dateInfo.promptText}`);
    
    // 測試 5: 生成動態 Prompt
    Logger.log('\n=== 測試 5: 動態 Prompt 生成 ===');
    const voicePrompt = generateVoicePromptWithDynamicDate('我今天買了一杯咖啡花了150元');
    Logger.log(`📝 語音 Prompt 長度: ${voicePrompt.length} 字符`);
    
    const imagePrompt = generateImagePromptWithDynamicDate('這是昨天的收據');
    Logger.log(`📸 圖片 Prompt 長度: ${imagePrompt.length} 字符`);
    
    Logger.log('\n✅ 時區感知日期處理測試完成');
    
  } catch (error) {
    Logger.log(`❌ 測試失敗: ${error.toString()}`);
  }
}

/**
 * 🔄 更新 Code.gs 中的語音記帳函數（示例）
 * 這個函數展示如何在現有代碼中整合時區感知功能
 */
function callGeminiForVoiceWithTimezone(voiceText, timezone = null) {
  Logger.log('🎤 呼叫 Gemini 進行語音記帳（時區感知版）...');
  
  try {
    // 使用動態生成的 prompt
    const prompt = generateVoicePromptWithDynamicDate(voiceText, timezone);
    
    // 呼叫 Gemini API
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
    
    const GEMINI_API_KEY = getConfig('GEMINI_API_KEY');
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
    
    const aiResultText = jsonResponse.candidates[0].content.parts[0].text;
    
    // 驗證返回的 JSON
    JSON.parse(aiResultText);
    
    Logger.log(`✅ 語音記帳處理完成（時區感知）`);
    return aiResultText;
    
  } catch (error) {
    Logger.log(`❌ 時區感知語音記帳失敗: ${error.toString()}`);
    throw error;
  }
}

/**
 * 📋 部署時區感知修復的指南
 */
function deployTimezoneAwareFix() {
  Logger.log('📋 部署時區感知修復指南...');
  
  Logger.log(`
=== 時區感知日期修復部署指南 ===

1. 【測試新功能】
   執行: testTimezoneAwareDateProcessor()
   
2. 【更新 Code.gs】
   需要修改以下函數：
   - callGeminiForVoice() → 使用 generateVoicePromptWithDynamicDate()
   - callGeminiForVision() → 使用 generateImagePromptWithDynamicDate()
   
3. 【替換硬編碼日期】
   搜尋並替換所有 "2025-07-25" 為動態日期
   
4. 【驗證修復效果】
   - 語音記帳測試：說「我今天買咖啡」
   - 拍照記帳測試：拍攝收據
   - 檢查記錄的日期是否為當天
   
5. 【時區配置】
   - 預設使用 Asia/Taipei
   - 可根據需要調整 defaultTimezone
   
✅ 修復完成後，系統將自動使用當前日期而非硬編碼的 7/25
  `);
}