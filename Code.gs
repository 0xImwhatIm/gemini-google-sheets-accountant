// =================================================================================================
// 專案名稱：智慧記帳 GEM (Gemini AI Accountant)
// 版本：V46.0 - IOU 群組拆分引擎 (IOU Group Splitting Engine)
// 作者：0ximwhatim & Gemini
// 最後更新：2025-07-21
// 說明：此版本為「代墊款追蹤器」的第三階段開發，實現了核心的群組拆帳功能。
//      - [重大強化] callGeminiForIou 的 Prompt，新增了對「群組拆帳」動作的判斷 (CREATE_GROUP)。
//      - [重大強化] processIou 函式，新增了處理 CREATE_GROUP 動作的邏輯分支。
//      - [新增] handleGroupSplit 函式，用於計算均分金額並觸發寫入多筆帳務。
//      - [改造] writeToIouLedger 函式，使其能夠處理多筆 debts 的寫入。
// =================================================================================================

// =================================================================================================
// 【使用者設定區】
// =================================================================================================
const MAIN_LEDGER_ID = 'YOUR_GOOGLE_SHEET_ID_HERE'; // 主帳本的 Google Sheet ID
const SHEET_NAME = 'All Records';
const EMAIL_RULES_SHEET_NAME = 'EmailRules';
const SETTINGS_SHEET_NAME = 'Settings';
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE';
const GCP_PROJECT_ID = 'YOUR_GCP_PROJECT_ID_HERE';
const DOCUMENT_AI_PROCESSOR_ID = 'YOUR_DOCUMENT_AI_PROCESSOR_ID_HERE';
const FOLDER_ID_TO_PROCESS = 'YOUR_GOOGLE_DRIVE_FOLDER_ID_TO_PROCESS';
const FOLDER_ID_ARCHIVE = 'YOUR_GOOGLE_DRIVE_FOLDER_ID_FOR_ARCHIVE';
const FOLDER_ID_DUPLICATES = 'YOUR_GOOGLE_DRIVE_FOLDER_ID_FOR_DUPLICATES';
const BATCH_SIZE = 5;

const IOU_EVENTS_SHEET_NAME = 'Events';
const IOU_PARTICIPANTS_SHEET_NAME = 'Participants';
const IOU_DEBTS_SHEET_NAME = 'Debts';


// =================================================================================================
// 【V44.0 核心】多入口路由 (已更新)
// =================================================================================================
function doGet(e) {
  // ... (此處程式碼與 V43.0 相同，為節省篇幅省略)
}

function doPost(e) {
  const endpoint = e.parameter.endpoint;

  if (endpoint === 'image') {
    return doPost_Image(e);
  } else if (endpoint === 'voice') {
    return doPost_Voice(e);
  } else if (endpoint === 'pdf') {
    return doPost_Pdf(e);
  } else if (endpoint === 'iou') {
    return doPost_Iou(e);
  } else {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: '無效的 API 端點。請在 URL 中指定 ?endpoint=image, ?endpoint=voice, ?endpoint=pdf, 或 ?endpoint=iou'
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// =================================================================================================
// 【V44.0 新增】IOU 處理入口
// =================================================================================================
function doPost_Iou(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const text = params.text;
    
    if (!text) throw new Error("缺少 text 參數。");

    return processIou(text);
  } catch (error) {
    Logger.log(`[doPost_Iou Error] ${error.toString()}`);
    sendNotification('doPost_Iou 執行失敗', `處理代墊款時發生錯誤: ${error.stack}`, 'ERROR');
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: `處理代墊款時發生錯誤: ${error.message}` })).setMimeType(ContentService.MimeType.JSON);
  }
}

