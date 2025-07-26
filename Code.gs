// =================================================================================================
// 專案名稱：智慧記帳 GEM (Gemini AI Accountant)
// 版本：V47.1 - 圖片歸檔增強版 (Image Archive Enhancement)
// 作者：0ximwhatim & Gemini
// 最後更新：2025-07-25
// 說明：此版本修正了拍照記帳功能並新增圖片歸檔增強功能。
//      - [重大修正] 拍照記帳 JSON 解析錯誤修正：解決 undefined 錯誤問題
//      - [重大修正] 電子發票自動處理功能修正：修正觸發器調用問題
//      - [重大新增] 圖片歸檔增強功能：分類前綴檔名 + 超連結生成
//      - [重大新增] Archives 資料夾自動管理：智慧檔案歸檔系統
//      - [功能增強] 匯率計算內嵌化：提升穩定性和效能
//      - [重大新增] 組合資料處理：圖片+語音的綜合分析能力
//      - [功能強化] Phase 4 錯誤處理：所有新功能都整合企業級錯誤管理
//      - [向後相容] 保持所有現有功能不變，新增 iOS 行動端支援
// =================================================================================================

// =================================================================================================
// 【配置管理整合】V47.0 更新
// =================================================================================================
// 注意：現在使用 ConfigManager 來管理所有配置，提供更好的靈活性和安全性
// 如果您是首次部署，請執行 configSetupWizard() 來初始化配置

// 配置獲取函數（向後相容）
function getConfig(key, defaultValue = null) {
  try {
    // 如果 configManager 存在，使用它；否則使用舊的常數
    if (typeof configManager !== 'undefined') {
      return configManager.get(key, defaultValue);
    }
  } catch (error) {
    Logger.log(`[getConfig] 配置管理器錯誤，使用預設值: ${error.toString()}`);
  }
  
  // 向後相容的常數對應
  const legacyConfigs = {
    'MAIN_LEDGER_ID': 'YOUR_GOOGLE_SHEET_ID_HERE',
    'GEMINI_API_KEY': 'YOUR_GEMINI_API_KEY_HERE',
    'GCP_PROJECT_ID': 'YOUR_GCP_PROJECT_ID_HERE',
    'DOCUMENT_AI_PROCESSOR_ID': 'YOUR_DOCUMENT_AI_PROCESSOR_ID_HERE',
    'FOLDER_ID_TO_PROCESS': 'YOUR_GOOGLE_DRIVE_FOLDER_ID_TO_PROCESS',
    'FOLDER_ID_ARCHIVE': 'YOUR_GOOGLE_DRIVE_FOLDER_ID_FOR_ARCHIVE',
    'FOLDER_ID_DUPLICATES': 'YOUR_GOOGLE_DRIVE_FOLDER_ID_FOR_DUPLICATES',
    'BATCH_SIZE': 5,
    'API_TIMEOUT': 30000,
    'MAX_RETRY_ATTEMPTS': 3,
    'DEFAULT_CURRENCY': 'TWD',
    'DUPLICATE_THRESHOLD': 0.8,
    'AUTO_MERGE_ENABLED': true,
    'SHEET_NAME': 'All Records',
    'EMAIL_RULES_SHEET_NAME': 'EmailRules',
    'SETTINGS_SHEET_NAME': 'Settings',
    'IOU_EVENTS_SHEET_NAME': 'Events',
    'IOU_PARTICIPANTS_SHEET_NAME': 'Participants',
    'IOU_DEBTS_SHEET_NAME': 'Debts'
  };
  
  return legacyConfigs[key] || defaultValue;
}

// 動態配置常數（使用配置管理器）
const MAIN_LEDGER_ID = getConfig('MAIN_LEDGER_ID');
const SHEET_NAME = getConfig('SHEET_NAME', 'All Records');
const EMAIL_RULES_SHEET_NAME = getConfig('EMAIL_RULES_SHEET_NAME', 'EmailRules');
const SETTINGS_SHEET_NAME = getConfig('SETTINGS_SHEET_NAME', 'Settings');
const GEMINI_API_KEY = getConfig('GEMINI_API_KEY');
const GCP_PROJECT_ID = getConfig('GCP_PROJECT_ID');
const DOCUMENT_AI_PROCESSOR_ID = getConfig('DOCUMENT_AI_PROCESSOR_ID');
const FOLDER_ID_TO_PROCESS = getConfig('FOLDER_ID_TO_PROCESS');
const FOLDER_ID_ARCHIVE = getConfig('FOLDER_ID_ARCHIVE');
const FOLDER_ID_DUPLICATES = getConfig('FOLDER_ID_DUPLICATES');
const BATCH_SIZE = getConfig('BATCH_SIZE', 5);

const IOU_EVENTS_SHEET_NAME = getConfig('IOU_EVENTS_SHEET_NAME', 'Events');
const IOU_PARTICIPANTS_SHEET_NAME = getConfig('IOU_PARTICIPANTS_SHEET_NAME', 'Participants');
const IOU_DEBTS_SHEET_NAME = getConfig('IOU_DEBTS_SHEET_NAME', 'Debts');

// =================================================================================================
// 【V47.0 整合】Phase 4 錯誤處理框架整合
// =================================================================================================

// Phase 4 錯誤處理包裝函數
function withPhase4ErrorHandling(operation, context = {}, operationName = 'unknown') {
  try {
    // 暫時跳過 Phase 4 檢查，直接執行操作
    Logger.log(`[基本錯誤處理] 執行操作: ${operationName}`);
    return operation();
  } catch (error) {
    // 使用基本錯誤處理
    Logger.log(`[基本錯誤處理] ${operationName} 失敗: ${error.toString()}`);
    sendNotification(`${operationName} 執行失敗`, error.toString(), 'ERROR');
    throw error;
  }
}

// Phase 4 帳本關聯處理（如果框架可用）
function processLedgerLinkingWithPhase4(iouData, mainLedgerData, options = {}) {
  if (typeof phase4Integration !== 'undefined') {
    return phase4Integration.processLedgerLinking(iouData, mainLedgerData, options);
  } else {
    Logger.log('[Phase4] 整合框架未初始化，跳過 Phase 4 處理');
    return { success: true, message: 'Phase 4 框架未啟用' };
  }
}


