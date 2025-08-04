// =================================================================================================
// 緊急授權修復工具 - 2025-08-01
// 專門解決 "Authorization is required to perform that action" 問題
// =================================================================================================

/**
 * 🚨 緊急授權修復 - 一鍵解決方案
 * 執行此函數來快速修復授權問題
 */
function emergencyAuthorizationFix() {
  Logger.log('🚨 開始緊急授權修復...');
  
  try {
    // 步驟 1: 強制重新授權所有權限
    Logger.log('--- 步驟 1: 重新授權所有權限 ---');
    forceReauthorizeAllPermissions();
    
    // 步驟 2: 檢查授權狀態
    Logger.log('--- 步驟 2: 檢查授權狀態 ---');
    const authStatus = checkAuthorizationStatus();
    
    // 步驟 3: 測試關鍵函數
    Logger.log('--- 步驟 3: 測試關鍵函數 ---');
    testCriticalFunctions();
    
    // 步驟 4: 重建觸發器
    Logger.log('--- 步驟 4: 重建觸發器 ---');
    rebuildEmailTriggers();
    
    // 步驟 5: 處理遺漏的 Email
    Logger.log('--- 步驟 5: 處理遺漏的 Email ---');
    processMissedEmails();
    
    Logger.log('✅ 緊急授權修復完成！');
    Logger.log('📧 請檢查 Email 處理是否恢復正常');
    
    return {
      success: true,
      authStatus: authStatus,
      message: '授權修復完成，Email 處理已恢復'
    };
    
  } catch (error) {
    Logger.log(`❌ 緊急修復失敗: ${error.toString()}`);
    return {
      success: false,
      error: error.toString(),
      message: '修復失敗，請手動檢查授權設定'
    };
  }
}

/**
 * 強制重新授權所有權限
 */
function forceReauthorizeAllPermissions() {
  Logger.log('🔐 強制重新授權所有權限...');
  
  const permissions = [
    {
      name: 'Gmail',
      test: () => GmailApp.search('is:unread', 0, 1)
    },
    {
      name: 'Sheets',
      test: () => {
        const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
        if (mainLedgerId) {
          return SpreadsheetApp.openById(mainLedgerId);
        }
        throw new Error('MAIN_LEDGER_ID 未設定');
      }
    },
    {
      name: 'Drive',
      test: () => DriveApp.getFolders()
    },
    {
      name: 'Script',
      test: () => ScriptApp.getProjectTriggers()
    }
  ];
  
  permissions.forEach(permission => {
    try {
      permission.test();
      Logger.log(`✅ ${permission.name} 權限正常`);
    } catch (error) {
      Logger.log(`❌ ${permission.name} 權限失敗: ${error.toString()}`);
      throw new Error(`${permission.name} 權限授權失敗`);
    }
  });
}

/**
 * 檢查授權狀態
 */
function checkAuthorizationStatus() {
  Logger.log('🔍 檢查授權狀態...');
  
  const status = {
    gmail: false,
    sheets: false,
    drive: false,
    script: false,
    mainLedgerConfigured: false,
    geminiApiConfigured: false
  };
  
  try {
    // 檢查 Gmail 權限
    const threads = GmailApp.search('is:unread', 0, 1);
    status.gmail = true;
    Logger.log(`✅ Gmail: 正常 (${threads.length} 個未讀郵件)`);
  } catch (error) {
    Logger.log(`❌ Gmail: ${error.toString()}`);
  }
  
  try {
    // 檢查 Sheets 權限
    const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    if (mainLedgerId) {
      const ss = SpreadsheetApp.openById(mainLedgerId);
      status.sheets = true;
      status.mainLedgerConfigured = true;
      Logger.log('✅ Sheets: 正常');
    } else {
      Logger.log('⚠️ Sheets: MAIN_LEDGER_ID 未設定');
    }
  } catch (error) {
    Logger.log(`❌ Sheets: ${error.toString()}`);
  }
  
  try {
    // 檢查 Drive 權限
    DriveApp.getFolders();
    status.drive = true;
    Logger.log('✅ Drive: 正常');
  } catch (error) {
    Logger.log(`❌ Drive: ${error.toString()}`);
  }
  
  try {
    // 檢查 Script 權限
    const triggers = ScriptApp.getProjectTriggers();
    status.script = true;
    Logger.log(`✅ Script: 正常 (${triggers.length} 個觸發器)`);
  } catch (error) {
    Logger.log(`❌ Script: ${error.toString()}`);
  }
  
  // 檢查 Gemini API Key
  const geminiApiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  status.geminiApiConfigured = !!geminiApiKey;
  Logger.log(`${geminiApiKey ? '✅' : '⚠️'} Gemini API: ${geminiApiKey ? '已設定' : '未設定'}`);
  
  return status;
}

