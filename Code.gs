// =================================================================================================
// 專案名稱：智慧記帳 GEM (Gemini AI Accountant)
// 版本：V40.4 - 帳單知識庫擴充版 (Billing Knowledge Expansion)
// 作者：0ximwhatim & Gemini
// 最後更新：2025-07-05
// 說明：此版本針對 PDF 繳費單辨識失敗的問題進行修正。
//      - 大幅強化 callGeminiForPdfText 的 Prompt，新增了處理「繳費證明單」的規則與範例。
//      - AI 現在能夠理解「學校名稱」、「繳款金額」等欄位，並將其正確歸類，提升了對非零售收據的處理能力。
// =================================================================================================

// =================================================================================================
// 【使用者設定區】
// =================================================================================================
const MAIN_LEDGER_ID = 'YOUR_MAIN_SPREADSHEET_ID_HERE';
const SHEET_NAME = 'All Records';
const SETTINGS_SHEET_NAME = 'Settings';
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE';
const GCP_PROJECT_ID = 'YOUR_GCP_PROJECT_ID_HERE';
const DOCUMENT_AI_PROCESSOR_ID = 'YOUR_DOC_AI_PROCESSOR_ID_HERE';
const FOLDER_ID_TO_PROCESS = 'YOUR_GOOGLE_DRIVE_FOLDER_ID_FOR_PROCESSING';
const FOLDER_ID_ARCHIVE = 'YOUR_GOOGLE_DRIVE_FOLDER_ID_FOR_ARCHIVING';
const FOLDER_ID_DUPLICATES = 'YOUR_GOOGLE_DRIVE_FOLDER_ID_FOR_DUPLICATES';

// =================================================================================================
// 【V35.0 核心】多入口路由
// =================================================================================================
function doGet(e) {
  const endpoint = e.parameter.endpoint || 'unknown';
  Logger.log(`一個 GET 請求被接收，端點為: ${endpoint}。這應該是一個 POST 請求，可能是由重新導向造成。`);

  return ContentService.createTextOutput(JSON.stringify({
    status: 'error',
    message: `接收到 GET 請求，但此 API 端點只接受 POST 請求。請檢查您的捷徑設定，或確認 Web App 是否已正確部署。`
  })).setMimeType(ContentService.MimeType.JSON);
}

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
    const imageBase64 = params.image_base_64;
    const voiceText = params.voice_text;
    const fileName = params.filename || `image_${new Date().getTime()}.jpg`;

    if (!imageBase64) throw new Error("缺少 image_base_64 參數。");

    const fileBytes = Utilities.base64Decode(imageBase64);
    const fileExtension = (params.file_extension || 'jpg').toLowerCase();
    const mimeType = fileExtension.includes('png') ? MimeType.PNG : MimeType.JPEG;
    
    const tempFile = DriveApp.getFolderById(FOLDER_ID_TO_PROCESS).createFile(Utilities.newBlob(fileBytes, mimeType, fileName));
    
    processImage(tempFile, voiceText, targetSheetId);

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: '圖片請求已接收，將在背景處理。' })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log(`[doPost_Image Error] ${error.toString()}`);
    sendNotification('doPost_Image 執行失敗', `處理圖片時發生錯誤: ${error.stack}`, 'ERROR');
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: `處理圖片時發生錯誤: ${error.message}` })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost_Pdf(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const targetSheetId = sanitizeSheetId(params.target_sheet_id || MAIN_LEDGER_ID);
    const pdfBase64 = params.image_base_64;
    const fileName = params.filename || `file_${new Date().getTime()}.pdf`;

    if (!pdfBase64) throw new Error("缺少 pdf (image_base_64) 參數。");

    const fileBytes = Utilities.base64Decode(pdfBase64);
    const tempFile = DriveApp.getFolderById(FOLDER_ID_TO_PROCESS).createFile(Utilities.newBlob(fileBytes, MimeType.PDF, fileName));

    processPdf(tempFile, targetSheetId);

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'PDF 請求已接收，將在背景處理。' })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log(`[doPost_Pdf Error] ${error.toString()}`);
    sendNotification('doPost_Pdf 執行失敗', `處理 PDF 時發生錯誤: ${error.stack}`, 'ERROR');
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
    sendNotification('doPost_Voice 執行失敗', `處理語音時發生錯誤: ${error.stack}`, 'ERROR');
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: `處理語音時發生錯誤: ${error.message}` })).setMimeType(ContentService.MimeType.JSON);
  }
}


