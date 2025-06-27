// =================================================================================================
// 專案名稱：智慧記帳 GEM (Gemini AI Accountant)
// 版本：V38.1 - 多目標語音記帳與時間精度強化
// 作者：0ximwhatim & Gemini
// 最後更新：2025-06-27
// 說明：此版本根據使用者反饋，進行了多項功能擴充與 AI 指令優化。
//      1. 【AI 指令升級】: callGeminiForVoice 的 prompt 全面強化，現在能從自然語言中解析相對時間，並以 ISO 8601 格式回傳。
//      2. 【功能擴充】: 語音記帳流程 (doPost_Voice -> processVoice -> writeToSheetFromVoice) 已完全支援 target_sheet_id，可將語音紀錄寫入指定帳本。
//      3. 【規則擴展】: EMAIL_PROCESSING_RULES 中已新增「國泰產險繳費通知」的 HTML 處理規則。
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

// ============================= V38.1 函式修改 START =============================
// 【統一郵件處理規則書】
// type: 'HTML' -> 解析 HTML 內容 (優先從 .htm/.html 附件，其次從郵件內文)，適用於官方電子發票。
// type: 'PDF'  -> 抓取 PDF 附件，適用於廠商收據。
const EMAIL_PROCESSING_RULES = [
  // --- HTML 內文/附件處理規則 ---
  { query: 'from:invoice@einvoice.nat.gov.tw', type: 'HTML' },
  { query: 'from:invoice@mail2.ei.com.tw subject:"電子發票開立通知"', type: 'HTML' },
  { query: 'from:service@pchomepay.com.tw subject:"電子發票開立通知"', type: 'HTML' },
  { query: 'from:invoice@cht.com.tw subject:"中華電信電子發票"', type: 'HTML' },
  { query: 'from:payonline@cathay-ins.com.tw subject:"國泰產險保費繳費成功通知"', type: 'HTML' }, // 新增保險繳費規則
  
  // --- PDF 附件處理規則 ---
  { query: 'from:receipts-noreply@uber.com', type: 'PDF' },
  { query: 'from:noreply@uber.com has:attachment', type: 'PDF' },
  { query: 'from:agoda@agoda.com subject:預訂確認', type: 'PDF' },
  { query: 'from:no_reply@email.apple.com subject:"你的 Apple 開立發票通知"', type: 'PDF' },
  { query: 'from:service@ebill.firstbank.tw subject:"第一銀行信用卡電子對帳單"', type: 'PDF' },
  { query: 'from:ebill@water.gov.taipei subject:"臺北自來水事業處"', type: 'PDF' },
  { query: 'from:payments-noreply@google.com subject:"Google：隨信附上您的電子應付憑據 (統一發票)"', type: 'PDF' },
];
// ============================= V38.1 函式修改 END ===============================
// =================================================================================================


// =================================================================================================
// 【V35.0 核心】多入口路由
// =================================================================================================

/**
 * @description 處理 HTTP GET 請求。
 * 主要用於處理因 Web App 重新導向，導致客戶端將 POST 轉為 GET 的錯誤情境。
 * @param {Object} e - Apps Script 的事件物件。
 * @returns {ContentService.TextOutput} 一個結構化的 JSON 錯誤訊息。
 */
function doGet(e) {
  const endpoint = e.parameter.endpoint || 'unknown';
  Logger.log(`一個 GET 請求被接收，端點為: ${endpoint}。這應該是一個 POST 請求，可能是由重新導向造成。`);
  
  return ContentService.createTextOutput(JSON.stringify({
    status: 'error',
    message: `接收到 GET 請求，但此 API 端點只接受 POST 請求。請檢查您的捷徑設定，或確認 Web App 是否已正確部署。`
  })).setMimeType(ContentService.MimeType.JSON);
}