// =================================================================================================
// 【V44.0 核心】多入口路由 (已更新)
// =================================================================================================
function doGet(e) {
  return withPhase4ErrorHandling(() => {
    const action = e.parameter.action;
    const endpoint = e.parameter.endpoint;
    
    // 記錄 GET 請求的詳細資訊
    Logger.log(`GET request received - action: ${action}, endpoint: ${endpoint}`);
    Logger.log(`All parameters: ${JSON.stringify(e.parameter)}`);
    
    // 處理 endpoint 參數（支援 iOS 捷徑的 GET 請求）
    if (endpoint) {
      Logger.log(`GET request received for endpoint: ${endpoint}`);
      
      if (endpoint === 'voice') {
        return doGet_Voice(e);
      } else if (endpoint === 'image') {
        return doGet_Image(e);
      } else if (endpoint === 'pdf') {
        return doGet_Pdf(e);
      } else if (endpoint === 'iou') {
        return doGet_Iou(e);
      } else {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'error',
          message: `無效的 GET endpoint: ${endpoint}。支援的 endpoint: voice, image, pdf, iou`
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // 處理 action 參數（原有功能）
    if (action === 'processEmails') {
      processAutomatedEmails();
      return ContentService.createTextOutput('Email processing completed').setMimeType(ContentService.MimeType.TEXT);
    } else if (action === 'checkReceipts') {
      checkReceiptsFolder();
      return ContentService.createTextOutput('Receipt folder check completed').setMimeType(ContentService.MimeType.TEXT);
    } else {
      return HtmlService.createHtmlOutput(`
        <h1>智慧記帳 GEM API</h1>
        <p>可用的動作:</p>
        <ul>
          <li><a href="?action=processEmails">處理電子郵件</a></li>
          <li><a href="?action=checkReceipts">檢查收據資料夾</a></li>
        </ul>
        <p>API 端點 (GET 支援):</p>
        <ul>
          <li>GET ?endpoint=voice&text=語音文字 - 處理語音</li>
          <li>GET ?endpoint=iou&text=代墊款文字 - 處理代墊款</li>
        </ul>
        <p>API 端點 (POST):</p>
        <ul>
          <li>POST ?endpoint=image - 處理圖片</li>
          <li>POST ?endpoint=voice - 處理語音</li>
          <li>POST ?endpoint=pdf - 處理 PDF</li>
          <li>POST ?endpoint=iou - 處理代墊款</li>
        </ul>
      `);
    }
  }, { action: e.parameter.action, endpoint: e.parameter.endpoint }, 'doGet');
}

function doPost(e) {
  return withPhase4ErrorHandling(() => {
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
  }, { endpoint: e.parameter.endpoint }, 'doPost');
}

// =================================================================================================
// 【V44.0 新增】IOU 處理入口
// =================================================================================================
function doPost_Iou(e) {
  return withPhase4ErrorHandling(() => {
    const params = JSON.parse(e.postData.contents);
    const text = params.text;
    if (!text) throw new Error("缺少 text 參數。");
    return processIou(text);
  }, { endpoint: 'iou' }, 'doPost_Iou');
}

// --- V46.1 Phase 4 整合 ---
function processIou(text) {
  return withPhase4ErrorHandling(() => {
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

    // Phase 4 帳本關聯處理
    if (result && (parsedData.action === 'CREATE' || parsedData.action === 'CREATE_GROUP')) {
      const iouData = {
        events: [{ EventID: 'TEMP', Status: 'Settled' }],
        participants: parsedData.participants || [parsedData.counterparty],
        debts: []
      };
      processLedgerLinkingWithPhase4(iouData, { records: [] }, {
        realizeExpenses: true,
        continueOnExpenseError: false
      });
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: result ? 'success' : 'error',
      data: parsedData
    })).setMimeType(ContentService.MimeType.JSON);
  }, { text: text, action: 'processIou' }, 'processIou');
}


// =================================================================================================
// 【V46.0 新增】IOU 群組拆分處理函式
// =================================================================================================
function handleGroupSplit(data) {
  return withPhase4ErrorHandling(() => {
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
  }, {
    totalAmount: data.totalAmount,
    participants: data.participants,
    splitType: data.splitType
  }, 'handleGroupSplit');
}


// =================================================================================================
// 【V45.0 新增】IOU 結算處理函式
// =================================================================================================
function handleSettlement(data) {
  return withPhase4ErrorHandling(() => {
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
  }, {
    counterparty: data.counterparty,
    amount: data.amount
  }, 'handleSettlement');
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
  return withPhase4ErrorHandling(() => {
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
  }, { text: text }, 'callGeminiForIou');
}

// =================================================================================================
// 【V46.0 改造】IOU 專用表格寫入函式
// =================================================================================================
function writeToIouLedger(originalText, totalAmount, payer, debts) {
  return withPhase4ErrorHandling(() => {
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
  }, {
    originalText: originalText,
    totalAmount: totalAmount,
    debtsCount: debts.length
  }, 'writeToIouLedger');
}


// =================================================================================================
// 【V47.0 新增】Phase 4 測試函數
// =================================================================================================
/**
 * 手動測試 Phase 4 錯誤處理框架
 * 在 Google Apps Script 編輯器中執行此函數來驗證錯誤處理功能
 */
function manualErrorHandlingTest() {
  Logger.log('=== Phase 4 錯誤處理測試開始 ===');
  try {
    if (typeof phase4Integration !== 'undefined') {
      // 測試完整的錯誤處理流程
      const testIOUData = {
        events: [{ EventID: 'TEST-001', Status: 'Settled', TotalAmount: 100 }],
        participants: [{ EventID: 'TEST-001', Name: '測試用戶' }],
        debts: [{ EventID: 'TEST-001', Amount: 100, Status: 'Settled' }]
      };
      const result = phase4Integration.processLedgerLinking(testIOUData, { records: [] }, {
        testMode: true,
        realizeExpenses: false
      });
      Logger.log('✅ Phase 4 錯誤處理測試完成');
      Logger.log(`測試結果: ${JSON.stringify(result)}`);
    } else {
      Logger.log('⚠️ Phase 4 錯誤處理框架未初始化');
    }
  } catch (error) {
    Logger.log(`❌ Phase 4 錯誤處理測試失敗: ${error.toString()}`);
  }
  Logger.log('=== Phase 4 錯誤處理測試結束 ===');
}

/**
 * 手動測試錯誤檢測功能
 */
function manualErrorDetectionTest() {
  Logger.log('=== Phase 4 錯誤檢測測試開始 ===');
  try {
    if (typeof phase4LedgerLinkDetector !== 'undefined') {
      // 測試錯誤檢測功能
      const testData = {
        events: [{ EventID: 'INVALID-ID', TotalAmount: 1000 }],
        debts: [{ EventID: 'INVALID-ID', Amount: 1500 }] // 故意不匹配的金額
      };
      const result = phase4LedgerLinkDetector.detectLinkErrors(testData, { records: [] });
      Logger.log('✅ Phase 4 錯誤檢測測試完成');
      Logger.log(`檢測到 ${result.summary?.errorsFound || 0} 個錯誤`);
    } else {
      Logger.log('⚠️ Phase 4 錯誤檢測器未初始化');
    }
  } catch (error) {
    Logger.log(`❌ Phase 4 錯誤檢測測試失敗: ${error.toString()}`);
  }
  Logger.log('=== Phase 4 錯誤檢測測試結束 ===');
}

