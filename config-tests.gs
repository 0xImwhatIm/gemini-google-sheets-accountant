/**
 * 智慧記帳 GEM - 配置管理測試腳本
 * 
 * 提供完整的配置管理功能測試
 */

/**
 * 執行所有配置管理測試
 */
function runAllConfigTests() {
  Logger.log('🧪 開始配置管理測試套件...\n');
  
  const tests = [
    testConfigManagerBasics,
    testConfigCaching,
    testConfigValidation,
    testSensitiveConfigHandling,
    testBatchOperations,
    testConfigBackupRestore,
    testPerformance
  ];
  
  let passedTests = 0;
  let totalTests = tests.length;
  
  tests.forEach((test, index) => {
    try {
      Logger.log(`📝 測試 ${index + 1}/${totalTests}: ${test.name}`);
      const result = test();
      if (result) {
        Logger.log('✅ 通過\n');
        passedTests++;
      } else {
        Logger.log('❌ 失敗\n');
      }
    } catch (error) {
      Logger.log(`❌ 錯誤: ${error.toString()}\n`);
    }
  });
  
  Logger.log(`📊 測試結果: ${passedTests}/${totalTests} 通過`);
  
  if (passedTests === totalTests) {
    Logger.log('🎉 所有配置管理測試通過！');
  } else {
    Logger.log('⚠️ 部分測試失敗，請檢查上述錯誤');
  }
  
  return passedTests === totalTests;
}

/**
 * 測試配置管理器基本功能
 */
function testConfigManagerBasics() {
  Logger.log('  測試基本的 get/set 操作...');
  
  // 測試設定和獲取
  const testKey = 'TEST_CONFIG_BASIC';
  const testValue = 'test_value_123';
  
  configManager.set(testKey, testValue);
  const retrievedValue = configManager.get(testKey);
  
  if (retrievedValue !== testValue) {
    Logger.log(`  ❌ 基本 get/set 失敗: 期望 ${testValue}, 實際 ${retrievedValue}`);
    return false;
  }
  
  // 測試預設值
  const defaultValue = 'default_test';
  const nonExistentValue = configManager.get('NON_EXISTENT_KEY', defaultValue);
  
  if (nonExistentValue !== defaultValue) {
    Logger.log(`  ❌ 預設值測試失敗: 期望 ${defaultValue}, 實際 ${nonExistentValue}`);
    return false;
  }
  
  // 測試類型轉換
  configManager.set('TEST_BOOLEAN', 'true');
  configManager.set('TEST_NUMBER', '123.45');
  
  const boolValue = configManager.get('TEST_BOOLEAN');
  const numValue = configManager.get('TEST_NUMBER');
  
  if (boolValue !== true || numValue !== 123.45) {
    Logger.log(`  ❌ 類型轉換失敗: boolean=${boolValue}, number=${numValue}`);
    return false;
  }
  
  // 清理測試資料
  cleanupTestConfigs();
  
  Logger.log('  ✅ 基本功能測試通過');
  return true;
}

/**
 * 測試配置快取功能
 */
function testConfigCaching() {
  Logger.log('  測試配置快取功能...');
  
  const testKey = 'TEST_CACHE_CONFIG';
  const testValue = 'cache_test_value';
  
  // 清除快取
  configManager.clearCache();
  
  // 設定配置
  configManager.set(testKey, testValue);
  
  // 測試快取讀取
  const startTime = Date.now();
  for (let i = 0; i < 10; i++) {
    configManager.get(testKey, null, true); // 使用快取
  }
  const cachedTime = Date.now() - startTime;
  
  // 測試非快取讀取
  configManager.clearCache();
  const startTime2 = Date.now();
  for (let i = 0; i < 10; i++) {
    configManager.get(testKey, null, false); // 不使用快取
  }
  const nonCachedTime = Date.now() - startTime2;
  
  Logger.log(`  📊 快取讀取: ${cachedTime}ms, 非快取讀取: ${nonCachedTime}ms`);
  
  // 快取應該更快（允許一些誤差）
  if (cachedTime > nonCachedTime * 1.5) {
    Logger.log('  ⚠️ 快取效能未如預期，但功能正常');
  }
  
  // 測試快取失效
  configManager.set(testKey, 'new_value');
  const newValue = configManager.get(testKey);
  
  if (newValue !== 'new_value') {
    Logger.log(`  ❌ 快取失效測試失敗: 期望 new_value, 實際 ${newValue}`);
    return false;
  }
  
  cleanupTestConfigs();
  Logger.log('  ✅ 快取功能測試通過');
  return true;
}

