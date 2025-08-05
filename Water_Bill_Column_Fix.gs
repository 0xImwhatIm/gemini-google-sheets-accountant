// =================================================================================================
// 水費帳單欄位對應修正 - V47.4.1
// 版本：V47.4.1 - 2025-08-05
// 修正問題：
// 1. I 欄位內容 → G 欄位（項目描述整合）
// 2. J 欄位內容 → Q 欄位（來源信息移動）
// 3. P 欄位：設定為「待確認」狀態
// =================================================================================================

/**
 * 🚰 水費帳單專用寫入函數（修正欄位對應）
 * 替換原有的 writeToSheet 調用，確保欄位對應正確
 */
function writeWaterBillToSheet(data, source = 'email_water_bill') {
  return withPhase4ErrorHandling(() => {
    const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      throw new Error(`找不到工作表: ${SHEET_NAME}`);
    }
    
    // 獲取匯率
    const exchangeRate = getExchangeRate(data.currency);
    
    // 整合項目描述（原本分散在 item 和 notes 中）
    const integratedItem = data.notes ? 
      `${data.item} - ${data.notes}` : 
      data.item;
    
    // 準備寫入的資料（修正後的欄位對應）
    const rowData = [
      new Date(data.date),              // A: 日期
      data.amount,                      // B: 金額
      data.currency,                    // C: 幣別
      exchangeRate,                     // D: 匯率
      data.amount * exchangeRate,       // E: 台幣金額
      data.category,                    // F: 類別
      integratedItem,                   // G: 項目（整合原 I 欄位內容）
      '私人',                           // H: 帳戶類型（私人/工作）
      '',                               // I: 備註（清空，內容已移到 G）
      '',                               // J: 清空（內容移到 Q）
      data.invoice_number || '',        // K: 發票號碼
      '',                               // L: 買方統編
      '',                               // M: 賣方統編
      '',                               // N: 收據編號
      '',                               // O: 預留
      '待確認',                         // P: 狀態（設定為待確認）
      source,                           // Q: 來源（原 J 欄位內容移到這裡）
      '',                               // R: 預留
      data.originalContent || '',       // S: OCR 完整文字
      JSON.stringify({                  // T: 原始資料（包含商家信息）
        ...data,
        merchant: data.merchant,        // 商家信息保存在原始資料中
        accountType: '私人'             // 記錄帳戶類型
      })
    ];
    
    sheet.appendRow(rowData);
    Logger.log(`✅ 水費帳單寫入成功: ${integratedItem} - ${data.amount} ${data.currency}`);
    Logger.log(`📊 欄位對應: G=${integratedItem}, P=待確認, Q=${source}`);
    
    return true;
    
  }, { 
    source: source, 
    item: data.item, 
    amount: data.amount,
    merchant: data.merchant 
  }, 'writeWaterBillToSheet');
}

/**
 * 🔧 修正現有水費記錄的欄位對應（批量修正工具）
 * 用於修正已經記錄但欄位對應錯誤的水費資料
 */