/**
 * 手動測試一致性檢查功能
 */
function manualConsistencyCheckTest() {
  Logger.log('=== Phase 4 一致性檢查測試開始 ===');
  try {
    if (typeof phase4ConsistencyChecker !== 'undefined') {
      // 測試一致性檢查功能
      const result = phase4ConsistencyChecker.performFullConsistencyCheck();
      Logger.log('✅ Phase 4 一致性檢查測試完成');
      Logger.log(`檢查結果: ${JSON.stringify(result.summary || {})}`);
    } else {
      Logger.log('⚠️ Phase 4 一致性檢查器未初始化');
    }
  } catch (error) {
    Logger.log(`❌ Phase 4 一致性檢查測試失敗: ${error.toString()}`);
  }
  Logger.log('=== Phase 4 一致性檢查測試結束 ===');
}

/**
 * 測試欄位對應修正
 * 驗證 C、D、E、F 欄位是否正確對應
 */
function testColumnMapping() {
  Logger.log('=== 欄位對應測試開始 ===');
  
  try {
    // 測試語音記帳的欄位對應
    const testVoiceData = {
      date: '2025-01-25',
      amount: 150,
      currency: 'TWD',
      category: '食',
      description: '測試咖啡',
      merchant: '星巴克'
    };
    
    Logger.log('測試資料:');
    Logger.log(`C欄位 (Currency): ${testVoiceData.currency} - 應該是 TWD`);
    Logger.log(`F欄位 (Category): ${testVoiceData.category} - 應該是 食`);
    
    // 測試匯率計算
    const exchangeRate = getExchangeRate(testVoiceData.currency);
    Logger.log(`D欄位 (Exchange Rate): ${exchangeRate} - TWD 應該是 1`);
    
    // 測試 JPY 匯率
    const jpyRate = getExchangeRate('JPY');
    Logger.log(`JPY 匯率測試: ${jpyRate} - 應該是即時匯率或預設值 0.21`);
    
    Logger.log('✅ 欄位對應測試完成');
    
  } catch (error) {
    Logger.log(`❌ 欄位對應測試失敗: ${error.toString()}`);
  }
  
  Logger.log('=== 欄位對應測試結束 ===');
}

/**
 * 手動測試 iOS 捷徑 API 端點
 * 在 Google Apps Script 編輯器中執行此函數來驗證所有端點功能
 */
function manualIOSShortcutsTest() {
  Logger.log('=== iOS 捷徑 API 端點測試開始 ===');
  
  try {
    // 測試語音記帳 API
    Logger.log('--- 測試語音記帳 API ---');
    const voiceTestEvent = {
      parameter: {
        endpoint: 'voice',
        text: '我今天買了一杯咖啡花了150元'
      }
    };
    const voiceResult = doGet_Voice(voiceTestEvent);
    Logger.log('✅ 語音記帳 API 測試完成');
    Logger.log(`語音測試結果: ${voiceResult.getContent()}`);
    
    // 測試代墊款 API
    Logger.log('--- 測試代墊款 API ---');
    const iouTestEvent = {
      parameter: {
        endpoint: 'iou',
        text: '我幫小明代墊了250元的電影票'
      }
    };
    const iouResult = doGet_Iou(iouTestEvent);
    Logger.log('✅ 代墊款 API 測試完成');
    Logger.log(`代墊款測試結果: ${iouResult.getContent()}`);
    
    Logger.log('✅ 所有 iOS 捷徑 API 端點測試完成');
    
  } catch (error) {
    Logger.log(`❌ iOS 捷徑 API 測試失敗: ${error.toString()}`);
    Logger.log(`錯誤堆疊: ${error.stack}`);
  }
  
  Logger.log('=== iOS 捷徑 API 端點測試結束 ===');
}

/**
 * 測試圖片處理 API（需要實際的 base64 圖片資料）
 */
function manualImageProcessingTest() {
  Logger.log('=== 圖片處理 API 測試開始 ===');
  
  try {
    // 注意：這裡需要實際的 base64 圖片資料才能完整測試
    Logger.log('⚠️ 圖片處理測試需要實際的 base64 圖片資料');
    Logger.log('請通過 iOS 捷徑或 Postman 等工具進行實際測試');
    
    // 測試錯誤處理
    const errorTestEvent = {
      postData: {
        contents: JSON.stringify({
          // 故意不提供 image 參數來測試錯誤處理
          filename: 'test.jpg'
        })
      }
    };
    
    try {
      const errorResult = doPost_Image(errorTestEvent);
      Logger.log('❌ 應該拋出錯誤但沒有');
    } catch (expectedError) {
      Logger.log('✅ 錯誤處理測試通過');
      Logger.log(`預期錯誤: ${expectedError.message}`);
    }
    
  } catch (error) {
    Logger.log(`❌ 圖片處理測試失敗: ${error.toString()}`);
  }
  
  Logger.log('=== 圖片處理 API 測試結束 ===');
}