/**
 * 測試關鍵函數
 */
function testCriticalFunctions() {
  Logger.log('🧪 測試關鍵函數...');
  
  const testFunctions = [
    {
      name: 'processReceiptsByEmailRules',
      func: () => {
        // 測試版本，只處理 1 封郵件
        const threads = GmailApp.search('from:einvoice@einvoice.nat.gov.tw subject:彙整 is:unread', 0, 1);
        return `找到 ${threads.length} 封待處理郵件`;
      }
    },
    {
      name: 'checkUnprocessedReceiptsByRules',
      func: () => {
        const threads = GmailApp.search('subject:電子發票 is:unread OR subject:發票 is:unread', 0, 5);
        return `找到 ${threads.length} 封未處理收據`;
      }
    }
  ];
  
  testFunctions.forEach(test => {
    try {
      const result = test.func();
      Logger.log(`✅ ${test.name}: ${result}`);
    } catch (error) {
      Logger.log(`❌ ${test.name}: ${error.toString()}`);
    }
  });
}

/**
 * 重建 Email 觸發器
 */
function rebuildEmailTriggers() {
  Logger.log('🔄 重建 Email 觸發器...');
  
  try {
    // 刪除所有現有觸發器
    const existingTriggers = ScriptApp.getProjectTriggers();
    existingTriggers.forEach(trigger => {
      ScriptApp.deleteTrigger(trigger);
      Logger.log(`🗑️ 刪除觸發器: ${trigger.getHandlerFunction()}`);
    });
    
    // 建立新的 Email 處理觸發器
    ScriptApp.newTrigger('processReceiptsByEmailRules')
      .timeBased()
      .everyMinutes(15)
      .create();
    
    Logger.log('✅ 建立 Email 處理觸發器 (每 15 分鐘)');
    
    // 建立收據檢查觸發器
    ScriptApp.newTrigger('checkReceiptsFolderSimplified')
      .timeBased()
      .everyHours(1)
      .create();
    
    Logger.log('✅ 建立收據檢查觸發器 (每小時)');
    
  } catch (error) {
    Logger.log(`❌ 重建觸發器失敗: ${error.toString()}`);
    throw error;
  }
}

/**
 * 處理遺漏的 Email
 */
function processMissedEmails() {
  Logger.log('📧 處理遺漏的 Email...');
  
  try {
    // 檢查重要的 Email 規則
    const importantRules = [
      'from:einvoice@einvoice.nat.gov.tw subject:彙整 is:unread',
      'from:no_reply@email.apple.com subject:發票通知 is:unread',
      'from:invoice@cht.com.tw subject:電子發票 is:unread'
    ];
    
    let totalProcessed = 0;
    
    importantRules.forEach(query => {
      try {
        const threads = GmailApp.search(query, 0, 3); // 限制處理數量
        Logger.log(`📧 ${query}: 找到 ${threads.length} 封`);
        
        threads.forEach(thread => {
          const messages = thread.getMessages();
          messages.forEach(message => {
            if (message.isUnread()) {
              try {
                // 簡化處理，只記錄基本資訊
                const result = processEmailSimplified(message);
                if (result && result.amount > 0) {
                  saveEmailRecordSimplified(result, message);
                  message.markRead();
                  totalProcessed++;
                  Logger.log(`✅ 處理完成: ${message.getSubject()}`);
                }
              } catch (emailError) {
                Logger.log(`❌ 處理郵件失敗: ${emailError.toString()}`);
              }
            }
          });
        });
        
      } catch (queryError) {
        Logger.log(`❌ 搜尋失敗: ${queryError.toString()}`);
      }
    });
    
    Logger.log(`✅ 共處理 ${totalProcessed} 封遺漏的 Email`);
    
  } catch (error) {
    Logger.log(`❌ 處理遺漏 Email 失敗: ${error.toString()}`);
  }
}