/**
 * @description 處理 HTTP POST 請求，並根據 URL 參數，將請求路由到不同的處理函式。
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

// ============================= V38.1 函式修改 START =============================
function doPost_Voice(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    // 【V38.1 升級】現在會讀取 target_sheet_id，若無則使用主帳本
    const targetSheetId = sanitizeSheetId(params.target_sheet_id || MAIN_LEDGER_ID);
    const voiceText = params.voice_text;
    
    if (!voiceText) throw new Error("缺少 voice_text 參數。");

    return processVoice(voiceText, targetSheetId);
  } catch (error) {
    Logger.log(`[doPost_Voice Error] ${error.toString()}`);
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: `處理語音時發生錯誤: ${error.message}` })).setMimeType(ContentService.MimeType.JSON);
  }
}
// ============================= V38.1 函式修改 END ===============================

// =================================================================================================
// 自動化處理管道
// =================================================================================================

/**
 * @description 【V36.2 新增】統一的郵件自動化處理入口。
 * 這個函式會取代舊的 syncPdfsFromGmail 和 syncInvoicesFromGmail。
 * 請為此函式設定時間觸發器。
 */
function processAutomatedEmails() {
  const processFolder = DriveApp.getFolderById(FOLDER_ID_TO_PROCESS);
  const sanitizedMainLedgerId = sanitizeSheetId(MAIN_LEDGER_ID);
  
  EMAIL_PROCESSING_RULES.forEach(rule => {
    const fullQuery = `${rule.query} is:unread`;
    Logger.log(`正在搜尋郵件: "${fullQuery}"，處理類型: ${rule.type}`);
    
    const threads = GmailApp.search(fullQuery);
    threads.forEach(thread => {
      const messages = thread.getMessages();
      messages.forEach(message => {
        
        try {
          // --- PDF 附件處理邏輯 ---
          if (rule.type === 'PDF') {
            const attachments = message.getAttachments();
            if (attachments.length > 0) {
              let pdfFound = false;
              attachments.forEach(attachment => {
                if (attachment.getContentType() === 'application/pdf') {
                  processFolder.createFile(attachment);
                  pdfFound = true;
                }
              });
              if (pdfFound) {
                 Logger.log(`找到 PDF 附件於郵件: ${message.getSubject()}`);
                 message.markRead();
              }
            } else {
               Logger.log(`規則為 PDF，但郵件 "${message.getSubject()}" 中未找到附件，跳過。`);
            }
          }
          // --- HTML 內文/附件處理邏輯 ---
          else if (rule.type === 'HTML') {
            let htmlContent = null;
            let sourceDescription = "電子發票"; // 預設來源描述
            const attachments = message.getAttachments();
            
            // 優先尋找 htm/html 附件
            const htmlAttachment = attachments.find(att =>
                att.getContentType() === MimeType.HTML ||
                att.getName().toLowerCase().endsWith('.htm') ||
                att.getName().toLowerCase().endsWith('.html')
            );
            
            if (htmlAttachment) {
                htmlContent = htmlAttachment.getDataAsString();
                sourceDescription = `電子發票 (${htmlAttachment.getName()})`;
                Logger.log(`找到 ${sourceDescription} 於郵件: ${message.getSubject()}`);
            } else {
                // 如果沒有 HTML 附件，才使用郵件內文
                htmlContent = message.getBody();
            }
            
            if (htmlContent) {
                const invoiceData = parseInvoiceEmail(htmlContent);
                // 【V38.0 升級】直接將解析出的資料，交給新的統一處理函式
                processNewRecord(invoiceData, null, `HTML (${sourceDescription})`, sanitizedMainLedgerId, null);
                message.markRead();

            } else {
                Logger.log(`規則為 HTML，但郵件 "${message.getSubject()}" 中找不到任何 HTML 內容（包括內文與附件），跳過。`);
            }
          }
        } catch (e) {
          Logger.log(`處理郵件失敗: ${e.toString()}. 主旨: ${message.getSubject()}`);
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


// =================================================================================================
// 核心處理函式
// =================================================================================================

function processImage(file, optionalVoiceNote, sheetId) {
  try {
    const aiResult = callGeminiForVision(file.getBlob(), optionalVoiceNote);
    const parsedData = JSON.parse(aiResult.text);
    const source = optionalVoiceNote ? 'OCR+語音' : 'OCR';
    // 【V38.0 升級】所有新紀錄都通過統一的處理函式
    processNewRecord(parsedData, file, source, sheetId, aiResult.rawText);
  } catch (error) {
    Logger.log(`[processImage Error] ${error.toString()} for file ${file.getName()}`);
    handleFailedFile(error, file, sheetId);
  }
}

function processPdf(file, sheetId) {
  let pdfText;
  let usedEngine = "備用引擎";

  try {
    if (GCP_PROJECT_ID && DOCUMENT_AI_PROCESSOR_ID) {
      Logger.log(`偵測到 Document AI 設定，嘗試使用主引擎處理檔案：${file.getName()}`);
      pdfText = callDocumentAIAPI(file.getBlob());
      usedEngine = "主引擎 (Document AI)";
    } else {
      throw new Error("Document AI 未設定，將使用備用引擎。");
    }
  } catch (docAiError) {
    Logger.log(`[${usedEngine} Error] ${docAiError.message}`);
    Logger.log(`自動切換至備用引擎來處理檔案：${file.getName()}`);
    try {
      pdfText = extractPdfText(file);
      usedEngine = "備用引擎";
    } catch (fallbackError) {
      Logger.log(`[備用引擎 Error] ${fallbackError.message}`);
      handleFailedFile(fallbackError, file, sheetId);
      return;
    }
  }

  try {
    const textQuality = assessTextQuality(pdfText);
    Logger.log(`檔案 ${file.getName()} 的 PDF 文字品質評估: ${textQuality} (由 ${usedEngine} 產出)`);
    
    if (textQuality === 'poor') {
      Logger.log(`警告: PDF '${file.getName()}' 文字品質不佳，可能影響辨識準確度`);
    }
    
    const aiResult = callGeminiForPdfText(pdfText, textQuality);
    const parsedData = JSON.parse(aiResult);
    
    const source = `PDF (${usedEngine})`;
    // 【V38.0 升級】所有新紀錄都通過統一的處理函式
    processNewRecord(parsedData, file, source, sheetId, pdfText);
  
  } catch (finalProcessingError) {
    Logger.log(`[最終處理階段 Error] 在分析文字或寫入表格時發生錯誤。檔案: ${file.getName()}, 錯誤: ${finalProcessingError.toString()}`);
    handleFailedFile(finalProcessingError, file, sheetId);
  }
}

// ============================= V38.1 函式修改 START =============================
function processVoice(voiceText, sheetId) {
  try {
    const aiResultText = callGeminiForVoice(voiceText);
    const parsedData = JSON.parse(aiResultText);
     // 【V38.1 升級】所有新紀錄都通過統一的處理函式
    const result = processNewRecord(parsedData, null, '語音', sheetId, voiceText);
    return ContentService.createTextOutput(JSON.stringify({ status: result ? 'success' : 'error', data: parsedData })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log(`[processVoice Error] ${error.toString()} for text "${voiceText}"`);
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: `處理語音時發生錯誤: ${error.message}` })).setMimeType(ContentService.MimeType.JSON);
  }
}
// ============================= V38.1 函式修改 END ===============================


/**
 * @description 【V38.0 新增】處理失敗檔案的輔助函式，實現智慧分流與歸檔
 * @param {Error} error - 捕捉到的錯誤物件
 * @param {File} file - 處理失敗的檔案物件
 * @param {string} sheetId - 目標工作表的 ID
 */
function handleFailedFile(error, file, sheetId) {
  Logger.log(`[handleFailedFile] 開始處理失敗的檔案 ${file ? file.getName() : 'N/A'}。錯誤: ${error.message}`);
  
  if (file) {
    if (error && error.message && error.message.includes('不是有效的 PDF 檔案')) {
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
}


// =================================================================================================
// 【V38.0 新增】資料關聯與擴充 (Data Reconciliation & Enrichment)
// =================================================================================================

// 資料來源的信任評分 (越高越可信)
const SOURCE_TRUST_SCORES = {
  'HTML': 10,
  'PDF': 8,
  'OCR': 6,
  '語音': 4
};


/**
 * @description 【V38.0 新增】統一處理所有新紀錄的入口函式。
 * 它會先尋找關聯紀錄，如果找到就進行智慧合併，找不到才新增一筆。
 * @param {object} newData - AI 解析出的新資料物件。
 * @param {File} file - (可選) 相關的檔案物件 (圖片或PDF)。
 * @param {string} source - 資料來源的描述 (例如 'PDF (主引擎)', 'OCR+語音')。
 * @param {string} sheetId - 目標工作表的 ID。
 * @param {string} rawText - 原始的文字內容，用於查重。
 * @returns {boolean} 操作是否成功。
 */
function processNewRecord(newData, file, source, sheetId, rawText) {
  try {
    const sheet = SpreadsheetApp.openById(sheetId).getSheetByName(SHEET_NAME);
    const relatedRecord = findRelatedRecord(newData, sheet, rawText);

    if (relatedRecord) {
      // --- 找到關聯紀錄 -> 進行更新 ---
      Logger.log(`找到關聯紀錄於第 ${relatedRecord.rowIndex} 列，準備進行智慧合併。`);
      const mergedData = enrichAndMergeData(newData, relatedRecord.data, source);
      // setValues 期望一個二維陣列
      sheet.getRange(relatedRecord.rowIndex, 1, 1, mergedData.length).setValues([mergedData]);
      Logger.log(`成功更新第 ${relatedRecord.rowIndex} 列的紀錄。`);
      
      // 成功合併後，處理原始檔案
      if (file) {
        const archiveFolder = DriveApp.getFolderById(FOLDER_ID_ARCHIVE);
        file.moveTo(archiveFolder);
        Logger.log(`檔案 ${file.getName()} 已被成功處理並封存。`);
      }

    } else {
      // --- 找不到關聯紀錄 -> 新增一筆 ---
      Logger.log(`未找到關聯紀錄，將新增一筆紀錄。`);
      const status = (newData.confidence === 'low') ? '需人工確認' : '待確認';
      const fileUrl = file ? file.getUrl() : null;
      writeToSheet(newData, fileUrl, rawText, null, source, sheetId, status);
      
      if (file) {
        const archiveFolder = DriveApp.getFolderById(FOLDER_ID_ARCHIVE);
        file.moveTo(archiveFolder);
      }
    }
    return true;

  } catch (error) {
    Logger.log(`[processNewRecord Error] 處理新紀錄時發生錯誤: ${error.toString()}`);
    if (file) {
      handleFailedFile(error, file, sheetId);
    }
    return false;
  }
}

/**
 * @description 【V38.0 新增】在表格中尋找與新紀錄相關的舊紀錄。
 * @param {object} newData - AI 解析出的新資料物件。
 * @param {Sheet} sheet - 目標工作表物件。
 * @param {string} newRawText - 新紀錄的原始文字。
 * @returns {object|null} 如果找到，回傳 {rowIndex, data} 物件；否則回傳 null。
 */
function findRelatedRecord(newData, sheet, newRawText) {
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();

  // Column indices (0-based)
  const COLS = {
    TIMESTAMP: 0,
    AMOUNT: 1,
    INVOICE_NUMBER: 8,
    RAW_TEXT: 17
  };

  // 策略一：使用「黃金鑰匙」- 發票號碼進行精準匹配
  if (newData.invoiceNumber) {
    for (let i = 1; i < values.length; i++) {
      if (values[i][COLS.INVOICE_NUMBER] === newData.invoiceNumber) {
        return { rowIndex: i + 1, data: values[i] };
      }
    }
  }

  // 策略二：使用「模糊鑰匙」- 日期、金額、內容相似度
  const newDate = new Date(newData.timestamp);
  const newAmount = parseFloat(newData.amount);

  for (let i = 1; i < values.length; i++) {
    const existingRow = values[i];
    const existingDate = new Date(existingRow[COLS.TIMESTAMP]);
    const existingAmount = parseFloat(existingRow[COLS.AMOUNT]);
    
    // Skip if essential data is missing
    if (!existingDate || isNaN(existingAmount)) continue;

    // Check for same day and similar amount
    const timeDiff = Math.abs(newDate.getTime() - existingDate.getTime());
    const dayDiff = timeDiff / (1000 * 3600 * 24);
    
    if (dayDiff < 1 && Math.abs(newAmount - existingAmount) < 0.01) {
      // If raw text is available for both, check similarity
      const existingRawText = existingRow[COLS.RAW_TEXT];
      if (newRawText && existingRawText) {
        const similarity = 1 - (levenshtein(newRawText, existingRawText) / Math.max(newRawText.length, existingRawText.length));
        if (similarity > 0.85) { // A slightly lower threshold for merging
           return { rowIndex: i + 1, data: existingRow };
        }
      } else {
        // If one of them lacks raw text, we consider it a match based on date/amount alone
        return { rowIndex: i + 1, data: existingRow };
      }
    }
  }
  
  return null; // No related record found
}

/**
 * @description 【V38.0 新增】智慧合併新舊兩筆紀錄的資料。
 * @param {object} newData - 新的資料物件。
 * @param {Array} oldRowData - 表格中舊的那一列資料。
 * @param {string} newSource - 新資料的來源描述。
 * @returns {Array} 合併後的、準備好寫回表格的一維陣列。
 */
function enrichAndMergeData(newData, oldRowData, newSource) {
  // Deep copy the old row data to avoid modifying it directly
  let mergedRow = [...oldRowData];

  const COLS = {
    TIMESTAMP: 0,
    AMOUNT: 1,
    CURRENCY: 2,
    CATEGORY: 5,
    ITEM: 6,
    INVOICE_NUMBER: 8,
    REFERENCE_NUMBER: 9,
    SOURCE: 15,
    NOTES: 16,
    RAW_TEXT: 17
  };

  const oldSource = mergedRow[COLS.SOURCE] || '未知';
  const newTrust = SOURCE_TRUST_SCORES[newSource.split(' ')[0]] || 0;
  const oldTrust = SOURCE_TRUST_SCORES[oldSource.split(' ')[0]] || 0;

  // --- 欄位合併邏輯 ---
  // 如果新資料的信任度更高，就用新的品項和分類覆蓋舊的
  if (newTrust > oldTrust) {
    if (newData.item) mergedRow[COLS.ITEM] = newData.item;
    if (newData.category) mergedRow[COLS.CATEGORY] = newData.category;
  }

  // 補充缺失的資訊 (如果原來是空的，就用新的填上)
  if (!mergedRow[COLS.INVOICE_NUMBER] && newData.invoiceNumber) {
    mergedRow[COLS.INVOICE_NUMBER] = newData.invoiceNumber;
  }
  if (!mergedRow[COLS.REFERENCE_NUMBER] && newData.referenceNumber) {
    mergedRow[COLS.REFERENCE_NUMBER] = newData.referenceNumber;
  }
  
  // 合併備註
  const oldNotes = mergedRow[COLS.NOTES] || '';
  const newNotes = newData.notes || '';
  if (newNotes && !oldNotes.includes(newNotes)) {
    mergedRow[COLS.NOTES] = oldNotes ? `${oldNotes}; ${newNotes}` : newNotes;
  }
  
  // 更新來源，讓使用者知道這筆資料被擴充了
  mergedRow[COLS.SOURCE] = `${oldSource} (+${newSource})`;
  
  return mergedRow;
}


// =================================================================================================
// AI 呼叫函式
// =================================================================================================

function callGeminiForVision(imageBlob, voiceNote) {
  const promptLines = [
    '你是一位專業、吹毛求疵的台灣記帳助理。你的任務是分析一張收據或發票的圖片，並結合一段可選的語音備註，提取出結構化的記帳資訊。',
    '',
    '---',
    '**【最高指導原則】**',
    '1. **主要資訊來源**: 圖片是主要資訊來源。請從圖片中提取日期、金額、品項、店家名稱等所有關鍵資訊。',
    '2. **語音備註用途**: 語音備註是用來補充情境的。請將語音備註的內容，填入 `notes` 欄位。如果語音備註能幫助你判斷 `item` (品項)，也可以用來豐富品項描述。',
    '3. **JSON 輸出結構**: 你**必須**回傳一個包含兩個頂層鍵的 JSON 物件: `structuredData` 和 `rawText`。',
    '   - `structuredData`: 包含所有結構化的記帳欄位。',
    '   - `rawText`: 包含從圖片中 OCR 辨識出的**完整**原始文字。',
    '',
    '---',
    '**【`structuredData` 的詳細規則】**',
    '**1. 日期 (timestamp)**: 從圖片中找到的交易日期與時間，格式化為 **`YYYY-MM-DDTHH:mm:ss`** 的 ISO 8601 標準格式。如果圖片中找不到確切時間，則使用 `00:00:00` 作為時間。',
    '**2. 金額 (amount)**: 從圖片中找到的總金額，只回傳純數字，並保留原始的小數點。',
    '**3. 分類 (category)**: **必須**從固定清單中選擇：[\'食\', \'衣\', \'住\', \'行\', \'育\', \'樂\', \'帳單\', \'其他\']。',
    '**4. 格式要求**: 找不到的欄位請填入 null。',
    '',
    '---',
    '**【學習範例】**',
    '',
    '**範例 1: 圖片 + 語音備註**',
    '[輸入圖片]:一張八方雲集的發票圖片，內容有品項、總金額160元、發票號碼HW86105671、日期2025/02/02、時間 13:21:34。',
    '[輸入語音備註]: "中午吃的鍋貼"',
    '[輸出 JSON]',
    '{',
    '  "structuredData": {',
    '    "timestamp": "2025-02-02T13:21:34",',
    '    "amount": 160,',
    '    "currency": "TWD",',
    '    "category": "食",',
    '    "item": "八方雲集",',
    '    "invoiceNumber": "HW86105671",',
    '    "referenceNumber": null,',
    '    "notes": "中午吃的鍋貼"',
    '  },',
    '  "rawText": "八方雲集...HW86105671...總計 160...時間 13:21:34..."',
    '}',
    '---',
    '',
    '**【你的任務】**',
    '現在，請處理以下新的圖片與語音備註。',
    `[輸入語音備註]: "${voiceNote || '無'}"`
  ];
  const prompt = promptLines.join('\n');
  
  const requestBody = {
    "contents": [{
      "parts": [
        { "text": prompt },
        { "inline_data": { "mime_type": imageBlob.getContentType(), "data": Utilities.base64Encode(imageBlob.getBytes()) }}
      ]
    }],
    "generationConfig": { "response_mime_type": "application/json" }
  };

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
    
    // 檢查回傳的 JSON 是否符合我們要求的嚴格結構
    if (parsedJson.structuredData && 'rawText' in parsedJson) {
      return { text: JSON.stringify(parsedJson.structuredData), rawText: parsedJson.rawText, translation: null };
    } else {
       throw new Error("AI 回應的 JSON 結構不符合預期 (缺少 structuredData 或 rawText 鍵)。");
    }
  } catch (e) {
    Logger.log(`callGeminiForVision 解析 JSON 失敗: ${e.toString()}. 原始 AI 回應: ${responseText}`);
    throw new Error(`Failed to process vision API call: ${e.message}`);
  }
}


function callGeminiForPdfText(pdfText, textQuality) {
  if (!pdfText || pdfText.trim() === '') {
    return JSON.stringify({
      timestamp: null, amount: null, currency: null, category: null, item: null,
      invoiceNumber: null, referenceNumber: null,
      notes: "無法讀取 PDF 文字內容，處理失敗。",
      confidence: "low",
      rawTextQuality: textQuality || 'empty'
    });
  }

  const promptLines = [
    '你是一位專業、吹毛求疵的台灣記帳助理。你的任務是從高品質的 PDF 文字中，學習範例，並提取出結構化的記帳資訊。',
    '',
    '---',
    '**【最高指導原則：日期判斷的思維鏈】**',
    '在決定最終的 `timestamp` 前，你必須在內心完成以下思考，並將此邏輯應用於所有判斷：',
    '1. **找出所有日期**：掃描文件，列出所有看起來像日期的文字 (例如 "付款日期 June 18, 2025", "入住期間 June 30, 2025", "開立日期:6月 15, 2025")。',
    '2. **評估優先級**：根據「**付款日期 (Payment Date)**」 > 「**開立日期 (Issue Date)**」這個優先級進行排序。',
    '3. **做出決策與解釋**：選擇優先級最高的日期作為 `timestamp`。同時，明確地忽略其他日期，並知道忽略它們的原因（例如，「我忽略了 June 30，因為它是入住日期，而非付款發生的時間點」）。',
    '',
    '---',
    '**【其他重要規則】**',
    '**1. 日期與時間 (timestamp)**: 將選擇的日期，格式化為 **`YYYY-MM-DDTHH:mm:ss`** 的 ISO 8601 標準格式。如果找不到確切時間，則使用 `00:00:00` 作為時間。',
    '**2. 金額 (amount):**',
    '   - 從「總計」、「總金額」、「Total」等關鍵字尋找金額，並只回傳純數字。',
    "   - **忠實記錄**：請忠實地記錄數字，**不要**對 TWD 或 JPY 進行四捨五入。保留原始的小數點。",
    '',
    '**3. 分類 (category):**',
    "   - **必須**從固定清單中選擇：['食', '衣', '住', '行', '育', '樂', '帳單', '其他']。",
    '   - 禁止創造新分類。住宿歸類為「住」，機票歸類為「行」。',
    '',
    '**4. 格式要求**: ',
    '   - **務必**、**只能**回傳一個單一的 JSON 物件。找不到的欄位請填入 null。',
    '',
    '---',
    '**【學習範例】**',
    '以下範例體現了上述所有規則，特別是日期判斷的思維鏈。',
    '',
    '**範例 1: 住宿收據 (多日期)**',
    '[輸入文字]',
    '"付款日期 June 18, 2025\\n收據\\n入住期間\\nJune 30, 2025 - July 4, 2025\\n總金額\\nTWD 8,286.06"',
    '[輸出 JSON]',
    '{',
    '  "timestamp": "2025-06-18T00:00:00",',
    '  "amount": 8286.06,',
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
    '**範例 2: 航班收據 (單一有效日期)**',
    '[輸入文字]',
    '"收據\\n開立日期:6月 15, 2025\\n預訂編號: 1620934638\\n總金額\\nTWD 22081.85"',
    '[輸出 JSON]',
    '{',
    '  "timestamp": "2025-06-15T00:00:00",',
    '  "amount": 22081.85,',
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
    '現在，請處理以下新的文字，並應用「思維鏈」邏輯與所有規則，回傳一個 JSON 物件。',
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
    
    JSON.parse(aiResultText);
    return aiResultText;

  } catch (e) {
    Logger.log(`callGeminiForPdfText 解析 JSON 失敗: ${e.toString()}. 原始 AI 回應: ${responseText}`);
    throw new Error(`Failed to process PDF text via API: ${e.message}`);
  }
}

// ============================= V38.1 函式修改 START =============================
function callGeminiForVoice(voiceText) {
  // 建立一個參考時間，讓 AI 知道 "今天" 是哪一天
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

  const promptLines = [
    '你是一位專業、嚴謹的台灣記帳助理。你的任務是從一句日常的中文對話中，提取出結構化的記帳資訊。',
    '',
    '---',
    '**【規則指令】**',
    '1.  **日期與時間 (timestamp)**: ',
    '    - **解析**: 請盡力從句子中解析日期與時間。例如「昨天早上十點」、「剛剛」、「中午」、「5/10 晚上八點」。',
    '    - **預設**: 如果句子中完全沒有提到日期，才使用今天的日期 `' + today + '`。如果沒有提到時間，則使用 `00:00:00`。',
    '    - **格式**: 最終格式必須是 **`YYYY-MM-DDTHH:mm:ss`** 的 ISO 8601 標準格式。',
    '2.  **金額 (amount)**: 請只提取數字部分，忽略任何貨幣符號或單位 (如 $, 元, 新台幣)。',
    '3.  **幣別 (currency)**: 如果沒有特別說明，一律預設為 \'TWD\'。',
    '4.  **分類 (category)**: **必須**從固定清單中選擇一個最相近的：[\'食\', \'衣\', \'住\', \'行\', \'育\', \'樂\', \'帳單\', \'其他\']。',
    '5.  **品項 (item)**: 提取出消費的主要商品或店家名稱。',
    '6.  **備註 (notes)**: 將原始的輸入句子完整地放入此欄位。',
    '7.  **格式要求**: **務必**、**只能**回傳一個單一的、無任何其他前後文字的 JSON 物件。',
    '',
    '---',
    '**【學習範例】**',
    '',
    '**範例 1:**',
    '[輸入文字]',
    '"今天早上在7-Eleven買煙花了新台幣$110用的是Line Pay"',
    '[輸出 JSON]',
    `{
  "timestamp": "${today}T09:00:00",
  "amount": 110,
  "currency": "TWD",
  "category": "其他",
  "item": "7-Eleven 買煙",
  "notes": "今天早上在7-Eleven買煙花了新台幣$110用的是Line Pay"
}`,
    '',
    '**範例 2:**',
    '[輸入文字]',
    '"昨天晚上八點搭計程車250元"',
    '[輸出 JSON]',
    `{
  "timestamp": "${new Date(new Date().setDate(new Date().getDate()-1)).toISOString().slice(0,10)}T20:00:00",
  "amount": 250,
  "currency": "TWD",
  "category": "行",
  "item": "計程車",
  "notes": "昨天晚上八點搭計程車250元"
}`,
    '---',
    '',
    '**【你的任務】**',
    '現在，請處理以下新的文字，並遵循上述所有規則與範例邏輯，回傳一個 JSON 物件。',
    '',
    '[輸入文字]',
    voiceText
  ];
  const prompt = promptLines.join('\n');

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
// ============================= V38.1 函式修改 END ===============================


function writeToSheet(data, fileUrl, rawText, translation, source, sheetId, customStatus = '待確認') {
  let sheet;
  try {
    const cleanSheetId = sanitizeSheetId(sheetId);
    sheet = SpreadsheetApp.openById(cleanSheetId).getSheetByName(SHEET_NAME);
  } catch (e) {
    Logger.log(`[writeToSheet Error] 無法開啟指定的 Google Sheet ID: '${sheetId}'。`);
    return false;
  }

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
    customStatus,
    source,
    data.notes || null,
    rawText,
    translation
  ];
  sheet.appendRow(row);
  return true;
}


function writeToSheetFromEmail(data, sheetId, source = '電子發票') {
  if (!data || typeof data.invoiceNumber === 'undefined') {
    Logger.log(`[writeToSheetFromEmail Warning] 函式被呼叫時，傳入的 data 物件無效或缺少 invoiceNumber。 Data: ${JSON.stringify(data)}`);
    return false;
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
    '待確認', source, `由 ${data.item} 開立`, null, null
  ];
  sheet.appendRow(row);
  return true;
}

// ============================= V38.1 函式修改 START =============================
function writeToSheetFromVoice(data, sheetId, originalVoiceText) {
  // 【V38.1 升級】直接將解析後的資料，交給統一的 processNewRecord 處理
  // 這樣語音記帳也能享受到「智慧合併」的好處
  processNewRecord(data, null, '語音', sheetId, originalVoiceText);
  return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: data })).setMimeType(ContentService.MimeType.JSON);
}
// ============================= V38.1 函式修改 END ===============================


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
    
    const sampleBytes = pdfBytes.slice(0, 1024);
    const sampleHeaderText = Utilities.newBlob(sampleBytes).getDataAsString("ISO-8859-1");
    
    if (sampleHeaderText.indexOf('%PDF') === -1) {
       throw new Error(`檔案 ${file.getName()} 的檔案標頭中找不到 '%PDF' 標記，不是有效的 PDF 檔案。`);
    }
    
    const encodings = ['UTF-8', 'ISO-8859-1', 'Windows-1252', 'Big5'];
    let bestText = '';
    
    for (const encoding of encodings) {
      try {
        const text = pdfBlob.getDataAsString(encoding);
        if (text && text.length > bestText.length && !text.includes('')) {
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
  
  const garbledChars = text.match(/[]/g);
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

