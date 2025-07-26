/**
 * 修正現有錯誤資料的腳本
 * 根據完整的 21 欄位資料庫結構修正所有欄位對應問題
 */
function fixExistingColumnData() {
  Logger.log('=== 開始修正現有錯誤資料 ===');
  
  try {
    const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      throw new Error(`找不到工作表: ${SHEET_NAME}`);
    }
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    if (values.length < 2) {
      Logger.log('表格中沒有資料需要修正');
      return;
    }
    
    const headers = values[0];
    Logger.log(`表格標題: ${headers.join(', ')}`);
    
    // 找到各欄位的索引
    const currencyColIndex = findColumnIndex(headers, ['CURRENCY', 'Currency', 'currency']);
    const categoryColIndex = findColumnIndex(headers, ['CATEGORY', 'Category', 'category']);
    const exchangeRateColIndex = findColumnIndex(headers, ['EXCHANGE RATE', 'Exchange Rate', 'exchange rate']);
    
    Logger.log(`Currency 欄位索引: ${currencyColIndex}`);
    Logger.log(`Category 欄位索引: ${categoryColIndex}`);
    Logger.log(`Exchange Rate 欄位索引: ${exchangeRateColIndex}`);
    
    const validCurrencies = ['TWD', 'JPY', 'USD', 'EUR', 'CNY'];
    const validCategories = ['食', '衣', '住', '行', '育', '樂', '醫療', '保險', '其他'];
    
    let fixedRows = 0;
    const updates = [];
    
    // 檢查每一行資料
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      let needsUpdate = false;
      const rowUpdates = [];
      
      // 檢查 Currency 欄位
      if (currencyColIndex >= 0) {
        const currencyValue = row[currencyColIndex];
        if (currencyValue && !validCurrencies.includes(currencyValue)) {
          Logger.log(`第 ${i+1} 行 Currency 欄位錯誤: "${currencyValue}" -> "TWD"`);
          rowUpdates.push({
            row: i + 1,
            col: currencyColIndex + 1,
            value: 'TWD'
          });
          needsUpdate = true;
        }
      }
      
      // 檢查 Exchange Rate 欄位
      if (exchangeRateColIndex >= 0 && currencyColIndex >= 0) {
        const currency = rowUpdates.find(u => u.col === currencyColIndex + 1)?.value || row[currencyColIndex];
        if (currency === 'TWD') {
          rowUpdates.push({
            row: i + 1,
            col: exchangeRateColIndex + 1,
            value: 1
          });
          needsUpdate = true;
        }
      }
      
      // 檢查 Category 欄位是否在正確位置
      if (categoryColIndex >= 0) {
        const categoryValue = row[categoryColIndex];
        if (categoryValue && !validCategories.includes(categoryValue)) {
          // 嘗試從描述中推斷類別
          const description = row[categoryColIndex + 1] || row[categoryColIndex - 1] || '';
          const inferredCategory = inferCategoryFromDescription(description.toString());
          Logger.log(`第 ${i+1} 行 Category 欄位可能錯誤: "${categoryValue}" -> "${inferredCategory}"`);
          rowUpdates.push({
            row: i + 1,
            col: categoryColIndex + 1,
            value: inferredCategory
          });
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        updates.push(...rowUpdates);
        fixedRows++;
      }
    }
    
    // 批次更新
    if (updates.length > 0) {
      Logger.log(`準備更新 ${updates.length} 個儲存格`);
      updates.forEach(update => {
        sheet.getRange(update.row, update.col).setValue(update.value);
      });
      Logger.log(`✅ 成功修正 ${fixedRows} 行資料`);
    } else {
      Logger.log('✅ 沒有發現需要修正的資料');
    }
    
  } catch (error) {
    Logger.log(`❌ 修正資料時發生錯誤: ${error.toString()}`);
    throw error;
  }
  
  Logger.log('=== 修正現有錯誤資料完成 ===');
}

/**
 * 尋找欄位索引
 */
function findColumnIndex(headers, possibleNames) {
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].toString().trim();
    if (possibleNames.some(name => header.toLowerCase().includes(name.toLowerCase()))) {
      return i;
    }
  }
  return -1;
}

/**
 * 從描述推斷類別
 */
function inferCategoryFromDescription(description) {
  const desc = description.toLowerCase();
  
  if (desc.includes('咖啡') || desc.includes('餐') || desc.includes('食') || desc.includes('飲料')) {
    return '食';
  } else if (desc.includes('衣') || desc.includes('服裝')) {
    return '衣';
  } else if (desc.includes('房') || desc.includes('住') || desc.includes('租')) {
    return '住';
  } else if (desc.includes('交通') || desc.includes('車') || desc.includes('油')) {
    return '行';
  } else if (desc.includes('書') || desc.includes('學') || desc.includes('課')) {
    return '育';
  } else if (desc.includes('電影') || desc.includes('遊戲') || desc.includes('娛樂')) {
    return '樂';
  } else if (desc.includes('醫') || desc.includes('藥') || desc.includes('健康')) {
    return '醫療';
  } else if (desc.includes('保險')) {
    return '保險';
  } else if (desc.includes('菸') || desc.includes('煙') || desc.includes('酒')) {
    return '其他';
  }
  
  return '其他';
}

/**
 * 重新設定表格標題和結構
 */
