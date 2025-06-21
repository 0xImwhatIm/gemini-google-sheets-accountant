// =================================================================================================
// 專案名稱：智慧記帳 GEM (Gemini AI Accountant)
// 版本：V29.0 - Gmail 自動化版
// 作者：[您的名稱]
// 最後更新：2025-06-21
// 說明：此版本為重大功能更新，加入了「管道一：官方發票管道」的核心功能。
//       新增了 syncInvoicesFromGmail() 等相關函式，使其具備自動掃描 Gmail、
//       解析官方電子發票郵件並自動記帳的能力。
// 注意：首次執行此版本，需額外授權 Google Apps Script 讀取您的 Gmail (gmail.readonly)。
// =================================================================================================

// =================================================================================================
// 【使用者設定區】
// 開始使用前，請將您自己的 Google Sheet ID、Gemini API Key 以及 Google Drive 資料夾 ID 填入此處。
// =================================================================================================
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
const SHEET_NAME = 'All Records'; // 請確認您的工作表分頁名稱與此處相符
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE';
const FOLDER_ID_TO_PROCESS = 'YOUR_GOOGLE_DRIVE_FOLDER_ID_FOR_PROCESSING';
const FOLDER_ID_ARCHIVE = 'YOUR_GOOGLE_DRIVE_FOLDER_ID_FOR_ARCHIVING';
const FOLDER_ID_DUPLICATES = 'YOUR_GOOGLE_DRIVE_FOLDER_ID_FOR_DUPLICATES';
// =================================================================================================


// =================================================================================================
// 【V29.0 新增功能】官方電子發票自動化管道
// =================================================================================================

/**
 * @description 【主函式】每日執行的官方發票同步作業。
 * 此函式應由時間觸發器每日自動執行一次。
 */
function syncInvoicesFromGmail() {
  const query = "from:invoice@einvoice.nat.gov.tw is:unread";
  const threads = GmailApp.search(query);
  let successCount = 0;

  threads.forEach(thread => {
    const messages = thread.getMessages();
    messages.forEach(message => {
      // 確保郵件是未讀的才處理
      if (message.isUnread()) {
        try {
          const invoiceData = parseInvoiceEmail(message.getBody());
          
          if (invoiceData && invoiceData.invoiceNumber) {
            // 進行查重與寫入
            const isWritten = writeToSheetFromEmail(invoiceData);
            if (isWritten) {
              successCount++;
            }
            // 無論是否寫入 (可能因重複而跳過)，都將郵件標示為已讀
            message.markRead();
          }
        } catch (e) {
          Logger.log(`處理郵件失敗: ${e.toString()}. 主旨: ${message.getSubject()}`);
        }
      }
    });
  });

  if (successCount > 0) {
    Logger.log(`Gmail 同步作業完成，成功新增 ${successCount} 筆官方電子發票紀錄。`);
  } else {
    Logger.log("Gmail 同步作業完成，沒有發現新的官方電子發票。");
  }
}

/**
 * @description 【輔助函式】解析財政部官方電子發票郵件的內文 (HTML)。
 * @param {string} htmlBody - 郵件的 HTML 內文。
 * @returns {Object|null} - 包含發票資訊的物件，或在解析失敗時回傳 null。
 */
function parseInvoiceEmail(htmlBody) {
  // 使用正規表達式從 HTML 中提取關鍵資訊
  const invoiceNumberMatch = htmlBody.match(/發票號碼(?:<[^>]+>)*\s*([A-Z]{2}-\d{8})/);
  const dateMatch = htmlBody.match(/開立日期(?:<[^>]+>)*\s*(\d{3}\/\d{2}\/\d{2})/);
  const amountMatch = htmlBody.match(/總計(?:<[^>]+>)*\s*NT\$([\d,]+)/);
  const sellerMatch = htmlBody.match(/賣方營業人名稱(?:<[^>]+>)*\s*([^<]+)/);

  if (!invoiceNumberMatch || !dateMatch || !amountMatch || !sellerMatch) {
    Logger.log("郵件解析失敗：找不到所有必要的發票欄位。");
    return null;
  }
  
  // 處理民國年 -> 西元年
  const minguoYear = parseInt(dateMatch[1].substring(0, 3), 10);
  const adYear = minguoYear + 1911;
  const monthDay = dateMatch[1].substring(4);
  const formattedDate = `${adYear}/${monthDay}`;

  return {
    invoiceNumber: invoiceNumberMatch[1],
    timestamp: new Date(formattedDate),
    amount: parseFloat(amountMatch[1].replace(/,/g, '')),
    item: sellerMatch[1].trim(), // 將賣方名稱作為品項
    currency: 'TWD'
  };
}

