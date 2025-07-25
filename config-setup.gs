/**
 * 智慧記帳 GEM - 配置快速設定腳本
 * 
 * 此腳本提供一鍵式配置設定，讓使用者能快速完成系統配置
 */

/**
 * 一鍵配置設定嚮導
 * 引導使用者完成基本配置
 */
function configSetupWizard() {
  Logger.log('🧙‍♂️ 開始配置設定嚮導...');
  
  try {
    // 步驟 1: 檢查基礎環境
    Logger.log('📋 步驟 1: 檢查基礎環境');
    const envCheck = checkEnvironment();
    if (!envCheck.success) {
      Logger.log('❌ 環境檢查失敗，請先完成基礎設定');
      envCheck.issues.forEach(issue => Logger.log(`  - ${issue}`));
      return false;
    }
    Logger.log('✅ 環境檢查通過');
    
    // 步驟 2: 初始化預設配置
    Logger.log('\n⚙️ 步驟 2: 初始化預設配置');
    initializeConfigs();
    
    // 步驟 3: 設定必要的敏感配置
    Logger.log('\n🔐 步驟 3: 檢查敏感配置');
    const sensitiveCheck = checkSensitiveConfigs();
    if (!sensitiveCheck.allSet) {
      Logger.log('⚠️ 發現未設定的敏感配置：');
      sensitiveCheck.missing.forEach(config => {
        Logger.log(`  - ${config.key}: ${config.description}`);
      });
      Logger.log('\n請使用以下函數設定敏感配置：');
      Logger.log('setSensitiveConfig("GEMINI_API_KEY", "your_api_key_here")');
      Logger.log('setSensitiveConfig("MAIN_LEDGER_ID", "your_sheets_id_here")');
    }
    
    // 步驟 4: 個人化設定建議
    Logger.log('\n👤 步驟 4: 個人化設定建議');
    suggestPersonalizedConfigs();
    
    // 步驟 5: 驗證最終配置
    Logger.log('\n✅ 步驟 5: 驗證最終配置');
    const finalCheck = configHealthCheck();
    
    if (finalCheck.healthy) {
      Logger.log('\n🎉 配置設定嚮導完成！系統已準備就緒。');
      Logger.log('💡 建議執行 runFullDeploymentTest() 進行完整測試');
    } else {
      Logger.log('\n⚠️ 配置設定完成，但發現一些問題需要處理');
    }
    
    return finalCheck.healthy;
    
  } catch (error) {
    Logger.log(`❌ 配置設定嚮導失敗: ${error.toString()}`);
    return false;
  }
}

/**
 * 檢查基礎環境
 */
function checkEnvironment() {
  const issues = [];
  
  try {
    // 檢查 Google Sheets 存取
    const testSheetId = configManager.get('MAIN_LEDGER_ID');
    if (!testSheetId || testSheetId.includes('YOUR_')) {
      issues.push('MAIN_LEDGER_ID 未設定，請先設定 Google Sheets ID');
    } else {
      try {
        const ss = SpreadsheetApp.openById(testSheetId);
        const settingsSheet = ss.getSheetByName('Settings');
        if (!settingsSheet) {
          issues.push('Settings 工作表不存在，請執行 setup-sheets-template.gs');
        }
      } catch (e) {
        issues.push(`無法存取 Google Sheets: ${e.toString()}`);
      }
    }
    
    // 檢查必要的工作表
    if (issues.length === 0) {
      const requiredSheets = ['All Records', 'Settings', 'Events', 'Participants', 'Debts'];
      const ss = SpreadsheetApp.openById(testSheetId);
      const existingSheets = ss.getSheets().map(sheet => sheet.getName());
      const missingSheets = requiredSheets.filter(name => !existingSheets.includes(name));
      
      if (missingSheets.length > 0) {
        issues.push(`缺少必要工作表: ${missingSheets.join(', ')}`);
      }
    }
    
  } catch (error) {
    issues.push(`環境檢查錯誤: ${error.toString()}`);
  }
  
  return {
    success: issues.length === 0,
    issues: issues
  };
}

/**
 * 檢查敏感配置
 */
function checkSensitiveConfigs() {
  const sensitiveConfigs = [
    { key: 'GEMINI_API_KEY', description: 'Google Gemini API 金鑰' },
    { key: 'MAIN_LEDGER_ID', description: 'Google Sheets 主帳本 ID' },
    { key: 'GCP_PROJECT_ID', description: 'Google Cloud Platform 專案 ID' }
  ];
  
  const missing = [];
  
  sensitiveConfigs.forEach(config => {
    const value = configManager.get(config.key);
    if (!value || String(value).includes('YOUR_') || String(value).includes('_HERE')) {
      missing.push(config);
    }
  });
  
  return {
    allSet: missing.length === 0,
    missing: missing,
    total: sensitiveConfigs.length
  };
}