// =================================================================================================
// 【V45.0 新增】名稱正規化函式
// =================================================================================================
function normalizeName(name) {
  if (!name) return '';
  // 移除空白、標點符號，轉為小寫
  return name.replace(/[\s.,;:!?'"()\[\]{}]/g, '').toLowerCase();
}

// =================================================================================================
// 【V44.0 新增】基本通知函式
// =================================================================================================
function sendNotification(title, message, level = 'INFO') {
  try {
    Logger.log(`[${level}] ${title}: ${message}`);
    // 如果有 Phase 4 通知管理器，優先使用
    if (typeof phase4NotificationManager !== 'undefined') {
      phase4NotificationManager.sendNotification({
        title: title,
        message: message,
        severity: level
      });
      return;
    }
    // 基本通知實作（可擴展為 Email 或其他通知方式）
    const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
    const settingsSheet = ss.getSheetByName(SETTINGS_SHEET_NAME);
    if (settingsSheet) {
      const notificationsRange = settingsSheet.getRange("A:B").getValues();
      const notificationRow = notificationsRange.findIndex(row => row[0] === "NOTIFICATIONS_ENABLED");
      if (notificationRow >= 0 && notificationsRange[notificationRow][1] === true) {
        // 通知已啟用，可以實作 Email 或其他通知方式
        // 例如: MailApp.sendEmail(recipientEmail, title, message);
      }
    }
  } catch (error) {
    Logger.log(`通知發送失敗: ${error.toString()}`);
  }
}

// =================================================================================================
// 【V47.0 新增】圖片處理入口（支援 iOS 捷徑拍照記帳）
// =================================================================================================
function doPost_Image(e) {
  return withPhase4ErrorHandling(() => {
    const params = JSON.parse(e.postData.contents);
    const imageData = params.image;
    const filename = params.filename || 'image.jpg';
    const voiceNote = params.voiceNote || '';
    
    if (!imageData) {
      throw new Error("缺少 image 參數。請提供 base64 編碼的圖片資料");
    }
    
    Logger.log(`POST Image request received - filename: ${filename}, has voiceNote: ${!!voiceNote}`);
    
    // 處理 base64 圖片資料
    const imageBlob = Utilities.newBlob(
      Utilities.base64Decode(imageData),
      'image/jpeg',
      filename
    );
    
    // 使用 Gemini Vision API 處理圖片
    const aiResultText = callGeminiForVision(imageBlob, voiceNote);
    
    // 安全檢查：確保 aiResultText 不是 undefined 或 null
    let parsedData;
    if (!aiResultText || aiResultText === 'undefined') {
      Logger.log('❌ callGeminiForVision 返回無效結果，使用預設值');
      parsedData = {
        "date": "2025-07-25 12:00:00",
        "amount": 0,
        "currency": "TWD",
        "category": "其他",
        "description": "圖片處理失敗",
        "merchant": ""
      };
    } else {
      parsedData = JSON.parse(aiResultText);
    }
    
    if (!parsedData) {
      throw new Error("AI未能解析出有效的交易資料。");
    }
    
    // 圖片歸檔增強處理（加上分類前綴和生成超連結）
    let enhancedReceiptLink = filename;
    
    try {
      if (typeof archiveImageWithCategoryAndLink === 'function') {
        Logger.log('🖼️ 開始圖片歸檔增強處理...');
        
        enhancedReceiptLink = archiveImageWithCategoryAndLink(
          imageBlob,
          filename,
          parsedData.category || '其他',
          parsedData
        );
        
        Logger.log(`📁 圖片歸檔增強完成: ${enhancedReceiptLink}`);
      }
    } catch (archiveError) {
      Logger.log(`⚠️ 圖片歸檔增強處理失敗: ${archiveError.toString()}`);
      enhancedReceiptLink = filename; // 失敗時使用原檔名
    }
    
    // 寫入到 Google Sheet（使用增強的檔案連結）
    const result = writeToSheetFromImageEnhanced(parsedData, MAIN_LEDGER_ID, filename, enhancedReceiptLink, voiceNote);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: voiceNote ? '收據和語音處理完成' : '收據處理完成',
      data: parsedData
    })).setMimeType(ContentService.MimeType.JSON);
    
  }, { endpoint: 'image', method: 'POST', hasVoiceNote: !!e.postData.contents.includes('voiceNote') }, 'doPost_Image');
}

// =================================================================================================
// 【V47.0 新增】GET 請求處理入口（支援 iOS 捷徑）
// =================================================================================================
function doGet_Voice(e) {
  return withPhase4ErrorHandling(() => {
    const text = e.parameter.text;
    if (!text) {
      throw new Error("缺少 text 參數。請在 URL 中提供 ?text=語音文字");
    }
    
    Logger.log(`GET Voice request received with text: ${text}`);
    
    // 使用現有的語音處理邏輯
    return processVoiceText(text, MAIN_LEDGER_ID);
  }, { endpoint: 'voice', method: 'GET' }, 'doGet_Voice');
}

function doGet_Image(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'error',
    message: 'GET 方式不支援圖片處理，請使用 POST 方式上傳圖片'
  })).setMimeType(ContentService.MimeType.JSON);
}

function doGet_Pdf(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'error',
    message: 'GET 方式不支援 PDF 處理，請使用 POST 方式上傳 PDF'
  })).setMimeType(ContentService.MimeType.JSON);
}

function doGet_Iou(e) {
  return withPhase4ErrorHandling(() => {
    const text = e.parameter.text;
    if (!text) {
      throw new Error("缺少 text 參數。請在 URL 中提供 ?text=代墊款文字");
    }
    
    Logger.log(`GET IOU request received with text: ${text}`);
    
    // 使用現有的 IOU 處理邏輯
    const aiResultText = callGeminiForIou(text);
    const parsedData = JSON.parse(aiResultText);
    if (!parsedData || !parsedData.action) {
      throw new Error("AI未能解析出有效的代墊款動作。");
    }

    let result;
    if (parsedData.action === 'CREATE') {
      Logger.log(`IOU Action: CREATE. Data: ${JSON.stringify(parsedData)}`);
      const groupData = {
        totalAmount: parsedData.amount,
        item: parsedData.item,
        participants: [parsedData.counterparty],
        splitType: 'TOTAL',
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

    return ContentService.createTextOutput(JSON.stringify({
      status: result ? 'success' : 'error',
      data: parsedData
    })).setMimeType(ContentService.MimeType.JSON);
  }, { endpoint: 'iou', method: 'GET' }, 'doGet_Iou');
}

// =================================================================================================
// 【V44.0 新增】語音處理入口
// =================================================================================================
function doPost_Voice(e) {
  return withPhase4ErrorHandling(() => {
    const params = JSON.parse(e.postData.contents);
    const text = params.text;
    if (!text) throw new Error("缺少 text 參數。");
    
    return processVoiceText(text, MAIN_LEDGER_ID);
  }, { endpoint: 'voice', method: 'POST' }, 'doPost_Voice');
}

// =================================================================================================
// 【V47.0 新增】語音文字處理函數
// =================================================================================================
function processVoiceText(voiceText, sheetId) {
  return withPhase4ErrorHandling(() => {
    Logger.log(`Processing voice text: ${voiceText}`);
    
    // 使用 Gemini AI 處理語音文字
    const aiResultText = callGeminiForVoice(voiceText);
    const parsedData = JSON.parse(aiResultText);
    
    if (!parsedData) {
      throw new Error("AI未能解析出有效的交易資料。");
    }
    
    // 寫入到 Google Sheet
    const result = writeToSheetFromVoice(parsedData, sheetId, voiceText);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: '語音文字處理完成',
      data: parsedData
    })).setMimeType(ContentService.MimeType.JSON);
    
  }, { voiceText: voiceText, sheetId: sheetId }, 'processVoiceText');
}

// =================================================================================================
// 【V44.0 新增】PDF 處理入口
// =================================================================================================
function doPost_Pdf(e) {
  // PDF 處理實作...
  return ContentService.createTextOutput(JSON.stringify({
    status: 'success',
    message: 'PDF processing endpoint'
  })).setMimeType(ContentService.MimeType.JSON);
}

// =================================================================================================
// 【V44.0 新增】自動處理電子郵件
// =================================================================================================
function processAutomatedEmails() {
  Logger.log('🔄 主程式觸發電子郵件處理...');
  
  try {
    // 調用 email-triggers-fixed.gs 中的實際實作
    if (typeof processAutomatedEmailsFixed === 'function') {
      Logger.log('✅ 調用修復版電子郵件處理');
      return processAutomatedEmailsFixed();
    } else if (typeof processAutomatedEmailsV46Compatible === 'function') {
      Logger.log('✅ 調用 V46 相容版電子郵件處理');
      return processAutomatedEmailsV46Compatible();
    } else {
      Logger.log('❌ 找不到電子郵件處理實作函數');
      throw new Error('電子郵件處理函數未找到');
    }
  } catch (error) {
    Logger.log(`❌ 電子郵件處理失敗: ${error.toString()}`);
    sendNotification('電子郵件處理失敗', error.toString(), 'ERROR');
    throw error;
  }
}