function resetTableStructure() {
  Logger.log('=== 重新設定表格結構 ===');
  
  try {
    const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      throw new Error(`找不到工作表: ${SHEET_NAME}`);
    }
    
    // 備份現有資料
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    if (values.length > 1) {
      Logger.log('⚠️ 表格中有資料，建議先備份');
      Logger.log('如果要強制重設，請執行 forceResetTableStructure()');
      return;
    }
    
    // 設定正確的標題行
    const correctHeaders = [
      'TIMESTAMP', 'AMOUNT', 'CURRENCY', 'EXCHANGE RATE', 'Amount (TWD)', 'CATEGORY', 'ITEM', 'ACCOUNT TYPE', 
      'Linked_IOU_EventID', 'INVOICE NO.', 'REFERENCES NO.', 'BUYER NAME', 'BUYER TAX ID', 'SELLER TAX ID', 
      'RECEIPT IMAGE', 'STATUS', 'SOURCE', 'NOTES', 'Original Text (OCR)', 'Translation (AI)', 'META_DATA'
    ];
    
    // 清除第一行並設定新標題
    sheet.getRange(1, 1, 1, sheet.getLastColumn()).clearContent();
    sheet.getRange(1, 1, 1, correctHeaders.length).setValues([correctHeaders]);
    
    // 設定 E 欄位公式
    sheet.getRange('E1').setValue('Amount (TWD)');
    sheet.getRange('E2').setFormula('={"Amount (TWD)"; ARRAYFORMULA(IF(ISBLANK(A2:A),, B2:B * D2:D))}');
    
    Logger.log('✅ 表格結構重設完成');
    
  } catch (error) {
    Logger.log(`❌ 重設表格結構時發生錯誤: ${error.toString()}`);
    throw error;
  }
  
  Logger.log('=== 重新設定表格結構完成 ===');
}

/**
 * 強制重設表格結構（會清除所有資料）
 */
function forceResetTableStructure() {
  Logger.log('=== 強制重設表格結構（警告：會清除所有資料）===');
  
  const confirmation = Browser.msgBox(
    '警告', 
    '此操作會清除表格中的所有資料，是否確定要繼續？', 
    Browser.Buttons.YES_NO
  );
  
  if (confirmation !== Browser.Buttons.YES) {
    Logger.log('用戶取消操作');
    return;
  }
  
  try {
    const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      throw new Error(`找不到工作表: ${SHEET_NAME}`);
    }
    
    // 清除所有內容
    sheet.clear();
    
    // 設定正確的標題行
    const correctHeaders = [
      'TIMESTAMP', 'AMOUNT', 'CURRENCY', 'EXCHANGE RATE', 'Amount (TWD)', 'CATEGORY', 'ITEM', 'ACCOUNT TYPE', 
      'Linked_IOU_EventID', 'INVOICE NO.', 'REFERENCES NO.', 'BUYER NAME', 'BUYER TAX ID', 'SELLER TAX ID', 
      'RECEIPT IMAGE', 'STATUS', 'SOURCE', 'NOTES', 'Original Text (OCR)', 'Translation (AI)', 'META_DATA'
    ];
    
    sheet.getRange(1, 1, 1, correctHeaders.length).setValues([correctHeaders]);
    
    // 設定 E 欄位公式
    sheet.getRange('E1').setValue('Amount (TWD)');
    sheet.getRange('E2').setFormula('={"Amount (TWD)"; ARRAYFORMULA(IF(ISBLANK(A2:A),, B2:B * D2:D))}');
    
    Logger.log('✅ 表格結構強制重設完成');
    
  } catch (error) {
    Logger.log(`❌ 強制重設表格結構時發生錯誤: ${error.toString()}`);
    throw error;
  }
  
  Logger.log('=== 強制重設表格結構完成 ===');
}

/**
 * 檢查目前表格結構
 */
function checkCurrentTableStructure() {
  Logger.log('=== 檢查目前表格結構 ===');
  
  try {
    const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      throw new Error(`找不到工作表: ${SHEET_NAME}`);
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    Logger.log('目前表格標題:');
    headers.forEach((header, index) => {
      const column = String.fromCharCode(65 + index);
      Logger.log(`${column} 欄位: ${header}`);
    });
    
    // 檢查前幾行資料
    if (sheet.getLastRow() > 1) {
      Logger.log('\n前 3 行資料範例:');
      const sampleData = sheet.getRange(2, 1, Math.min(3, sheet.getLastRow() - 1), sheet.getLastColumn()).getValues();
      sampleData.forEach((row, index) => {
        Logger.log(`第 ${index + 2} 行: ${row.slice(0, 6).join(' | ')}`);
      });
    }
    
  } catch (error) {
    Logger.log(`❌ 檢查表格結構時發生錯誤: ${error.toString()}`);
    throw error;
  }
  
  Logger.log('=== 檢查表格結構完成 ===');
}

/**
 * 一鍵修正所有問題
 */
function fixAllIssues() {
  Logger.log('🔧 開始一鍵修正所有問題...\n');
  
  try {
    // 1. 檢查目前結構
    checkCurrentTableStructure();
    
    // 2. 修正現有資料
    fixExistingColumnData();
    
    // 3. 再次檢查結果
    Logger.log('\n修正後的結構:');
    checkCurrentTableStructure();
    
    Logger.log('\n✅ 所有問題修正完成！');
    
  } catch (error) {
    Logger.log(`❌ 修正過程中發生錯誤: ${error.toString()}`);
    Logger.log(`錯誤堆疊: ${error.stack}`);
  }
}