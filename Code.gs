// =================================================================================================
// 專案名稱：智慧記帳 GEM (Gemini AI Accountant)
// 版本：V31.1 - PDF 視覺增強版
// 作者：[您的名稱]
// 最後更新：2025-06-24
// 說明：此版本為架構優化更新。
//       1. 統一由 callGeminiForVision() 處理所有視覺相關任務（圖片與PDF），簡化了程式碼並提升了辨識準確性。
//       2. 系統現在能自動掃描 Gmail，找出特定廠商寄送的 PDF 收據，並交由背景視覺 AI 處理。
// =================================================================================================

// =================================================================================================
// 【使用者設定區】
// =================================================================================================
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
const SHEET_NAME = 'All Records';
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE';
const FOLDER_ID_TO_PROCESS = 'YOUR_GOOGLE_DRIVE_FOLDER_ID_FOR_PROCESSING';
const FOLDER_ID_ARCHIVE = 'YOUR_GOOGLE_DRIVE_FOLDER_ID_FOR_ARCHIVING';
const FOLDER_ID_DUPLICATES = 'YOUR_GOOGLE_DRIVE_FOLDER_ID_FOR_DUPLICATES';

// 【廠商收據自動化設定】
const VENDOR_QUERIES = [
  "from:receipts-noreply@uber.com",
  "from:noreply@uber.com has:attachment",
  "from:agoda@agoda.com subject:預訂確認",
  "from:service@pchomepay.com.tw subject:電子發票開立通知",
  'from:no_reply@email.apple.com subject:"你的 Apple 開立發票通知"',
  'from:service@ebill.firstbank.tw subject:"第一銀行信用卡電子對帳單"',
  'from:invoice@cht.com.tw subject:"中華電信電子發票"',
  'from:ebill@water.gov.taipei subject:"臺北自來水事業處"',
  'from:payments-noreply@google.com subject:"Google：隨信附上您的電子應付憑據 (統一發票)"',
  'from:invoice@mail2.ei.com.tw subject:"電子發票開立通知"'
  // 您可以繼續加入更多廠商的搜尋條件
];
// =================================================================================================


// =================================================================================================
// 自動化處理管道
// =================================================================================================

/**
 * @description 【管道二】定期執行的廠商 PDF 收據同步作業。
 */
function syncPdfsFromGmail() {
  const processFolder = DriveApp.getFolderById(FOLDER_ID_TO_PROCESS);
  let successCount = 0;

  VENDOR_QUERIES.forEach(query => {
    const fullQuery = `${query} is:unread`;
    const threads = GmailApp.search(fullQuery);

    threads.forEach(thread => {
      const messages = thread.getMessages();
      messages.forEach(message => {
        const attachments = message.getAttachments();
        let pdfFound = false;
        attachments.forEach(attachment => {
          if (attachment.getContentType() === 'application/pdf') {
            try {
              processFolder.createFile(attachment);
              pdfFound = true;
              successCount++;
              Logger.log(`成功從郵件 [${message.getSubject()}] 中抓取 PDF 附件：${attachment.getName()}`);
            } catch (e) {
              Logger.log(`儲存附件失敗: ${e.toString()}`);
            }
          }
        });
        if (pdfFound) {
          message.markRead();
        }
      });
    });
  });

  if (successCount > 0) {
    Logger.log(`廠商收據同步作業完成，成功抓取 ${successCount} 個 PDF 檔案至待處理資料夾。`);
  } else {
    Logger.log("廠商收據同步作業完成，沒有發現新的 PDF 收據。");
  }
}

/**
 * @description 【中央處理器】由時間觸發器定期執行，用來處理待處理資料夾中的所有檔案。
 */