// --- V46.0 強化 START ---
function processIou(text) {
  try {
    const aiResultText = callGeminiForIou(text);
    const parsedData = JSON.parse(aiResultText);

    if (!parsedData || !parsedData.action) {
      throw new Error("AI未能解析出有效的代墊款動作。");
    }

    let result;
    if (parsedData.action === 'CREATE') {
      Logger.log(`IOU Action: CREATE. Data: ${JSON.stringify(parsedData)}`);
      // 將單人 CREATE 轉換為 handleGroupSplit 的格式以統一處理
      const groupData = {
        totalAmount: parsedData.amount,
        item: parsedData.item,
        participants: [parsedData.counterparty],
        splitType: 'TOTAL', // 特殊類型，表示此人承擔全部
        originalText: text
      };
      result = handleGroupSplit(groupData);
    } else if (parsedData.action === 'SETTLE') {
      Logger.log(`IOU Action: SETTLE. Data: ${JSON.stringify(parsedData)}`);
      result = handleSettlement(parsedData);
    } else if (parsedData.action === 'CREATE_GROUP') {
      Logger.log(`IOU Action: CREATE_GROUP. Data: ${JSON.stringify(parsedData)}`);
      parsedData.originalText = text;
      result = handleGroupSplit(parsedData);
    } else {
      throw new Error(`未知的 IOU 動作: ${parsedData.action}`);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: result ? 'success' : 'error', data: parsedData })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log(`[processIou Error] ${error.toString()} for text "${text}"`);
    sendNotification('處理代墊款失敗', `處理文字 "${text}" 時發生錯誤。\n\n錯誤詳情:\n${error.stack}`, 'ERROR');
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: `處理代墊款時發生錯誤: ${error.message}` })).setMimeType(ContentService.MimeType.JSON);
  }
}
// --- V46.0 強化 END ---


// =================================================================================================
// 【V46.0 新增】IOU 群組拆分處理函式
// =================================================================================================
function handleGroupSplit(data) {
  try {
    const me = "我";
    const totalAmount = data.totalAmount;
    const participants = data.participants;
    
    if (!totalAmount || !participants || participants.length === 0) {
      throw new Error("群組拆分資訊不完整。");
    }

    let debts = [];
    if (data.splitType === 'EVENLY') {
      const totalPeople = participants.length + 1; // 包含付款人「我」
      const amountPerPerson = totalAmount / totalPeople;
      
      participants.forEach(person => {
        debts.push({
          debtor: person,
          amount: amountPerPerson,
          item: data.item
        });
      });
    } else if (data.splitType === 'TOTAL') {
      // 這是為了相容單人 CREATE 的情況
      debts.push({
        debtor: participants[0],
        amount: totalAmount,
        item: data.item
      });
    } else {
      throw new Error(`不支援的拆分類型: ${data.splitType}`);
    }
    
    return writeToIouLedger(data.originalText, totalAmount, me, debts);

  } catch (e) {
    Logger.log(`[handleGroupSplit Error] ${e.toString()}`);
    sendNotification('IOU 群組拆分失敗', `處理群組拆分時發生錯誤。\n\n錯誤詳情:\n${e.stack}`, 'ERROR');
    return false;
  }
}


// =================================================================================================
// 【V45.0 新增】IOU 結算處理函式
// =================================================================================================
function handleSettlement(data) {
  try {
    const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
    const debtsSheet = ss.getSheetByName(IOU_DEBTS_SHEET_NAME);
    if (!debtsSheet) throw new Error(`找不到工作表: ${IOU_DEBTS_SHEET_NAME}`);

    const unsettledDebt = findUnsettledDebt(debtsSheet, data.counterparty, data.amount);

    if (!unsettledDebt) {
      const message = `找不到與「${data.counterparty}」相關的未結清款項。請檢查對方名稱或金額是否正確。`;
      Logger.log(message);
      sendNotification('IOU 結算失敗', message, 'INFO');
      return false;
    }

    Logger.log(`找到舊帳於第 ${unsettledDebt.rowIndex} 列，準備將其結清...`);
    
    const statusColIndex = unsettledDebt.header.indexOf('Status') + 1;
    const settlementDateColIndex = unsettledDebt.header.indexOf('SettlementDate') + 1;
    
    if (statusColIndex > 0) {
      debtsSheet.getRange(unsettledDebt.rowIndex, statusColIndex).setValue('Settled');
    }
    if (settlementDateColIndex > 0) {
      debtsSheet.getRange(unsettledDebt.rowIndex, settlementDateColIndex).setValue(new Date());
    }
    
    Logger.log(`成功結清第 ${unsettledDebt.rowIndex} 列的款項。`);
    return true;

  } catch (e) {
    Logger.log(`[handleSettlement Error] ${e.toString()}`);
    sendNotification('IOU 結算失敗', `結算與 ${data.counterparty} 的款項時發生錯誤。\n\n錯誤詳情:\n${e.stack}`, 'ERROR');
    return false;
  }
}

