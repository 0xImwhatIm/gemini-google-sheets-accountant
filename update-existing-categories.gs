// =================================================================================================
// 更新現有記錄分類工具 - 2025-08-04
// 將現有的財政部發票記錄更新為正確的智能分類
// =================================================================================================

/**
 * 🔄 更新現有財政部發票記錄的分類
 */
function updateExistingGovernmentInvoiceCategories() {
  Logger.log('🔄 開始更新現有財政部發票記錄的分類...');
  
  try {
    const classifier = new SmartCategoryClassifier();
    const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    
    if (!mainLedgerId) {
      Logger.log('❌ 未設定 MAIN_LEDGER_ID');
      return;
    }
    
    const ss = SpreadsheetApp.openById(mainLedgerId);
    const sheet = ss.getSheetByName('All Records');
    const data = sheet.getDataRange().getValues();
    
    let updatedCount = 0;
    let totalGovernmentRecords = 0;
    
    // 從第2行開始（跳過標題行）
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // 檢查是否為財政部發票記錄
      const source = String(row[16] || ''); // SOURCE 欄位
      const item = String(row[6] || '');    // ITEM 欄位
      const currentCategory = String(row[5] || ''); // CATEGORY 欄位
      
      if (source.includes('財政部') || item.includes('財政部發票')) {
        totalGovernmentRecords++;
        
        // 從項目描述中提取商家名稱
        const merchantMatch = item.match(/財政部發票\s*-\s*(.+)/);
        if (merchantMatch) {
          const merchantName = merchantMatch[1].trim();
          
          // 使用智能分類器
          const newCategory = classifier.classify(merchantName);
          
          // 如果分類有變化，更新記錄
          if (newCategory !== currentCategory) {
            // 更新 Google Sheets 中的分類
            sheet.getRange(i + 1, 6).setValue(newCategory); // CATEGORY 欄位是第6欄
            
            updatedCount++;
            Logger.log(`✅ 更新第 ${i + 1} 行: ${merchantName} → ${currentCategory} 改為 ${newCategory}`);
          } else {
            Logger.log(`⏭️ 第 ${i + 1} 行已是正確分類: ${merchantName} → ${newCategory}`);
          }
        }
      }
    }
    
    Logger.log(`\n📊 更新完成統計:`);
    Logger.log(`   財政部發票總數: ${totalGovernmentRecords}`);
    Logger.log(`   更新分類數量: ${updatedCount}`);
    Logger.log(`   保持不變數量: ${totalGovernmentRecords - updatedCount}`);
    
    if (updatedCount > 0) {
      Logger.log(`✅ 成功更新 ${updatedCount} 筆記錄的分類`);
    } else {
      Logger.log(`ℹ️ 所有記錄的分類都已是最新的`);
    }
    
  } catch (error) {
    Logger.log(`❌ 更新分類失敗: ${error.toString()}`);
  }
}

/**
 * 🔍 預覽將要更新的分類變更
 */
function previewCategoryUpdates() {
  Logger.log('🔍 預覽將要更新的分類變更...');
  
  try {
    const classifier = new SmartCategoryClassifier();
    const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    
    if (!mainLedgerId) {
      Logger.log('❌ 未設定 MAIN_LEDGER_ID');
      return;
    }
    
    const ss = SpreadsheetApp.openById(mainLedgerId);
    const sheet = ss.getSheetByName('All Records');
    const data = sheet.getDataRange().getValues();
    
    const changes = [];
    let totalGovernmentRecords = 0;
    
    // 從第2行開始（跳過標題行）
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // 檢查是否為財政部發票記錄
      const source = String(row[16] || '');
      const item = String(row[6] || '');
      const currentCategory = String(row[5] || '');
      
      if (source.includes('財政部') || item.includes('財政部發票')) {
        totalGovernmentRecords++;
        
        // 從項目描述中提取商家名稱
        const merchantMatch = item.match(/財政部發票\s*-\s*(.+)/);
        if (merchantMatch) {
          const merchantName = merchantMatch[1].trim();
          const newCategory = classifier.classify(merchantName);
          
          if (newCategory !== currentCategory) {
            changes.push({
              row: i + 1,
              merchant: merchantName,
              oldCategory: currentCategory,
              newCategory: newCategory,
              amount: row[1],
              date: row[0]
            });
          }
        }
      }
    }
    
    Logger.log(`\n📊 預覽統計:`);
    Logger.log(`   財政部發票總數: ${totalGovernmentRecords}`);
    Logger.log(`   需要更新的記錄: ${changes.length}`);
    
    if (changes.length > 0) {
      Logger.log(`\n📋 將要進行的分類變更:`);
      
      // 按分類分組顯示
      const categoryGroups = {};
      changes.forEach(change => {
        if (!categoryGroups[change.newCategory]) {
          categoryGroups[change.newCategory] = [];
        }
        categoryGroups[change.newCategory].push(change);
      });
      
      Object.entries(categoryGroups).forEach(([category, items]) => {
        Logger.log(`\n🏷️ 將更新為「${category}」類別 (${items.length} 筆):`);
        items.slice(0, 5).forEach(item => {
          Logger.log(`   第 ${item.row} 行: ${item.merchant} (${item.amount} 元) [${item.oldCategory} → ${item.newCategory}]`);
        });
        if (items.length > 5) {
          Logger.log(`   ... 還有 ${items.length - 5} 筆記錄`);
        }
      });
      
      Logger.log(`\n💡 如果預覽結果正確，請執行 updateExistingGovernmentInvoiceCategories() 來應用變更`);
    } else {
      Logger.log(`ℹ️ 所有記錄的分類都已是最新的，無需更新`);
    }
    
  } catch (error) {
    Logger.log(`❌ 預覽失敗: ${error.toString()}`);
  }
}