/**
 * @description 【輔助函式】將從 Email 解析出的發票資料寫入 Google Sheet，並進行查重。
 * @param {Object} data - 從 parseInvoiceEmail 解析出的發票物件。
 * @returns {boolean} - 如果成功寫入則回傳 true，如果是重複紀錄則回傳 false。
 */
function writeToSheetFromEmail(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const dataRange = sheet.getRange("I2:I" + sheet.getLastRow()); // 只檢查發票號碼欄 (I)
  const existingInvoiceNumbers = dataRange.getValues().flat();

  // 管道一的查重核心：只比對絕對唯一的發票號碼
  if (existingInvoiceNumbers.includes(data.invoiceNumber)) {
    Logger.log(`發現重複的官方發票，跳過寫入：${data.invoiceNumber}`);
    return false;
  }

  const amountTWD = data.amount;
  
  const row = [
    data.timestamp,
    data.amount,
    data.currency,
    1, // Exchange Rate
    amountTWD,
    '其他', // Category (官方發票預設為其他，可手動修改)
    data.item,
    '私人', // Account Type
    data.invoiceNumber,
    null, // Reference No.
    null, // Buyer Name
    null, // Buyer Tax ID
    null, // Seller Tax ID
    null, // Photo Link
    '待確認', // Status
    '電子發票', // Source
    `由 ${data.item} 開立`, // Notes
    null, // Raw Text
    null  // Translation
  ];
  sheet.appendRow(row);
  return true;
}

// =================================================================================================
// 既有功能 (V28.6)
// =================================================================================================

/**
 * @description Web App 的主入口函式，接收來自 iPhone 捷徑的 HTTP POST 請求。
 * @param {Object} e - Apps Script 的事件物件，包含請求的參數。
 * @returns {ContentService.TextOutput} - 回傳給前端的 JSON 回應。
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("無效的請求：缺少 postData。");
    }
    
    const params = JSON.parse(e.postData.contents);
    const imageBase64 = params.image_base64;
    const voiceText = params.voice_text;
    const fileName = params.filename || `image_${new Date().getTime()}.jpg`;

    if (imageBase64) {
      const imageBytes = Utilities.base64Decode(imageBase64);
      return processImage(imageBytes, fileName, voiceText);
    } else if (voiceText) {
      return processVoice(voiceText);
    } else {
      throw new Error("無效的請求：必須提供 image_base64 或 voice_text。");
    }

  } catch (error) {
    Logger.log(`[doPost Error] ${error.toString()}`);
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: `後端處理失敗: ${error.message}`
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * @description 處理圖片的核心函式（純拍照或旅行筆記模式）。
 * @param {Byte[]} imageBytes - 圖片的位元組陣列。
 * @param {string} fileName - 圖片的原始檔名。
 * @param {string} [optionalVoiceNote] - 可選的語音備註 (旅行筆記模式)。
 * @returns {ContentService.TextOutput} - 處理結果的 JSON 回應。
 */
