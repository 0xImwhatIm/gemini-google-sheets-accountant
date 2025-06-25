// =================================================================================================
// 專案名稱：智慧記帳 GEM (Gemini AI Accountant)
// 版本：V36.1 - 語法錯誤修正版
// 作者：[您的名稱]
// 最後更新：2025-06-25
// 說明：此版本修正了 V36.0 中因 prompt 字串建構方式，而導致在特定環境下產生語法錯誤的問題。
//      1. 【修正】: 重寫 callGeminiForPdfText 的 prompt 建構邏輯，改用陣列組合，確保語法穩定性。
//      2. AI 的「範例學習」功能與所有邏輯均保持不變。
// =================================================================================================

// =================================================================================================
// 【使用者設定區】
// =================================================================================================
const MAIN_LEDGER_ID = 'YOUR_MAIN_SPREADSHEET_ID_HERE'; // 主帳本的 Google Sheet ID
const SHEET_NAME = 'All Records';
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE';

// === 【V35.8 新增】Document AI 設定 (主引擎) ===
const GCP_PROJECT_ID = 'YOUR_GCP_PROJECT_ID_HERE'; // 例如 'my-gcp-project-12345'
const DOCUMENT_AI_PROCESSOR_ID = 'YOUR_DOC_AI_PROCESSOR_ID_HERE'; // 例如 'a1b2c3d4e5f6g7h8'

const FOLDER_ID_TO_PROCESS = 'YOUR_GOOGLE_DRIVE_FOLDER_ID_FOR_PROCESSING';
const FOLDER_ID_ARCHIVE = 'YOUR_GOOGLE_DRIVE_FOLDER_ID_FOR_ARCHIVING';
const FOLDER_ID_DUPLICATES = 'YOUR_GOOGLE_DRIVE_FOLDER_ID_FOR_DUPLICATES'; // 也可用於歸檔錯誤檔案

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
];
// =================================================================================================


// =================================================================================================
// 【V35.0 核心】多入口路由
// =================================================================================================
/**
 * @description 主 Web App 入口，根據 URL 參數，將請求路由到不同的處理函式。
 * @param {Object} e - Apps Script 的事件物件。
 */
function doPost(e) {
  const endpoint = e.parameter.endpoint;

  if (endpoint === 'image') {
    return doPost_Image(e);
  } else if (endpoint === 'voice') {
    return doPost_Voice(e);
  } else if (endpoint === 'pdf') {
    return doPost_Pdf(e);
  } else {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: '無效的 API 端點。請在 URL 中指定 ?endpoint=image, ?endpoint=voice, 或 ?endpoint=pdf'
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// =================================================================================================
// 專屬入口函式
// =================================================================================================

function doPost_Image(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const targetSheetId = sanitizeSheetId(params.target_sheet_id || MAIN_LEDGER_ID);
    const imageBase64 = params.image_base64;
    const voiceText = params.voice_text;
    const fileName = params.filename || `image_${new Date().getTime()}.jpg`;

    if (!imageBase64) throw new Error("缺少 image_base64 參數。");

    const fileBytes = Utilities.base64Decode(imageBase64);
    const fileExtension = (params.file_extension || 'jpg').toLowerCase();
    const mimeType = fileExtension.includes('png') ? MimeType.PNG : MimeType.JPEG;
    
    const tempFile = DriveApp.getFolderById(FOLDER_ID_TO_PROCESS).createFile(Utilities.newBlob(fileBytes, mimeType, fileName));
    
    processImage(tempFile, voiceText, targetSheetId);

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: '圖片請求已接收，將在背景處理。' })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log(`[doPost_Image Error] ${error.toString()}`);
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: `處理圖片時發生錯誤: ${error.message}` })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost_Pdf(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const targetSheetId = sanitizeSheetId(params.target_sheet_id || MAIN_LEDGER_ID);
    const pdfBase64 = params.image_base64;
    const fileName = params.filename || `file_${new Date().getTime()}.pdf`;

    if (!pdfBase64) throw new Error("缺少 pdf (image_base64) 參數。");

    const fileBytes = Utilities.base64Decode(pdfBase64);
    const tempFile = DriveApp.getFolderById(FOLDER_ID_TO_PROCESS).createFile(Utilities.newBlob(fileBytes, MimeType.PDF, fileName));

    processPdf(tempFile, targetSheetId);

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'PDF 請求已接收，將在背景處理。' })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log(`[doPost_Pdf Error] ${error.toString()}`);
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: `處理 PDF 時發生錯誤: ${error.message}` })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost_Voice(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const targetSheetId = sanitizeSheetId(params.target_sheet_id || MAIN_LEDGER_ID);
    const voiceText = params.voice_text;
    
    if (!voiceText) throw new Error("缺少 voice_text 參數。");

    return processVoice(voiceText, targetSheetId);
  } catch (error) {
    Logger.log(`[doPost_Voice Error] ${error.toString()}`);
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: `處理語音時發生錯誤: ${error.message}` })).setMimeType(ContentService.MimeType.JSON);
  }
}