// =================================================================================================
// 【V38.3 新增】智慧通報中心 (Notification Hub)
// =================================================================================================
function getNotificationRules() {
    const cache = CacheService.getScriptCache();
    const cachedRules = cache.get('notification_rules');
    if (cachedRules) {
        return JSON.parse(cachedRules);
    }

    try {
        const sheet = SpreadsheetApp.openById(MAIN_LEDGER_ID).getSheetByName(SETTINGS_SHEET_NAME);
        if (!sheet) return [];

        const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const channelIndex = header.indexOf('Channel');
        const targetIndex = header.indexOf('Target');
        const levelIndex = header.indexOf('Level');

        if (channelIndex === -1 || targetIndex === -1 || levelIndex === -1) {
            Logger.log(`警告：在 "${SETTINGS_SHEET_NAME}" 工作表中找不到必需的標題: 'Channel', 'Target', 'Level'。`);
            return [];
        }

        const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
        const rules = data.map(row => {
            const channel = row[channelIndex];
            const target = row[targetIndex];
            const level = row[levelIndex];
            if (channel && target) {
                return {
                    channel: channel.trim().toUpperCase(),
                    target: target.trim(),
                    level: (level || 'ALL').trim().toUpperCase()
                };
            }
            return null;
        }).filter(Boolean);
        
        cache.put('notification_rules', JSON.stringify(rules), 300); // 快取 5 分鐘
        return rules;

    } catch (e) {
        Logger.log(`[getNotificationRules Error] ${e.toString()}`);
        return [];
    }
}

function sendNotification(title, message, severity) {
    const rules = getNotificationRules();
    if (rules.length === 0) return;

    rules.forEach(rule => {
        if (rule.level === 'ERROR' && severity !== 'ERROR') {
            return;
        }

        const fullMessage = `【智慧記帳 GEM 通知】\n${title}\n\n${message}`;

        try {
            switch (rule.channel) {
                case 'EMAIL':
                    MailApp.sendEmail(rule.target, `【智慧記帳 GEM 通知】${title}`, message);
                    break;
                case 'WEBHOOK':
                    const payload = { text: fullMessage };
                    UrlFetchApp.fetch(rule.target, {
                        method: 'post',
                        contentType: 'application/json',
                        payload: JSON.stringify(payload)
                    });
                    break;
                default:
                    Logger.log(`未知的通知渠道: ${rule.channel}`);
            }
        } catch (e) {
            Logger.log(`發送通知到 ${rule.channel} (${rule.target}) 失敗: ${e.toString()}`);
        }
    });
}

// =================================================================================================
// 【V38.2 新增】動態規則讀取
// =================================================================================================
function getEmailProcessingRulesFromSheet() {
  try {
    const sheet = SpreadsheetApp.openById(MAIN_LEDGER_ID).getSheetByName(SETTINGS_SHEET_NAME);
    if (!sheet) {
      throw new Error(`找不到名為 "${SETTINGS_SHEET_NAME}" 的工作表。`);
    }
    const range = sheet.getRange("A2:B" + sheet.getLastRow());
    const values = range.getValues();
    
    const rules = values.map(row => {
      const query = row[0];
      const type = row[1];
      if (query && type) {
        return { query: query.trim(), type: type.trim().toUpperCase() };
      }
      return null;
    }).filter(rule => rule !== null);

    Logger.log(`成功從 "${SETTINGS_SHEET_NAME}" 工作表讀取了 ${rules.length} 條規則。`);
    return rules;

  } catch (error) {
    Logger.log(`[getEmailProcessingRulesFromSheet Error] 讀取規則時發生錯誤: ${error.toString()}`);
    sendNotification('讀取郵件規則失敗', `無法從 "${SETTINGS_SHEET_NAME}" 工作表讀取郵件處理規則。\n\n錯誤詳情:\n${error.stack}`, 'ERROR');
    return [];
  }
}

// =================================================================================================
// 自動化處理管道
// =================================================================================================