// --- V45.5 最終修正 ---
function findUnsettledDebt(sheet, counterparty, amount) {
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  if (values.length < 2) return null;

  const header = values[0];
  const me = "我";

  const debtorColIndex = header.indexOf('Debtor');
  const payerColIndex = header.indexOf('Payer');
  const amountColIndex = header.indexOf('Amount');
  const statusColIndex = header.indexOf('Status');

  const normalizedCounterparty = normalizeName(counterparty);

  for (let i = values.length - 1; i > 0; i--) {
    const row = values[i];
    const status = row[statusColIndex];
    
    if (status === 'Unsettled') {
      const debtor = row[debtorColIndex];
      const payer = row[payerColIndex];
      
      let sheetCounterparty = '';
      if (payer === me && debtor !== me) {
        sheetCounterparty = debtor;
      } else if (debtor === me && payer !== me) {
        sheetCounterparty = payer;
      } else {
        continue;
      }

      const normalizedSheetCounterparty = normalizeName(sheetCounterparty);
      
      if (normalizedSheetCounterparty === normalizedCounterparty) {
        if (amount) {
          const debtAmount = parseFloat(row[amountColIndex]);
          if (Math.abs(debtAmount - amount) < 0.01) {
            return { rowIndex: i + 1, data: row, header: header };
          }
        } else {
          return { rowIndex: i + 1, data: row, header: header };
        }
      }
    }
  }
  return null;
}


