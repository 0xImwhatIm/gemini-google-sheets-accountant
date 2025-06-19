/**
 * =================================================================
 * 智慧記帳 GEM - 開源版程式碼 (基於 V30)
 * =================================================================
 * This is the open-source version of the "Smart Accountant GEM" project.
 * All personal IDs and Keys have been replaced with placeholders.
 * Please fill in your own information in the USER SETTINGS section.
 *
 * @version 30.0.0-opensource
 * @author Gemini & You
 */

// ====================【使用者設定區 (USER SETTINGS)】====================
// 請將 'YOUR_...' 替換為您自己的資訊
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID'; // 您的 Google Sheet 檔案 ID
const SHEET_NAME = 'All Records'; // 您要寫入的工作表分頁名稱
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY'; // 您的 Google AI Gemini API 金鑰
const FOLDER_ID_TO_PROCESS = 'YOUR_FOLDER_ID_TO_PROCESS'; // 您用來存放待處理收據的資料夾 ID
const FOLDER_ID_ARCHIVE = 'YOUR_FOLDER_ID_ARCHIVE'; // 您用來存放已歸檔收據的資料夾 ID
const FOLDER_ID_DUPLICATES = 'YOUR_FOLDER_ID_DUPLICATES'; // 您用來存放重複單據的資料夾 ID

const COLUMN_MAP = {
  TIMESTAMP: 1,
  AMOUNT: 2,
  INVOICE_NO: 9,
  REFERENCE_NO: 10,
  NOTES: 17,
  RAW_TEXT: 18
};

// ===========================================================

// ===========================================================
// SECTION 1: Web App 主入口函式
// ===========================================================
function doPost(e) {
  const requestType = e.postData.type;
  const requestContents = e.postData.contents;

  if (requestType === 'application/json') {
    try {
      const requestData = JSON.parse(requestContents);
      if (requestData.image_base64) {
        const noteText = requestData.note_text || null;
        handleTravelLog(requestData.image_base64, noteText);
        return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: '旅行筆記已收到' })).setMimeType(ContentService.MimeType.JSON);
      } else if (requestData.text) {
        const parsedData = callGeminiForVoice(requestData.text);
        writeToSheetFromVoice(parsedData);
        return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: '語音記錄成功' })).setMimeType(ContentService.MimeType.JSON);
      } else {
        throw new Error("JSON 格式無法辨識，缺少必要的鍵 (image_base64 或 text)。");
      }
    } catch (error) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: `處理 JSON 請求失敗: ${error.toString()}` })).setMimeType(ContentService.MimeType.JSON);
    }
  } else if (requestType.startsWith('image/')) {
    try {
      const imageBlob = e.postData;
      handleImageUpload(imageBlob, null);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: '照片已收到，將在背景處理。' })).setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: `處理圖片請求失敗: ${error.toString()}` })).setMimeType(ContentService.MimeType.JSON);
    }
  } else {
    const errorMessage = `不支援的請求類型: ${requestType}`;
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: errorMessage })).setMimeType(ContentService.MimeType.JSON);
  }
}

function handleImageUpload(imageBlob, noteText) {
  const processFolder = DriveApp.getFolderById(FOLDER_ID_TO_PROCESS);
  const timestamp = new Date().getTime();
  const imageFileName = `receipt-${timestamp}.jpg`;
  const file = processFolder.createFile(imageBlob).setName(imageFileName);
  if (noteText && noteText.trim() !== '') {
    const noteFileName = `note-${timestamp}.txt`;
    processFolder.createFile(noteFileName, noteText, 'text/plain');
  }
}

function handleTravelLog(imageBase64, noteText) {
  const imageBlob = Utilities.newBlob(Utilities.base64Decode(imageBase64), 'image/jpeg', `receipt-decoded.jpg`);
  handleImageUpload(imageBlob, noteText);
}

