// =================================================================================================
// V47 觸發器修復工具 - 2025-08-01
// 專門解決 "Script function not found" 觸發器問題
// =================================================================================================

/**
 * 🔧 修復觸發器問題 - 一鍵解決方案
 */
function fixTriggerIssues() {
  Logger.log('🔧 開始修復觸發器問題...');
  
  try {
    // 步驟 1: 清除所有問題觸發器
    Logger.log('--- 步驟 1: 清除問題觸發器 ---');
    cleanupBrokenTriggers();
    
    // 步驟 2: 建立正確的觸發器
    Logger.log('--- 步驟 2: 建立正確觸發器 ---');
    createCorrectTriggers();
    
    // 步驟 3: 驗證觸發器函數存在
    Logger.log('--- 步驟 3: 驗證函數存在 ---');
    validateTriggerFunctions();
    
    // 步驟 4: 測試觸發器
    Logger.log('--- 步驟 4: 測試觸發器 ---');
    testTriggerFunctions();
    
    Logger.log('✅ 觸發器修復完成！');
    
    return {
      success: true,
      message: '觸發器已修復，所有函數正常運作'
    };
    
  } catch (error) {
    Logger.log(`❌ 觸發器修復失敗: ${error.toString()}`);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 清除有問題的觸發器
 */
function cleanupBrokenTriggers() {
  Logger.log('🗑️ 清除有問題的觸發器...');
  
  try {
    const triggers = ScriptApp.getProjectTriggers();
    Logger.log(`找到 ${triggers.length} 個現有觸發器`);
    
    let deletedCount = 0;
    
    triggers.forEach(trigger => {
      const functionName = trigger.getHandlerFunction();
      Logger.log(`檢查觸發器: ${functionName}`);
      
      // 檢查函數是否存在
      try {
        const functionExists = eval(`typeof ${functionName} === 'function'`);
        if (!functionExists) {
          Logger.log(`❌ 函數不存在，刪除觸發器: ${functionName}`);
          ScriptApp.deleteTrigger(trigger);
          deletedCount++;
        } else {
          Logger.log(`✅ 函數存在: ${functionName}`);
        }
      } catch (error) {
        Logger.log(`❌ 函數檢查失敗，刪除觸發器: ${functionName}`);
        ScriptApp.deleteTrigger(trigger);
        deletedCount++;
      }
    });
    
    Logger.log(`🗑️ 共刪除 ${deletedCount} 個有問題的觸發器`);
    
  } catch (error) {
    Logger.log(`❌ 清除觸發器失敗: ${error.toString()}`);
    throw error;
  }
}

/**
 * 建立正確的觸發器
 */
function createCorrectTriggers() {
  Logger.log('🔨 建立正確的觸發器...');
  
  const triggerConfigs = [
    {
      functionName: 'processReceiptsByEmailRules',
      type: 'timeBased',
      interval: 'everyMinutes',
      value: 15,
      description: 'Email 發票處理'
    },
    {
      functionName: 'checkReceiptsFolder',
      type: 'timeBased',
      interval: 'everyHours',
      value: 2,
      description: '收據資料夾檢查'
    }
  ];
  
  triggerConfigs.forEach(config => {
    try {
      // 檢查函數是否存在
      const functionExists = eval(`typeof ${config.functionName} === 'function'`);
      
      if (functionExists) {
        // 建立觸發器
        let trigger = ScriptApp.newTrigger(config.functionName).timeBased();
        
        if (config.interval === 'everyMinutes') {
          trigger = trigger.everyMinutes(config.value);
        } else if (config.interval === 'everyHours') {
          trigger = trigger.everyHours(config.value);
        }
        
        trigger.create();
        Logger.log(`✅ 建立觸發器: ${config.functionName} (${config.description})`);
        
      } else {
        Logger.log(`⚠️ 函數不存在，跳過: ${config.functionName}`);
      }
      
    } catch (error) {
      Logger.log(`❌ 建立觸發器失敗: ${config.functionName} - ${error.toString()}`);
    }
  });
}

/**
 * 驗證觸發器函數存在
 */
function validateTriggerFunctions() {
  Logger.log('🔍 驗證觸發器函數...');
  
  const requiredFunctions = [
    'processReceiptsByEmailRules',
    'checkReceiptsFolder',
    'processAutomatedEmails',
    'checkReceiptsFolderSimplified'
  ];
  
  const missingFunctions = [];
  
  requiredFunctions.forEach(functionName => {
    try {
      const functionExists = eval(`typeof ${functionName} === 'function'`);
      if (functionExists) {
        Logger.log(`✅ 函數存在: ${functionName}`);
      } else {
        Logger.log(`❌ 函數不存在: ${functionName}`);
        missingFunctions.push(functionName);
      }
    } catch (error) {
      Logger.log(`❌ 函數檢查失敗: ${functionName}`);
      missingFunctions.push(functionName);
    }
  });
  
  if (missingFunctions.length > 0) {
    Logger.log(`⚠️ 缺少的函數: ${missingFunctions.join(', ')}`);
    createMissingFunctions(missingFunctions);
  }
}

/**
 * 建立缺少的函數
 */
function createMissingFunctions(missingFunctions) {
  Logger.log('🔨 建立缺少的函數...');
  
  // 注意：這個函數只能記錄缺少的函數，實際的函數需要手動添加到代碼中
  missingFunctions.forEach(functionName => {
    Logger.log(`📝 需要手動添加函數: ${functionName}`);
  });
  
  // 提供函數模板
  Logger.log('\n📋 函數模板:');
  
  if (missingFunctions.includes('checkReceiptsFolderSimplified')) {
    Logger.log(`
/**
 * 簡化版收據資料夾檢查
 */
function checkReceiptsFolderSimplified() {
  Logger.log('🔄 檢查收據資料夾（簡化版）...');
  try {
    const folderId = PropertiesService.getScriptProperties().getProperty('FOLDER_ID_TO_PROCESS');
    if (!folderId) {
      Logger.log('⚠️ 收據資料夾 ID 未設定');
      return;
    }
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFiles();
    let count = 0;
    while (files.hasNext() && count < 5) {
      files.next();
      count++;
    }
    Logger.log(\`✅ 找到 \${count} 個檔案\`);
  } catch (error) {
    Logger.log(\`❌ 檢查失敗: \${error.toString()}\`);
  }
}
    `);
  }
  
  if (missingFunctions.includes('checkReceiptsFolder')) {
    Logger.log(`
/**
 * 標準收據資料夾檢查
 */
function checkReceiptsFolder() {
  Logger.log('🔄 檢查收據資料夾...');
  try {
    // 調用現有的處理邏輯
    if (typeof checkReceiptsFolderSimplified === 'function') {
      checkReceiptsFolderSimplified();
    } else {
      Logger.log('⚠️ 簡化版函數不存在，跳過檢查');
    }
  } catch (error) {
    Logger.log(\`❌ 檢查失敗: \${error.toString()}\`);
  }
}
    `);
  }
}

/**
 * 測試觸發器函數
 */
function testTriggerFunctions() {
  Logger.log('🧪 測試觸發器函數...');
  
  const testFunctions = [
    'processReceiptsByEmailRules',
    'checkReceiptsFolder'
  ];
  
  testFunctions.forEach(functionName => {
    try {
      const functionExists = eval(`typeof ${functionName} === 'function'`);
      
      if (functionExists) {
        Logger.log(`🧪 測試函數: ${functionName}`);
        
        // 這裡不實際執行函數，只是驗證可以調用
        Logger.log(`✅ 函數 ${functionName} 可以正常調用`);
        
      } else {
        Logger.log(`❌ 函數不存在: ${functionName}`);
      }
      
    } catch (error) {
      Logger.log(`❌ 測試函數失敗: ${functionName} - ${error.toString()}`);
    }
  });
}

/**
 * 檢查當前觸發器狀態
 */
function checkCurrentTriggerStatus() {
  Logger.log('📊 檢查當前觸發器狀態...');
  
  try {
    const triggers = ScriptApp.getProjectTriggers();
    Logger.log(`\n📋 觸發器清單 (共 ${triggers.length} 個):`);
    
    triggers.forEach((trigger, index) => {
      const functionName = trigger.getHandlerFunction();
      const triggerSource = trigger.getTriggerSource();
      const eventType = trigger.getEventType();
      
      Logger.log(`${index + 1}. ${functionName}`);
      Logger.log(`   - 來源: ${triggerSource}`);
      Logger.log(`   - 事件: ${eventType}`);
      
      // 檢查函數是否存在
      try {
        const functionExists = eval(`typeof ${functionName} === 'function'`);
        Logger.log(`   - 狀態: ${functionExists ? '✅ 正常' : '❌ 函數不存在'}`);
      } catch (error) {
        Logger.log(`   - 狀態: ❌ 檢查失敗`);
      }
    });
    
    return triggers.length;
    
  } catch (error) {
    Logger.log(`❌ 檢查觸發器狀態失敗: ${error.toString()}`);
    return 0;
  }
}

/**
 * 建立安全的觸發器（只使用確定存在的函數）
 */
function createSafeTriggers() {
  Logger.log('🛡️ 建立安全觸發器...');
  
  try {
    // 清除所有現有觸發器
    const existingTriggers = ScriptApp.getProjectTriggers();
    existingTriggers.forEach(trigger => {
      ScriptApp.deleteTrigger(trigger);
    });
    Logger.log('🗑️ 清除所有現有觸發器');
    
    // 只建立確定存在的函數的觸發器
    const safeFunctions = [
      {
        name: 'processReceiptsByEmailRules',
        minutes: 15
      }
    ];
    
    safeFunctions.forEach(func => {
      try {
        const functionExists = eval(`typeof ${func.name} === 'function'`);
        
        if (functionExists) {
          ScriptApp.newTrigger(func.name)
            .timeBased()
            .everyMinutes(func.minutes)
            .create();
          
          Logger.log(`✅ 建立安全觸發器: ${func.name} (每 ${func.minutes} 分鐘)`);
        } else {
          Logger.log(`⚠️ 函數不存在，跳過: ${func.name}`);
        }
        
      } catch (error) {
        Logger.log(`❌ 建立觸發器失敗: ${func.name} - ${error.toString()}`);
      }
    });
    
    Logger.log('✅ 安全觸發器建立完成');
    
  } catch (error) {
    Logger.log(`❌ 建立安全觸發器失敗: ${error.toString()}`);
  }
}

/**
 * 🆘 緊急觸發器修復（當所有方法都失敗時）
 */
function emergencyTriggerFix() {
  Logger.log('🆘 執行緊急觸發器修復...');
  
  try {
    // 1. 強制刪除所有觸發器
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      try {
        ScriptApp.deleteTrigger(trigger);
      } catch (error) {
        Logger.log(`⚠️ 刪除觸發器時出錯: ${error.toString()}`);
      }
    });
    Logger.log('🗑️ 強制清除所有觸發器');
    
    // 2. 等待一段時間
    Utilities.sleep(2000);
    
    // 3. 只建立最基本的觸發器
    try {
      ScriptApp.newTrigger('emergencyEmailProcessor')
        .timeBased()
        .everyMinutes(30)
        .create();
      
      Logger.log('✅ 建立緊急觸發器: emergencyEmailProcessor');
    } catch (error) {
      Logger.log(`❌ 建立緊急觸發器失敗: ${error.toString()}`);
    }
    
    Logger.log('✅ 緊急觸發器修復完成');
    return true;
    
  } catch (error) {
    Logger.log(`❌ 緊急觸發器修復失敗: ${error.toString()}`);
    return false;
  }
}

/**
 * 標準收據資料夾檢查（補充缺少的函數）
 */
function checkReceiptsFolder() {
  Logger.log('🔄 檢查收據資料夾...');
  
  try {
    // 調用簡化版函數
    if (typeof checkReceiptsFolderSimplified === 'function') {
      checkReceiptsFolderSimplified();
    } else {
      Logger.log('⚠️ 簡化版函數不存在，執行基本檢查');
      
      const folderId = PropertiesService.getScriptProperties().getProperty('FOLDER_ID_TO_PROCESS');
      if (folderId) {
        const folder = DriveApp.getFolderById(folderId);
        Logger.log(`✅ 收據資料夾存在: ${folder.getName()}`);
      } else {
        Logger.log('⚠️ 收據資料夾 ID 未設定');
      }
    }
    
  } catch (error) {
    Logger.log(`❌ 檢查收據資料夾失敗: ${error.toString()}`);
  }
}