function fixExistingWaterBillRecords() {
  Logger.log('🔧 === 開始修正現有水費記錄的欄位對應 ===');
  
  try {
    const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      throw new Error(`找不到工作表: ${SHEET_NAME}`);
    }
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    if (values.length <= 1) {
      Logger.log('ℹ️ 沒有找到需要修正的記錄');
      return 0;
    }
    
    let fixedCount = 0;
    
    // 從第二行開始檢查（跳過標題行）
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      
      // 檢查是否為台北自來水的記錄
      const merchant = row[7]; // H 欄位：商家
      const source = row[9];   // J 欄位：來源
      const item = row[6];     // G 欄位：項目
      const notes = row[8];    // I 欄位：備註
      const status = row[15];  // P 欄位：狀態
      const sourceQ = row[16]; // Q 欄位：來源
      
      // 識別台北自來水記錄的條件（修正類型檢查）
      const isWaterBill = (
        merchant === '台北自來水事業處' ||
        (source && typeof source === 'string' && source.includes('email_water_bill')) ||
        (item && typeof item === 'string' && item.includes('水費'))
      );
      
      if (isWaterBill) {
        Logger.log(`🔍 找到水費記錄第 ${i + 1} 行: ${item}`);
        
        let needsUpdate = false;
        const rowIndex = i + 1; // Google Sheets 行號從 1 開始
        
        // 修正 1: I 欄位內容整合到 G 欄位
        if (notes && notes.trim() !== '') {
          const integratedItem = item ? `${item} - ${notes}` : notes;
          sheet.getRange(rowIndex, 7).setValue(integratedItem); // G 欄位
          sheet.getRange(rowIndex, 9).setValue(''); // 清空 I 欄位
          Logger.log(`  ✅ 整合項目描述: ${integratedItem}`);
          needsUpdate = true;
        }
        
        // 修正 2: J 欄位內容移動到 Q 欄位
        if (source && source.trim() !== '' && (!sourceQ || sourceQ.trim() === '')) {
          sheet.getRange(rowIndex, 17).setValue(source); // Q 欄位
          sheet.getRange(rowIndex, 10).setValue(''); // 清空 J 欄位
          Logger.log(`  ✅ 移動來源信息到 Q 欄位: ${source}`);
          needsUpdate = true;
        }
        
        // 修正 3: H 欄位設定為「私人」（帳戶類型）
        if (merchant === '台北自來水事業處') {
          sheet.getRange(rowIndex, 8).setValue('私人'); // H 欄位
          Logger.log(`  ✅ 設定帳戶類型為: 私人`);
          needsUpdate = true;
        }
        
        // 修正 4: P 欄位設定為「待確認」
        if (!status || status.trim() === '') {
          sheet.getRange(rowIndex, 16).setValue('待確認'); // P 欄位
          Logger.log(`  ✅ 設定狀態為: 待確認`);
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          fixedCount++;
          Logger.log(`  🎯 第 ${rowIndex} 行修正完成`);
        } else {
          Logger.log(`  ℹ️ 第 ${rowIndex} 行無需修正`);
        }
      }
    }
    
    Logger.log(`🎉 === 欄位對應修正完成 ===`);
    Logger.log(`✅ 共修正了 ${fixedCount} 筆水費記錄`);
    Logger.log(`📊 修正內容:`);
    Logger.log(`   - I 欄位內容整合到 G 欄位`);
    Logger.log(`   - J 欄位內容移動到 Q 欄位`);
    Logger.log(`   - P 欄位設定為「待確認」`);
    
    return fixedCount;
    
  } catch (error) {
    Logger.log(`❌ 修正失敗: ${error.toString()}`);
    return 0;
  }
}

/**
 * 🔍 檢查水費記錄的欄位對應狀況
 */
