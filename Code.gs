// =================================================================================================
// 專案名稱：智慧記帳 GEM (Gemini AI Accountant)
// 版本：V28.5 - 智慧升級版 (開源準備版)
// 作者：[您的名稱]
// 最後更新：2025-06-20
// 說明：此版本為準備上傳至 GitHub 的開源版本。它整合了多模式輸入、強化的 AI 辨識
//       與穩定的錯誤處理機制。使用者需在下方設定區填入自己的金鑰與 ID。
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

/**
 * @description Web App 的主入口函式，接收來自 iPhone 捷徑的 HTTP POST 請求。
 * @param {Object} e - Apps Script 的事件物件，包含請求的參數。
 * @returns {ContentService.TextOutput} - 回傳給前端的 JSON 回應。
 */
function doPost(e) {
  try {
    // 檢查請求內容是否存在
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("無效的請求：缺少 postData。");
    }
    
    const params = JSON.parse(e.postData.contents);
    const imageBase64 = params.image_base64;
    const voiceText = params.voice_text; // 可能是語音辨識文字，也可能是旅行筆記的備註
    const fileName = params.filename || `image_${new Date().getTime()}.jpg`;

    // 根據收到的參數，決定執行哪個處理流程
    if (imageBase64) {
      // 模式：純拍照 或 旅行筆記 (照片+語音)
      const imageBytes = Utilities.base64Decode(imageBase64);
      return processImage(imageBytes, fileName, voiceText);
    } else if (voiceText) {
      // 模式：純語音記帳
      return processVoice(voiceText);
    } else {
      throw new Error("無效的請求：必須提供 image_base64 或 voice_text。");
    }

  } catch (error) {
    Logger.log(`[doPost Error] ${error.toString()}`);
    // 回傳一個標準化的錯誤訊息給前端
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

    // 執行進階查重
    if (isDuplicate(parsedData, rawText)) {
      const duplicatesFolder = DriveApp.getFolderById(FOLDER_ID_DUPLICATES);
      tempFile.moveTo(duplicatesFolder);
      Logger.log(`偵測到重複紀錄，檔案 ${fileName} 已移至重複資料夾。`);
      return ContentService.createTextOutput(JSON.stringify({
        status: 'duplicate',
        message: '偵測到重複紀錄。'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 將資料寫入 Google Sheet
    writeToSheetFromOCR(parsedData, tempFile.getUrl(), rawText, translation, optionalVoiceNote);

    // 歸檔處理完成的圖片
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
    // 如果處理失敗，檔案會留在待處理資料夾中供手動檢查
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
    
    // 語音模式不進行查重，直接寫入
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
          "amount": 120,
          "currency": "TWD",
          "item": "某某咖啡店",
          "category": "餐飲",
          "invoiceNumber": "AB-12345678",
          "referenceNumber": null,
          "notes": "和朋友喝下午茶"
      },
      "rawText": "這裡是從圖片辨識出的所有原始文字...",
      "translation": "如果原文是外語，這裡是翻譯後的繁體中文..."
    }

    **任務與規則:**
    1.  **rawText:** 提取圖片中的所有原始文字，放到 "rawText" 欄位。
    2.  **translation:** 如果原始文字為外語，請將其翻譯成繁體中文，放到 "translation" 欄位。如果原始文字是中文，此欄位回傳 null。
    3.  **structuredData:** 根據原始文字和語音備註，填寫結構化資料：
        * **timestamp:** 提取交易日期與時間。找不到則用今天中午12點。
        * **amount:** 提取總金額。
        * **currency:** 判斷幣別 (e.g., TWD, JPY, USD)。"$" 優先視為 "TWD"。
        * **item:** 商家名稱或主要品項。
        * **category:** **必須**從 [餐飲, 交通, 購物, 娛樂, 居家, 醫療, 帳單, 雜項, 旅遊, 投資, 收入, 工作] 中選擇。
        * **invoiceNumber:** 10位數發票號碼，沒有則回傳 null。
        * **referenceNumber:** 其他參考編號，沒有則回傳 null。
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
  
  // V5 Schema Column Indexes
  const INVOICE_COL = 8; // 發票號碼 (I)
  const REF_NO_COL = 9; // 參考編號 (J)
  const DATE_COL = 0;    // 時間戳 (A)
  const AMOUNT_TWD_COL = 4; // 金額 TWD (E)
  const RAW_TEXT_COL = 17; // OCR 原文 (R)

  // 主要路徑：檢查發票號碼或參考編號
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
  
  // Fallback 路徑：檢查日期、金額、原文相似度
  if (!rawText || rawText.trim() === '') return false; // 如果沒有原文，不進行相似度比對

  const newDate = new Date(data.timestamp);
  const newAmount = parseFloat(data.amount);

  for (let i = 1; i < values.length; i++) {
    const existingDate = new Date(values[i][DATE_COL]);
    const existingAmount = parseFloat(values[i][AMOUNT_TWD_COL]);
    const existingRawText = values[i][RAW_TEXT_COL];

    if (!existingDate || isNaN(existingAmount) || !existingRawText) continue;

    const timeDiff = Math.abs(newDate.getTime() - existingDate.getTime());
    const dayDiff = timeDiff / (1000 * 3600 * 24);
    
    // 日期在 ±1 天內，且金額幾乎相同
    if (dayDiff <= 1 && Math.abs(newAmount - existingAmount) < 0.01) {
      const similarity = 1 - (levenshtein(rawText, existingRawText) / Math.max(rawText.length, existingRawText.length));
      // 原文相似度 > 90%
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
    // 優先使用具備備援的 API
    const url = `https://api.exchangerate-api.com/v4/latest/${currency}`;
    const response = await UrlFetchApp.fetch(url);
    const data = JSON.parse(response.getContentText());
    const rate = data.rates.TWD;

    if (!rate) throw new Error("API 未回傳 TWD 匯率。");

    cache.put(currency, rate.toString(), 3600); // 暫存 1 小時
    return rate;

  } catch (error) {
    Logger.log(`[getExchangeRate Error] ${error.toString()}. 使用備案匯率。`);
    // 備案：手動維護的匯率表
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
    
    // 簡易的配對邏輯：尋找同檔名的 .txt 備註檔
    let voiceNote = null;
    try {
      const noteFileName = fileName.split('.')[0] + '.txt';
      const noteFiles = processFolder.getFilesByName(noteFileName);
      if (noteFiles.hasNext()) {
        const noteFile = noteFiles.next();
        voiceNote = noteFile.getBlob().getDataAsString();
        // 刪除備註檔
        noteFile.setTrashed(true);
      }
    } catch(e) {
      Logger.log(`尋找備註檔 ${fileName} 時發生錯誤: ${e.toString()}`);
    }

    Logger.log(`由背景觸發器處理檔案：${fileName}`);
    processImage(file.getBlob().getBytes(), fileName, voiceNote);
  }
}