// =================================================================================================
// 【V46.0 強化】IOU 專用 AI 呼叫函式
// =================================================================================================
function callGeminiForIou(text) {
  const prompt = `
你是一位專業、聰明的記帳助理，專門處理日常的「代墊款項」關係。你的任務是從一句話中，判斷其意圖，並提取出結構化的資訊。

---
**【最高指導原則】**
1.  **意圖判斷 (Action Detection)**: 首先，你必須判斷這句話的「動作」。動作有三種：
    * \`CREATE\`: 建立一筆**單人**的代墊款。特徵：只有一個代墊對象。
    * \`CREATE_GROUP\`: 建立一筆**多人**的代墊款。特徵：提到多個人名、或「大家」、「我們」等群體詞彙，且通常包含「均分」、「拆帳」等關鍵詞。
    * \`SETTLE\`: 結清一筆已經存在的代墊款。關鍵詞：「還我錢」、「把錢給我了」、「付清了」。

2.  **欄位名稱統一**: 你**必須**使用以下指定的欄位名稱，回傳一個單一、合法的 JSON 物件。

---
**【針對不同 Action 的輸出格式】**

**1. 如果 Action 是 "CREATE" (單人):**
   * \`action\`: "CREATE"
   * \`type\`: "Owes_Me" (別人欠我) 或 "I_Owe" (我欠別人)。
   * \`counterparty\`: **(字串)** 交易對方的名字。
   * \`item\`: **(字串)** 發生代墊的具體事由。
   * \`amount\`: **(數字)** 金額。
   * \`currency\`: 幣別，預設為 "TWD"。

**2. 如果 Action 是 "CREATE_GROUP" (多人):**
   * \`action\`: "CREATE_GROUP"
   * \`totalAmount\`: **(數字)** 總金額。
   * \`item\`: **(字串)** 發生代墊的具體事由。
   * \`participants\`: **(陣列)** 所有**除了付款人之外**的參與者名字。
   * \`splitType\`: **(字串)** 目前只支援 "EVENLY" (均分)。

**3. 如果 Action 是 "SETTLE" (結清):**
   * \`action\`: "SETTLE"
   * \`counterparty\`: **(字串)** 還款的人的名字。
   * \`amount\`: **(數字/null)** 金額，如果句子中沒提到具體金額，此欄位應為 null。
   * \`currency\`: 幣別，預設為 "TWD"。

---
**【學習範例】**

[輸入文字 1]: "我幫小明代墊了 250 元的電影票"
[輸出 JSON 1]:
{
  "action": "CREATE",
  "type": "Owes_Me",
  "counterparty": "小明",
  "item": "電影票",
  "amount": 250,
  "currency": "TWD"
}

[輸入文字 2]: "我幫小明、小華、小李付了 1200 元的午餐，大家均分"
[輸出 JSON 2]:
{
  "action": "CREATE_GROUP",
  "totalAmount": 1200,
  "item": "午餐",
  "participants": ["小明", "小華", "小李"],
  "splitType": "EVENLY"
}

[輸入文字 3]: "黃小弟以及猴子兄弟把晚餐錢還我了"
[輸出 JSON 3]:
{
  "action": "SETTLE",
  "counterparty": "黃小弟以及猴子兄弟",
  "amount": null,
  "currency": "TWD"
}
---
**【你的任務】**
現在，請處理以下這句新的代墊款描述，並嚴格遵循上述所有規則，回傳一個 JSON 物件。
[輸入文字]:
${text}
`;
  // ... (此處呼叫 Gemini API 的程式碼與 V45.5 相同，但使用上述更新的 prompt)
  const requestBody = { "contents": [{ "parts":[{ "text": prompt }] }], "generationConfig": { "response_mime_type": "application/json" } };
  const options = { 'method' : 'post', 'contentType': 'application/json', 'payload' : JSON.stringify(requestBody), 'muteHttpExceptions': true };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
  
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode !== 200) {
    throw new Error(`[IOU] Gemini API HTTP Error: ${responseCode}. Response: ${responseText}`);
  }

  try {
    const jsonResponse = JSON.parse(responseText);
    if (jsonResponse.error) { throw new Error(`[IOU] Gemini API returned an error: ${jsonResponse.error.message}`); }
    if (!jsonResponse.candidates || !jsonResponse.candidates[0].content.parts[0].text) { throw new Error(`[IOU] Unexpected Gemini API response structure.`); }
    const aiResultText = jsonResponse.candidates[0].content.parts[0].text;
    JSON.parse(aiResultText); // 驗證回傳的是否為合法 JSON
    return aiResultText;
  } catch (e) {
    Logger.log(`callGeminiForIou 解析 JSON 失敗: ${e.toString()}. 原始 AI 回應: ${responseText}`);
    throw new Error(`Failed to process IOU API call: ${e.message}`);
  }
}