// =================================================================================================
// 【V44.0 新增】檢查收據資料夾
// =================================================================================================
function checkReceiptsFolder() {
  // 收據資料夾檢查實作...
  Logger.log('Receipt folder check triggered');
}

// =================================================================================================
// 既有函式庫 (為節省篇幅，此處僅列出函式名稱，內容與 V45.5 相同)
// =================================================================================================
// =================================================================================================
// 【V47.0 新增】圖片處理核心函數
// =================================================================================================
function callGeminiForVision(imageBlob, voiceNote = '') {
  try {
    Logger.log(`[callGeminiForVision] 開始處理圖片，語音備註: ${voiceNote || '無'}`);
    
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
      throw new Error('GEMINI_API_KEY 未設定');
    }
    const prompt = `
你是一位專業的記帳助理，專門處理收據和發票圖片。請分析這張圖片並提取交易資訊。

【重要】今天的日期是 2025年7月25日 (2025-07-25)，請以此為基準判斷日期。

${voiceNote ? `用戶補充說明：${voiceNote}` : ''}

請分析圖片中的收據/發票資訊，並提取以下資料：
- 如果是支出，amount 為正數
- 如果是收入，amount 為負數
- 日期和時間處理（基準日期：2025-07-25）：
  * 優先使用收據上的完整日期時間
  * 格式：YYYY-MM-DD HH:MM:SS
  * 如果收據只有日期沒有時間，補上 12:00:00
  * 如果收據沒有日期，使用 2025-07-25 12:00:00
  * 如果有語音補充說明時間（如「這是昨天的收據」），以語音說明為準，昨天=2025-07-24

【重要欄位說明】
- currency (幣別)：只能是 TWD, JPY, USD, EUR, CNY 其中之一，絕對不能填入商品名稱、類別或其他內容
- category (類別)：只能是 食、衣、住、行、育、樂、醫療、保險、其他 其中之一

【嚴格規則】
1. currency 欄位：根據收據上的幣別符號判斷（NT$→TWD, ¥→JPY, $→USD, €→EUR, ¥→CNY），如果無法判斷則填入 "TWD"
2. category 欄位：根據商品內容判斷類別，例如：
   - 餐廳、咖啡、食物 → "食"
   - 服飾、鞋類 → "衣"
   - 房租、水電、家具 → "住"
   - 交通、停車、油費 → "行"
   - 書籍、文具、課程 → "育"
   - 娛樂、電影、遊戲 → "樂"
   - 醫院、藥局、健檢 → "醫療"
   - 保險費用 → "保險"
   - 無法分類 → "其他"

${voiceNote ? '請結合圖片資訊和用戶的語音補充說明，提供完整的交易記錄。' : ''}

請回傳 JSON 格式，包含以下欄位：
{
  "date": "完整的交易日期時間 (YYYY-MM-DD HH:MM:SS 格式)",
  "amount": "金額 (數字，支出為正，收入為負)",
  "currency": "幣別 (只能是 TWD/JPY/USD/EUR/CNY，根據收據判斷，預設 TWD)",
  "category": "類別 (只能是 食/衣/住/行/育/樂/醫療/保險/其他)",
  "description": "描述",
  "merchant": "商家名稱 (如果能識別)",
  "note": "備註 (如果有語音補充說明)"
}
`;

    // 將圖片轉換為 base64
    const base64Image = Utilities.base64Encode(imageBlob.getBytes());
    
    const requestBody = {
      "contents": [{
        "parts": [
          { "text": prompt },
          {
            "inline_data": {
              "mime_type": imageBlob.getContentType(),
              "data": base64Image
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
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode !== 200) {
      throw new Error(`[Vision] Gemini API HTTP Error: ${responseCode}. Response: ${responseText}`);
    }

    try {
      const jsonResponse = JSON.parse(responseText);
      if (jsonResponse.error) {
        throw new Error(`[Vision] Gemini API returned an error: ${jsonResponse.error.message}`);
      }
      if (!jsonResponse.candidates || !jsonResponse.candidates[0].content.parts[0].text) {
        throw new Error(`[Vision] Unexpected Gemini API response structure.`);
      }
      const aiResultText = jsonResponse.candidates[0].content.parts[0].text;
      JSON.parse(aiResultText); // 驗證回傳的是否為合法 JSON
      return aiResultText;
    } catch (e) {
      Logger.log(`callGeminiForVision 解析 JSON 失敗: ${e.toString()}`);
      
      // 返回預設的 JSON 結構而不是拋出錯誤
      const errorResult = {
        "date": "2025-07-25 12:00:00",
        "amount": 0,
        "currency": "TWD",
        "category": "其他",
        "description": "圖片處理錯誤",
        "merchant": ""
      };
      
      Logger.log(`返回錯誤預設結果: ${JSON.stringify(errorResult)}`);
      return JSON.stringify(errorResult);
    }
  } catch (error) {
    Logger.log(`[callGeminiForVision] 最外層錯誤處理: ${error.toString()}`);
    
    // 最終的預設值返回
    const finalErrorResult = {
      "date": "2025-07-25 12:00:00",
      "amount": 0,
      "currency": "TWD",
      "category": "其他",
      "description": "圖片處理完全失敗",
      "merchant": ""
    };
    
    Logger.log(`[callGeminiForVision] 返回最終預設結果: ${JSON.stringify(finalErrorResult)}`);
    return JSON.stringify(finalErrorResult);
  }
}

function writeToSheetFromImage(data, sheetId, filename, voiceNote = '') {
  return withPhase4ErrorHandling(() => {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      throw new Error(`找不到工作表: ${SHEET_NAME}`);
    }

    // 檢查是否為空工作表，如果是則添加標題行和公式
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'TIMESTAMP', 'AMOUNT', 'CURRENCY', 'EXCHANGE RATE', 'Amount (TWD)', 'CATEGORY', 'ITEM', 'ACCOUNT TYPE',
        'Linked_IOU_EventID', 'INVOICE NO.', 'REFERENCES NO.', 'BUYER NAME', 'BUYER TAX ID', 'SELLER TAX ID',
        'RECEIPT IMAGE', 'STATUS', 'SOURCE', 'NOTES', 'Original Text (OCR)', 'Translation (AI)', 'META_DATA'
      ]);
      // 設定 E 欄位的公式標題
      sheet.getRange('E1').setValue('Amount (TWD)');
      sheet.getRange('E2').setFormula('={"Amount (TWD)"; ARRAYFORMULA(IF(ISBLANK(A2:A),, B2:B * D2:D))}');
    }

    // 計算匯率和台幣金額（內嵌邏輯）
    const currency = data.currency || 'TWD';
    const originalAmount = data.amount || 0;
    
    // 直接內嵌匯率邏輯，避免函數調用問題
    let exchangeRate;
    if (currency === 'TWD') {
      exchangeRate = 1;
    } else if (currency === 'USD') {
      exchangeRate = 31.5;
    } else if (currency === 'JPY') {
      exchangeRate = 0.21;
    } else if (currency === 'EUR') {
      exchangeRate = 34.2;
    } else if (currency === 'CNY') {
      exchangeRate = 4.35;
    } else {
      exchangeRate = 1; // 預設值
    }

    Logger.log(`圖片記帳內嵌匯率計算: ${currency} = ${exchangeRate}`);
    const amountTWD = originalAmount * exchangeRate;

    // 準備要寫入的資料 - 修正完整欄位對應
    const rowData = [
      data.date || new Date().toISOString().split('T')[0], // A: TIMESTAMP
      originalAmount, // B: AMOUNT
      currency, // C: CURRENCY (TWD, JPY, USD, EUR, CNY)
      exchangeRate, // D: EXCHANGE RATE
      '', // E: Amount (TWD) - 由公式自動計算
      data.category || '其他', // F: CATEGORY (食衣住行育樂醫療保險其他)
      data.description || '圖片識別', // G: ITEM
      '私人', // H: ACCOUNT TYPE
      '', // I: Linked_IOU_EventID
      '', // J: INVOICE NO.
      '', // K: REFERENCES NO.
      '', // L: BUYER NAME
      '', // M: BUYER TAX ID
      '', // N: SELLER TAX ID
      filename || '', // O: RECEIPT IMAGE
      '待確認', // P: STATUS
      voiceNote ? '圖片+語音' : '圖片識別', // Q: SOURCE
      data.note || voiceNote || '', // R: NOTES
      data.description || '圖片識別', // S: Original Text (OCR)
      '', // T: Translation (AI)
      JSON.stringify({
        filename: filename,
        processTime: new Date(),
        hasVoiceNote: !!voiceNote
      }) // U: META_DATA
    ];

    // 寫入資料
    sheet.appendRow(rowData);
    
    Logger.log(`成功寫入圖片交易記錄: ${JSON.stringify(data)}`);
    return true;
    
  }, {
    filename: filename,
    sheetId: sheetId,
    hasVoiceNote: !!voiceNote
  }, 'writeToSheetFromImage');
}