function processAutomatedEmails() {
  const processFolder = DriveApp.getFolderById(FOLDER_ID_TO_PROCESS);
  const sanitizedMainLedgerId = sanitizeSheetId(MAIN_LEDGER_ID);
  
  const emailProcessingRules = getEmailProcessingRulesFromSheet();

  if (emailProcessingRules.length === 0) {
    Logger.log("警告：未從 'Settings' 工作表讀取到任何有效的郵件處理規則，本次執行結束。");
    return;
  }
 
  emailProcessingRules.forEach(rule => {
    const fullQuery = `${rule.query} is:unread`;
    Logger.log(`正在搜尋郵件: "${fullQuery}"，處理類型: ${rule.type}`);
    
    const threads = GmailApp.search(fullQuery);
    threads.forEach(thread => {
      const messages = thread.getMessages();
      messages.forEach(message => {
        try {
          if (rule.type.toUpperCase() === 'PDF') {
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
            }
          }
          else if (rule.type.toUpperCase() === 'HTML') {
            let htmlContent = null;
            let sourceDescription = "電子發票";
            const attachments = message.getAttachments();
            
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
              htmlContent = message.getBody();
            }
            
            if (htmlContent) {
              const invoiceData = parseInvoiceEmail(htmlContent);
              if (invoiceData) {
                 processNewRecord(invoiceData, null, `HTML (${sourceDescription})`, sanitizedMainLedgerId, null, null);
                 message.markRead();
              } else {
                 Logger.log(`郵件 "${message.getSubject()}" 的 HTML 內容無法解析，跳過。`);
              }
            }
          }
        } catch (e) {
          Logger.log(`處理郵件失敗: ${e.toString()}. 主旨: ${message.getSubject()}`);
          sendNotification('郵件處理失敗', `處理郵件 "${message.getSubject()}" 時發生錯誤。\n\n錯誤詳情:\n${e.stack}`, 'ERROR');
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
       handleFailedFile(e, file, sanitizedMainLedgerId);
    }
  }
}

// =================================================================================================
// 核心處理函式
// =================================================================================================
function processImage(file, optionalVoiceNote, sheetId) {
  try {
    const aiResult = callGeminiForVision(file.getBlob(), optionalVoiceNote);
    
    if (aiResult.transactions && Array.isArray(aiResult.transactions)) {
      Logger.log("偵測到交易列表，啟動列表處理模式...");
      processImageAsTransactionList(aiResult.transactions, file, optionalVoiceNote, sheetId, aiResult.rawText);
    } else {
      Logger.log("偵測到單筆收據，啟動標準處理模式...");
      const parsedData = JSON.parse(aiResult.text);
      const source = optionalVoiceNote ? 'OCR+語音' : 'OCR';
      processNewRecord(parsedData, file, source, sheetId, aiResult.rawText, aiResult.metaData);
    }
  } catch (error) {
    Logger.log(`[processImage Error] ${error.toString()} for file ${file.getName()}`);
    handleFailedFile(error, file, sheetId);
  }
}

function processImageAsTransactionList(transactions, file, optionalVoiceNote, sheetId, fullRawText) {
  let totalExpense = 0;
  let currency = 'JPY';

  transactions.forEach(tx => {
    const amountStr = String(tx.amount || '0');
    const amount = parseFloat(amountStr.replace(/[^0-9.-]+/g,""));
    const description = tx.description || '未知交易';

    if (amountStr.includes('¥')) {
        currency = 'JPY';
    } else if (amountStr.includes('$') || amountStr.toLowerCase().includes('twd')) {
        currency = 'TWD';
    }

    let category = '行';
    let notes = optionalVoiceNote || '';

    if (tx.transaction_type === 'TRANSFER') {
      category = '內部轉帳';
    } else if (tx.transaction_type === 'EXPENSE') {
      totalExpense += Math.abs(amount);
    }

    const newData = {
      timestamp: tx.date ? new Date(tx.date) : new Date(),
      amount: Math.abs(amount),
      currency: currency,
      category: category,
      item: description,
      invoiceNumber: null,
      referenceNumber: null,
      notes: notes
    };
    
    processNewRecord(newData, null, 'OCR (列表)', sheetId, fullRawText, tx);
  });
  
  if (file) {
    const archiveFolder = DriveApp.getFolderById(FOLDER_ID_ARCHIVE);
    file.moveTo(archiveFolder);
    Logger.log(`交易列表截圖 ${file.getName()} 已被成功處理並封存。`);
  }
  
  if (totalExpense > 0) {
    const summaryMessage = `今日 IC 卡交通費總支出為 ${totalExpense} ${currency}。共處理了 ${transactions.length} 筆交易。`;
    sendNotification('IC 卡交易匯總', summaryMessage, 'INFO');
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
    processNewRecord(parsedData, file, source, sheetId, pdfText, null);
  
  } catch (finalProcessingError) {
    Logger.log(`[最終處理階段 Error] 在分析文字或寫入表格時發生錯誤。檔案: ${file.getName()}, 錯誤: ${finalProcessingError.toString()}`);
    handleFailedFile(finalProcessingError, file, sheetId);
  }
}

function processVoice(voiceText, sheetId) {
  try {
    const aiResultText = callGeminiForVoice(voiceText);
    const parsedData = JSON.parse(aiResultText);
    const result = processNewRecord(parsedData, null, '語音', sheetId, voiceText, null);
    return ContentService.createTextOutput(JSON.stringify({ status: result ? 'success' : 'error', data: parsedData })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log(`[processVoice Error] ${error.toString()} for text "${voiceText}"`);
    sendNotification('處理語音失敗', `處理語音文字 "${voiceText}" 時發生錯誤。\n\n錯誤詳情:\n${error.stack}`, 'ERROR');
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: `處理語音時發生錯誤: ${error.message}` })).setMimeType(ContentService.MimeType.JSON);
  }
}

function handleFailedFile(error, file, sheetId) {
    Logger.log(`[handleFailedFile] 開始處理失敗的檔案 ${file ? file.getName() : 'N/A'}。錯誤: ${error.message}`);
    
    const fileName = file ? file.getName() : '未知檔案';
    sendNotification(
        `檔案處理失敗: ${fileName}`,
        `一個檔案在處理過程中發生錯誤，已被移至錯誤資料夾。\n\n錯誤詳情:\n${error.stack}`,
        'ERROR'
    );

    if (file) {
        if (error && error.message && error.message.includes('不是有效的 PDF 檔案')) {
            const mimeType = file.getMimeType();
            if (mimeType === MimeType.JPEG || mimeType === MimeType.PNG) {
                Logger.log(`偵測到偽裝成 PDF 的圖片 (${mimeType})，將轉交給圖片處理函式...`);
                try {
                    processImage(file, null, sheetId);
                    return;
                } catch (imageError) {
                    const newErrorMsg = `[handleFailedFile -> processImage Error] 轉交處理圖片時發生新錯誤: ${imageError.toString()}`;
                    Logger.log(newErrorMsg);
                    sendNotification(
                        `檔案處理失敗 (轉交後): ${fileName}`,
                        `檔案 ${fileName} 在轉交給圖片處理器後，再次發生錯誤。\n\n原始錯誤:\n${error.message}\n\n新錯誤:\n${imageError.stack}`,
                        'ERROR'
                    );
                }
            }
        }
        try {
            const errorFolder = DriveApp.getFolderById(FOLDER_ID_DUPLICATES);
            file.moveTo(errorFolder);
        } catch (moveError) {
            const fatalMsg = `[handleFailedFile Fatal] 連移動檔案至錯誤資料夾都失敗了: ${moveError.toString()}`;
            Logger.log(fatalMsg);
            sendNotification('嚴重錯誤：歸檔失敗', fatalMsg, 'ERROR');
        }
    }
}


// =================================================================================================
// 【V38.0 新增】資料關聯與擴充 (Data Reconciliation & Enrichment)
// =================================================================================================
const SOURCE_TRUST_SCORES = { 'HTML': 10, 'PDF': 8, 'OCR (列表)': 7, 'OCR': 6, '語音': 4 };

function processNewRecord(newData, file, source, sheetId, rawText, metaData) {
  try {
    const sheet = SpreadsheetApp.openById(sheetId).getSheetByName(SHEET_NAME);
    const relatedRecord = findRelatedRecord(newData, sheet, rawText);

    if (relatedRecord) {
      Logger.log(`找到關聯紀錄於第 ${relatedRecord.rowIndex} 列，準備進行智慧合併。`);
      const mergedData = enrichAndMergeData(newData, relatedRecord.data, source);
      sheet.getRange(relatedRecord.rowIndex, 1, 1, mergedData.length).setValues([mergedData]);
      Logger.log(`成功更新第 ${relatedRecord.rowIndex} 列的紀錄。`);
      
      if (file) {
        const archiveFolder = DriveApp.getFolderById(FOLDER_ID_ARCHIVE);
        file.moveTo(archiveFolder);
        Logger.log(`檔案 ${file.getName()} 已被成功處理並封存。`);
      }

    } else {
      Logger.log(`未找到關聯紀錄，將新增一筆紀錄。`);
      const status = (newData.confidence === 'low') ? '需人工確認' : '待確認';
      const fileUrl = file ? file.getUrl() : null;
      writeToSheet(newData, fileUrl, rawText, null, source, sheetId, status, metaData);
      
      if (file && source !== 'OCR (列表)') { // 列表檔案在 processImageAsTransactionList 中統一處理
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

function findRelatedRecord(newData, sheet, newRawText) {
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();

  const COLS = { TIMESTAMP: 0, AMOUNT: 1, INVOICE_NUMBER: 8, RAW_TEXT: 17 };

  if (newData.invoiceNumber) {
    for (let i = 1; i < values.length; i++) {
      if (values[i][COLS.INVOICE_NUMBER] === newData.invoiceNumber) {
        return { rowIndex: i + 1, data: values[i] };
      }
    }
  }

  if (newRawText && newRawText.includes('transaction_type')) {
      return null;
  }

  const newDate = new Date(newData.timestamp);
  const newAmount = parseFloat(newData.amount);

  for (let i = 1; i < values.length; i++) {
    const existingRow = values[i];
    const existingDate = new Date(existingRow[COLS.TIMESTAMP]);
    const existingAmount = parseFloat(existingRow[COLS.AMOUNT]);
    
    if (!existingDate || isNaN(existingAmount)) continue;

    const timeDiff = Math.abs(newDate.getTime() - existingDate.getTime());
    const dayDiff = timeDiff / (1000 * 3600 * 24);
    
    if (dayDiff < 1 && Math.abs(newAmount - existingAmount) < 0.01) {
      const existingRawText = existingRow[COLS.RAW_TEXT];
      if (newRawText && existingRawText) {
        const similarity = 1 - (levenshtein(newRawText, existingRawText) / Math.max(newRawText.length, existingRawText.length));
        if (similarity > 0.85) {
           return { rowIndex: i + 1, data: existingRow };
        }
      } else {
        return { rowIndex: i + 1, data: existingRow };
      }
    }
  }
  
  return null;
}

function enrichAndMergeData(newData, oldRowData, newSource) {
  let mergedRow = [...oldRowData];

  const COLS = { TIMESTAMP: 0, AMOUNT: 1, CURRENCY: 2, CATEGORY: 5, ITEM: 6, INVOICE_NUMBER: 8, REFERENCE_NUMBER: 9, SOURCE: 15, NOTES: 16, RAW_TEXT: 17 };

  const oldSource = mergedRow[COLS.SOURCE] || '未知';
  const newTrust = SOURCE_TRUST_SCORES[newSource.split(' ')[0]] || 0;
  const oldTrust = SOURCE_TRUST_SCORES[oldSource.split(' ')[0]] || 0;

  if (newTrust > oldTrust) {
    if (newData.item) mergedRow[COLS.ITEM] = newData.item;
    if (newData.category) mergedRow[COLS.CATEGORY] = newData.category;
  }

  if (!mergedRow[COLS.INVOICE_NUMBER] && newData.invoiceNumber) {
    mergedRow[COLS.INVOICE_NUMBER] = newData.invoiceNumber;
  }
  if (!mergedRow[COLS.REFERENCE_NUMBER] && newData.referenceNumber) {
    mergedRow[COLS.REFERENCE_NUMBER] = newData.referenceNumber;
  }
  
  const oldNotes = mergedRow[COLS.NOTES] || '';
  const newNotes = newData.notes || '';
  if (newNotes && !oldNotes.includes(newNotes)) {
    mergedRow[COLS.NOTES] = oldNotes ? `${oldNotes}; ${newNotes}` : newNotes;
  }
  
  mergedRow[COLS.SOURCE] = `${oldSource} (+${newSource})`;
  
  return mergedRow;
}


// =================================================================================================
// AI 呼叫函式
// =================================================================================================

function callGeminiForNormalization(messyJsonText) {
  const prompt = `
你是一位專業、嚴謹的數據正規化 AI。你的唯一任務是將一個格式混亂的 JSON 字串，轉換為一個結構與欄位名稱都完全標準化的 JSON 字串。

---
**【最高指導原則】**
1.  **輸出格式**: 你的輸出**必須**是一個單一、合法的 JSON 物件。
2.  **標準欄位名稱**: 你**必須**使用以下指定的、小寫的、蛇形命名的欄位名稱。**嚴禁**使用任何其他自創的欄位名稱。
    * **標準欄位**: \`timestamp\`, \`amount\`, \`currency\`, \`category\`, \`item\`, \`invoiceNumber\`, \`referenceNumber\`, \`notes\`。
3.  **欄位對應**: 請根據以下對應規則，將輸入 JSON 的鍵名映射到標準欄位：
    * \`Date\`, \`TransactionDate\`, \`date\` -> \`timestamp\`
    * \`Vendor\`, \`Store\`, \`Merchant\` -> \`item\`
    * \`Total\`, \`TotalAmount\`, \`Price\` -> \`amount\`
    * \`Remarks\`, \`Memo\` -> \`notes\`
    * 其他相似的鍵名也請比照辦理。
4.  **分類 (category)**:
    * **嚴格規則**: **必須**從以下固定清單中選擇一個最相近的：['食', '衣', '住', '行', '育', '樂', '醫療保險', '內部轉帳', '其他']。
    * **你的任務是分類，不是創造分類。** 請根據輸入 JSON 中的 \`item\` 或 \`Vendor\` 資訊來判斷。如果無法判斷，請**務必**將其歸類為「其他」。
5.  **時間戳 (timestamp)**:
    * **強制合併**: 如果輸入中**同時包含** \`Date\` 和 \`Time\` 兩個欄位，你**必須**將它們合併成最終的 \`timestamp\`。
    * **預設時間**: 只有在 \`Time\` 欄位完全不存在時，才可以使用 \`00:00:00\` 作為時間。
    * **格式**: 最終格式必須是 **\`YYYY-MM-DDTHH:mm:ss\`** 的 ISO 8601 標準格式。
6.  **幣別 (currency)**:
    * **優先級**: 請優先從輸入 JSON 的 \`notes\` 欄位（語音備註）中尋找幣別關鍵字（如「日幣」）。
    * **次要級**: 如果 \`notes\` 中沒有，再從 \`amount\` 或 \`Total\` 等金額欄位的字串中尋找貨幣符號（如 \`¥\`, \`$\`）。
    * **預設值**: 如果都找不到，則預設為 \`TWD\`。
7.  **找不到的欄位**: 如果輸入 JSON 中找不到對應的資訊，請在輸出中將該標準欄位設為 null。

---
**【學習範例】**
[輸入的混亂 JSON 字串]:
'{"Date": "2025/07/02", "Time": "13:22", "Vendor": "FLYING OVEN", "Total": "¥3,550", "notes": "午餐在魔女之谷..."}'

[你的標準化輸出 JSON 字串]:
{
  "timestamp": "2025-07-02T13:22:00",
  "amount": 3550,
  "currency": "JPY",
  "category": "食",
  "item": "FLYING OVEN",
  "invoiceNumber": null,
  "referenceNumber": null,
  "notes": "午餐在魔女之谷..."
}
---
**【你的任務】**
現在，請將以下這個混亂的 JSON 字串，轉換為標準化的 JSON 物件。
[輸入的混亂 JSON 字串]:
${messyJsonText}
`;

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
    throw new Error(`[Normalization] Gemini API HTTP Error: ${responseCode}. Response: ${responseText}`);
  }

  try {
    const jsonResponse = JSON.parse(responseText);
    if (jsonResponse.error) { throw new Error(`[Normalization] Gemini API returned an error: ${jsonResponse.error.message}`); }
    if (!jsonResponse.candidates || !jsonResponse.candidates[0].content.parts[0].text) { throw new Error(`[Normalization] Unexpected Gemini API response structure.`); }
    const normalizedJsonText = jsonResponse.candidates[0].content.parts[0].text;
    JSON.parse(normalizedJsonText);
    return normalizedJsonText;
  } catch (e) {
    Logger.log(`callGeminiForNormalization 解析 JSON 失敗: ${e.toString()}. 原始 AI 回應: ${responseText}`);
    throw new Error(`Failed to process normalization API call: ${e.message}`);
  }
}

function callGeminiForVision(imageBlob, voiceNote) {
  const extractionPrompt = `
你是一位強大的 OCR 資訊提取 AI。你的任務是分析一張收據圖片，並將所有你看到的關鍵資訊提取成一個單一、合法的 JSON 物件。

---
**【指導原則】**
1.  **情境判斷**: 首先，請判斷圖片是「單筆收據」還是「交易列表」(例如 IC 卡的消費紀錄)。
2.  **輸出結構**:
    * **如果是「單筆收據」**: 請回傳一個包含所有你提取出的欄位的 JSON 物件。
    * **如果是「交易列表」**: 請回傳一個包含 \`transactions\` (一個物件陣列) 的 JSON 物件。
3.  **包含原始文字**: 在你輸出的 JSON 物件中，請**務必**包含一個名為 \`rawText\` 的欄位，其值為從圖片中辨識出的所有原始文字。
4.  **交易定性 (僅適用於交易列表)**: 如果是交易列表，請為列表中的每一個物件，增加一個 \`transaction_type\` 欄位，並根據關鍵字（如「增值」、「チャージ」）將其標記為 \`TRANSFER\` 或 \`EXPENSE\`。

---
**【你的任務】**
現在，請處理以下新的圖片與語音備註。請將語音備註的內容，作為單筆收據中的 \`notes\` 或 \`Remarks\` 欄位的值。
[輸入語音備註]: "${voiceNote || '無'}"
`;

  const requestBody = {
    "contents": [{ "parts": [ { "text": extractionPrompt }, { "inline_data": { "mime_type": imageBlob.getContentType(), "data": Utilities.base64Encode(imageBlob.getBytes()) }} ] }],
    "generationConfig": { "response_mime_type": "application/json" }
  };

  const options = { 'method': 'post', 'contentType': 'application/json', 'payload': JSON.stringify(requestBody), 'muteHttpExceptions': true };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
  
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode !== 200) {
    const errorMsg = `[Extraction] Gemini API HTTP Error: ${responseCode}. Response: ${responseText}`;
    sendNotification('Gemini 提取 API 呼叫失敗', errorMsg, 'ERROR');
    throw new Error(errorMsg);
  }

  try {
    const jsonResponse = JSON.parse(responseText);
    if (jsonResponse.error) { throw new Error(`[Extraction] Gemini API returned an error: ${jsonResponse.error.message}`); }
    if (!jsonResponse.candidates || !jsonResponse.candidates[0].content.parts[0].text) { throw new Error(`[Extraction] Unexpected Gemini API response structure.`); }
    
    let fullResponseText = jsonResponse.candidates[0].content.parts[0].text;
    let parsedJson;

    try {
        parsedJson = JSON.parse(fullResponseText);
    } catch (e) {
        Logger.log(`初步 JSON 解析失敗，嘗試進行字串修復。錯誤: ${e.toString()}`);
        const lastBraceIndex = fullResponseText.lastIndexOf('}');
        if (lastBraceIndex !== -1) {
            const potentialJson = fullResponseText.substring(0, lastBraceIndex + 1);
            try {
                parsedJson = JSON.parse(potentialJson);
                Logger.log("成功透過字串修復解析 JSON。");
            } catch (e2) {
                throw new Error(`AI 回應的內容不是有效的 JSON 格式，即使在修復後也是如此: ${e.toString()}`);
            }
        } else {
            throw new Error("AI 回應的內容中找不到有效的 JSON 結構。");
        }
    }
    
    if (parsedJson.transactions && Array.isArray(parsedJson.transactions)) {
        return parsedJson;
    }

    const rawText = parsedJson.rawText || '';
    const metaData = { ...parsedJson };
    delete metaData.rawText;

    const messyJsonText = JSON.stringify(metaData);

    Logger.log(`提取出的原始 JSON: ${messyJsonText}`);
    const cleanJsonText = callGeminiForNormalization(messyJsonText);
    Logger.log(`正規化後的 JSON: ${cleanJsonText}`);
    
    return { text: cleanJsonText, rawText: rawText, metaData: metaData };

  } catch (e) {
    Logger.log(`callGeminiForVision 處理失敗: ${e.toString()}. 原始 AI 回應: ${responseText}`);
    throw new Error(`Failed to process vision API call: ${e.message}`);
  }
}

function callGeminiForPdfText(pdfText, textQuality) {
  const prompt = `
你是一位專業、吹毛求疵的台灣記帳助理。你的任務是從高品質的 PDF 文字中，提取出結構化的記帳資訊。

---
**【最高指導原則】**
1.  **欄位名稱統一**: 你**必須**使用以下指定的、小寫的、蛇形命名的欄位名稱。**嚴禁**使用任何其他自創的欄位名稱。
    * **正確的欄位名稱**: \`timestamp\`, \`amount\`, \`currency\`, \`category\`, \`item\`, \`invoiceNumber\`, \`referenceNumber\`, \`notes\`。
2.  **思維鏈**: 在決定最終的 \`timestamp\` 前，你必須在內心完成以下思考：
    * **找出所有日期**：掃描文件，列出所有看起來像日期的文字。
    * **評估優先級**：「付款日期 (Payment Date)」 > 「開立日期 (Issue Date)」。
    * **做出決策**：選擇優先級最高的日期作為 \`timestamp\`。

---
**【其他重要規則】**
1.  **timestamp**: 將選擇的日期，格式化為 **\`YYYY-MM-DDTHH:mm:ss\`** 的 ISO 8601 標準格式。如果找不到確切時間，則使用 \`00:00:00\`。
2.  **category**:
    * **嚴格規則**: **必須**從以下固定清單中選擇一個最相近的：['食', '衣', '住', '行', '育', '樂', '醫療保險', '其他']。
    * **你的任務是分類，不是創造分類。**
3.  **格式要求**: 務必、只能回傳一個單一的 JSON 物件。找不到的欄位請填入 null。

---
**【學習範例】**
[輸入文字]: "學校名稱: 臺北市松山區民族國民\\n繳款金額: 新台幣4400元\\n交易日期: 2025/07/05 16:09:48"
[輸出 JSON]:
{
  "timestamp": "2025-07-05T16:09:48",
  "amount": 4400,
  "currency": "TWD",
  "category": "育",
  "item": "臺北市松山區民族國民 學雜費",
  "invoiceNumber": null,
  "referenceNumber": null,
  "notes": "信用卡繳費證明單"
}
---
**【你的任務】**
現在，請處理以下新的文字，並應用所有規則，回傳一個 JSON 物件。
[高品質 PDF 文字內容開始]
${pdfText}
[高品質 PDF 文字內容結束]`;

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
    JSON.parse(aiResultText);
    return aiResultText;

  } catch (e) {
    Logger.log(`callGeminiForPdfText 解析 JSON 失敗: ${e.toString()}. 原始 AI 回應: ${responseText}`);
    throw new Error(`Failed to process PDF text via API: ${e.message}`);
  }
}

function callGeminiForVoice(voiceText) {
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  const prompt = `
你是一位專業、嚴謹的台灣記帳助理。你的任務是從一句日常的中文對話中，提取出結構化的記帳資訊。

---
**【最高指導原則】**
1.  **欄位名稱統一**: 你**必須**使用以下指定的、小寫的、蛇形命名的欄位名稱。**嚴禁**使用任何其他自創的欄位名稱。
    * **正確的欄位名稱**: \`timestamp\`, \`amount\`, \`currency\`, \`category\`, \`item\`, \`notes\`。

---
**【其他重要規則】**
1.  **timestamp**:
    * **解析**: 請盡力從句子中解析日期與時間。例如「昨天早上十點」、「剛剛」、「中午」、「5/10 晚上八點」。
    * **預設**: 如果句子中完全沒有提到日期，才使用今天的日期 \`${today}\`。如果沒有提到時間，則使用 \`00:00:00\`。
    * **格式**: 最終格式必須是 **\`YYYY-MM-DDTHH:mm:ss\`** 的 ISO 8601 標準格式。
2.  **category**:
    * **嚴格規則**: **必須**從以下固定清單中選擇一個最相近的：['食', '衣', '住', '行', '育', '樂', '醫療保險', '其他']。
    * **你的任務是分類，不是創造分類。**
    * **特例說明**: 「醫療保險」專指人身的醫療或旅遊平安險。如果是汽機車的強制險或相關保險，應歸類為「行」。
    * **最終防線**: 如果真的無法判斷，請**務必**將其歸類為「其他」。
3.  **notes**: 將原始的輸入句子完整地放入此欄位。
4.  **格式要求**: 務必、只能回傳一個單一的 JSON 物件。

---
**【你的任務】**
現在，請處理以下新的文字，並嚴格遵循上述所有規則，回傳一個 JSON 物件。
[輸入文字]:
${voiceText}
`;

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
    JSON.parse(aiResultText);
    return aiResultText;
  } catch (e) {
      Logger.log(`callGeminiForVoice 解析 JSON 失敗: ${e.toString()}. 原始 AI 回應: ${responseText}`);
      throw new Error(`Failed to process voice API call: ${e.message}`);
  }
}
function callDocumentAIAPI(blob) {
  const url = `https://us-documentai.googleapis.com/v1/projects/${GCP_PROJECT_ID}/locations/us/processors/${DOCUMENT_AI_PROCESSOR_ID}:process`;
  
  const requestBody = {
    "raw_document": { "content": Utilities.base64Encode(blob.getBytes()), "mime_type": blob.getContentType() }
  };

  const options = {
    'method' : 'post', 'contentType': 'application/json', 'headers': { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() },
    'payload' : JSON.stringify(requestBody), 'muteHttpExceptions': true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode !== 200) { throw new Error(`Document AI API HTTP Error: ${responseCode}. Response: ${responseText}`); }
  const jsonResponse = JSON.parse(responseText);
  if (!jsonResponse.document || !jsonResponse.document.text) { throw new Error('Document AI API did not return valid text.'); }
  return jsonResponse.document.text;
}


// =================================================================================================
// 表格寫入函式
// =================================================================================================
function writeToSheet(data, fileUrl, rawText, translation, source, sheetId, customStatus = '待確認', metaData = null) {
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
    data.amount || null, data.currency || 'TWD', rate, amountTWD || null,
    data.category || '其他', data.item || null, '私人', data.invoiceNumber || null,
    data.referenceNumber || null, null, null, null, fileUrl, customStatus, source,
    data.notes || null, rawText, translation, metaData ? JSON.stringify(metaData) : null
  ];
  sheet.appendRow(row);
  return true;
}

