// =================================================================================================
// 觸發器管理工具 - V47.4.1
// 版本：V47.4.1 - 2025-08-05
// 用途：自動化管理 Google Apps Script 觸發器
// =================================================================================================

/**
 * 🔧 自動更新觸發器為台北自來水帳單處理版本
 * 這個函數會自動刪除舊觸發器並創建新的
 */
function updateTriggerForWaterBill() {
  Logger.log('🔧 === 開始更新觸發器 ===');
  
  try {
    // 步驟 1: 列出所有現有觸發器
    Logger.log('📋 檢查現有觸發器...');
    const existingTriggers = ScriptApp.getProjectTriggers();
    
    Logger.log(`找到 ${existingTriggers.length} 個現有觸發器:`);
    existingTriggers.forEach((trigger, index) => {
      Logger.log(`  ${index + 1}. 函數: ${trigger.getHandlerFunction()}, 類型: ${trigger.getEventType()}`);
    });
    
    // 步驟 2: 刪除舊的 Email 處理觸發器
    Logger.log('🗑️ 刪除舊的 Email 處理觸發器...');
    let deletedCount = 0;
    
    const emailFunctions = [
      'processAutomatedEmails',
      'processAutomatedEmailsFixed',
      'processAutomatedEmailsV46Compatible',
      'processAutomatedEmailsSimplified',
      'processAutomatedEmailsEnhanced',
      'processReceiptsByEmailRules'
    ];
    
    existingTriggers.forEach(trigger => {
      const functionName = trigger.getHandlerFunction();
      if (emailFunctions.includes(functionName)) {
        Logger.log(`  刪除觸發器: ${functionName}`);
        ScriptApp.deleteTrigger(trigger);
        deletedCount++;
      }
    });
    
    Logger.log(`✅ 已刪除 ${deletedCount} 個舊觸發器`);
    
    // 步驟 3: 創建新的觸發器
    Logger.log('⏰ 創建新的台北自來水帳單處理觸發器...');
    
    const newTrigger = ScriptApp.newTrigger('processAutomatedEmailsWithWaterBill')
      .timeBased()
      .everyMinutes(15)
      .create();
    
    Logger.log(`✅ 新觸發器已創建: ${newTrigger.getHandlerFunction()}`);
    Logger.log(`   觸發頻率: 每 15 分鐘`);
    Logger.log(`   觸發器 ID: ${newTrigger.getUniqueId()}`);
    
    // 步驟 4: 驗證新觸發器
    Logger.log('🔍 驗證新觸發器...');
    const updatedTriggers = ScriptApp.getProjectTriggers();
    const waterBillTrigger = updatedTriggers.find(t => 
      t.getHandlerFunction() === 'processAutomatedEmailsWithWaterBill'
    );
    
    if (waterBillTrigger) {
      Logger.log('✅ 新觸發器驗證成功');
    } else {
      Logger.log('❌ 新觸發器驗證失敗');
      return false;
    }
    
    // 步驟 5: 測試新觸發器函數
    Logger.log('🧪 測試新觸發器函數...');
    try {
      if (typeof processAutomatedEmailsWithWaterBill === 'function') {
        Logger.log('✅ 觸發器函數存在且可調用');
      } else {
        Logger.log('❌ 觸發器函數不存在');
        return false;
      }
    } catch (testError) {
      Logger.log(`❌ 觸發器函數測試失敗: ${testError.toString()}`);
      return false;
    }
    
    Logger.log('🎉 === 觸發器更新完成 ===');
    Logger.log('✅ 舊觸發器已刪除');
    Logger.log('✅ 新觸發器已創建');
    Logger.log('✅ 台北自來水帳單處理功能已啟用');
    Logger.log('📧 系統將每 15 分鐘自動檢查並處理 ebill@water.gov.taipei 的郵件');
    
    return true;
    
  } catch (error) {
    Logger.log(`❌ 觸發器更新失敗: ${error.toString()}`);
    return false;
  }
}

/**
 * 📋 列出所有現有觸發器
 */