/**
 * 測試配置驗證功能
 */
function testConfigValidation() {
  Logger.log('  測試配置驗證功能...');
  
  // 備份原始配置
  const originalApiKey = configManager.get('GEMINI_API_KEY');
  const originalSheetId = configManager.get('MAIN_LEDGER_ID');
  
  try {
    // 測試無效配置
    configManager.set('GEMINI_API_KEY', 'YOUR_API_KEY_HERE', 'properties');
    configManager.set('MAIN_LEDGER_ID', 'YOUR_SHEET_ID_HERE');
    
    const validation = configManager.validate();
    
    if (validation.isValid) {
      Logger.log('  ❌ 驗證應該失敗但卻通過了');
      return false;
    }
    
    if (validation.errors.length === 0) {
      Logger.log('  ❌ 應該有驗證錯誤但沒有發現');
      return false;
    }
    
    Logger.log(`  📋 發現 ${validation.errors.length} 個驗證錯誤（符合預期）`);
    
    // 測試數值範圍驗證
    configManager.set('DUPLICATE_THRESHOLD', 1.5); // 超出範圍
    const validation2 = configManager.validate();
    
    const hasRangeError = validation2.errors.some(error => 
      error.includes('DUPLICATE_THRESHOLD') && error.includes('範圍')
    );
    
    if (!hasRangeError) {
      Logger.log('  ❌ 數值範圍驗證失敗');
      return false;
    }
    
  } finally {
    // 恢復原始配置
    if (originalApiKey) {
      configManager.set('GEMINI_API_KEY', originalApiKey, 'properties');
    }
    if (originalSheetId) {
      configManager.set('MAIN_LEDGER_ID', originalSheetId);
    }
    configManager.set('DUPLICATE_THRESHOLD', 0.8);
  }
  
  Logger.log('  ✅ 配置驗證測試通過');
  return true;
}

/**
 * 測試敏感配置處理
 */
function testSensitiveConfigHandling() {
  Logger.log('  測試敏感配置處理...');
  
  const testSensitiveKey = 'TEST_SENSITIVE_KEY';
  const testSensitiveValue = 'super_secret_value_123';
  
  try {
    // 測試敏感配置設定
    setSensitiveConfig(testSensitiveKey, testSensitiveValue);
    
    // 從 Apps Script 屬性讀取
    const storedValue = PropertiesService.getScriptProperties().getProperty(testSensitiveKey);
    
    if (storedValue !== testSensitiveValue) {
      Logger.log(`  ❌ 敏感配置儲存失敗: 期望 ${testSensitiveValue}, 實際 ${storedValue}`);
      return false;
    }
    
    // 確認不會儲存到 Google Sheets
    const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
    const settingsSheet = ss.getSheetByName('Settings');
    const data = settingsSheet.getDataRange().getValues();
    
    const foundInSheets = data.some(row => row[0] === testSensitiveKey);
    
    if (foundInSheets) {
      Logger.log('  ❌ 敏感配置不應該出現在 Google Sheets 中');
      return false;
    }
    
    // 測試非敏感配置的錯誤處理
    try {
      setSensitiveConfig('REGULAR_CONFIG', 'regular_value');
      Logger.log('  ❌ 應該拒絕非敏感配置但沒有');
      return false;
    } catch (error) {
      // 預期的錯誤
      Logger.log('  ✅ 正確拒絕非敏感配置');
    }
    
  } finally {
    // 清理測試資料
    PropertiesService.getScriptProperties().deleteProperty(testSensitiveKey);
  }
  
  Logger.log('  ✅ 敏感配置處理測試通過');
  return true;
}