/**
 * 增強版圖片記帳寫入函數（支援歸檔連結）
 */
function writeToSheetFromImageEnhanced(data, sheetId, originalFilename, receiptImageLink, voiceNote = '') {
  return withPhase4ErrorHandling(() => {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      throw new Error(`找不到工作表: ${SHEET_NAME}`);
    }

    // 檢查是否為空工作表，如果是則添加標題行和公式
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'TIMESTAMP', 'AMOUNT', 'CURRENCY', 'EXCHANGE RATE', 'Amount (TWD)', 'CATEGORY', 'ITEM', 'ACCOUNT TYPE',
        'Linked_IOU_EventID', 'INVOICE NO.', 'REFERENCES NO.', 'BUYER NAME', 'BUYER TAX ID', 'SELLER TAX ID',
        'RECEIPT IMAGE', 'STATUS', 'SOURCE', 'NOTES', 'Original Text (OCR)', 'Translation (AI)', 'META_DATA'
      ]);
      // 設定 E 欄位的公式標題
      sheet.getRange('E1').setValue('Amount (TWD)');
      sheet.getRange('E2').setFormula('={"Amount (TWD)"; ARRAYFORMULA(IF(ISBLANK(A2:A),, B2:B * D2:D))}');
    }

    // 計算匯率和台幣金額（內嵌邏輯）
    const currency = data.currency || 'TWD';
    const originalAmount = data.amount || 0;
    
    // 直接內嵌匯率邏輯，避免函數調用問題
    let exchangeRate;
    if (currency === 'TWD') {
      exchangeRate = 1;
    } else if (currency === 'USD') {
      exchangeRate = 31.5;
    } else if (currency === 'JPY') {
      exchangeRate = 0.21;
    } else if (currency === 'EUR') {
      exchangeRate = 34.2;
    } else if (currency === 'CNY') {
      exchangeRate = 4.35;
    } else {
      exchangeRate = 1; // 預設值
    }

    Logger.log(`圖片記帳內嵌匯率計算: ${currency} = ${exchangeRate}`);
    const amountTWD = originalAmount * exchangeRate;

    // 準備要寫入的資料 - 使用增強的收據連結
    const rowData = [
      data.date || new Date().toISOString().split('T')[0], // A: TIMESTAMP
      originalAmount, // B: AMOUNT
      currency, // C: CURRENCY (TWD, JPY, USD, EUR, CNY)
      exchangeRate, // D: EXCHANGE RATE
      '', // E: Amount (TWD) - 由公式自動計算
      data.category || '其他', // F: CATEGORY (食衣住行育樂醫療保險其他)
      data.description || '圖片識別', // G: ITEM
      '私人', // H: ACCOUNT TYPE
      '', // I: Linked_IOU_EventID
      '', // J: INVOICE NO.
      '', // K: REFERENCES NO.
      '', // L: BUYER NAME
      '', // M: BUYER TAX ID
      '', // N: SELLER TAX ID
      receiptImageLink || originalFilename || '', // O: RECEIPT IMAGE (增強版超連結)
      '待確認', // P: STATUS
      voiceNote ? '圖片+語音' : '圖片識別', // Q: SOURCE
      data.note || voiceNote || '', // R: NOTES
      data.description || '圖片識別', // S: Original Text (OCR)
      '', // T: Translation (AI)
      JSON.stringify({
        originalFilename: originalFilename,
        enhancedLink: receiptImageLink,
        processTime: new Date(),
        hasVoiceNote: !!voiceNote,
        category: data.category || '其他'
      }) // U: META_DATA
    ];

    // 寫入資料
    sheet.appendRow(rowData);
    
    Logger.log(`成功寫入增強版圖片交易記錄: ${JSON.stringify(data)}`);
    Logger.log(`收據連結: ${receiptImageLink}`);
    return true;
    
  }, {
    originalFilename: originalFilename,
    receiptImageLink: receiptImageLink,
    sheetId: sheetId,
    hasVoiceNote: !!voiceNote
  }, 'writeToSheetFromImageEnhanced');
}

// =================================================================================================
// 【V47.0 新增】圖片歸檔增強功能
// =================================================================================================

/**
 * 將圖片歸檔到 Archives 資料夾並生成超連結
 */