/**
 * 個人化設定建議
 */
function suggestPersonalizedConfigs() {
  const suggestions = [
    {
      key: 'DEFAULT_CURRENCY',
      current: configManager.get('DEFAULT_CURRENCY'),
      suggestion: 'TWD',
      reason: '根據地區設定建議使用台幣'
    },
    {
      key: 'LANGUAGE_PREFERENCE', 
      current: configManager.get('LANGUAGE_PREFERENCE'),
      suggestion: 'zh-TW',
      reason: '繁體中文介面'
    },
    {
      key: 'TIMEZONE',
      current: configManager.get('TIMEZONE'),
      suggestion: 'Asia/Taipei',
      reason: '台灣時區'
    },
    {
      key: 'NOTIFICATION_LEVEL',
      current: configManager.get('NOTIFICATION_LEVEL'),
      suggestion: 'INFO',
      reason: '建議設為 INFO 以接收重要通知'
    }
  ];
  
  Logger.log('💡 個人化設定建議：');
  suggestions.forEach(item => {
    if (item.current !== item.suggestion) {
      Logger.log(`  ${item.key}: 目前 "${item.current}" → 建議 "${item.suggestion}" (${item.reason})`);
      Logger.log(`    設定指令: configManager.set('${item.key}', '${item.suggestion}')`);
    }
  });
}

/**
 * 設定敏感配置的安全函數
 */
function setSensitiveConfig(key, value) {
  const sensitiveKeys = ['GEMINI_API_KEY', 'DOCUMENT_AI_PROCESSOR_ID', 'WEBHOOK_SECRET'];
  
  if (!key || !value) {
    throw new Error('金鑰和值都不能為空');
  }
  
  if (sensitiveKeys.includes(key)) {
    // 儲存到 Apps Script 屬性（安全）
    PropertiesService.getScriptProperties().setProperty(key, value);
    Logger.log(`✅ 敏感配置 ${key} 已安全儲存到 Apps Script 屬性`);
    
    // 清除快取
    configManager.clearCache();
    
    // 如果是 API 金鑰，進行測試
    if (key === 'GEMINI_API_KEY') {
      Logger.log('🧪 測試 Gemini API 金鑰...');
      const testResult = testApiKey(value);
      if (testResult.success) {
        Logger.log('✅ API 金鑰測試通過');
      } else {
        Logger.log(`❌ API 金鑰測試失敗: ${testResult.error}`);
      }
    }
  } else {
    // 一般配置儲存到 Google Sheets
    configManager.set(key, value);
    Logger.log(`✅ 配置 ${key} 已儲存到 Google Sheets`);
  }
}

/**
 * 批次設定配置
 */
function setBatchConfigs(configObject) {
  if (!configObject || typeof configObject !== 'object') {
    throw new Error('請提供有效的配置物件');
  }
  
  Logger.log('📦 開始批次設定配置...');
  
  let successCount = 0;
  let errorCount = 0;
  
  Object.entries(configObject).forEach(([key, value]) => {
    try {
      configManager.set(key, value);
      Logger.log(`✅ ${key}: ${value}`);
      successCount++;
    } catch (error) {
      Logger.log(`❌ ${key}: 設定失敗 - ${error.toString()}`);
      errorCount++;
    }
  });
  
  Logger.log(`\n📊 批次設定完成: ${successCount} 成功, ${errorCount} 失敗`);
  
  // 驗證配置
  if (errorCount === 0) {
    Logger.log('🔍 驗證配置...');
    const validation = configManager.validate();
    if (validation.isValid) {
      Logger.log('✅ 所有配置驗證通過');
    } else {
      Logger.log('⚠️ 配置驗證發現問題:');
      validation.errors.forEach(error => Logger.log(`  - ${error}`));
    }
  }
}

/**
 * 匯出配置為 JSON
 */
function exportConfigsToJson() {
  try {
    const allConfigs = configManager.getAll();
    const exportData = {
      exportTime: new Date().toISOString(),
      version: 'V46.0',
      configs: allConfigs
    };
    
    const jsonString = JSON.stringify(exportData, null, 2);
    Logger.log('📄 配置 JSON 匯出：');
    Logger.log(jsonString);
    
    // 儲存到 Google Drive
    const blob = Utilities.newBlob(
      jsonString,
      'application/json',
      `gem-configs-export-${new Date().toISOString().split('T')[0]}.json`
    );
    
    const file = DriveApp.createFile(blob);
    Logger.log(`💾 配置已匯出到 Google Drive: ${file.getName()}`);
    
    return {
      json: jsonString,
      fileId: file.getId(),
      fileName: file.getName()
    };
  } catch (error) {
    Logger.log(`❌ 匯出配置失敗: ${error.toString()}`);
    throw error;
  }
}