function writeToSheetFromEmail(data, sheetId, source = '電子發票') {
  if (!data || typeof data.invoiceNumber === 'undefined') {
    Logger.log(`[writeToSheetFromEmail Warning] 傳入的 data 無效或缺少 invoiceNumber。`);
    return false;
  }

  const cleanSheetId = sanitizeSheetId(sheetId);
  const sheet = SpreadsheetApp.openById(cleanSheetId).getSheetByName(SHEET_NAME);
  const dataRange = sheet.getRange("I2:I" + sheet.getLastRow());
  const existingInvoiceNumbers = dataRange.getValues().flat();

  if (existingInvoiceNumbers.includes(data.invoiceNumber)) {
    return false;
  }

  const row = [
    data.timestamp, data.amount, data.currency, 1, data.amount,
    '其他', data.item, '私人', data.invoiceNumber, null, null, null, null, null,
    '待確認', source, `由 ${data.item} 開立`, null, null, null
  ];
  sheet.appendRow(row);
  return true;
}

function writeToSheetFromVoice(data, sheetId, originalVoiceText) {
  processNewRecord(data, null, '語音', sheetId, originalVoiceText, null);
  return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: data })).setMimeType(ContentService.MimeType.JSON);
}

// =================================================================================================
// 輔助函式
// =================================================================================================
function isDuplicate(data, rawText, sheetId) {
  const cleanSheetId = sanitizeSheetId(sheetId);
  const sheet = SpreadsheetApp.openById(cleanSheetId).getSheetByName(SHEET_NAME);
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  
  const INVOICE_COL = 8;
  const REF_NO_COL = 9;

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
  return false;
}

function extractPdfText(file) {
  try {
    const pdfBlob = file.getBlob();
    const text = pdfBlob.getDataAsString('UTF-8');
    if (!text.includes('%PDF')) {
      throw new Error(`檔案 ${file.getName()} 不是有效的 PDF 檔案。`);
    }
    return text;
  } catch (e) {
    throw e;
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
  if (cachedRate) return parseFloat(cachedRate);
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