function listAllTriggers() {
  Logger.log('📋 === 所有觸發器列表 ===');
  
  try {
    const triggers = ScriptApp.getProjectTriggers();
    
    if (triggers.length === 0) {
      Logger.log('ℹ️ 沒有找到任何觸發器');
      return;
    }
    
    Logger.log(`找到 ${triggers.length} 個觸發器:`);
    
    triggers.forEach((trigger, index) => {
      const functionName = trigger.getHandlerFunction();
      const eventType = trigger.getEventType();
      const source = trigger.getTriggerSource();
      const uniqueId = trigger.getUniqueId();
      
      Logger.log(`\n${index + 1}. 觸發器詳情:`);
      Logger.log(`   函數名稱: ${functionName}`);
      Logger.log(`   事件類型: ${eventType}`);
      Logger.log(`   事件來源: ${source}`);
      Logger.log(`   唯一 ID: ${uniqueId}`);
      
      // 如果是時間驅動的觸發器，顯示更多詳情
      if (eventType === ScriptApp.EventType.CLOCK) {
        try {
          // 注意：某些觸發器屬性可能無法直接訪問
          Logger.log(`   觸發頻率: 時間驅動觸發器`);
        } catch (e) {
          Logger.log(`   觸發頻率: 無法獲取詳細信息`);
        }
      }
    });
    
    Logger.log('\n=== 觸發器列表結束 ===');
    
  } catch (error) {
    Logger.log(`❌ 列出觸發器失敗: ${error.toString()}`);
  }
}

/**
 * 🗑️ 刪除所有 Email 相關的觸發器
 */
function deleteAllEmailTriggers() {
  Logger.log('🗑️ === 刪除所有 Email 相關觸發器 ===');
  
  try {
    const triggers = ScriptApp.getProjectTriggers();
    let deletedCount = 0;
    
    const emailFunctions = [
      'processAutomatedEmails',
      'processAutomatedEmailsFixed',
      'processAutomatedEmailsV46Compatible',
      'processAutomatedEmailsSimplified',
      'processAutomatedEmailsEnhanced',
      'processAutomatedEmailsWithWaterBill',
      'processReceiptsByEmailRules',
      'processReceiptsByEmailRulesEnhanced'
    ];
    
    triggers.forEach(trigger => {
      const functionName = trigger.getHandlerFunction();
      if (emailFunctions.includes(functionName)) {
        Logger.log(`刪除觸發器: ${functionName} (ID: ${trigger.getUniqueId()})`);
        ScriptApp.deleteTrigger(trigger);
        deletedCount++;
      }
    });
    
    Logger.log(`✅ 已刪除 ${deletedCount} 個 Email 相關觸發器`);
    
    if (deletedCount === 0) {
      Logger.log('ℹ️ 沒有找到需要刪除的 Email 觸發器');
    }
    
  } catch (error) {
    Logger.log(`❌ 刪除觸發器失敗: ${error.toString()}`);
  }
}

/**
 * ⏰ 僅創建台北自來水帳單處理觸發器
 */
function createWaterBillTriggerOnly() {
  Logger.log('⏰ === 創建台北自來水帳單處理觸發器 ===');
  
  try {
    // 檢查函數是否存在
    if (typeof processAutomatedEmailsWithWaterBill !== 'function') {
      Logger.log('❌ processAutomatedEmailsWithWaterBill 函數不存在');
      Logger.log('💡 請先將 Code_gs_Water_Bill_Patch.gs 的內容添加到 Code.gs 中');
      return false;
    }
    
    // 檢查是否已存在相同的觸發器
    const existingTriggers = ScriptApp.getProjectTriggers();
    const existingWaterBillTrigger = existingTriggers.find(t => 
      t.getHandlerFunction() === 'processAutomatedEmailsWithWaterBill'
    );
    
    if (existingWaterBillTrigger) {
      Logger.log('ℹ️ 台北自來水帳單處理觸發器已存在');
      Logger.log(`   觸發器 ID: ${existingWaterBillTrigger.getUniqueId()}`);
      return true;
    }
    
    // 創建新觸發器
    const newTrigger = ScriptApp.newTrigger('processAutomatedEmailsWithWaterBill')
      .timeBased()
      .everyMinutes(15)
      .create();
    
    Logger.log(`✅ 台北自來水帳單處理觸發器已創建`);
    Logger.log(`   函數: ${newTrigger.getHandlerFunction()}`);
    Logger.log(`   頻率: 每 15 分鐘`);
    Logger.log(`   ID: ${newTrigger.getUniqueId()}`);
    
    return true;
    
  } catch (error) {
    Logger.log(`❌ 創建觸發器失敗: ${error.toString()}`);
    return false;
  }
}