// =================================================================================================
// 自動化處理管道
// =================================================================================================

function syncPdfsFromGmail() {
  const processFolder = DriveApp.getFolderById(FOLDER_ID_TO_PROCESS);
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
}

function checkReceiptsFolder() {
  const processFolder = DriveApp.getFolderById(FOLDER_ID_TO_PROCESS);
  const files = processFolder.getFiles();
  const sanitizedMainLedgerId = sanitizeSheetId(MAIN_LEDGER_ID);
  while (files.hasNext()) {
    const file = files.next();
    const mimeType = file.getMimeType();
    try {
      if (mimeType === MimeType.JPEG || mimeType === MimeType.PNG) {
        processImage(file, null, sanitizedMainLedgerId);
      } else if (mimeType === MimeType.PDF) {
        processPdf(file, sanitizedMainLedgerId);
      }
    } catch (e) {
       Logger.log(`處理檔案 ${file.getName()} 時發生無法預期的錯誤: ${e.toString()}`);
    }
  }
}

function syncInvoicesFromGmail() {
  const query = "from:invoice@einvoice.nat.gov.tw is:unread";
  const threads = GmailApp.search(query);
  const sanitizedMainLedgerId = sanitizeSheetId(MAIN_LEDGER_ID);
  let successCount = 0;
  threads.forEach(thread => {
    const messages = thread.getMessages();
    messages.forEach(message => {
      if (message.isUnread()) {
        try {
          const invoiceData = parseInvoiceEmail(message.getBody());
          if (invoiceData && invoiceData.invoiceNumber) {
            if (writeToSheetFromEmail(invoiceData, sanitizedMainLedgerId)) {
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
}

// =================================================================================================
// 核心處理函式
// =================================================================================================

function processImage(file, optionalVoiceNote, sheetId) {
  try {
    const aiResult = callGeminiForVision(file.getBlob().getBytes(), optionalVoiceNote, file.getMimeType());
    const parsedData = JSON.parse(aiResult.text);
    if (isDuplicate(parsedData, aiResult.rawText, sheetId)) {
      const duplicatesFolder = DriveApp.getFolderById(FOLDER_ID_DUPLICATES);
      file.moveTo(duplicatesFolder);
      return;
    }
    const source = optionalVoiceNote ? 'OCR+語音' : 'OCR';
    writeToSheetFromOCR(parsedData, file.getUrl(), aiResult.rawText, aiResult.translation, source, sheetId);
    const archiveFolder = DriveApp.getFolderById(FOLDER_ID_ARCHIVE);
    file.moveTo(archiveFolder);
    Logger.log(`成功處理圖片檔案 ${file.getName()} 並寫入 Google Sheet (ID: ${sheetId})。`);
  } catch (error) {
    Logger.log(`[processImage Error] ${error.toString()} for file ${file.getName()}`);
  }
}

function processPdf(file, sheetId) {
  let pdfText;
  let usedEngine = "備用引擎"; // 預設使用備用引擎

  try {
    // 步驟 1: 優先嘗試使用「主引擎」 (Document AI)
    if (GCP_PROJECT_ID && DOCUMENT_AI_PROCESSOR_ID) {
      Logger.log(`偵測到 Document AI 設定，嘗試使用主引擎處理檔案：${file.getName()}`);
      pdfText = callDocumentAIAPI(file.getBlob());
      usedEngine = "主引擎 (Document AI)";
    } else {
      throw new Error("Document AI 未設定，將使用備用引擎。");
    }

  } catch (docAiError) {
    // 步驟 2: 如果主引擎失敗，自動降級並使用「備用引擎」
    Logger.log(`[${usedEngine} Error] ${docAiError.message}`);
    Logger.log(`自動切換至備用引擎來處理檔案：${file.getName()}`);
    
    try {
      pdfText = extractPdfText(file);
      usedEngine = "備用引擎";
    } catch (fallbackError) {
      // 如果連備用引擎都失敗了，進行智慧分流或歸檔
      Logger.log(`[備用引擎 Error] ${fallbackError.message}`);
      handleFailedFile(fallbackError, file, sheetId);
      return; // 終止函式執行
    }
  }

  // 步驟 3: 使用提取出的文字，繼續後續的 AI 分析與寫入流程
  try {
    const textQuality = assessTextQuality(pdfText);
    Logger.log(`檔案 ${file.getName()} 的 PDF 文字品質評估: ${textQuality} (由 ${usedEngine} 產出)`);
    
    if (textQuality === 'poor') {
      Logger.log(`警告: PDF '${file.getName()}' 文字品質不佳，可能影響辨識準確度`);
    }
    
    const aiResult = callGeminiForPdfText(pdfText, textQuality);
    const parsedData = JSON.parse(aiResult);
    
    if (isDuplicate(parsedData, pdfText, sheetId)) {
      const duplicatesFolder = DriveApp.getFolderById(FOLDER_ID_DUPLICATES);
      file.moveTo(duplicatesFolder);
      Logger.log(`檔案 ${file.getName()} 偵測為重複紀錄，已移至重複資料夾。`);
      return;
    }
    
    const status = (parsedData.confidence === 'low' || textQuality === 'poor') ? '需人工確認' : '待確認';
    
    writeToSheetFromOCR(parsedData, file.getUrl(), pdfText, null, `PDF (${usedEngine})`, sheetId, status);
    
    const archiveFolder = DriveApp.getFolderById(FOLDER_ID_ARCHIVE);
    file.moveTo(archiveFolder);
    
    Logger.log(`成功處理 PDF: ${file.getName()}, 品質: ${textQuality}, AI信心度: ${parsedData.confidence}, 最終狀態: ${status}`);
  
  } catch (finalProcessingError) {
    Logger.log(`[最終處理階段 Error] 在分析文字或寫入表格時發生錯誤。檔案: ${file.getName()}, 錯誤: ${finalProcessingError.toString()}`);
    handleFailedFile(finalProcessingError, file, sheetId);
  }
}

/**
 * @description 【V35.8 新增】處理失敗檔案的輔助函式，實現智慧分流與歸檔
 * @param {Error} error - 捕捉到的錯誤物件
 * @param {File} file - 處理失敗的檔案物件
 * @param {string} sheetId - 目標工作表的 ID
 */
function handleFailedFile(error, file, sheetId) {
  Logger.log(`[handleFailedFile] 開始處理失敗的檔案 ${file.getName()}。錯誤: ${error.message}`);
  
  if (error.message.includes('不是有效的 PDF 檔案')) {
    const mimeType = file.getMimeType();
    if (mimeType === MimeType.JPEG || mimeType === MimeType.PNG) {
      Logger.log(`偵測到偽裝成 PDF 的圖片 (${mimeType})，將轉交給圖片處理函式...`);
      try {
        processImage(file, null, sheetId);
        return;
      } catch (imageError) {
        Logger.log(`[handleFailedFile -> processImage Error] 轉交處理圖片時發生新錯誤: ${imageError.toString()}`);
      }
    }
  }
  
  Logger.log(`[handleFailedFile Error] 無法自動處理的錯誤，將檔案 ${file.getName()} 歸檔至錯誤資料夾。`);
  try {
    const errorFolder = DriveApp.getFolderById(FOLDER_ID_DUPLICATES);
    file.moveTo(errorFolder);
  } catch (moveError) {
    Logger.log(`[handleFailedFile Fatal] 連移動檔案至錯誤資料夾都失敗了: ${moveError.toString()}`);
  }
}


function processVoice(voiceText, sheetId) {
  try {
    const aiResultText = callGeminiForVoice(voiceText);
    const parsedData = JSON.parse(aiResultText);
    return writeToSheetFromVoice(parsedData, sheetId);
  } catch (error) {
    Logger.log(`[processVoice Error] ${error.toString()} for text "${voiceText}"`);
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: `處理語音時發生錯誤: ${error.message}` })).setMimeType(ContentService.MimeType.JSON);
  }
}


// =================================================================================================
// AI 與資料庫核心
// =================================================================================================
/**
 * @description 【V35.8 新增】主引擎：呼叫 Google Cloud Document AI API 來解析 PDF。
 * @param {Blob} pdfBlob - PDF 檔案的 Blob 物件。
 * @returns {string} 由 Document AI 提取出的高品質純文字。
 */
function callDocumentAIAPI(pdfBlob) {
  const url = `https://us-documentai.googleapis.com/v1/projects/${GCP_PROJECT_ID}/locations/us/processors/${DOCUMENT_AI_PROCESSOR_ID}:process`;

  const requestBody = {
    "skipHumanReview": true,
    "rawDocument": {
      "content": Utilities.base64Encode(pdfBlob.getBytes()),
      "mimeType": "application/pdf"
    }
  };

  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'headers': {
      'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
    },
    'payload': JSON.stringify(requestBody),
    'muteHttpExceptions': true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode !== 200) {
    throw new Error(`Document AI API 呼叫失敗: ${responseCode} - ${responseText}`);
  }
  
  const result = JSON.parse(responseText);
  if (!result.document || !result.document.text) {
    throw new Error('Document AI 回傳了非預期的結構，缺少 document.text 欄位。');
  }

  Logger.log('成功透過 Document AI 取得高品質文字。');
  return result.document.text;
}


function callGeminiForVision(fileBytes, voiceNote, mimeType) {
  const prompt = `你是一位專業、細心的台灣在地記帳助理。請分析這份文件（可能是圖片或PDF），並嚴格按照以下單一 JSON 格式回傳結果...`; // 省略
  const requestBody = { "contents": [{ "role": "user", "parts": [ { "text": prompt }, { "inline_data": { "mime_type": mimeType, "data": Utilities.base64Encode(fileBytes) }} ] }], "generationConfig": { "response_mime_type": "application/json" } };
  const options = { 'method': 'post', 'contentType': 'application/json', 'payload': JSON.stringify(requestBody), 'muteHttpExceptions': true };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
  
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode !== 200) {
    throw new Error(`Gemini API HTTP Error: ${responseCode}. Response: ${responseText}`);
  }

  try {
    const jsonResponse = JSON.parse(responseText);
    if (jsonResponse.error) { throw new Error(`Gemini API returned an error: ${jsonResponse.error.message}`); }
    if (!jsonResponse.candidates || !jsonResponse.candidates[0].content.parts[0].text) { throw new Error(`Unexpected Gemini API response structure.`); }
    
    const fullResponse = jsonResponse.candidates[0].content.parts[0].text;
    const parsedJson = JSON.parse(fullResponse);
    if (parsedJson.structuredData && 'rawText' in parsedJson) {
      return { text: JSON.stringify(parsedJson.structuredData), rawText: parsedJson.rawText, translation: parsedJson.translation || null };
    } else {
       throw new Error("AI 回應的 JSON 結構不符合預期。");
    }
  } catch (e) {
    Logger.log(`callGeminiForVision 解析 JSON 失敗: ${e.toString()}. 原始 AI 回應: ${responseText}`);
    throw new Error(`Failed to process vision API call: ${e.message}`);
  }
}

// ============================= V36.1 函式修改 START =============================
function callGeminiForPdfText(pdfText, textQuality) {
  // 如果傳入的文字為空或只有空白，直接回傳一個表示失敗的 JSON，避免浪費 API call
  if (!pdfText || pdfText.trim() === '') {
    return JSON.stringify({
      timestamp: null, amount: null, currency: null, category: null, item: null,
      invoiceNumber: null, referenceNumber: null,
      notes: "無法讀取 PDF 文字內容，處理失敗。",
      confidence: "low",
      rawTextQuality: textQuality || 'empty'
    });
  }

  // 【V36.1 修正】改用陣列組合字串，避免 template literal 在特定環境下的解析問題。
  const promptLines = [
    '你是一位專業、吹毛求疵的台灣記帳助理。你的任務是從高品質的 PDF 文字中，學習範例，並提取出結構化的記帳資訊。',
    '',
    '---',
    '**【規則指令區】**',
    '請嚴格遵守以下所有規則：',
    '',
    '**1. 日期 (timestamp) 提取規則:**',
    '   - **優先序**: 請嚴格按照以下順序尋找日期：**1. 付款日期 (Payment Date)** > 2. 開立日期 (Issue Date)。',
    '   - **忽略**: 請明確忽略「入住日期 (Check-in Date)」或「航班日期」等非付款性質的日期。',
    "   - **格式**: 最終日期必須格式化為 'YYYY-MM-DD'。",
    '',
    '**2. 金額 (amount) 處理規則:**',
    '   - **提取**: 從「總計」、「總金額」、「Total」等關鍵字尋找金額，並只回傳純數字。',
    "   - **整數處理**: 如果幣別 (currency) 是 **'TWD'** 或 **'JPY'**，請將提取出的數字**四捨五入到最接近的整數**。",
    "   - **小數處理**: 對於 'USD', 'EUR' 等其他貨幣，請保留小數點後兩位。",
    '',
    '**3. 分類 (category) 選擇規則:**',
    "   - **固定選項**: `category` 欄位**必須**從以下清單中選擇一個：['食', '衣', '住', '行', '育', '樂', '帳單', '其他']。",
    '   - **禁止**: 不要創造清單以外的新分類。',
    '',
    '**4. 格式要求**: ',
    '   - **務必**、**只能**回傳一個單一的、無任何其他前後文字的 JSON 物件。找不到的欄位請填入 null。',
    '',
    '---',
    '**【範例學習區塊】**',
    '以下是兩個你需要學習的範例，請理解其邏輯，並應用到新的文字上。',
    '',
    '**範例 1: 住宿收據**',
    '[輸入文字]',
    '"付款日期 June 18, 2025\\n收據\\n客人姓名&地址\\n姓名\\nPo Fu Chiang\\n預訂住宿名稱\\nVessel Inn Sakae Station\\n入住期間\\nJune 30, 2025 - July 4, 2025 (4晚)\\n總金額\\nTWD 8,286.06"',
    '',
    '[輸出 JSON]',
    '{',
    '  "timestamp": "2025-06-18",',
    '  "amount": 8286,',
    '  "currency": "TWD",',
    '  "category": "住",',
    '  "item": "Vessel Inn Sakae Station",',
    '  "invoiceNumber": null,',
    '  "referenceNumber": null,',
    '  "notes": "Agoda 住宿費用",',
    '  "confidence": "high",',
    '  "rawTextQuality": "good"',
    '}',
    '',
    '**範例 2: 航班收據**',
    '[輸入文字]',
    '"收據\\n開立日期:6月 15, 2025\\n乘客: Po Fu Chiang\\n航班資訊\\nCathay Pacific\\nCX 531\\n預訂編號: 1620934638\\n總金額\\nTWD 22081.85"',
    '',
    '[輸出 JSON]',
    '{',
    '  "timestamp": "2025-06-15",',
    '  "amount": 22082,',
    '  "currency": "TWD",',
    '  "category": "行",',
    '  "item": "Cathay Pacific 航班",',
    '  "invoiceNumber": null,',
    '  "referenceNumber": "1620934638",',
    '  "notes": "Agoda 航班費用",',
    '  "confidence": "high",',
    '  "rawTextQuality": "good"',
    '}',
    '---',
    '',
    '**【你的任務】**',
    '現在，請處理以下新的文字，並遵循上述所有規則與範例邏輯，回傳一個 JSON 物件。',
    '',
    '[高品質 PDF 文字內容開始]',
    pdfText,
    '[高品質 PDF 文字內容結束]'
  ];
  const prompt = promptLines.join('\n');


  const requestBody = {
    "contents": [{ "parts":[{ "text": prompt }] }],
    "generationConfig": { "response_mime_type": "application/json" }
  };
  const options = { 'method' : 'post', 'contentType': 'application/json', 'payload' : JSON.stringify(requestBody), 'muteHttpExceptions': true };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
  
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();
   
  if (responseCode !== 200) {
    throw new Error(`Gemini API HTTP Error: ${responseCode}. Response: ${responseText}`);
  }

  try {
    const jsonResponse = JSON.parse(responseText);
    if (jsonResponse.error) { throw new Error(`Gemini API returned an error: ${jsonResponse.error.message}`); }
    if (!jsonResponse.candidates || !jsonResponse.candidates[0].content.parts[0].text) { throw new Error(`Unexpected Gemini API response structure.`); }
    const aiResultText = jsonResponse.candidates[0].content.parts[0].text;
    
    // 再次驗證 AI 回傳的是否為可解析的 JSON
    JSON.parse(aiResultText);
    return aiResultText;

  } catch (e) {
    Logger.log(`callGeminiForPdfText 解析 JSON 失敗: ${e.toString()}. 原始 AI 回應: ${responseText}`);
    throw new Error(`Failed to process PDF text via API: ${e.message}`);
  }
}
// ============================= V36.1 函式修改 END ===============================


function callGeminiForVoice(voiceText) {
  const prompt = `你是一位非常嚴謹、只會遵循規則的記帳助理...`; // 省略
  const requestBody = { "contents": [{ "parts":[{ "text": prompt }] }], "generationConfig": { "response_mime_type": "application/json" } };
  const options = { 'method' : 'post', 'contentType': 'application/json', 'payload' : JSON.stringify(requestBody), 'muteHttpExceptions': true };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
  
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode !== 200) {
      throw new Error(`Gemini API HTTP Error: ${responseCode}. Response: ${responseText}`);
  }

  try {
    const jsonResponse = JSON.parse(responseText);
    if (jsonResponse.error) { throw new Error(`Gemini API returned an error: ${jsonResponse.error.message}`); }
    if (!jsonResponse.candidates || !jsonResponse.candidates[0].content.parts[0].text) { throw new Error(`Unexpected Gemini API response structure.`); }
    const aiResultText = jsonResponse.candidates[0].content.parts[0].text;
    JSON.parse(aiResultText); // 驗證
    return aiResultText;
  } catch (e) {
      Logger.log(`callGeminiForVoice 解析 JSON 失敗: ${e.toString()}. 原始 AI 回應: ${responseText}`);
      throw new Error(`Failed to process voice API call: ${e.message}`);
  }
}


function writeToSheetFromOCR(data, fileUrl, rawText, translation, source, sheetId, customStatus = '待確認') {
  const cleanSheetId = sanitizeSheetId(sheetId);
  const sheet = SpreadsheetApp.openById(cleanSheetId).getSheetByName(SHEET_NAME);
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
    null, null, null,
    fileUrl,
    customStatus,  // 使用動態狀態
    source,
    data.notes || null,
    rawText,
    translation
  ];
  sheet.appendRow(row);
}


function writeToSheetFromEmail(data, sheetId) {
  // 【V35.4 修正】新增防呆機制，防止因無效的 data 物件傳入而導致程式崩潰。
  if (!data || typeof data.invoiceNumber === 'undefined') {
    Logger.log(`[writeToSheetFromEmail Warning] 函式被呼叫時，傳入的 data 物件無效或缺少 invoiceNumber。 Data: ${JSON.stringify(data)}`);
    return false; // 直接返回，不執行後續操作
  }

  const cleanSheetId = sanitizeSheetId(sheetId);
  const sheet = SpreadsheetApp.openById(cleanSheetId).getSheetByName(SHEET_NAME);
  const dataRange = sheet.getRange("I2:I" + sheet.getLastRow());
  const existingInvoiceNumbers = dataRange.getValues().flat();

  if (existingInvoiceNumbers.includes(data.invoiceNumber)) {
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

function writeToSheetFromVoice(data, sheetId) {
  const cleanSheetId = sanitizeSheetId(sheetId);
  const sheet = SpreadsheetApp.openById(cleanSheetId).getSheetByName(SHEET_NAME);
  const rate = getExchangeRate(data.currency || 'TWD');
  const amountTWD = (data.currency === 'TWD' || !data.currency) ? data.amount : (data.amount * rate);
  
  const row = [
    data.timestamp ? new Date(data.timestamp) : new Date(), data.amount || null, data.currency || 'TWD',
    rate, amountTWD || null, data.category || '其他', data.item || null, '私人',
    null, null, null, null, null, null, '待確認', '語音', data.notes || null, null, null
  ];
  sheet.appendRow(row);
  return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: data })).setMimeType(ContentService.MimeType.JSON);
}