// ===========================================================
// SECTION 2: 收據掃描與查重
// ===========================================================
function checkReceiptsFolder() {
  const processFolder = DriveApp.getFolderById(FOLDER_ID_TO_PROCESS);
  const archiveFolder = DriveApp.getFolderById(FOLDER_ID_ARCHIVE);
  const duplicatesFolder = DriveApp.getFolderById(FOLDER_ID_DUPLICATES);
  let fileMap = {};
  let allImageFiles = [];
  const files = processFolder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    if (file.getMimeType().startsWith('image/')) {
      allImageFiles.push(file);
    } else if (file.getName().startsWith('note-')) {
      const timestamp = file.getName().replace('note-', '').replace('.txt', '');
      if (!fileMap[timestamp]) { fileMap[timestamp] = {}; }
      fileMap[timestamp].note = file;
    }
  }
  for (const imageFile of allImageFiles) {
    try {
      let noteContent = null;
      const parts = imageFile.getName().split('-');
      if (parts.length > 1) {
        const timestamp = parts[parts.length - 1].split('.')[0];
        if (fileMap[timestamp] && fileMap[timestamp].note) {
          noteContent = fileMap[timestamp].note.getBlob().getDataAsString();
          if (noteContent && noteContent.trim() === '') {
            noteContent = null;
          }
          fileMap[timestamp].note.setTrashed(true);
        }
      }
      processImage(imageFile, archiveFolder, duplicatesFolder, noteContent);
    } catch (e) {
      console.error(`處理檔案 ${imageFile.getName()} 時發生嚴重錯誤: ${e.toString()}`);
    }
  }
}

function processImage(file, archiveFolder, duplicatesFolder, voiceNote) {
  const originalFileName = file.getName();
  const imageBytes = file.getBlob().getBytes();
  const parsedData = callGeminiForVision(imageBytes, voiceNote);
  if (!parsedData || !parsedData.structured) {
    console.log(`檔案 ${originalFileName} 無法被 AI 解析，直接歸檔。`);
    file.moveTo(archiveFolder);
    return;
  }

  const structured = parsedData.structured;
  
  if (isDuplicate(structured, parsedData.raw_text)) {
    console.log(`偵測到重複的單據。檔案 ${originalFileName} 將被移動到重複資料夾。`);
    file.moveTo(duplicatesFolder);
    return;
  }

  const translation = translateText(parsedData.raw_text);
  writeToSheetFromOCR(structured, file.getUrl(), parsedData.raw_text, translation, voiceNote);
  try {
    const category = structured.category || '未分類';
    file.setName(`${category} - ${originalFileName}`);
  } catch (e) { console.error(`重新命名檔案時發生錯誤: ${e.toString()}`); }
  file.moveTo(archiveFolder);
}

function isDuplicate(structuredData, rawText) {
  try {
    if (structuredData.invoiceNumber && isDuplicateEntry(structuredData.invoiceNumber, COLUMN_MAP.INVOICE_NO)) return true;
    if (structuredData.referenceNumber && isDuplicateEntry(structuredData.referenceNumber, COLUMN_MAP.REFERENCE_NO)) return true;

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    const range = sheet.getDataRange();
    const values = range.getValues();
    
    if (!structuredData.transactionDate || !structuredData.amount) return false;
    const newDate = new Date(structuredData.transactionDate);
    const newAmount = parseFloat(structuredData.amount);

    if (isNaN(newDate.getTime()) || isNaN(newAmount)) return false;

    for (let i = 1; i < values.length; i++) {
      try {
        const row = values[i];
        const existingDateStr = row[COLUMN_MAP.TIMESTAMP - 1];
        const existingAmountStr = row[COLUMN_MAP.AMOUNT - 1];

        if (!existingDateStr || !existingAmountStr) continue;

        const existingDate = new Date(existingDateStr);
        const existingAmount = parseFloat(existingAmountStr);
        
        if (isNaN(existingDate.getTime()) || isNaN(existingAmount)) continue;

        const timeDiff = Math.abs(newDate.getTime() - existingDate.getTime());
        const dayDiff = timeDiff / (1000 * 3600 * 24);

        if (dayDiff <= 1 && newAmount === existingAmount) {
          const existingRawText = row[COLUMN_MAP.RAW_TEXT - 1];
          if (rawText && existingRawText) {
            const similarity = levenshteinDistance(rawText, existingRawText);
            if (similarity > 0.9) {
              console.log(`Fallback 查重觸發：與第 ${i + 1} 行記錄相似度達 ${similarity.toFixed(2)}`);
              return true;
            }
          }
        }
      } catch(innerError) {
          console.error(`在比對第 ${i+1} 行時發生錯誤，已跳過: ${innerError.toString()}`);
          continue;
      }
    }
  } catch (outerError) {
      console.error(`執行 isDuplicate 函式時發生嚴重錯誤: ${outerError.toString()}`);
      return false;
  }
  return false;
}