function checkReceiptsFolder() {
  const processFolder = DriveApp.getFolderById(FOLDER_ID_TO_PROCESS);
  const files = processFolder.getFiles();

  while (files.hasNext()) {
    const file = files.next();
    const mimeType = file.getMimeType();

    try {
      if (mimeType === MimeType.JPEG || mimeType === MimeType.PNG) {
        Logger.log(`由背景觸發器處理圖片檔案：${file.getName()}`);
        processImage(file.getBlob().getBytes(), file.getName());
      } else if (mimeType === MimeType.PDF) {
        Logger.log(`由背景觸發器處理 PDF 檔案：${file.getName()}`);
        // V31.1 更新：直接呼叫 processImage 處理 PDF
        processImage(file.getBlob().getBytes(), file.getName(), null, MimeType.PDF);
      } else {
        Logger.log(`發現不支援的檔案類型: ${mimeType}，檔名: ${file.getName()}。將跳過處理。`);
      }
    } catch (e) {
       Logger.log(`處理檔案 ${file.getName()} 時發生無法預期的錯誤: ${e.toString()}`);
    }
  }
}

/**
 * @description 【管道一】每日執行的官方發票同步作業。
 */
function syncInvoicesFromGmail() {
  const query = "from:invoice@einvoice.nat.gov.tw is:unread";
  const threads = GmailApp.search(query);
  let successCount = 0;

  threads.forEach(thread => {
    const messages = thread.getMessages();
    messages.forEach(message => {
      if (message.isUnread()) {
        try {
          const invoiceData = parseInvoiceEmail(message.getBody());
          
          if (invoiceData && invoiceData.invoiceNumber) {
            const isWritten = writeToSheetFromEmail(invoiceData);
            if (isWritten) {
              successCount++;
            }
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


// =================================================================================================
// 核心處理函式
// =================================================================================================

/**
 * @description 【V31.1 重大修改】處理視覺檔案（圖片或PDF）的核心函式。
 * @param {Byte[]} fileBytes - 檔案的位元組陣列。
 * @param {string} fileName - 檔案的原始檔名。
 * @param {string} [optionalVoiceNote] - 可選的語音備註。
 * @param {string} [mimeType] - 檔案的MIME類型，預設為圖片。
 */
function processImage(fileBytes, fileName, optionalVoiceNote, mimeType = MimeType.JPEG) {
  // 注意：這裡不再需要將檔案存到 Drive 再處理，直接從記憶體送出
  try {
    const aiResult = callGeminiForVision(fileBytes, optionalVoiceNote, mimeType);
    const parsedData = JSON.parse(aiResult.text);
    const rawText = aiResult.rawText || '';
    const translation = aiResult.translation || '';

    // 建立一個暫存檔案以進行查重後的移動操作
    const tempFile = DriveApp.getFolderById(FOLDER_ID_TO_PROCESS).createFile(Utilities.newBlob(fileBytes, mimeType, fileName));

    if (isDuplicate(parsedData, rawText)) {
      const duplicatesFolder = DriveApp.getFolderById(FOLDER_ID_DUPLICATES);
      tempFile.moveTo(duplicatesFolder);
      Logger.log(`偵測到重複紀錄，檔案 ${fileName} 已移至重複資料夾。`);
      return;
    }

    // 根據檔案類型決定 Source
    const source = (mimeType === MimeType.PDF) ? 'PDF' : (optionalVoiceNote ? 'OCR+語音' : 'OCR');
    writeToSheetFromOCR(parsedData, tempFile.getUrl(), rawText, translation, source);

    const archiveFolder = DriveApp.getFolderById(FOLDER_ID_ARCHIVE);
    tempFile.moveTo(archiveFolder);
    
    Logger.log(`成功處理檔案 ${fileName} 並寫入 Google Sheet。`);

  } catch (error) {
    Logger.log(`[processImage/Pdf Error] ${error.toString()} for file ${fileName}`);
  }
}


function processVoice(voiceText) {
  try {
    const aiResultText = callGeminiForVoice(voiceText);
    const parsedData = JSON.parse(aiResultText);
    writeToSheetFromVoice(parsedData);
    Logger.log(`成功處理語音記帳: "${voiceText}"`);
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: parsedData })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log(`[processVoice Error] ${error.toString()} for text "${voiceText}"`);
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: `處理語音時發生錯誤: ${error.message}` })).setMimeType(ContentService.MimeType.JSON);
  }
}

// doPost 保持不變，因為前端上傳的依然是 Base64 編碼後的圖片
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
      // 前端捷徑上傳的都是圖片，所以直接呼叫 processImage
      processImage(imageBytes, fileName, voiceText, MimeType.JPEG);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: '請求已接收，將在背景處理。' })).setMimeType(ContentService.MimeType.JSON);
    } else if (voiceText) {
      return processVoice(voiceText);
    } else {
      throw new Error("無效的請求：必須提供 image_base64 或 voice_text。");
    }
  } catch (error) {
    Logger.log(`[doPost Error] ${error.toString()}`);
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: `後端處理失敗: ${error.message}` })).setMimeType(ContentService.MimeType.JSON);
  }
}