/**
 * 從 JSON 匯入配置
 */
function importConfigsFromJson(jsonString) {
  try {
    const importData = JSON.parse(jsonString);
    
    if (!importData.configs) {
      throw new Error('無效的配置 JSON 格式');
    }
    
    Logger.log('📥 開始匯入配置...');
    Logger.log(`📅 匯出時間: ${importData.exportTime}`);
    Logger.log(`🏷️ 版本: ${importData.version}`);
    
    // 批次設定配置
    setBatchConfigs(importData.configs);
    
    Logger.log('✅ 配置匯入完成');
    
  } catch (error) {
    Logger.log(`❌ 匯入配置失敗: ${error.toString()}`);
    throw error;
  }
}

/**
 * 重置配置為預設值
 */
function resetConfigsToDefault() {
  Logger.log('🔄 重置配置為預設值...');
  
  try {
    // 獲取預設配置
    const defaults = configManager.getDefaultConfigs();
    
    // 確認操作
    Logger.log('⚠️ 此操作將重置所有配置為預設值');
    Logger.log('💡 建議先執行 backupConfigs() 進行備份');
    
    // 批次設定預設值
    setBatchConfigs(defaults);
    
    Logger.log('✅ 配置已重置為預設值');
    
  } catch (error) {
    Logger.log(`❌ 重置配置失敗: ${error.toString()}`);
    throw error;
  }
}

/**
 * 配置比較工具
 */
function compareConfigs(config1, config2) {
  const differences = [];
  const allKeys = new Set([...Object.keys(config1), ...Object.keys(config2)]);
  
  allKeys.forEach(key => {
    const val1 = config1[key];
    const val2 = config2[key];
    
    if (val1 !== val2) {
      differences.push({
        key: key,
        value1: val1,
        value2: val2,
        status: val1 === undefined ? 'added' : val2 === undefined ? 'removed' : 'changed'
      });
    }
  });
  
  Logger.log('🔍 配置比較結果：');
  if (differences.length === 0) {
    Logger.log('✅ 配置完全相同');
  } else {
    differences.forEach(diff => {
      const status = diff.status === 'added' ? '新增' : diff.status === 'removed' ? '移除' : '變更';
      Logger.log(`  ${status}: ${diff.key}`);
      if (diff.status === 'changed') {
        Logger.log(`    舊值: ${diff.value1}`);
        Logger.log(`    新值: ${diff.value2}`);
      }
    });
  }
  
  return differences;
}

/**
 * 配置效能分析
 */
function analyzeConfigPerformance() {
  Logger.log('📊 開始配置效能分析...');
  
  const startTime = Date.now();
  
  // 測試配置讀取效能
  const testKeys = ['DEFAULT_CURRENCY', 'API_TIMEOUT', 'BATCH_SIZE', 'DUPLICATE_THRESHOLD'];
  const iterations = 100;
  
  // 測試快取效能
  Logger.log('🚀 測試快取讀取效能...');
  const cacheStartTime = Date.now();
  for (let i = 0; i < iterations; i++) {
    testKeys.forEach(key => configManager.get(key, null, true));
  }
  const cacheTime = Date.now() - cacheStartTime;
  
  // 測試非快取效能
  Logger.log('🐌 測試非快取讀取效能...');
  configManager.clearCache();
  const noCacheStartTime = Date.now();
  for (let i = 0; i < iterations; i++) {
    testKeys.forEach(key => configManager.get(key, null, false));
  }
  const noCacheTime = Date.now() - noCacheStartTime;
  
  const totalTime = Date.now() - startTime;
  
  Logger.log('\n📈 效能分析結果：');
  Logger.log(`  快取讀取: ${cacheTime}ms (${iterations * testKeys.length} 次操作)`);
  Logger.log(`  非快取讀取: ${noCacheTime}ms (${iterations * testKeys.length} 次操作)`);
  Logger.log(`  效能提升: ${Math.round((noCacheTime - cacheTime) / noCacheTime * 100)}%`);
  Logger.log(`  總測試時間: ${totalTime}ms`);
  
  return {
    cacheTime: cacheTime,
    noCacheTime: noCacheTime,
    improvement: Math.round((noCacheTime - cacheTime) / noCacheTime * 100),
    totalTime: totalTime
  };
}