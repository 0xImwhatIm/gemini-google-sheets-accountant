/**
 * 資料庫結構驗證和修正腳本
 * 根據完整的 21 欄位資料庫結構進行驗證和修正
 */

// 標準資料庫結構定義
const DATABASE_SCHEMA = {
  ALL_RECORDS: {
    SHEET_NAME: 'All Records',
    COLUMNS: [
      { name: 'TIMESTAMP', index: 0, type: 'Datetime', description: '交易發生的精確時間' },
      { name: 'AMOUNT', index: 1, type: 'Number', description: '原始交易金額' },
      { name: 'CURRENCY', index: 2, type: 'String', description: '原始交易的幣別', validValues: ['TWD', 'JPY', 'USD', 'EUR', 'CNY'] },
      { name: 'EXCHANGE RATE', index: 3, type: 'Number', description: '相對於 TWD 的匯率' },
      { name: 'Amount (TWD)', index: 4, type: 'Number', description: '自動換算為新台幣後的金額', formula: true },
      { name: 'CATEGORY', index: 5, type: 'String', description: '交易分類', validValues: ['食', '衣', '住', '行', '育', '樂', '醫療', '保險', '其他'] },
      { name: 'ITEM', index: 6, type: 'String', description: '交易項目或商品名稱的詳細描述' },
      { name: 'ACCOUNT TYPE', index: 7, type: 'String', description: '帳戶類型', validValues: ['私人', '公司'] },
      { name: 'Linked_IOU_EventID', index: 8, type: 'String', description: '關聯至 Events 表的 EventID' },
      { name: 'INVOICE NO.', index: 9, type: 'String', description: '發票號碼' },
      { name: 'REFERENCES NO.', index: 10, type: 'String', description: '其他參考編號' },
      { name: 'BUYER NAME', index: 11, type: 'String', description: '買方名稱' },
      { name: 'BUYER TAX ID', index: 12, type: 'String', description: '買方統編' },
      { name: 'SELLER TAX ID', index: 13, type: 'String', description: '賣方統編' },
      { name: 'RECEIPT IMAGE', index: 14, type: 'URL', description: '原始單據的照片連結' },
      { name: 'STATUS', index: 15, type: 'String', description: '紀錄狀態', validValues: ['待確認', '已確認', 'Active'] },
      { name: 'SOURCE', index: 16, type: 'String', description: '資料來源', validValues: ['OCR', '語音', 'PDF', 'Email CSV', '圖片識別', '語音輸入', '圖片+語音'] },
      { name: 'NOTES', index: 17, type: 'String', description: '備註' },
      { name: 'Original Text (OCR)', index: 18, type: 'String', description: '從 OCR 或其他來源獲取的未處理原始文字' },
      { name: 'Translation (AI)', index: 19, type: 'String', description: 'AI 翻譯或處理後的文字' },
      { name: 'META_DATA', index: 20, type: 'JSON String', description: '由 AI 解析出的原始 JSON 數據' }
    ]
  }
};

/**
 * 驗證資料庫結構是否正確
 */
function validateDatabaseStructure() {
  Logger.log('=== 開始驗證資料庫結構 ===');
  
  try {
    const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
    const sheet = ss.getSheetByName(DATABASE_SCHEMA.ALL_RECORDS.SHEET_NAME);
    
    if (!sheet) {
      throw new Error(`找不到工作表: ${DATABASE_SCHEMA.ALL_RECORDS.SHEET_NAME}`);
    }
    
    // 檢查標題行
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const expectedHeaders = DATABASE_SCHEMA.ALL_RECORDS.COLUMNS.map(col => col.name);
    
    Logger.log(`目前欄位數量: ${headers.length}`);
    Logger.log(`期望欄位數量: ${expectedHeaders.length}`);
    
    const issues = [];
    
    // 檢查欄位數量
    if (headers.length !== expectedHeaders.length) {
      issues.push(`欄位數量不符：目前 ${headers.length} 個，期望 ${expectedHeaders.length} 個`);
    }
    
    // 檢查每個欄位
    for (let i = 0; i < Math.max(headers.length, expectedHeaders.length); i++) {
      const currentHeader = headers[i] || '(缺少)';
      const expectedHeader = expectedHeaders[i] || '(多餘)';
      
      if (currentHeader !== expectedHeader) {
        issues.push(`第 ${i+1} 欄位不符：目前 "${currentHeader}"，期望 "${expectedHeader}"`);
      }
    }
    
    // 檢查資料驗證
    if (sheet.getLastRow() > 1) {
      const dataValidationIssues = validateDataContent(sheet);
      issues.push(...dataValidationIssues);
    }
    
    // 輸出結果
    if (issues.length === 0) {
      Logger.log('✅ 資料庫結構驗證通過');
      return { valid: true, issues: [] };
    } else {
      Logger.log('❌ 發現以下問題:');
      issues.forEach(issue => Logger.log(`  - ${issue}`));
      return { valid: false, issues: issues };
    }
    
  } catch (error) {
    Logger.log(`❌ 驗證過程發生錯誤: ${error.toString()}`);
    return { valid: false, issues: [error.toString()] };
  }
  
  Logger.log('=== 資料庫結構驗證完成 ===');
}