function isDuplicateEntry(value, columnNumber) {
  if (!value) return false;
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getRange(2, columnNumber, sheet.getLastRow() - 1, 1).getValues();
  const existingValues = data.map(row => row[0].toString().trim()).filter(String);
  return existingValues.includes(value.toString().trim());
}

function levenshteinDistance(s1, s2) {
  let longer = s1;
  let shorter = s2;
  if (s1.length < s2.length) {
    longer = s2;
    shorter = s1;
  }
  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;
  return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);

  function editDistance(s1, s2) {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) costs[j] = j;
        else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }
}

// ===========================================================
// SECTION 3: Gemini AI & 翻譯函式
// ===========================================================
function callGeminiForVoice(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
  const today = new Date().toLocaleDateString('en-CA');
  const prompt = `你是一個專業的記帳助理。今天是 ${today}。請從以下這段台灣繁體中文的記帳文字中，提取結構化資訊，並回傳一個 JSON 物件。
    【重要規則】
    - **日期與時間：** 請只提取文字中明確提及的日期和時間。**如果文字中沒有提供明確的日期或時間，請『絕對不要』自行發明或猜測，必須將 transactionDate 和/或 transactionTime 的值設為 null。**
    
    【必要欄位與規則】
    - "transactionDate": 消費的實際日期 (字串，格式為YYYY-MM-DD)。若無則為 null。
    - "transactionTime": 消費的實際時間 (字串，格式為 HH:MM)。若無則為 null。
    - "amount": 金額 (純數字)。
    - "currency": 幣別 (字串，例如 TWD, JPY, USD)。
    - "category": 主分類 (字串，從 ["食", "衣", "住", "行", "育", "樂", "醫療保險", "其他"] 選擇)。
    - "item": 項目/地點 (字串)。
    - "accountType": 帳務類別 (字串，預設 "私人")。
    - "notes": 備註 (字串，若無則為 "")。
    
    現在，請解析以下文字： "${text}"`;
  const payload = { "contents": [{ "parts": [{ "text": prompt }] }] };
  const options = { 'method': 'post', 'contentType': 'application/json', 'payload': JSON.stringify(payload) };
  const response = UrlFetchApp.fetch(url, options);
  const responseText = response.getContentText();
  const jsonResponse = JSON.parse(responseText);
  const content = jsonResponse.candidates[0].content.parts[0].text;
  let cleanedJsonString = content.trim().replace(/^```json/, '').replace(/```$/, '').trim();
  return JSON.parse(cleanedJsonString);
}

function callGeminiForVision(imageBytes, voiceNote) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
  let prompt = `你是一位頂尖的財務文件辨識專家。請從圖片中提取資訊，並回傳一個包含兩個主要鍵的 JSON 物件: "structured" 和 "raw_text"。

【使用者情境備註】
${(voiceNote && voiceNote.trim() !== '') ? `這是我當下記錄的語音筆記，請將它作為最重要的參考，來輔助你判斷「item」,「notes」和「category」欄位：\n"${voiceNote}"\n\n` : ''}

【第一部分: 結構化資料 "structured"】
請在此處填寫你分析後的結構化資料。請嚴格遵守以下規則：

1.  **日期處理 (最高優先級):**
    * 優先尋找最明確的交易日期與時間 (例如 '2025/06/18 19:38')。
    * 如果看到「民國」年份，**必須**加上 1911 轉換為西元年。
    * **如果圖片上沒有任何明確的完整日期，請將 'transactionDate' 的值設為 null。不要從「5-6月份」這類範圍資訊中去猜測日期。**

2.  **個人化規則:**
    * 如果「買受人 (buyerName)」是「四號小行星影像製作有限公司」，則「帳務類別 (accountType)」**必須**設為「工作」。

3.  **項目與分類 (item/category) 規則:**
    * 'item': 應為該單據最核心的標題或目的。其餘細項放入 'notes'。
    * 'category': 「全民健保」、「醫院」歸類為「醫療保險」；「郵局」、「郵寄」歸類為「行」。

4.  **唯一識別碼規則:**
    * 'invoiceNumber': 優先尋找「發票號碼」，格式通常為「兩位英文字母 + 八位數字」。
    * 'referenceNumber': 若無發票號碼，才尋找其他唯一識別碼。

5.  **在地化規則 (台灣):**
    * **貨幣:** 'currency' 預設為 'TWD'。如果看到「$」符號，應判斷為「TWD」。

6.  **輸出欄位:** transactionDate, transactionTime, amount, currency, category, item, accountType, invoiceNumber, referenceNumber, buyerName, buyerTaxId, sellerTaxId, notes.

【第二部分: 原始文字 "raw_text"】
請在此處填寫你從圖片上辨識出的所有文字，逐行抄錄，盡量保持原始樣貌。

請嚴格按照以上格式輸出 JSON。`;
  
  const requestBody = { "contents": [{ "parts": [ { "text": prompt }, { "inline_data": { "mime_type": "image/jpeg", "data": Utilities.base64Encode(imageBytes) } } ] }] };
  const options = { 'method': 'post', 'contentType': 'application/json', 'payload': JSON.stringify(requestBody), 'muteHttpExceptions': true };
  const response = UrlFetchApp.fetch(url, options);
  const responseText = response.getContentText();
  const jsonResponse = JSON.parse(responseText);
  if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) { return null; }
  const content = jsonResponse.candidates[0].content.parts[0].text;
  let cleanedJsonString = content.trim().replace(/^```json/, '').replace(/```$/, '').trim();
  return JSON.parse(cleanedJsonString);
}