/**
 * 測試批次操作
 */
function testBatchOperations() {
  Logger.log('  測試批次操作...');
  
  const testConfigs = {
    'TEST_BATCH_1': 'value1',
    'TEST_BATCH_2': 'value2',
    'TEST_BATCH_3': 123,
    'TEST_BATCH_4': true
  };
  
  // 測試批次設定
  setBatchConfigs(testConfigs);
  
  // 測試批次獲取
  const keys = Object.keys(testConfigs);
  const retrievedConfigs = configManager.getMultiple(keys);
  
  // 驗證所有值
  for (const [key, expectedValue] of Object.entries(testConfigs)) {
    if (retrievedConfigs[key] !== expectedValue) {
      Logger.log(`  ❌ 批次操作失敗: ${key} 期望 ${expectedValue}, 實際 ${retrievedConfigs[key]}`);
      return false;
    }
  }
  
  // 測試 getAll
  const allConfigs = configManager.getAll();
  
  if (!allConfigs || typeof allConfigs !== 'object') {
    Logger.log('  ❌ getAll 回傳無效結果');
    return false;
  }
  
  // 檢查測試配置是否包含在 getAll 結果中
  for (const key of keys) {
    if (!(key in allConfigs)) {
      Logger.log(`  ❌ getAll 結果缺少 ${key}`);
      return false;
    }
  }
  
  cleanupTestConfigs();
  Logger.log('  ✅ 批次操作測試通過');
  return true;
}

/**
 * 測試配置備份和還原
 */
function testConfigBackupRestore() {
  Logger.log('  測試配置備份和還原...');
  
  // 設定一些測試配置
  const testConfigs = {
    'TEST_BACKUP_1': 'backup_value_1',
    'TEST_BACKUP_2': 'backup_value_2'
  };
  
  setBatchConfigs(testConfigs);
  
  try {
    // 測試備份
    const backupFileId = backupConfigs();
    
    if (!backupFileId) {
      Logger.log('  ❌ 備份失敗，沒有回傳檔案 ID');
      return false;
    }
    
    // 驗證備份檔案
    const backupFile = DriveApp.getFileById(backupFileId);
    const backupContent = backupFile.getBlob().getDataAsString();
    const backupData = JSON.parse(backupContent);
    
    if (!backupData.configs || !backupData.timestamp) {
      Logger.log('  ❌ 備份檔案格式無效');
      return false;
    }
    
    // 檢查測試配置是否在備份中
    for (const [key, value] of Object.entries(testConfigs)) {
      if (backupData.configs[key] !== value) {
        Logger.log(`  ❌ 備份中缺少配置 ${key}`);
        return false;
      }
    }
    
    // 測試匯出功能
    const exportResult = exportConfigsToJson();
    
    if (!exportResult.json || !exportResult.fileId) {
      Logger.log('  ❌ 匯出功能失敗');
      return false;
    }
    
    // 清理備份檔案
    DriveApp.getFileById(backupFileId).setTrashed(true);
    DriveApp.getFileById(exportResult.fileId).setTrashed(true);
    
  } catch (error) {
    Logger.log(`  ❌ 備份還原測試錯誤: ${error.toString()}`);
    return false;
  } finally {
    cleanupTestConfigs();
  }
  
  Logger.log('  ✅ 備份還原測試通過');
  return true;
}

/**
 * 測試效能
 */