function isDuplicate(data, rawText, sheetId) {
  const cleanSheetId = sanitizeSheetId(sheetId);
  const sheet = SpreadsheetApp.openById(cleanSheetId).getSheetByName(SHEET_NAME);
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

// =================================================================================================
// 輔助函式
// =================================================================================================
function extractPdfText(file) {
  try {
    const pdfBlob = file.getBlob();
    const pdfBytes = pdfBlob.getBytes();
    
    // V35.6 修正：讀取前 1024 bytes，使其更具彈性，以應對開頭有非標準字元的 PDF。
    const sampleBytes = pdfBytes.slice(0, 1024);
    // V35.7 修正：將無效編碼 "Latin-1" 更正為標準的 "ISO-8859-1"。
    const sampleHeaderText = Utilities.newBlob(sampleBytes).getDataAsString("ISO-8859-1");
    
    // PDF 的 "Magic Number" 是 "%PDF"。我們在取樣的文字中搜尋它。
    if (sampleHeaderText.indexOf('%PDF') === -1) {
       throw new Error(`檔案 ${file.getName()} 的檔案標頭中找不到 '%PDF' 標記，不是有效的 PDF 檔案。`);
    }
    
    const encodings = ['UTF-8', 'ISO-8859-1', 'Windows-1252', 'Big5'];
    let bestText = '';
    
    for (const encoding of encodings) {
      try {
        const text = pdfBlob.getDataAsString(encoding);
        if (text && text.length > bestText.length && !text.includes('�')) {
          bestText = text;
        }
      } catch (e) {
        Logger.log(`嘗試使用 ${encoding} 編碼讀取 ${file.getName()} 失敗，繼續...`);
        continue;
      }
    }
    
    if (bestText.trim() === '') {
        const fallbackText = pdfBlob.getDataAsString('UTF-8');
        if (fallbackText && fallbackText.trim() !== '') {
            bestText = fallbackText;
            Logger.log(`所有無亂碼編碼嘗試失敗，退回使用原始 UTF-8 提取的文字。檔案: ${file.getName()}`);
        }
    }

    if (bestText.trim() === '') {
        Logger.log(`警告：檔案 ${file.getName()} 在所有編碼嘗試後，提取文字內容為空。`);
    }
    return bestText;

  } catch (error) {
    Logger.log(`[extractPdfText Error] 在提取 '${file.getName()}' 文字時發生錯誤: ${error.message}`);
    throw error;
  }
}

function assessTextQuality(text) {
  if (!text || text.trim() === '') return 'empty';
  
  const garbledChars = text.match(/[�]/g);
  const totalChars = text.length;
  const garbledRatio = garbledChars ? garbledChars.length / totalChars : 0;
  
  if (garbledRatio > 0.3) return 'poor';
  if (garbledRatio > 0.1) return 'medium';
  return 'good';
}


function sanitizeSheetId(idString) {
  if (!idString || typeof idString !== 'string' || idString.trim() === '') {
    const sanitizedMainId = MAIN_LEDGER_ID.match(/\/d\/([a-zA-Z0-9-_]+)/) ? MAIN_LEDGER_ID.match(/\/d\/([a-zA-Z0-9-_]+)/)[1] : MAIN_LEDGER_ID;
    return sanitizedMainId;
  }
  const match = idString.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return idString.trim();
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
  for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
  for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }
  return matrix[b.length][a.length];
}


function parseInvoiceEmail(htmlBody) {
  const invoiceNumberMatch = htmlBody.match(/發票號碼(?:<[^>]+>)*\s*([A-Z]{2}-\d{8})/);
  const dateMatch = htmlBody.match(/開立日期(?:<[^>]+>)*\s*(\d{3}\/\d{2}\/\d{2})/);
  const amountMatch = htmlBody.match(/總計(?:<[^>]+>)*\s*NT\$([\d,]+)/);
  const sellerMatch = htmlBody.match(/賣方營業人名稱(?:<[^>]+>)*\s*([^<]+)/);

  if (!invoiceNumberMatch || !dateMatch || !amountMatch || !sellerMatch) {
    return null;
  }
  
  const minguoYear = parseInt(dateMatch[1].substring(0, 3), 10);
  const adYear = minguoYear + 1911;
  const monthDay = dateMatch[1].substring(4);
  const formattedDate = `${adYear}/${monthDay}`;

  return {
    invoiceNumber: invoiceNumberMatch[1],
    timestamp: new Date(formattedDate),
    amount: parseFloat(amountMatch[1].replace(/,/g, '')),
    item: sellerMatch[1].trim(),
    currency: 'TWD'
  };
}