function translateText(textToTranslate) {
  if (!textToTranslate || typeof textToTranslate !== 'string') return "";
  try {
    if (textToTranslate.match(/[\u0000-\u007F]/)) {
        return LanguageApp.translate(textToTranslate, "", "zh-TW");
    }
    return textToTranslate;
  } 
  catch (e) { 
    console.error("翻譯時發生錯誤: " + e.toString());
    return "(翻譯失敗)"; 
  }
}

// ===========================================================
// SECTION 4: 匯率與寫入函式
// ===========================================================
function getLiveExchangeRates() {
  const cache = CacheService.getScriptCache();
  const CACHE_KEY = 'LIVE_EXCHANGE_RATES';
  const cached = cache.get(CACHE_KEY);
  if (cached != null) return JSON.parse(cached);
  try {
    const response = UrlFetchApp.fetch("https://api.exchangerate-api.com/v4/latest/TWD");
    const data = JSON.parse(response.getContentText());
    if (data && data.rates) {
      cache.put(CACHE_KEY, JSON.stringify(data.rates), 14400); 
      return data.rates;
    } return null;
  } catch (e) { return null; }
}

function getExchangeRate(currency) {
  const upperCurrency = currency ? currency.toUpperCase() : 'TWD';
  if (upperCurrency === 'TWD' || upperCurrency === 'NTD') return 1;
  const liveRates = getLiveExchangeRates();
  if (liveRates && liveRates[upperCurrency]) return 1 / liveRates[upperCurrency];
  const fallbackRates = {"USD": 32.5, "JPY": 0.21, "EUR": 35.0, "CNY": 4.5, "HKD": 4.1, "KRW": 0.024};
  return fallbackRates[upperCurrency] || 1;
}

function writeToSheetFromVoice(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const amount = parseFloat(data.amount) || 0;
  const currency = data.currency || 'TWD';
  
  let exchangeRate = getExchangeRate(currency);
  if (typeof exchangeRate !== 'number' || isNaN(exchangeRate)) {
    exchangeRate = 1;
  }

  const amountTWD = Math.round(amount * exchangeRate);
  
  let transactionTimestamp;
  if (data.transactionDate) {
    let dateString = data.transactionDate;
    if (data.transactionTime) {
      dateString += ` ${data.transactionTime}`;
    }
    transactionTimestamp = new Date(dateString);
    if (isNaN(transactionTimestamp.getTime())) {
      transactionTimestamp = new Date();
    }
  } else {
    transactionTimestamp = new Date();
  }

  const newRow = [
    transactionTimestamp, amount, currency, exchangeRate.toFixed(4), amountTWD,
    data.category || '', data.item || '', data.accountType || '私人',
    '', '', '', '', '', '', '待確認', '語音',
    data.notes || '', '', ''
  ];
  sheet.appendRow(newRow);
}