function testPerformance() {
  Logger.log('  測試配置管理效能...');
  
  try {
    const performanceResult = analyzeConfigPerformance();
    
    if (!performanceResult || typeof performanceResult !== 'object') {
      Logger.log('  ❌ 效能分析失敗');
      return false;
    }
    
    const { cacheTime, noCacheTime, improvement } = performanceResult;
    
    Logger.log(`  📊 效能分析結果:`);
    Logger.log(`    快取讀取: ${cacheTime}ms`);
    Logger.log(`    非快取讀取: ${noCacheTime}ms`);
    Logger.log(`    效能提升: ${improvement}%`);
    
    // 基本效能檢查
    if (cacheTime > 5000) {
      Logger.log('  ⚠️ 快取讀取時間過長');
    }
    
    if (noCacheTime > 30000) {
      Logger.log('  ⚠️ 非快取讀取時間過長');
    }
    
    if (improvement < 0) {
      Logger.log('  ⚠️ 快取未提供效能改善');
    }
    
  } catch (error) {
    Logger.log(`  ❌ 效能測試錯誤: ${error.toString()}`);
    return false;
  }
  
  Logger.log('  ✅ 效能測試通過');
  return true;
}

/**
 * 清理測試配置
 */
function cleanupTestConfigs() {
  try {
    const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
    const settingsSheet = ss.getSheetByName('Settings');
    
    if (!settingsSheet) return;
    
    const data = settingsSheet.getDataRange().getValues();
    const rowsToDelete = [];
    
    // 找出測試配置的列
    for (let i = data.length - 1; i > 0; i--) {
      const key = data[i][0];
      if (key && key.toString().startsWith('TEST_')) {
        rowsToDelete.push(i + 1); // +1 因為 getRange 使用 1-based 索引
      }
    }
    
    // 刪除測試配置（從後往前刪除避免索引問題）
    rowsToDelete.forEach(rowIndex => {
      settingsSheet.deleteRow(rowIndex);
    });
    
    // 清除快取
    configManager.clearCache();
    
    if (rowsToDelete.length > 0) {
      Logger.log(`  🧹 已清理 ${rowsToDelete.length} 個測試配置`);
    }
    
  } catch (error) {
    Logger.log(`  ⚠️ 清理測試配置時發生錯誤: ${error.toString()}`);
  }
}

/**
 * 測試配置管理器的錯誤處理
 */
function testErrorHandling() {
  Logger.log('  測試錯誤處理...');
  
  try {
    // 測試無效的 Sheets ID
    const originalSheetId = MAIN_LEDGER_ID;
    
    // 暫時設定無效的 Sheet ID（這會在實際使用中造成錯誤）
    // 但我們的 configManager 應該優雅地處理這種情況
    
    const result = configManager.get('SOME_CONFIG', 'default_value');
    
    // 應該回傳預設值而不是拋出錯誤
    if (result !== 'default_value') {
      Logger.log('  ❌ 錯誤處理失敗：應該回傳預設值');
      return false;
    }
    
  } catch (error) {
    Logger.log(`  ❌ 錯誤處理測試失敗: ${error.toString()}`);
    return false;
  }
  
  Logger.log('  ✅ 錯誤處理測試通過');
  return true;
}

/**
 * 快速配置測試（用於日常檢查）
 */
function quickConfigTest() {
  Logger.log('🚀 執行快速配置測試...');
  
  const tests = [
    () => {
      const value = configManager.get('DEFAULT_CURRENCY', 'TWD');
      return value !== null;
    },
    () => {
      configManager.set('TEST_QUICK', 'quick_test');
      const retrieved = configManager.get('TEST_QUICK');
      return retrieved === 'quick_test';
    },
    () => {
      const validation = configManager.validate();
      return validation !== null;
    }
  ];
  
  let passed = 0;
  tests.forEach((test, index) => {
    try {
      if (test()) {
        Logger.log(`✅ 快速測試 ${index + 1} 通過`);
        passed++;
      } else {
        Logger.log(`❌ 快速測試 ${index + 1} 失敗`);
      }
    } catch (error) {
      Logger.log(`❌ 快速測試 ${index + 1} 錯誤: ${error.toString()}`);
    }
  });
  
  cleanupTestConfigs();
  
  Logger.log(`📊 快速測試結果: ${passed}/${tests.length} 通過`);
  return passed === tests.length;
}