/**
 * 驗證資料內容是否符合規範
 */
function validateDataContent(sheet) {
  const issues = [];
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  
  if (values.length < 2) return issues;
  
  // 檢查前 10 行資料（避免處理時間過長）
  const rowsToCheck = Math.min(10, values.length - 1);
  
  for (let i = 1; i <= rowsToCheck; i++) {
    const row = values[i];
    
    // 檢查 CURRENCY 欄位 (index 2)
    const currency = row[2];
    if (currency && !DATABASE_SCHEMA.ALL_RECORDS.COLUMNS[2].validValues.includes(currency)) {
      issues.push(`第 ${i+1} 行 CURRENCY 欄位無效: "${currency}"`);
    }
    
    // 檢查 CATEGORY 欄位 (index 5)
    const category = row[5];
    if (category && !DATABASE_SCHEMA.ALL_RECORDS.COLUMNS[5].validValues.includes(category)) {
      issues.push(`第 ${i+1} 行 CATEGORY 欄位無效: "${category}"`);
    }
    
    // 檢查 ACCOUNT TYPE 欄位 (index 7)
    const accountType = row[7];
    if (accountType && !DATABASE_SCHEMA.ALL_RECORDS.COLUMNS[7].validValues.includes(accountType)) {
      issues.push(`第 ${i+1} 行 ACCOUNT TYPE 欄位無效: "${accountType}"`);
    }
  }
  
  return issues;
}

/**
 * 自動修正資料庫結構
 */
function fixDatabaseStructure() {
  Logger.log('=== 開始修正資料庫結構 ===');
  
  try {
    const validation = validateDatabaseStructure();
    
    if (validation.valid) {
      Logger.log('✅ 資料庫結構已經正確，無需修正');
      return;
    }
    
    Logger.log('開始修正發現的問題...');
    
    const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
    const sheet = ss.getSheetByName(DATABASE_SCHEMA.ALL_RECORDS.SHEET_NAME);
    
    // 備份現有資料
    const existingData = sheet.getDataRange().getValues();
    Logger.log(`備份了 ${existingData.length} 行資料`);
    
    // 重設標題行
    const correctHeaders = DATABASE_SCHEMA.ALL_RECORDS.COLUMNS.map(col => col.name);
    sheet.getRange(1, 1, 1, sheet.getLastColumn()).clearContent();
    sheet.getRange(1, 1, 1, correctHeaders.length).setValues([correctHeaders]);
    
    // 設定 E 欄位公式
    sheet.getRange('E1').setValue('Amount (TWD)');
    sheet.getRange('E2').setFormula('={"Amount (TWD)"; ARRAYFORMULA(IF(ISBLANK(A2:A),, B2:B * D2:D))}');
    
    // 修正現有資料
    if (existingData.length > 1) {
      const fixedData = fixDataRows(existingData.slice(1)); // 排除標題行
      
      if (fixedData.length > 0) {
        // 寫入修正後的資料
        sheet.getRange(3, 1, fixedData.length, correctHeaders.length).setValues(fixedData);
        Logger.log(`修正並寫入了 ${fixedData.length} 行資料`);
      }
    }
    
    Logger.log('✅ 資料庫結構修正完成');
    
    // 再次驗證
    const finalValidation = validateDatabaseStructure();
    if (finalValidation.valid) {
      Logger.log('✅ 修正後驗證通過');
    } else {
      Logger.log('⚠️ 修正後仍有問題:');
      finalValidation.issues.forEach(issue => Logger.log(`  - ${issue}`));
    }
    
  } catch (error) {
    Logger.log(`❌ 修正過程發生錯誤: ${error.toString()}`);
    throw error;
  }
  
  Logger.log('=== 資料庫結構修正完成 ===');
}

/**
 * 修正資料行，確保符合 21 欄位結構
 */
function fixDataRows(dataRows) {
  const fixedRows = [];
  const correctColumnCount = DATABASE_SCHEMA.ALL_RECORDS.COLUMNS.length;
  
  dataRows.forEach((row, index) => {
    const fixedRow = new Array(correctColumnCount).fill('');
    
    // 複製現有資料到正確位置
    for (let i = 0; i < Math.min(row.length, correctColumnCount); i++) {
      fixedRow[i] = row[i];
    }
    
    // 修正特定欄位的值
    // CURRENCY 欄位 (index 2)
    if (fixedRow[2] && !DATABASE_SCHEMA.ALL_RECORDS.COLUMNS[2].validValues.includes(fixedRow[2])) {
      Logger.log(`修正第 ${index+2} 行 CURRENCY: "${fixedRow[2]}" -> "TWD"`);
      fixedRow[2] = 'TWD';
    }
    
    // EXCHANGE RATE 欄位 (index 3)
    if (fixedRow[2] === 'TWD' && (!fixedRow[3] || fixedRow[3] !== 1)) {
      fixedRow[3] = 1;
    }
    
    // CATEGORY 欄位 (index 5)
    if (fixedRow[5] && !DATABASE_SCHEMA.ALL_RECORDS.COLUMNS[5].validValues.includes(fixedRow[5])) {
      const inferredCategory = inferCategoryFromText(fixedRow[6] || fixedRow[18] || '');
      Logger.log(`修正第 ${index+2} 行 CATEGORY: "${fixedRow[5]}" -> "${inferredCategory}"`);
      fixedRow[5] = inferredCategory;
    }
    
    // ACCOUNT TYPE 欄位 (index 7)
    if (!fixedRow[7] || !DATABASE_SCHEMA.ALL_RECORDS.COLUMNS[7].validValues.includes(fixedRow[7])) {
      fixedRow[7] = '私人';
    }
    
    // STATUS 欄位 (index 15)
    if (!fixedRow[15] || !DATABASE_SCHEMA.ALL_RECORDS.COLUMNS[15].validValues.includes(fixedRow[15])) {
      fixedRow[15] = '待確認';
    }
    
    fixedRows.push(fixedRow);
  });
  
  return fixedRows;
}