/**
 * 🔄 更新現有記錄的日期為實際消費日期
 */
function updateExistingGovernmentInvoiceDates() {
  Logger.log('🔄 開始更新現有財政部發票記錄的日期...');
  
  try {
    const dateProcessor = new SmartDateProcessor();
    const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    
    if (!mainLedgerId) {
      Logger.log('❌ 未設定 MAIN_LEDGER_ID');
      return;
    }
    
    const ss = SpreadsheetApp.openById(mainLedgerId);
    const sheet = ss.getSheetByName('All Records');
    const data = sheet.getDataRange().getValues();
    
    let updatedCount = 0;
    let totalGovernmentRecords = 0;
    
    // 從第2行開始（跳過標題行）
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // 檢查是否為財政部發票記錄
      const source = String(row[16] || '');
      const metaData = String(row[20] || '');
      
      if (source.includes('財政部')) {
        totalGovernmentRecords++;
        
        try {
          // 嘗試從 META_DATA 中提取原始發票日期
          const meta = JSON.parse(metaData);
          if (meta.originalData && meta.originalData.發票日期) {
            const invoiceDateStr = meta.originalData.發票日期;
            const actualDate = dateProcessor.parseInvoiceDate(invoiceDateStr);
            
            if (actualDate) {
              const currentDate = new Date(row[0]);
              const newDateStr = dateProcessor.formatDate(actualDate);
              const currentDateStr = dateProcessor.formatDate(currentDate);
              
              if (newDateStr !== currentDateStr) {
                // 更新日期
                sheet.getRange(i + 1, 1).setValue(newDateStr); // TIMESTAMP 欄位是第1欄
                
                updatedCount++;
                Logger.log(`✅ 更新第 ${i + 1} 行日期: ${currentDateStr} → ${newDateStr}`);
              }
            }
          }
        } catch (parseError) {
          Logger.log(`⚠️ 第 ${i + 1} 行 META_DATA 解析失敗`);
        }
      }
    }
    
    Logger.log(`\n📊 日期更新完成統計:`);
    Logger.log(`   財政部發票總數: ${totalGovernmentRecords}`);
    Logger.log(`   更新日期數量: ${updatedCount}`);
    
    if (updatedCount > 0) {
      Logger.log(`✅ 成功更新 ${updatedCount} 筆記錄的日期`);
    } else {
      Logger.log(`ℹ️ 所有記錄的日期都已是最新的`);
    }
    
  } catch (error) {
    Logger.log(`❌ 更新日期失敗: ${error.toString()}`);
  }
}

/**
 * 🎯 一鍵完整更新現有記錄
 */
function updateAllExistingRecords() {
  Logger.log('🎯 開始一鍵完整更新現有記錄...');
  
  try {
    Logger.log('\n=== 1. 預覽分類變更 ===');
    previewCategoryUpdates();
    
    Logger.log('\n=== 2. 更新分類 ===');
    updateExistingGovernmentInvoiceCategories();
    
    Logger.log('\n=== 3. 更新日期 ===');
    updateExistingGovernmentInvoiceDates();
    
    Logger.log('\n🎉 所有更新完成！');
    Logger.log('✅ 現有記錄已更新為智能分類和實際消費日期');
    
  } catch (error) {
    Logger.log(`❌ 一鍵更新失敗: ${error.toString()}`);
  }
}