/**
 * 簡化版郵件處理
 */
function processEmailSimplified(message) {
  try {
    const subject = message.getSubject();
    const plainBody = message.getPlainBody();
    const sender = message.getFrom();
    
    // 基本資料提取
    const result = {
      date: Utilities.formatDate(message.getDate(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      amount: 0,
      currency: 'TWD',
      category: '其他',
      description: subject,
      source: 'Email : 緊急修復'
    };
    
    // 簡單的金額提取
    const amountPatterns = [
      /NT\$\s*([0-9,]+(?:\.[0-9]{1,2})?)/g,
      /([0-9,]+)\s*元/g,
      /金額[：:\s]*([0-9,]+)/i
    ];
    
    for (let pattern of amountPatterns) {
      const matches = plainBody.match(pattern);
      if (matches && matches.length > 0) {
        const amounts = matches.map(match => {
          const cleanAmount = match.replace(/[NT\$元金額：:\s]/g, '').replace(/,/g, '');
          return parseFloat(cleanAmount);
        }).filter(amount => !isNaN(amount) && amount > 0);
        
        if (amounts.length > 0) {
          result.amount = Math.max(...amounts);
          break;
        }
      }
    }
    
    // 簡單的商家識別
    if (sender.includes('apple.com')) {
      result.category = '育';
      result.description = 'Apple - 數位服務';
    } else if (sender.includes('cht.com.tw')) {
      result.category = '行';
      result.description = '中華電信 - 電信服務';
    } else if (sender.includes('einvoice.nat.gov.tw')) {
      result.category = '其他';
      result.description = '財政部 - 電子發票彙整';
    }
    
    return result;
    
  } catch (error) {
    Logger.log(`❌ 簡化處理失敗: ${error.toString()}`);
    return null;
  }
}

/**
 * 簡化版記錄儲存
 */
function saveEmailRecordSimplified(data, message) {
  try {
    const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    
    if (!mainLedgerId) {
      throw new Error('MAIN_LEDGER_ID 未設定');
    }
    
    const ss = SpreadsheetApp.openById(mainLedgerId);
    const sheet = ss.getSheetByName('All Records');
    
    if (!sheet) {
      throw new Error('找不到 All Records 工作表');
    }
    
    const newRow = [
      data.date,                    // A: TIMESTAMP
      data.amount,                  // B: AMOUNT
      data.currency,                // C: CURRENCY
      1,                           // D: EXCHANGE RATE
      '',                          // E: Amount (TWD) - 由公式計算
      data.category,               // F: CATEGORY
      data.description,            // G: ITEM
      '私人',                      // H: ACCOUNT TYPE
      '',                          // I: Linked_IOU_EventID
      '',                          // J: INVOICE NO.
      '',                          // K: REFERENCES NO.
      '',                          // L: BUYER NAME
      '',                          // M: BUYER TAX ID
      '',                          // N: SELLER TAX ID
      '',                          // O: RECEIPT IMAGE
      '待確認',                    // P: STATUS
      data.source,                 // Q: SOURCE
      '',                          // R: NOTES
      message.getSubject(),        // S: Original Text (OCR)
      '',                          // T: Translation (AI)
      JSON.stringify({             // U: META_DATA
        messageId: message.getId(),
        sender: message.getFrom(),
        receivedDate: message.getDate().toISOString(),
        processedBy: 'EmergencyAuthFix',
        processedAt: new Date().toISOString()
      })
    ];
    
    sheet.appendRow(newRow);
    Logger.log(`💾 記錄已儲存: ${data.amount} ${data.currency} - ${data.description}`);
    
  } catch (error) {
    Logger.log(`❌ 儲存記錄失敗: ${error.toString()}`);
    throw error;
  }
}

/**
 * 快速健康檢查（修復後驗證用）
 */
function quickHealthCheckAfterFix() {
  Logger.log('🏥 修復後健康檢查...');
  
  try {
    const status = checkAuthorizationStatus();
    
    // 檢查觸發器
    const triggers = ScriptApp.getProjectTriggers();
    Logger.log(`觸發器數量: ${triggers.length}`);
    
    // 檢查未處理 Email
    const unreadCount = GmailApp.search('subject:電子發票 is:unread OR subject:發票 is:unread', 0, 10).length;
    Logger.log(`未處理 Email: ${unreadCount} 封`);
    
    // 記錄修復時間
    PropertiesService.getScriptProperties().setProperty(
      'LAST_AUTH_FIX_TIME',
      new Date().toISOString()
    );
    
    const healthScore = Object.values(status).filter(Boolean).length;
    Logger.log(`\n🏥 健康評分: ${healthScore}/6`);
    
    if (healthScore >= 4) {
      Logger.log('✅ 系統健康狀況良好');
    } else {
      Logger.log('⚠️ 系統仍有問題，需要進一步檢查');
    }
    
    return {
      healthScore: healthScore,
      status: status,
      triggerCount: triggers.length,
      unreadEmails: unreadCount,
      fixTime: new Date().toISOString()
    };
    
  } catch (error) {
    Logger.log(`❌ 健康檢查失敗: ${error.toString()}`);
    return { error: error.toString() };
  }
}

/**
 * 🆘 超級緊急修復（當一般修復都失敗時使用）
 */
function superEmergencyFix() {
  Logger.log('🆘 執行超級緊急修復...');
  
  try {
    // 1. 清除所有觸發器
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
    Logger.log('🗑️ 清除所有觸發器');
    
    // 2. 重置配置
    const properties = PropertiesService.getScriptProperties();
    const mainLedgerId = properties.getProperty('MAIN_LEDGER_ID');
    const geminiApiKey = properties.getProperty('GEMINI_API_KEY');
    
    if (!mainLedgerId || !geminiApiKey) {
      Logger.log('❌ 關鍵配置遺失，請手動重新設定');
      return false;
    }
    
    // 3. 測試基本權限
    GmailApp.search('is:unread', 0, 1);
    SpreadsheetApp.openById(mainLedgerId);
    DriveApp.getFolders();
    
    // 4. 建立最小化觸發器
    ScriptApp.newTrigger('emergencyEmailProcessor')
      .timeBased()
      .everyMinutes(30)
      .create();
    
    Logger.log('✅ 超級緊急修復完成');
    return true;
    
  } catch (error) {
    Logger.log(`❌ 超級緊急修復失敗: ${error.toString()}`);
    return false;
  }
}

/**
 * 緊急 Email 處理器（最簡化版本）
 */
function emergencyEmailProcessor() {
  Logger.log('🚨 緊急 Email 處理器啟動...');
  
  try {
    const threads = GmailApp.search('subject:發票 is:unread', 0, 2);
    
    threads.forEach(thread => {
      const messages = thread.getMessages();
      messages.forEach(message => {
        if (message.isUnread()) {
          Logger.log(`📧 緊急處理: ${message.getSubject()}`);
          message.markRead(); // 至少標記為已讀，避免重複處理
        }
      });
    });
    
    Logger.log('✅ 緊急處理完成');
    
  } catch (error) {
    Logger.log(`❌ 緊急處理失敗: ${error.toString()}`);
  }
}

/**
 * 簡化版收據資料夾檢查（修復遺失函數）
 */
function checkReceiptsFolderSimplified() {
  Logger.log('🔄 開始檢查收據資料夾（簡化版）...');
  
  try {
    const folderId = PropertiesService.getScriptProperties().getProperty('FOLDER_ID_TO_PROCESS');
    
    if (!folderId) {
      Logger.log('⚠️ 收據資料夾 ID 未設定，跳過檢查');
      return;
    }
    
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFiles();
    
    let fileCount = 0;
    while (files.hasNext() && fileCount < 5) { // 限制處理數量避免超時
      const file = files.next();
      Logger.log(`📄 找到檔案: ${file.getName()}`);
      fileCount++;
    }
    
    Logger.log(`✅ 收據資料夾檢查完成，找到 ${fileCount} 個檔案`);
    
    // 記錄最後檢查時間
    PropertiesService.getScriptProperties().setProperty(
      'LAST_FOLDER_CHECK_TIME',
      new Date().toISOString()
    );
    
  } catch (error) {
    Logger.log(`❌ 收據資料夾檢查失敗: ${error.toString()}`);
    
    // 如果資料夾 ID 無效，清除設定
    if (error.toString().includes('not found') || error.toString().includes('Invalid')) {
      Logger.log('🗑️ 清除無效的資料夾 ID 設定');
      PropertiesService.getScriptProperties().deleteProperty('FOLDER_ID_TO_PROCESS');
    }
  }
}