/**
 * 從文字推斷類別
 */
function inferCategoryFromText(text) {
  if (!text) return '其他';
  
  const textLower = text.toLowerCase();
  
  if (textLower.includes('咖啡') || textLower.includes('餐') || textLower.includes('食') || 
      textLower.includes('飲料') || textLower.includes('午餐') || textLower.includes('晚餐')) {
    return '食';
  } else if (textLower.includes('衣') || textLower.includes('服裝') || textLower.includes('鞋')) {
    return '衣';
  } else if (textLower.includes('房') || textLower.includes('住') || textLower.includes('租') || textLower.includes('水電')) {
    return '住';
  } else if (textLower.includes('交通') || textLower.includes('車') || textLower.includes('油') || textLower.includes('捷運')) {
    return '行';
  } else if (textLower.includes('書') || textLower.includes('學') || textLower.includes('課') || textLower.includes('教育')) {
    return '育';
  } else if (textLower.includes('電影') || textLower.includes('遊戲') || textLower.includes('娛樂') || textLower.includes('休閒')) {
    return '樂';
  } else if (textLower.includes('醫') || textLower.includes('藥') || textLower.includes('健康') || textLower.includes('診所')) {
    return '醫療';
  } else if (textLower.includes('保險')) {
    return '保險';
  }
  
  return '其他';
}

/**
 * 生成資料庫結構報告
 */
function generateDatabaseReport() {
  Logger.log('=== 生成資料庫結構報告 ===');
  
  try {
    const validation = validateDatabaseStructure();
    const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
    const sheet = ss.getSheetByName(DATABASE_SCHEMA.ALL_RECORDS.SHEET_NAME);
    
    Logger.log('\n📊 資料庫結構報告');
    Logger.log('==================');
    Logger.log(`工作表名稱: ${DATABASE_SCHEMA.ALL_RECORDS.SHEET_NAME}`);
    Logger.log(`總行數: ${sheet.getLastRow()}`);
    Logger.log(`總欄數: ${sheet.getLastColumn()}`);
    Logger.log(`資料行數: ${sheet.getLastRow() - 1}`);
    Logger.log(`結構驗證: ${validation.valid ? '✅ 通過' : '❌ 失敗'}`);
    
    if (!validation.valid) {
      Logger.log('\n🚨 發現的問題:');
      validation.issues.forEach(issue => Logger.log(`  - ${issue}`));
    }
    
    Logger.log('\n📋 標準欄位結構:');
    DATABASE_SCHEMA.ALL_RECORDS.COLUMNS.forEach((col, index) => {
      const letter = String.fromCharCode(65 + index);
      Logger.log(`  ${letter}. ${col.name} (${col.type}) - ${col.description}`);
    });
    
    return validation;
    
  } catch (error) {
    Logger.log(`❌ 生成報告時發生錯誤: ${error.toString()}`);
    throw error;
  }
  
  Logger.log('=== 資料庫結構報告完成 ===');
}

/**
 * 一鍵完整修正
 */
function completeFixAllIssues() {
  Logger.log('🔧 開始一鍵完整修正...\n');
  
  try {
    // 1. 生成初始報告
    Logger.log('步驟 1: 生成初始報告');
    generateDatabaseReport();
    
    // 2. 修正資料庫結構
    Logger.log('\n步驟 2: 修正資料庫結構');
    fixDatabaseStructure();
    
    // 3. 生成最終報告
    Logger.log('\n步驟 3: 生成最終報告');
    const finalReport = generateDatabaseReport();
    
    if (finalReport.valid) {
      Logger.log('\n🎉 所有問題修正完成！資料庫結構現在完全符合規範。');
    } else {
      Logger.log('\n⚠️ 部分問題仍需手動處理。');
    }
    
    return finalReport;
    
  } catch (error) {
    Logger.log(`❌ 完整修正過程中發生錯誤: ${error.toString()}`);
    Logger.log(`錯誤堆疊: ${error.stack}`);
    throw error;
  }
}