function writeToSheetFromOCR(data, fileUrl, rawText, translation, voiceNote) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const amount = parseFloat(data.amount) || 0;
  const currency = data.currency || 'TWD';
  
  let exchangeRate = getExchangeRate(currency);
  if (typeof exchangeRate !== 'number' || isNaN(exchangeRate)) {
    exchangeRate = 1;
  }
  
  const amountTWD = Math.round(amount * exchangeRate);
  const source = voiceNote ? 'OCR+語音' : 'OCR';

  let transactionTimestamp;
  if (data.transactionDate) {
    let dateString = data.transactionDate;
    if (data.transactionTime) {
      dateString += ` ${data.transactionTime}`;
    }
    transactionTimestamp = new Date(dateString);
    if (isNaN(transactionTimestamp.getTime())) {
      transactionTimestamp = new Date();
    }
  } else {
    transactionTimestamp = new Date();
  }

  const newRow = [
    transactionTimestamp, amount, currency, exchangeRate.toFixed(4), amountTWD,
    data.category || '', data.item || '', data.accountType || '私人',
    data.invoiceNumber || '', data.referenceNumber || '',
    data.buyerName || '', data.buyerTaxId || '', data.sellerTaxId || '',
    fileUrl, '待確認', source,
    data.notes || '', rawText || '', translation || ''
  ];
  sheet.appendRow(newRow);
}

// ===========================================================
// SECTION 5: Gmail 電子發票自動化
// ===========================================================
function syncInvoicesFromGmail() {
  console.log("--- 開始執行 Gmail 電子發票同步作業 ---");
  const threads = scanGmailForInvoices();
  if (!threads || threads.length === 0) {
    console.log("沒有找到新的未讀發票郵件。");
    return;
  }
  
  console.log(`找到 ${threads.length} 封新的發票郵件，準備處理...`);
  
  for (const thread of threads) {
    try {
      const message = thread.getMessages()[0];
      const invoiceData = parseInvoiceEmail(message.getBody());
      
      if (!invoiceData) {
        console.warn(`無法解析郵件: ${thread.getFirstMessageSubject()}`);
        thread.markRead();
        continue;
      }
      
      if (isDuplicateEntry(invoiceData.invoiceNumber, COLUMN_MAP.INVOICE_NO)) {
        console.log(`發票 ${invoiceData.invoiceNumber} 已存在，跳過。`);
      } else {
        writeToSheetFromEmail(invoiceData);
        console.log(`成功記錄發票 ${invoiceData.invoiceNumber}。`);
      }
      
      thread.markRead();
      
    } catch (e) {
      console.error(`處理郵件時發生錯誤: ${thread.getFirstMessageSubject()}。錯誤: ${e.toString()}`);
      thread.markRead();
    }
  }
  console.log("--- Gmail 電子發票同步作業結束 ---");
}

function scanGmailForInvoices() {
  const query = "from:(invoice@einvoice.nat.gov.tw) is:unread";
  return GmailApp.search(query);
}

function parseInvoiceEmail(htmlBody) {
  try {
    const body = htmlBody.replace(/(\r\n|\n|\r)/gm, "");
    const invoiceNumberMatch = body.match(/發票號碼<\/td><td[^>]*>([A-Z]{2}\d{8})<\/td>/);
    const dateMatch = body.match(/開立時間<\/td><td[^>]*>(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})<\/td>/);
    const sellerNameMatch = body.match(/賣方<\/td><td[^>]*>([^<]+)<\/td>/);
    const totalAmountMatch = body.match(/總計<\/td><td[^>]*>(\d+)/);

    const items = [];
    const itemRegex = /<tr style="[^"]*"><td[^>]*>([^<]+)<\/td><td[^>]*>\d+<\/td><td[^>]*>(\d+)<\/td><\/tr>/g;
    let itemMatch;
    while ((itemMatch = itemRegex.exec(body)) !== null) {
      items.push(`${itemMatch[1]}: ${itemMatch[2]}`);
    }

    if (!invoiceNumberMatch || !dateMatch || !sellerNameMatch || !totalAmountMatch) {
      return null;
    }

    return {
      invoiceNumber: invoiceNumberMatch[1],
      timestamp: new Date(dateMatch[1]),
      item: sellerNameMatch[1].trim(),
      amount: parseFloat(totalAmountMatch[1]),
      notes: items.join(', '),
      currency: "TWD"
    };
  } catch (e) {
    return null;
  }
}

function writeToSheetFromEmail(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const amount = data.amount || 0;
  
  const newRow = [
    data.timestamp, amount, "TWD", 1, amount,
    '', 
    data.item, '私人',
    data.invoiceNumber, '',
    '', '', '',
    '', '待確認', '電子發票',
    data.notes, '', ''
  ];
  sheet.appendRow(newRow);
}