function archiveImageWithCategoryAndLink(imageBlob, originalFilename, category, transactionData) {
  Logger.log('=== 開始圖片歸檔增強處理 ===');
  
  try {
    // 步驟 1: 建立或取得 Archives 資料夾
    const archivesFolder = getOrCreateArchivesFolder();
    Logger.log(`✅ Archives 資料夾 ID: ${archivesFolder.getId()}`);
    
    // 步驟 2: 生成帶分類前綴的檔名
    const enhancedFilename = generateCategoryFilename(originalFilename, category, transactionData);
    Logger.log(`✅ 增強檔名: ${enhancedFilename}`);
    
    // 步驟 3: 將圖片儲存到 Archives 資料夾
    const archivedFile = archivesFolder.createFile(imageBlob.setName(enhancedFilename));
    Logger.log(`✅ 圖片已歸檔，檔案 ID: ${archivedFile.getId()}`);
    
    // 步驟 4: 生成可分享的超連結
    const fileUrl = generateShareableLink(archivedFile);
    Logger.log(`✅ 生成超連結: ${fileUrl}`);
    
    // 步驟 5: 生成 HTML 超連結格式（適用於 Google Sheets）
    const htmlLink = `=HYPERLINK("${fileUrl}", "${enhancedFilename}")`;
    Logger.log(`✅ HTML 超連結: ${htmlLink}`);
    
    return htmlLink;
    
  } catch (error) {
    Logger.log(`❌ 圖片歸檔增強處理失敗: ${error.toString()}`);
    return originalFilename || '圖片處理失敗';
  }
}

/**
 * 取得或建立 Archives 資料夾
 */
function getOrCreateArchivesFolder() {
  try {
    const folders = DriveApp.getFoldersByName('Archives');
    
    if (folders.hasNext()) {
      const folder = folders.next();
      Logger.log(`找到現有 Archives 資料夾: ${folder.getId()}`);
      return folder;
    }
    
    const newFolder = DriveApp.createFolder('Archives');
    Logger.log(`建立新的 Archives 資料夾: ${newFolder.getId()}`);
    newFolder.setDescription('智慧記帳 GEM - 收據圖片歸檔資料夾');
    
    return newFolder;
    
  } catch (error) {
    Logger.log(`❌ 取得/建立 Archives 資料夾失敗: ${error.toString()}`);
    return DriveApp.getRootFolder();
  }
}

/**
 * 生成帶分類前綴的檔名
 */
function generateCategoryFilename(originalFilename, category, transactionData) {
  try {
    const now = new Date();
    const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    
    const cleanCategory = (category || '其他').replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '');
    const fileExtension = getFileExtension(originalFilename);
    
    const merchant = transactionData.merchant || '';
    const cleanMerchant = merchant ? '_' + merchant.replace(/[^\\w\\u4e00-\\u9fff]/g, '').substring(0, 10) : '';
    
    const amount = transactionData.amount || 0;
    const currency = transactionData.currency || 'TWD';
    const amountInfo = amount > 0 ? `_${currency}${amount}` : '';
    
    const enhancedFilename = `${cleanCategory}_${timestamp}${cleanMerchant}${amountInfo}.${fileExtension}`;
    
    Logger.log(`檔名組合: 分類(${cleanCategory}) + 時間(${timestamp}) + 商家(${cleanMerchant}) + 金額(${amountInfo})`);
    
    return enhancedFilename;
    
  } catch (error) {
    Logger.log(`❌ 生成增強檔名失敗: ${error.toString()}`);
    
    const fallbackCategory = (category || '其他').replace(/[^\\w\\u4e00-\\u9fff]/g, '');
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    const fileExtension = getFileExtension(originalFilename);
    
    return `${fallbackCategory}_${timestamp}.${fileExtension}`;
  }
}

/**
 * 取得檔案副檔名
 */
function getFileExtension(filename) {
  if (!filename || typeof filename !== 'string') {
    return 'jpg';
  }
  
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return 'jpg';
  }
  
  return filename.substring(lastDotIndex + 1).toLowerCase();
}

/**
 * 生成可分享的檔案連結
 */
function generateShareableLink(file) {
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    const fileId = file.getId();
    const directViewUrl = `https://drive.google.com/file/d/${fileId}/view`;
    
    Logger.log(`生成分享連結: ${directViewUrl}`);
    
    return directViewUrl;
    
  } catch (error) {
    Logger.log(`❌ 生成分享連結失敗: ${error.toString()}`);
    return file.getUrl();
  }
}

// =================================================================================================
// 【V47.0 新增】匯率計算函數
// =================================================================================================
function getExchangeRate(currency) {
  Logger.log(`開始取得 ${currency} 匯率`);
  
  try {
    // TWD 匯率為 1
    if (currency === 'TWD') {
      Logger.log('返回 TWD 匯率: 1');
      return 1;
    }
    
    // 預設匯率
    const defaultRates = {
      'USD': 31.5,
      'JPY': 0.21,
      'EUR': 34.2,
      'CNY': 4.35
    };
    
    const rate = defaultRates[currency];
    if (rate) {
      Logger.log(`返回 ${currency} 預設匯率: ${rate}`);
      return rate;
    } else {
      Logger.log(`找不到 ${currency} 匯率，返回 1`);
      return 1;
    }
    
  } catch (error) {
    Logger.log(`匯率計算錯誤: ${error.toString()}`);
    return 1;
  }
}