function processImage(imageBytes, fileName, optionalVoiceNote) {
  const processFolder = DriveApp.getFolderById(FOLDER_ID_TO_PROCESS);
  const tempFile = processFolder.createFile(Utilities.newBlob(imageBytes, 'image/jpeg', fileName));
  
  try {
    const aiResult = callGeminiForVision(imageBytes, optionalVoiceNote);
    const parsedData = JSON.parse(aiResult.text);
    const rawText = aiResult.rawText || '';
    const translation = aiResult.translation || '';

    if (isDuplicate(parsedData, rawText)) {
      const duplicatesFolder = DriveApp.getFolderById(FOLDER_ID_DUPLICATES);
      tempFile.moveTo(duplicatesFolder);
      Logger.log(`偵測到重複紀錄，檔案 ${fileName} 已移至重複資料夾。`);
      return ContentService.createTextOutput(JSON.stringify({
        status: 'duplicate',
        message: '偵測到重複紀錄。'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    writeToSheetFromOCR(parsedData, tempFile.getUrl(), rawText, translation, optionalVoiceNote);

    const archiveFolder = DriveApp.getFolderById(FOLDER_ID_ARCHIVE);
    tempFile.moveTo(archiveFolder);
    
    Logger.log(`成功處理圖片 ${fileName} 並寫入 Google Sheet。`);
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: '影像辨識與記帳成功。',
      data: parsedData
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log(`[processImage Error] ${error.toString()} for file ${fileName}`);
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: `處理影像時發生錯誤: ${error.message}`
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * @description 處理純語音記帳的核心函式。
 * @param {string} voiceText - 語音辨識後的文字。
 * @returns {ContentService.TextOutput} - 處理結果的 JSON 回應。
 */
function processVoice(voiceText) {
  try {
    const aiResultText = callGeminiForVoice(voiceText);
    const parsedData = JSON.parse(aiResultText);
    
    writeToSheetFromVoice(parsedData);

    Logger.log(`成功處理語音記帳: "${voiceText}"`);
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: '語音記帳成功。',
      data: parsedData
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log(`[processVoice Error] ${error.toString()} for text "${voiceText}"`);
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: `處理語音時發生錯誤: ${error.message}`
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * @description 呼叫 Gemini API 進行圖片辨識 (Vision) 與資料提取。
 * @param {Byte[]} imageBytes - 圖片的位元組陣列。
 * @param {string} [voiceNote] - 可選的語音備註。
 * @returns {{text: string, rawText: string, translation: string}} - 包含結構化 JSON 字串、OCR 原文和翻譯的物件。
 */
function callGeminiForVision(imageBytes, voiceNote) {
  const prompt = `
    你是一位專業的台灣在地記帳助理。請分析這張圖片（以及可能的語音備註），並嚴格按照以下單一 JSON 格式回傳結果，不包含任何額外的說明文字或 markdown 標記。

    **最終輸出的 JSON 結構:**
    {
      "structuredData": {
          "timestamp": "2025-06-20T19:30:00",
          "amount": 165,
          "currency": "TWD",
          "item": "海關進口稅費",
          "category": "帳單",
          "invoiceNumber": null,
          "referenceNumber": "CX121133534477",
          "notes": "從國外網站買東西的關稅"
      },
      "rawText": "這裡是從圖片辨識出的所有原始文字...",
      "translation": "如果原文是外語，這裡是翻譯後的繁體中文..."
    }

    **任務與規則:**
    1.  **rawText:** 提取圖片中的所有原始文字，放到 "rawText" 欄位。
    2.  **translation:** 如果原始文字為外語，請將其翻譯成繁體中文，放到 "translation" 欄位。如果原始文字是中文，此欄位回傳 null。
    3.  **structuredData:** 根據原始文字和語音備註，填寫結構化資料：
        * **特殊文件規則：**
            * 如果文件標題包含「海關」、「繳納證明」或「罰單」，這是一筆「帳單」費用。
            * **金額 (amount):** 請優先尋找「稅費合計」、「總計」、「應繳金額」等字樣旁的數字作為總金額。忽略明細項目。
            * **品項 (item):** 直接使用文件的大標題，例如「海關進口稅費」或「交通罰單」。
            * **參考編號 (referenceNumber):** 尋找如「稅單號碼」、「單號碼」等唯一識別碼。
            * **日期 (timestamp):** 優先尋找「填發日期」、「繳費日期」或文件上最新的日期。
        * **一般收據規則：**
            * **timestamp:** 提取交易日期與時間。找不到則用今天中午12點。
            * **amount:** 提取總金額 (Total)。
            * **currency:** 判斷幣別 (e.g., TWD, JPY, USD)。"$" 優先視為 "TWD"。
            * **item:** 商家名稱或主要品項。
            * **category:** **必須**從 [餐飲, 交通, 購物, 娛樂, 居家, 醫療, 帳單, 雜項, 旅遊, 投資, 收入, 工作] 中選擇。
            * **invoiceNumber:** 10位數發票號碼，沒有則回傳 null。
        * **通用規則：**
            * **notes:** 填入下方提供的語音備註。

    **語音備註:** ${voiceNote || "無"}
    `;

  const requestBody = {
    "contents": [{
        "role": "user",
        "parts": [
          { "text": prompt },
          { "inline_data": { "mime_type": "image/jpeg", "data": Utilities.base64Encode(imageBytes) }}
        ]
    }],
    "generationConfig": { "response_mime_type": "application/json" }
  };

  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(requestBody)
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
  const response = UrlFetchApp.fetch(url, options);
  const responseText = response.getContentText();
  
  try {
    const jsonResponse = JSON.parse(responseText);
    const fullResponse = jsonResponse.candidates[0].content.parts[0].text;
    const parsedJson = JSON.parse(fullResponse);

    if (parsedJson.structuredData && 'rawText' in parsedJson && 'translation' in parsedJson) {
      return {
        text: JSON.stringify(parsedJson.structuredData),
        rawText: parsedJson.rawText,
        translation: parsedJson.translation
      };
    } else {
       throw new Error("AI 回應的 JSON 結構不符合預期。");
    }
  } catch (e) {
    Logger.log(`callGeminiForVision 解析 JSON 失敗: ${e.toString()}. 原始回傳: ${responseText}`);
    throw new Error("AI 回應格式錯誤，無法解析為 JSON。");
  }
}


/**
 * @description 呼叫 Gemini API 進行純語音文字的解析。
 * @param {string} voiceText - 語音辨識後的文字。
 * @returns {string} - 包含結構化資料的 JSON 字串。
 */
function callGeminiForVoice(voiceText) {
  const prompt = `
    你是一位非常嚴謹、只會遵循規則的記帳助理。請將以下這段口語化的描述，嚴格地轉換為結構化的 JSON 格式。

    **核心規則:**
    1.  **嚴格服從:** 絕不創造任何規則以外的資訊。如果找不到對應資訊，則回傳 null。
    2.  **JSON 輸出:** 務必只回傳一個乾淨的 JSON 物件，不包含任何前後說明文字或 "'''json" 標記。

    **欄位提取規則:**
    1.  **金額 (amount):**
        * 這是**最重要的欄位**。請仔細尋找任何數字，特別是後面跟著「元」或「塊」的數字。
        * 如果語音中明確提到了金額，**務必**將其提取為數字格式。
        * 如果語音中完全沒有提到任何金額，此欄位回傳 null，**不要編造或猜測**。
    2.  **分類 (category):**
        * 你 **必須** 從以下這個固定的列表中選擇一個最適合的分類：["食", "衣", "住", "行", "育", "樂", "醫療", "教育", "其他"]。
        * **範例:** 「吃午餐」、「喝了杯咖啡」應分類為「食」；「搭計程車回家」應分類為「行」。
        * **絕不**可以使用此列表以外的任何分類。如果無法明確對應，請一律使用 "其他"。
    3.  **時間 (timestamp):**
        * 解析描述中的相對時間，如「昨天晚上7點」、「前天中午」。
        * 如果沒有提到時間，使用今天的日期與當下時間。
    4.  **品項/地點 (item):**
        * 盡力從描述中提取消費的具體品項或商家名稱。
        * 如果無法判斷，可以回傳一個簡短的描述，例如 "晚餐" 或 "計程車費"。
    5.  **幣別 (currency):**
        * 此欄位固定為 "TWD"。
    6.  **備註 (notes):**
        * 將原始的完整語音文字，填入此欄位。
    
    **最終檢查:** 在輸出前，請再次確認「金額」和「分類」都完全符合上述規則。

    **口語描述:** "${voiceText}"
    `;

    const requestBody = {
      "contents": [{ "parts":[{ "text": prompt }] }],
      "generationConfig": { "response_mime_type": "application/json" }
    };

    const options = {
      'method' : 'post',
      'contentType': 'application/json',
      'payload' : JSON.stringify(requestBody)
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
    const response = UrlFetchApp.fetch(url, options);
    const responseText = response.getContentText();
    
    try {
        const jsonResponse = JSON.parse(responseText);
        return jsonResponse.candidates[0].content.parts[0].text;
    } catch (e) {
        Logger.log(`callGeminiForVoice 解析 JSON 失敗: ${e.toString()}. 原始回傳: ${responseText}`);
        throw new Error("AI 未回傳有效的 JSON 格式。");
    }
}


/**
 * @description 將 OCR 辨識出的資料寫入 Google Sheet。
 * @param {Object} data - 從 AI 解析出的 JSON 物件。
 * @param {string} fileUrl - 已歸檔圖片的 Google Drive 連結。
 * @param {string} rawText - OCR 辨識出的原始文字。
 * @param {string} translation - 原始文字的翻譯。
 * @param {string} [optionalVoiceNote] - 可選的語音備註。
 */
async function writeToSheetFromOCR(data, fileUrl, rawText, translation, optionalVoiceNote) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const rate = await getExchangeRate(data.currency || 'TWD');
  const amountTWD = (data.currency === 'TWD' || !data.currency) ? data.amount : (data.amount * rate);
  
  const row = [
    data.timestamp ? new Date(data.timestamp) : new Date(),
    data.amount || null,
    data.currency || 'TWD',
    rate,
    amountTWD || null,
    data.category || '雜項',
    data.item || null,
    '私人', // Account Type (可自訂)
    data.invoiceNumber || null,
    data.referenceNumber || null,
    null, // Buyer Name
    null, // Buyer Tax ID
    null, // Seller Tax ID
    fileUrl,
    '待確認', // Status
    optionalVoiceNote ? 'OCR+語音' : 'OCR', // Source
    data.notes || optionalVoiceNote || null, // Notes
    rawText,
    translation
  ];
  sheet.appendRow(row);
}

/**
 * @description 將純語音解析出的資料寫入 Google Sheet。
 * @param {Object} data - 從 AI 解析出的 JSON 物件。
 */
async function writeToSheetFromVoice(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const rate = await getExchangeRate(data.currency || 'TWD');
  const amountTWD = (data.currency === 'TWD' || !data.currency) ? data.amount : (data.amount * rate);
  
  const row = [
    data.timestamp ? new Date(data.timestamp) : new Date(),
    data.amount || null,
    data.currency || 'TWD',
    rate,
    amountTWD || null,
    data.category || '其他',
    data.item || null,
    '私人',
    null,
    null,
    null,
    null,
    null,
    null, // Photo Link
    '待確認',
    '語音', // Source
    data.notes || null,
    null, // Raw Text
    null  // Translation
  ];
  sheet.appendRow(row);
}

/**
 * @description V28 強化版查重機制。
 * @param {Object} data - 從 AI 解析出的 JSON 物件。
 * @param {string} rawText - 當前收據的 OCR 原文。
 * @returns {boolean} - 如果是重複紀錄，回傳 true。
 */
function isDuplicate(data, rawText) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  
  const INVOICE_COL = 8;
  const REF_NO_COL = 9;
  const DATE_COL = 0;
  const AMOUNT_TWD_COL = 4;
  const RAW_TEXT_COL = 17;

  if (data.invoiceNumber) {
    for (let i = 1; i < values.length; i++) {
      if (values[i][INVOICE_COL] === data.invoiceNumber) return true;
    }
  }
  if (data.referenceNumber) {
    for (let i = 1; i < values.length; i++) {
      if (values[i][REF_NO_COL] === data.referenceNumber) return true;
    }
  }
  
  if (!rawText || rawText.trim() === '') return false;

  const newDate = new Date(data.timestamp);
  const newAmount = parseFloat(data.amount);

  for (let i = 1; i < values.length; i++) {
    const existingDate = new Date(values[i][DATE_COL]);
    const existingAmount = parseFloat(values[i][AMOUNT_TWD_COL]);
    const existingRawText = values[i][RAW_TEXT_COL];

    if (!existingDate || isNaN(existingAmount) || !existingRawText) continue;

    const timeDiff = Math.abs(newDate.getTime() - existingDate.getTime());
    const dayDiff = timeDiff / (1000 * 3600 * 24);
    
    if (dayDiff <= 1 && Math.abs(newAmount - existingAmount) < 0.01) {
      const similarity = 1 - (levenshtein(rawText, existingRawText) / Math.max(rawText.length, existingRawText.length));
      if (similarity > 0.9) {
        Logger.log(`偵測到高度相似紀錄 (相似度: ${similarity})，視為重複。`);
        return true;
      }
    }
  }

  return false;
}

/**
 * @description 智慧匯率獲取函式 (具備暫存與備案機制)。
 * @param {string} currency - 3位字母的貨幣代碼。
 * @returns {Promise<number>} - 兌換成 TWD 的匯率。
 */
async function getExchangeRate(currency) {
  if (currency === 'TWD' || !currency) return 1;

  const cache = CacheService.getScriptCache();
  const cachedRate = cache.get(currency);
  if (cachedRate) {
    return parseFloat(cachedRate);
  }

  try {
    const url = `https://api.exchangerate-api.com/v4/latest/${currency}`;
    const response = await UrlFetchApp.fetch(url);
    const data = JSON.parse(response.getContentText());
    const rate = data.rates.TWD;

    if (!rate) throw new Error("API 未回傳 TWD 匯率。");

    cache.put(currency, rate.toString(), 3600);
    return rate;

  } catch (error) {
    Logger.log(`[getExchangeRate Error] ${error.toString()}. 使用備案匯率。`);
    const fallbackRates = { 'JPY': 0.21, 'USD': 32.5, 'EUR': 35.0, 'CNY': 4.5 };
    return fallbackRates[currency] || 1;
  }
}

/**
 * @description 計算兩個字串之間的 Levenshtein 距離。
 * @param {string} a - 字串 A。
 * @param {string} b - 字串 B。
 * @returns {number} - 距離值。
 */
function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * @description 背景函式，可由時間觸發器定期執行，用來處理手動上傳到資料夾的收據。
 * 注意：在 V28 的主要流程中，此函式為輔助性質。
 */
function checkReceiptsFolder() {
  const processFolder = DriveApp.getFolderById(FOLDER_ID_TO_PROCESS);
  const files = processFolder.getFiles();

  while (files.hasNext()) {
    const file = files.next();
    const fileName = file.getName();
    
    let voiceNote = null;
    try {
      const noteFileName = fileName.split('.')[0] + '.txt';
      const noteFiles = processFolder.getFilesByName(noteFileName);
      if (noteFiles.hasNext()) {
        const noteFile = noteFiles.next();
        voiceNote = noteFile.getBlob().getDataAsString();
        noteFile.setTrashed(true);
      }
    } catch(e) {
      Logger.log(`尋找備註檔 ${fileName} 時發生錯誤: ${e.toString()}`);
    }

    Logger.log(`由背景觸發器處理檔案：${fileName}`);
    processImage(file.getBlob().getBytes(), fileName, voiceNote);
  }
}