/**
 * 🧪 測試觸發器函數是否正常工作
 */
function testTriggerFunction() {
  Logger.log('🧪 === 測試觸發器函數 ===');
  
  try {
    // 測試新的觸發器函數
    if (typeof processAutomatedEmailsWithWaterBill === 'function') {
      Logger.log('✅ processAutomatedEmailsWithWaterBill 函數存在');
      
      // 實際執行測試（注意：這會處理真實的郵件）
      Logger.log('🔄 執行函數測試...');
      const result = processAutomatedEmailsWithWaterBill();
      
      Logger.log(`✅ 函數執行完成，結果: ${result}`);
      Logger.log('🎉 觸發器函數測試成功');
      
    } else {
      Logger.log('❌ processAutomatedEmailsWithWaterBill 函數不存在');
      Logger.log('💡 請確認已將補丁代碼添加到 Code.gs 中');
      return false;
    }
    
    return true;
    
  } catch (error) {
    Logger.log(`❌ 觸發器函數測試失敗: ${error.toString()}`);
    return false;
  }
}

/**
 * 🎯 一鍵完成觸發器設定（推薦使用）
 */
function oneClickTriggerSetup() {
  Logger.log('🎯 === 一鍵完成觸發器設定 ===');
  
  try {
    // 步驟 1: 列出現有觸發器
    Logger.log('📋 步驟 1: 檢查現有觸發器...');
    listAllTriggers();
    
    // 步驟 2: 更新觸發器
    Logger.log('\n🔧 步驟 2: 更新觸發器...');
    const updateSuccess = updateTriggerForWaterBill();
    
    if (!updateSuccess) {
      Logger.log('❌ 觸發器更新失敗');
      return false;
    }
    
    // 步驟 3: 測試觸發器函數
    Logger.log('\n🧪 步驟 3: 測試觸發器函數...');
    const testSuccess = testTriggerFunction();
    
    if (!testSuccess) {
      Logger.log('❌ 觸發器函數測試失敗');
      return false;
    }
    
    // 步驟 4: 最終驗證
    Logger.log('\n🔍 步驟 4: 最終驗證...');
    const finalTriggers = ScriptApp.getProjectTriggers();
    const waterBillTrigger = finalTriggers.find(t => 
      t.getHandlerFunction() === 'processAutomatedEmailsWithWaterBill'
    );
    
    if (waterBillTrigger) {
      Logger.log('🎉 === 一鍵設定完成 ===');
      Logger.log('✅ 觸發器已成功更新');
      Logger.log('✅ 函數測試通過');
      Logger.log('✅ 台北自來水帳單自動處理功能已啟用');
      Logger.log('📧 系統將每 15 分鐘自動檢查 ebill@water.gov.taipei 的郵件');
      
      return true;
    } else {
      Logger.log('❌ 最終驗證失敗');
      return false;
    }
    
  } catch (error) {
    Logger.log(`❌ 一鍵設定失敗: ${error.toString()}`);
    return false;
  }
}

// =================================================================================================
// 【使用說明】觸發器管理函數使用指南
// =================================================================================================
/*
📋 函數使用指南：

🎯 推薦使用（一鍵完成）：
   oneClickTriggerSetup()
   - 自動完成所有觸發器設定步驟

📋 個別功能：
   listAllTriggers()                    - 查看所有觸發器
   updateTriggerForWaterBill()          - 更新為水費處理觸發器
   deleteAllEmailTriggers()             - 刪除所有 Email 觸發器
   createWaterBillTriggerOnly()         - 僅創建水費觸發器
   testTriggerFunction()                - 測試觸發器函數

⚠️ 注意事項：
1. 執行前請確認已將 Code_gs_Water_Bill_Patch.gs 的內容添加到 Code.gs
2. 觸發器修改需要授權，首次執行時請允許權限
3. 建議先執行 listAllTriggers() 查看現有觸發器狀況
*/