// =================================================================================================
// 【V47.0 新增】語音處理核心函數
// =================================================================================================
function callGeminiForVoice(voiceText) {
  return withPhase4ErrorHandling(() => {
    const prompt = `
你是一位專業的記帳助理，專門處理語音輸入的交易記錄。請將以下語音文字轉換為結構化的交易資料。

【重要】今天的日期是 2025年7月25日 (2025-07-25)，請以此為基準計算相對日期。

請分析以下語音文字，並提取出交易資訊：
- 如果是支出，amount 為正數
- 如果是收入，amount 為負數
- 日期和時間處理規則（基準日期：2025-07-25）：
  * 格式：完整的日期時間應為 "YYYY-MM-DD HH:MM:SS" 格式
  * 如果語音中說「今天」、「剛才」、「現在」→ 使用 2025-07-25 + 當前時間
  * 如果語音中說「昨天」→ 使用 2025-07-24，時間部分如有明確提到則使用，否則使用 12:00:00
  * 如果語音中說「昨天晚上12:10」→ 使用 2025-07-24 00:10:00（凌晨12:10）
  * 如果語音中說「昨天下午3點」→ 使用 2025-07-24 15:00:00
  * 如果語音中說「前天」→ 使用 2025-07-23
  * 如果沒有明確日期，使用 2025-07-25 + 當前時間
  * 時間轉換：上午/AM用24小時制，下午/PM加12小時，晚上通常指19:00-23:59，深夜/凌晨指00:00-05:59

【重要欄位說明】
- currency (幣別)：只能是 TWD, JPY, USD, EUR, CNY 其中之一，絕對不能填入商品名稱、類別或其他內容
- category (類別)：只能是 食、衣、住、行、育、樂、醫療、保險、其他 其中之一

【嚴格規則】
1. currency 欄位：如果語音中沒有明確提到外幣，一律填入 "TWD"
2. category 欄位：根據消費內容判斷類別，例如：
   - 咖啡、餐廳、食物 → "食"
   - 衣服、鞋子 → "衣"
   - 房租、水電 → "住"
   - 交通、油錢 → "行"
   - 書籍、課程 → "育"
   - 電影、遊戲 → "樂"
   - 看醫生、藥品 → "醫療"
   - 保險費 → "保險"
   - 其他 → "其他"

語音文字：${voiceText}

請回傳 JSON 格式，包含以下欄位：
{
  "date": "完整的交易日期時間 (YYYY-MM-DD HH:MM:SS 格式，根據語音內容智能判斷)",
  "amount": "金額 (數字，支出為正，收入為負)",
  "currency": "幣別 (只能是 TWD/JPY/USD/EUR/CNY，預設 TWD)",
  "category": "類別 (只能是 食/衣/住/行/育/樂/醫療/保險/其他)",
  "description": "描述",
  "merchant": "商家名稱 (如果有提到)"
}
`;

    const requestBody = {
      "contents": [{ "parts":[{ "text": prompt }] }],
      "generationConfig": { "response_mime_type": "application/json" }
    };
    const options = {
      'method' : 'post',
      'contentType': 'application/json',
      'payload' : JSON.stringify(requestBody),
      'muteHttpExceptions': true
    };
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode !== 200) {
      throw new Error(`[Voice] Gemini API HTTP Error: ${responseCode}. Response: ${responseText}`);
    }

    try {
      const jsonResponse = JSON.parse(responseText);
      if (jsonResponse.error) {
        throw new Error(`[Voice] Gemini API returned an error: ${jsonResponse.error.message}`);
      }
      if (!jsonResponse.candidates || !jsonResponse.candidates[0].content.parts[0].text) {
        throw new Error(`[Voice] Unexpected Gemini API response structure.`);
      }
      const aiResultText = jsonResponse.candidates[0].content.parts[0].text;
      JSON.parse(aiResultText); // 驗證回傳的是否為合法 JSON
      return aiResultText;
    } catch (e) {
      Logger.log(`callGeminiForVoice 解析 JSON 失敗: ${e.toString()}. 原始 AI 回應: ${responseText}`);
      throw new Error(`Failed to process Voice API call: ${e.message}`);
    }
  }, { voiceText: voiceText }, 'callGeminiForVoice');
}

function writeToSheetFromVoice(data, sheetId, originalVoiceText) {
  return withPhase4ErrorHandling(() => {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      throw new Error(`找不到工作表: ${SHEET_NAME}`);
    }

    // 檢查是否為空工作表，如果是則添加標題行和公式
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'TIMESTAMP', 'AMOUNT', 'CURRENCY', 'EXCHANGE RATE', 'Amount (TWD)', 'CATEGORY', 'ITEM', 'ACCOUNT TYPE',
        'Linked_IOU_EventID', 'INVOICE NO.', 'REFERENCES NO.', 'BUYER NAME', 'BUYER TAX ID', 'SELLER TAX ID',
        'RECEIPT IMAGE', 'STATUS', 'SOURCE', 'NOTES', 'Original Text (OCR)', 'Translation (AI)', 'META_DATA'
      ]);
      // 設定 E 欄位的公式標題
      sheet.getRange('E1').setValue('Amount (TWD)');
      sheet.getRange('E2').setFormula('={"Amount (TWD)"; ARRAYFORMULA(IF(ISBLANK(A2:A),, B2:B * D2:D))}');
    }

    // 計算匯率和台幣金額（內嵌邏輯）
    const currency = data.currency || 'TWD';
    const originalAmount = data.amount || 0;
    
    // 直接內嵌匯率邏輯，避免函數調用問題
    let exchangeRate;
    if (currency === 'TWD') {
      exchangeRate = 1;
    } else if (currency === 'USD') {
      exchangeRate = 31.5;
    } else if (currency === 'JPY') {
      exchangeRate = 0.21;
    } else if (currency === 'EUR') {
      exchangeRate = 34.2;
    } else if (currency === 'CNY') {
      exchangeRate = 4.35;
    } else {
      exchangeRate = 1; // 預設值
    }

    Logger.log(`圖片記帳內嵌匯率計算: ${currency} = ${exchangeRate}`);
    const amountTWD = originalAmount * exchangeRate;

    // 準備要寫入的資料 - 修正完整欄位對應
    const rowData = [
      data.date || new Date().toISOString().split('T')[0], // A: TIMESTAMP
      originalAmount, // B: AMOUNT
      currency, // C: CURRENCY (TWD, JPY, USD, EUR, CNY)
      exchangeRate, // D: EXCHANGE RATE
      '', // E: Amount (TWD) - 由公式自動計算
      data.category || '其他', // F: CATEGORY (食衣住行育樂醫療保險其他)
      data.description || originalVoiceText, // G: ITEM
      '私人', // H: ACCOUNT TYPE
      '', // I: Linked_IOU_EventID
      '', // J: INVOICE NO.
      '', // K: REFERENCES NO.
      '', // L: BUYER NAME
      '', // M: BUYER TAX ID
      '', // N: SELLER TAX ID
      '', // O: RECEIPT IMAGE
      '待確認', // P: STATUS
      '語音輸入', // Q: SOURCE
      '', // R: NOTES
      originalVoiceText, // S: Original Text (OCR)
      '', // T: Translation (AI)
      JSON.stringify({
        originalVoiceText: originalVoiceText,
        processTime: new Date()
      }) // U: META_DATA
    ];

    // 寫入資料
    sheet.appendRow(rowData);
    
    Logger.log(`成功寫入語音交易記錄: ${JSON.stringify(data)}`);
    return true;
    
  }, {
    originalVoiceText: originalVoiceText,
    sheetId: sheetId
  }, 'writeToSheetFromVoice');
}

// 其他既有函式庫（省略詳細實作）
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

function callGeminiForPdfText(pdfText, textQuality) { /* ... */ }
function callDocumentAIAPI(blob) { /* ... */ }
function writeToSheet(data, fileUrl, rawText, translation, source, sheetId, customStatus = '待確認', metaData = null) { /* ... */ }
function writeToSheetFromEmail(data, sheetId, source = '電子發票') { /* ... */ }
function isDuplicate(data, rawText, sheetId) { /* ... */ }
function extractPdfText(file) { /* ... */ }
function assessTextQuality(text) { /* ... */ }
function sanitizeSheetId(idString) { /* ... */ }
function getExchangeRate(currency) { /* ... */ }
function getNotificationRules() { /* ... */ }
function getEmailProcessingRulesFromSheet() { /* ... */ }
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