// =================================================================================================
// AI 與資料庫核心
// =================================================================================================

/**
 * @description 【V31.1 升級】呼叫 Gemini API 進行視覺檔案（圖片或PDF）的辨識。
 * @param {Byte[]} fileBytes - 檔案的位元組陣列。
 * @param {string} [voiceNote] - 可選的語音備註。
 * @param {string} mimeType - 檔案的 MIME 類型。
 * @returns {{text: string, rawText: string, translation: string}} - 包含結構化 JSON 字串、OCR 原文和翻譯的物件。
 */
function callGeminiForVision(fileBytes, voiceNote, mimeType) {
  const prompt = `
    你是一位專業、細心的台灣在地記帳助理。請分析這份文件（可能是圖片或PDF），並嚴格按照以下單一 JSON 格式回傳結果，不包含任何額外的說明文字或 markdown 標記。

    **最終輸出的 JSON 結構:**
    {
      "structuredData": {
          "timestamp": "2025-06-15T00:00:00",
          "amount": 22081.85,
          "currency": "TWD",
          "item": "Agoda 航班預訂",
          "category": "旅遊",
          "invoiceNumber": null,
          "referenceNumber": "1620934638",
          "notes": "乘客: Po Fu Chiang, Shang-Lung Chiang"
      },
      "rawText": "這裡是從文件辨識出的所有原始文字...",
      "translation": null
    }

    **任務與規則:**
    1.  **rawText:** 提取文件中的所有可讀文字，放到 "rawText" 欄位。
    2.  **translation:** 如果原文是外語，請將其翻譯成繁體中文，放到 "translation" 欄位。如果原始文字是中文，此欄位回傳 null。
    3.  **structuredData:** 根據原始文字和語音備註，填寫結構化資料：
        * **日期 (timestamp):** 這是最重要的欄位之一。請仔細尋找最能代表「交易」或「開立」的日期。**務必**解析出完整的「年、月、日」。如果日期格式不標準（如 '6月15,2025'），請將其轉換為標準的 'YYYY-MM-DD' 格式。如果找不到年份，請使用今年。如果找不到日期，則回傳 null。
        * **金額 (amount):** 請優先尋找「總金額」、「總計」、「Total」、「稅費合計」等字樣旁的數字作為總金額。
        * **品項 (item):** 盡力找出商家名稱或服務名稱，例如「Agoda 航班預訂」、「海關進口稅費」。
        * **參考編號 (referenceNumber):** 尋找最主要的識別碼，如「預訂編號」、「訂單編號」、「稅單號碼」。
        * **其他欄位** 依照先前的規則進行提取（category, currency, invoiceNumber, notes）。

    **語音備註:** ${voiceNote || "無"}
    `;

  const requestBody = {
    "contents": [{
        "role": "user",
        "parts": [
          { "text": prompt },
          { "inline_data": { "mime_type": mimeType, "data": Utilities.base64Encode(fileBytes) }}
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


function callGeminiForVoice(voiceText) {
  const prompt = `
    你是一位非常嚴謹、只會遵循規則的記帳助理。請將以下這段口語化的描述，嚴格地轉換為結構化的 JSON 格式。

    **核心規則:**
    1.  **嚴格服從:** 絕不創造任何規則以外的資訊。如果找不到對應資訊，則回傳 null。
    2.  **JSON 輸出:** 務必只回傳一個乾淨的 JSON 物件，不包含任何前後說明文字或 "'''json" 標記。

    **欄位提取規則:**
    1.  **金額 (amount):** 這是最重要的欄位。請仔細尋找任何數字，特別是後面跟著「元」或「塊」的數字。如果語音中明確提到了金額，務必將其提取為數字格式。如果語音中完全沒有提到任何金額，此欄位回傳 null，不要編造或猜測。
    2.  **分類 (category):** 你 **必須** 從以下這個固定的列表中選擇一個最適合的分類：["食", "衣", "住", "行", "育", "樂", "醫療", "教育", "其他"]。 **範例:** 「吃午餐」、「喝了杯咖啡」應分類為「食」；「搭計程車回家」應分類為「行」。絕不可以使用此列表以外的任何分類。如果無法明確對應，請一律使用 "其他"。
    3.  **時間 (timestamp):** 解析描述中的相對時間，如「昨天晚上7點」、「前天中午」。如果沒有提到時間，使用今天的日期與當下時間。
    4.  **品項/地點 (item):** 盡力從描述中提取消費的具體品項或商家名稱。如果無法判斷，可以回傳一個簡短的描述，例如 "晚餐" 或 "計程車費"。
    5.  **幣別 (currency):** 此欄位固定為 "TWD"。
    6.  **備註 (notes):** 將原始的完整語音文字，填入此欄位。
    
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


function writeToSheetFromOCR(data, fileUrl, rawText, translation, source) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const rate = getExchangeRate(data.currency || 'TWD');
  const amountTWD = (data.currency === 'TWD' || !data.currency) ? data.amount : (data.amount * rate);
  
  const row = [
    data.timestamp ? new Date(data.timestamp) : new Date(),
    data.amount || null,
    data.currency || 'TWD',
    rate,
    amountTWD || null,
    data.category || '雜項',
    data.item || null,
    '私人',
    data.invoiceNumber || null,
    data.referenceNumber || null,
    null,
    null,
    null,
    fileUrl,
    '待確認',
    source, // V31.1 更新：使用傳入的 source
    data.notes || null,
    rawText,
    translation
  ];
  sheet.appendRow(row);
}


function writeToSheetFromEmail(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const dataRange = sheet.getRange("I2:I" + sheet.getLastRow());
  const existingInvoiceNumbers = dataRange.getValues().flat();

  if (existingInvoiceNumbers.includes(data.invoiceNumber)) {
    Logger.log(`發現重複的官方發票，跳過寫入：${data.invoiceNumber}`);
    return false;
  }

  const amountTWD = data.amount;
  
  const row = [
    data.timestamp, data.amount, data.currency, 1, amountTWD,
    '其他', data.item, '私人', data.invoiceNumber, null, null, null, null, null,
    '待確認', '電子發票', `由 ${data.item} 開立`, null, null
  ];
  sheet.appendRow(row);
  return true;
}

function writeToSheetFromVoice(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const rate = getExchangeRate(data.currency || 'TWD');
  const amountTWD = (data.currency === 'TWD' || !data.currency) ? data.amount : (data.amount * rate);
  
  const row = [
    data.timestamp ? new Date(data.timestamp) : new Date(), data.amount || null, data.currency || 'TWD',
    rate, amountTWD || null, data.category || '其他', data.item || null, '私人',
    null, null, null, null, null, null, '待確認', '語音', data.notes || null, null, null
  ];
  sheet.appendRow(row);
}


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

function getExchangeRate(currency) {
  if (currency === 'TWD' || !currency) return 1;

  const cache = CacheService.getScriptCache();
  const cachedRate = cache.get(currency);
  if (cachedRate) {
    return parseFloat(cachedRate);
  }

  try {
    const url = `https://api.exchangerate-api.com/v4/latest/${currency}`;
    const response = UrlFetchApp.fetch(url);
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

// 刪除了 processPdf 和 callGeminiForPdfText，因為它們的功能已被整合進 processImage 和 callGeminiForVision。

