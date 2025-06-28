// =================================================================================================
// 專案名稱：智慧記帳 GEM (Gemini AI Accountant)
// 版本：V38.3 - 智慧通報中心 (Notification Hub)
// 作者：0ximwhatim & Gemini
// 最後更新：2025-06-28
// 說明：此版本根據使用者反饋，進行了重大的架構升級，引入了靈活的通知系統。
//      1. 【架構升級】: 新增 sendNotification() 函式，作為所有錯誤與事件的統一通報入口。
//      2. 【功能擴充】: 現在會從 "Settings" 工作表讀取通知規則，支援 EMAIL 和 WEBHOOK (可用於 Slack, Discord 等) 渠道。
//      3. 【維護性提升】: 使用者可直接在 Google Sheets 中設定偏好的通知方式，無需修改程式碼。
//      4. 【錯誤處理強化】: 在多個關鍵的 try...catch 區塊中，加入了對 sendNotification 的呼叫。
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

// ... (doGet, doPost, doPost_Image, doPost_Pdf, doPost_Voice 保持不變) ...

// =================================================================================================
// 【V38.3 新增】智慧通報中心 (Notification Hub)
// =================================================================================================

/**
 * @description 【V38.3 新增】讀取並返回在 "Settings" 工作表中設定的通知規則。
 * @returns {Array<Object>} 通知規則陣列，例如 [{channel: 'EMAIL', target: 'a@b.com', level: 'ERROR'}]
 */
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


/**
 * @description 【V38.3 核心】統一的通知發送函式。
 * @param {string} title - 通知的標題。
 * @param {string} message - 通知的主體內容。
 * @param {string} severity - 通知的嚴重等級 ('INFO', 'ERROR')。
 */
function sendNotification(title, message, severity) {
    const rules = getNotificationRules();
    if (rules.length === 0) return;

    rules.forEach(rule => {
        // 如果規則等級是 ERROR，則只在嚴重等級為 ERROR 時發送
        // 如果規則等級是 ALL，則所有等級都發送
        if (rule.level === 'ERROR' && severity !== 'ERROR') {
            return;
        }

        const fullMessage = `${title}\n\n${message}`;

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
                // 未來可在此擴充 LINE, Telegram 等
                default:
                    Logger.log(`未知的通知渠道: ${rule.channel}`);
            }
        } catch (e) {
            Logger.log(`發送通知到 ${rule.channel} (${rule.target}) 失敗: ${e.toString()}`);
        }
    });
}

// ============================= V38.3 函式修改 START =============================
// 在關鍵的錯誤處理函式中，加入通知呼叫

function handleFailedFile(error, file, sheetId) {
    Logger.log(`[handleFailedFile] 開始處理失敗的檔案 ${file ? file.getName() : 'N/A'}。錯誤: ${error.message}`);
    
    // 【V38.3 升級】發送錯誤通知
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
                    // 轉交後再度失敗，還是要發通知
                    sendNotification(
                        `檔案處理失敗 (轉交後): ${fileName}`,
                        `檔案 ${fileName} 在轉交給圖片處理器後，再次發生錯誤。\n\n原始錯誤:\n${error.message}\n\n新錯誤:\n${imageError.stack}`,
                        'ERROR'
                    );
                }
            }
        }

        Logger.log(`[handleFailedFile Error] 無法自動處理的錯誤，將檔案 ${file.getName()} 歸檔至錯誤資料夾。`);
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

// 我們也可以在其他關鍵的 try-catch 中加入通知
function processAutomatedEmails() {
    // ...
    const emailProcessingRules = getEmailProcessingRulesFromSheet();

    if (emailProcessingRules.length === 0) {
        const msg = "警告：未從 'Settings' 工作表讀取到任何有效的郵件處理規則，本次執行結束。";
        Logger.log(msg);
        // 這不算嚴重錯誤，但可以發送 INFO 等級的通知
        // sendNotification("郵件處理警告", msg, 'INFO');
        return;
    }
    // ...
}

// 當 API 金鑰失效時
function callGeminiForVision(imageBlob, voiceNote) {
    // ...
    try {
        // ... (UrlFetchApp.fetch)
        if (responseCode !== 200) {
            const errorMsg = `Gemini API HTTP Error: ${responseCode}. Response: ${responseText}`;
            // 【V38.3 升級】發送錯誤通知
            sendNotification('Gemini API 呼叫失敗', errorMsg, 'ERROR');
            throw new Error(errorMsg);
        }
        // ...
    } catch (e) {
        // ...
    }
}
// ============================= V38.3 函式修改 END ===============================


// ... (所有其他未修改的函式，請確保它們仍然存在) ...