// =================================================================================================
// 【V46.0 改造】IOU 專用表格寫入函式
// =================================================================================================
function writeToIouLedger(originalText, totalAmount, payer, debts) {
  try {
    const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
    const eventsSheet = ss.getSheetByName(IOU_EVENTS_SHEET_NAME);
    const participantsSheet = ss.getSheetByName(IOU_PARTICIPANTS_SHEET_NAME);
    const debtsSheet = ss.getSheetByName(IOU_DEBTS_SHEET_NAME);

    if (!eventsSheet || !participantsSheet || !debtsSheet) {
      throw new Error(`找不到必要的 IOU 工作表: Events, Participants, 或 Debts。`);
    }

    const eventId = `EVT-${new Date().getTime()}-${Math.random().toString(36).substr(2, 5)}`;
    const now = new Date();

    // 1. 寫入 Events 表
    if (eventsSheet.getLastRow() === 0) {
      eventsSheet.appendRow(['EventID', 'EventName', 'TotalAmount', 'EventDate', 'Notes']);
    }
    eventsSheet.appendRow([eventId, originalText, totalAmount, now, originalText]);
    
    // 2. 寫入 Participants 表
    if (participantsSheet.getLastRow() === 0) {
      participantsSheet.appendRow(['ParticipantID', 'EventID', 'PersonName', 'PaidAmount']);
    }
    const participantId = `PTP-${new Date().getTime()}-${Math.random().toString(36).substr(2, 5)}`;
    participantsSheet.appendRow([participantId, eventId, payer, totalAmount]);
    
    // 3. 寫入多筆 Debts 表
    if (debtsSheet.getLastRow() === 0) {
      debtsSheet.appendRow(['DebtID', 'EventID', 'Payer', 'Debtor', 'Amount', 'ItemDetail', 'Status', 'SettlementDate']);
    }
    
    let rowsToAdd = [];
    debts.forEach(debt => {
      const debtId = `DBT-${new Date().getTime()}-${Math.random().toString(36).substr(2, 5)}`;
      rowsToAdd.push([debtId, eventId, payer, debt.debtor, debt.amount, debt.item, 'Unsettled', '']);
    });

    if (rowsToAdd.length > 0) {
      debtsSheet.getRange(debtsSheet.getLastRow() + 1, 1, rowsToAdd.length, rowsToAdd[0].length).setValues(rowsToAdd);
    }
    
    return true;
  } catch (e) {
    Logger.log(`[writeToIouLedger Error] ${e.toString()}`);
    sendNotification('IOU 寫入表格失敗', `寫入 IOU 相關工作表時發生錯誤。\n\n錯誤詳情:\n${e.stack}`, 'ERROR');
    return false;
  }
}


// =================================================================================================
// 既有函式庫 (為節省篇幅，此處僅列出函式名稱，內容與 V45.5 相同)
// =================================================================================================
function doPost_Image(e) { /* ... */ }
function doPost_Pdf(e) { /* ... */ }
function doPost_Voice(e) { /* ... */ }
function getNotificationRules() { /* ... */ }
function sendNotification(title, message, severity) { /* ... */ }
function getEmailProcessingRulesFromSheet() { /* ... */ }
function processAutomatedEmails() { /* ... */ }
function checkReceiptsFolder() { /* ... */ }
function processImage(file, optionalVoiceNote, sheetId) { /* ... */ }
function processImageAsTransactionList(transactions, file, optionalVoiceNote, sheetId, fullRawText) { /* ... */ }
function processPdf(file, sheetId) { /* ... */ }
function processVoice(voiceText, sheetId) { /* ... */ }
function handleFailedFile(error, file, sheetId) { /* ... */ }
const SOURCE_TRUST_SCORES = { /* ... */ };
function processNewRecord(newData, file, source, sheetId, rawText, metaData) { /* ... */ }
function findRelatedRecord(newData, sheet, newRawText) { /* ... */ }
function enrichAndMergeData(newData, oldRowData, newSource) { /* ... */ }
function callGeminiForNormalization(inputText, messageDate) { /* ... */ }
function callGeminiForVision(imageBlob, voiceNote) { /* ... */ }
function callGeminiForPdfText(pdfText, textQuality) { /* ... */ }
function callGeminiForVoice(voiceText) { /* ... */ }
function callDocumentAIAPI(blob) { /* ... */ }
function writeToSheet(data, fileUrl, rawText, translation, source, sheetId, customStatus = '待確認', metaData = null) { /* ... */ }
function writeToSheetFromEmail(data, sheetId, source = '電子發票') { /* ... */ }
function writeToSheetFromVoice(data, sheetId, originalVoiceText) { /* ... */ }
function isDuplicate(data, rawText, sheetId) { /* ... */ }
function extractPdfText(file) { /* ... */ }
function assessTextQuality(text) { /* ... */ }
function sanitizeSheetId(idString) { /* ... */ }
function getExchangeRate(currency) { /* ... */ }
function normalizeName(name) {
  if (!name || typeof name !== 'string') return '';
  return name.replace(/以及|及|和|與|還有| /g, '');
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
function parseInvoiceEmail(htmlBody) { /* ... */ }