function checkWaterBillColumnMapping() {
  Logger.log('🔍 === 檢查水費記錄的欄位對應狀況 ===');
  
  try {
    const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      throw new Error(`找不到工作表: ${SHEET_NAME}`);
    }
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    if (values.length <= 1) {
      Logger.log('ℹ️ 沒有找到任何記錄');
      return;
    }
    
    Logger.log('📊 水費記錄欄位對應檢查結果:');
    Logger.log('行號 | G(項目) | H(商家) | I(備註) | J(來源) | P(狀態) | Q(來源)');
    Logger.log('-----|---------|---------|---------|---------|---------|--------');
    
    let waterBillCount = 0;
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const merchant = row[7]; // H 欄位
      const source = row[9];   // J 欄位
      const item = row[6];     // G 欄位
      
      // 識別台北自來水記錄（修正類型檢查）
      const isWaterBill = (
        merchant === '台北自來水事業處' ||
        (source && typeof source === 'string' && source.includes('email_water_bill')) ||
        (item && typeof item === 'string' && item.includes('水費'))
      );
      
      if (isWaterBill) {
        waterBillCount++;
        const rowNum = i + 1;
        const itemG = (row[6] || '').toString().substring(0, 15);
        const merchantH = (row[7] || '').toString().substring(0, 10);
        const notesI = (row[8] || '').toString().substring(0, 10);
        const sourceJ = (row[9] || '').toString().substring(0, 10);
        const statusP = (row[15] || '').toString().substring(0, 8);
        const sourceQ = (row[16] || '').toString().substring(0, 10);
        
        Logger.log(`${rowNum.toString().padStart(4)} | ${itemG.padEnd(15)} | ${merchantH.padEnd(10)} | ${notesI.padEnd(10)} | ${sourceJ.padEnd(10)} | ${statusP.padEnd(8)} | ${sourceQ.padEnd(10)}`);
      }
    }
    
    Logger.log(`\n📈 統計結果:`);
    Logger.log(`   找到 ${waterBillCount} 筆水費記錄`);
    
    if (waterBillCount === 0) {
      Logger.log('ℹ️ 沒有找到台北自來水的記錄');
    }
    
  } catch (error) {
    Logger.log(`❌ 檢查失敗: ${error.toString()}`);
  }
}

/**
 * 🧪 測試修正後的水費記帳功能
 */
function testWaterBillColumnMapping() {
  Logger.log('🧪 === 測試修正後的水費記帳功能 ===');
  
  try {
    // 創建測試資料
    const testData = {
      date: '2025-08-05 15:30:00',
      amount: 428,
      currency: 'TWD',
      category: '住',
      item: '水費 (用戶號: 2-08-019198-4)',
      merchant: '台北自來水事業處',
      notes: '電子帳單自動提取 - 臺北自來水事業處電子帳單',
      source: 'email_html_water_bill',
      originalContent: '臺北自來水事業處 本期水費 428元...'
    };
    
    Logger.log('📊 測試資料:');
    Logger.log(`   項目: ${testData.item}`);
    Logger.log(`   備註: ${testData.notes}`);
    Logger.log(`   來源: ${testData.source}`);
    
    // 使用修正後的寫入函數
    const success = writeWaterBillToSheet(testData, 'email_water_bill');
    
    if (success) {
      Logger.log('✅ 測試寫入成功');
      Logger.log('📋 預期的欄位對應:');
      Logger.log(`   G 欄位: ${testData.item} - ${testData.notes}`);
      Logger.log(`   H 欄位: 私人 (帳戶類型)`);
      Logger.log(`   I 欄位: (空白)`);
      Logger.log(`   J 欄位: (空白)`);
      Logger.log(`   P 欄位: 待確認`);
      Logger.log(`   Q 欄位: email_water_bill`);
      Logger.log(`   商家信息: ${testData.merchant} (保存在 T 欄位的 JSON 中)`);
      
      Logger.log('💡 請檢查 Google Sheets 中的最新記錄是否符合預期');
    } else {
      Logger.log('❌ 測試寫入失敗');
    }
    
  } catch (error) {
    Logger.log(`❌ 測試失敗: ${error.toString()}`);
  }
}

// =================================================================================================
// 【使用說明】水費欄位修正工具使用指南
// =================================================================================================
/*
📋 使用步驟：

1. 🔍 檢查現有記錄狀況：
   checkWaterBillColumnMapping()

2. 🔧 修正現有錯誤記錄：
   fixExistingWaterBillRecords()

3. 🧪 測試新的記帳功能：
   testWaterBillColumnMapping()

4. 📝 更新水費處理函數：
   需要將 processWaterBillEmails() 中的 writeToSheet 調用
   改為 writeWaterBillToSheet 調用

⚠️ 注意事項：
- 執行修正前建議先備份 Google Sheets
- 修正是不可逆的操作，請謹慎執行
- 建議先執行檢查函數了解現狀
*/