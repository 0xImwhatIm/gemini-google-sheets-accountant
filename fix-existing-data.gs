// =================================================================================================
// CSV 金額提取邏輯修復工具 - 2025-08-04
// 專門修復財政部電子發票 CSV 金額提取問題
// =================================================================================================

/**
 * 🔬 深度分析 CSV 內容和格式
 */
function deepAnalyzeCsvContent() {
  Logger.log('🔬 開始深度分析 CSV 內容...');
  
  try {
    const threads = GmailApp.search('from:einvoice@einvoice.nat.gov.tw subject:彙整', 0, 1);
    
    if (threads.length === 0) {
      Logger.log('❌ 找不到財政部郵件');
      return null;
    }
    
    const message = threads[0].getMessages()[0];
    const attachments = message.getAttachments();
    
    Logger.log(`📧 分析郵件: ${message.getSubject()}`);
    Logger.log(`📅 日期: ${message.getDate()}`);
    Logger.log(`📎 附件數量: ${attachments.length}`);
    
    for (let attachment of attachments) {
      const fileName = attachment.getName();
      
      if (fileName.toLowerCase().includes('.csv')) {
        Logger.log(`\n📊 深度分析 CSV: ${fileName}`);
        
        // 嘗試讀取 CSV
        let csvContent = null;
        try {
          csvContent = attachment.getDataAsString('UTF-8');
        } catch (error) {
          csvContent = attachment.getDataAsString('Big5');
        }
        
        if (!csvContent) {
          Logger.log('❌ 無法讀取 CSV 內容');
          continue;
        }
        
        const lines = csvContent.split('\n');
        Logger.log(`📊 總行數: ${lines.length}`);
        
        // 分析標題行
        if (lines.length > 0) {
          const headerLine = lines[0].trim();
          Logger.log(`\n📋 標題行: ${headerLine}`);
          
          const headers = headerLine.split(',');
          Logger.log(`📋 欄位數: ${headers.length}`);
          
          headers.forEach((header, index) => {
            const cleanHeader = header.replace(/["\s]/g, '');
            Logger.log(`  欄位 ${index + 1}: "${cleanHeader}"`);
            
            // 檢查是否是金額相關欄位
            if (cleanHeader.includes('金額') || 
                cleanHeader.includes('總計') || 
                cleanHeader.includes('小計') ||
                cleanHeader.includes('稅額') ||
                cleanHeader.includes('價格') ||
                cleanHeader.includes('Amount') ||
                cleanHeader.toLowerCase().includes('total')) {
              Logger.log(`    💰 可能的金額欄位: ${index + 1}`);
            }
          });
        }
        
        // 分析前 10 行資料
        Logger.log(`\n📊 前 10 行資料分析:`);
        for (let i = 1; i < Math.min(11, lines.length); i++) {
          const line = lines[i].trim();
          if (line) {
            Logger.log(`\n行 ${i + 1}: ${line.substring(0, 200)}${line.length > 200 ? '...' : ''}`);
            
            const columns = line.split(',');
            Logger.log(`  欄位數: ${columns.length}`);
            
            // 分析每個欄位
            columns.forEach((col, colIndex) => {
              const cleanCol = col.replace(/["\s]/g, '');
              
              // 檢查是否是數字
              const numValue = parseFloat(cleanCol);
              if (!isNaN(numValue) && numValue > 0) {
                Logger.log(`  欄位 ${colIndex + 1}: "${cleanCol}" -> 數值: ${numValue}`);
                
                // 判斷是否可能是金額（合理範圍）
                if (numValue >= 1 && numValue <= 1000000) {
                  Logger.log(`    💰 可能的金額: ${numValue}`);
                }
              } else if (cleanCol.length > 0) {
                Logger.log(`  欄位 ${colIndex + 1}: "${cleanCol}" -> 非數值`);
              }
            });
          }
        }
        
        // 嘗試智慧金額提取
        Logger.log(`\n🧠 智慧金額提取測試:`);
        const smartExtraction = smartExtractAmounts(csvContent);
        
        return {
          fileName: fileName,
          totalLines: lines.length,
          headers: lines.length > 0 ? lines[0].split(',') : [],
          smartExtraction: smartExtraction
        };
      }
    }
    
    return null;
    
  } catch (error) {
    Logger.log(`❌ 深度分析失敗: ${error.toString()}`);
    return null;
  }
}

/**
 * 🧠 智慧金額提取邏輯
 */
function smartExtractAmounts(csvContent) {
  Logger.log('🧠 執行智慧金額提取...');
  
  try {
    const lines = csvContent.split('\n');
    let results = {
      strategy1: { total: 0, count: 0, description: '最後數字欄位策略' },
      strategy2: { total: 0, count: 0, description: '關鍵字匹配策略' },
      strategy3: { total: 0, count: 0, description: '最大合理值策略' },
      strategy4: { total: 0, count: 0, description: '固定欄位策略' },
      strategy5: { total: 0, count: 0, description: '模式識別策略' }
    };
    
    // 分析標題行找出可能的金額欄位
    const headers = lines.length > 0 ? lines[0].split(',') : [];
    const amountColumnIndexes = [];
    
    headers.forEach((header, index) => {
      const cleanHeader = header.replace(/["\s]/g, '').toLowerCase();
      if (cleanHeader.includes('金額') || 
          cleanHeader.includes('總計') || 
          cleanHeader.includes('小計') ||
          cleanHeader.includes('amount') ||
          cleanHeader.includes('total') ||
          cleanHeader.includes('price')) {
        amountColumnIndexes.push(index);
        Logger.log(`💰 識別金額欄位 ${index + 1}: "${header}"`);
      }
    });
    
    // 處理資料行
    for (let i = 1; i < Math.min(lines.length, 100); i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const columns = line.split(',');
      
      // 策略 1: 最後幾個數字欄位
      for (let col = Math.max(0, columns.length - 3); col < columns.length; col++) {
        const cellValue = columns[col].replace(/["\s]/g, '');
        const amount = parseFloat(cellValue);
        if (!isNaN(amount) && amount > 0 && amount <= 1000000) {
          results.strategy1.total += amount;
          results.strategy1.count++;
          break;
        }
      }
      
      // 策略 2: 關鍵字匹配
      for (let col = 0; col < columns.length; col++) {
        const cellValue = columns[col].replace(/["\s]/g, '');
        if (cellValue.includes('NT') || cellValue.includes('$') || cellValue.includes('元')) {
          const amount = parseFloat(cellValue.replace(/[^0-9.]/g, ''));
          if (!isNaN(amount) && amount > 0) {
            results.strategy2.total += amount;
            results.strategy2.count++;
            break;
          }
        }
      }
      
      // 策略 3: 最大合理值
      let maxAmount = 0;
      for (let col = 0; col < columns.length; col++) {
        const cellValue = columns[col].replace(/["\s]/g, '');
        const amount = parseFloat(cellValue);
        if (!isNaN(amount) && amount > maxAmount && amount <= 1000000) {
          maxAmount = amount;
        }
      }
      if (maxAmount > 0) {
        results.strategy3.total += maxAmount;
        results.strategy3.count++;
      }
      
      // 策略 4: 固定欄位（基於標題分析）
      for (let colIndex of amountColumnIndexes) {
        if (colIndex < columns.length) {
          const cellValue = columns[colIndex].replace(/["\s]/g, '');
          const amount = parseFloat(cellValue);
          if (!isNaN(amount) && amount > 0) {
            results.strategy4.total += amount;
            results.strategy4.count++;
            break;
          }
        }
      }
      
      // 策略 5: 模式識別（尋找最常見的數字格式）
      for (let col = 0; col < columns.length; col++) {
        const cellValue = columns[col].replace(/["\s]/g, '');
        // 匹配常見的金額格式：整數或小數點後1-2位
        if (/^\d+(\.\d{1,2})?$/.test(cellValue)) {
          const amount = parseFloat(cellValue);
          if (amount >= 1 && amount <= 1000000) {
            results.strategy5.total += amount;
            results.strategy5.count++;
            break;
          }
        }
      }
    }
    
    // 輸出各策略結果
    Logger.log('\n📊 各策略提取結果:');
    Object.keys(results).forEach(key => {
      const strategy = results[key];
      Logger.log(`${key}: ${strategy.description}`);
      Logger.log(`  總金額: ${strategy.total}`);
      Logger.log(`  記錄數: ${strategy.count}`);
      Logger.log(`  平均: ${strategy.count > 0 ? (strategy.total / strategy.count).toFixed(2) : 0}`);
    });
    
    // 選擇最佳策略
    let bestStrategy = null;
    let bestScore = 0;
    
    Object.keys(results).forEach(key => {
      const strategy = results[key];
      // 評分：總金額 > 0 且記錄數合理
      const score = strategy.total > 0 ? strategy.total * Math.min(strategy.count, 50) : 0;
      if (score > bestScore) {
        bestScore = score;
        bestStrategy = key;
      }
    });
    
    if (bestStrategy) {
      Logger.log(`\n🏆 最佳策略: ${bestStrategy} - ${results[bestStrategy].description}`);
      Logger.log(`💰 建議金額: ${results[bestStrategy].total}`);
      Logger.log(`📊 發票數量: ${results[bestStrategy].count}`);
    } else {
      Logger.log('\n❌ 所有策略都無法提取有效金額');
    }
    
    return {
      strategies: results,
      bestStrategy: bestStrategy,
      recommendedAmount: bestStrategy ? results[bestStrategy].total : 0,
      recommendedCount: bestStrategy ? results[bestStrategy].count : 0
    };
    
  } catch (error) {
    Logger.log(`❌ 智慧提取失敗: ${error.toString()}`);
    return null;
  }
}

/**
 * 🔧 基於分析結果的修復版處理器
 */
function processGovernmentEInvoiceUltraFixed(message, result) {
  Logger.log('🏛️ 超級修復版財政部電子發票處理器...');
  
  try {
    result.merchant = '財政部';
    result.category = '其他';
    result.description = '財政部 - 電子發票彙整';
    
    const attachments = message.getAttachments();
    Logger.log(`📎 找到 ${attachments.length} 個附件`);
    
    for (let attachment of attachments) {
      const fileName = attachment.getName();
      
      if (fileName.toLowerCase().includes('.csv')) {
        Logger.log(`📊 處理 CSV: ${fileName}`);
        
        try {
          // 讀取 CSV
          let csvContent = null;
          try {
            csvContent = attachment.getDataAsString('UTF-8');
          } catch (error) {
            csvContent = attachment.getDataAsString('Big5');
          }
          
          if (!csvContent) {
            Logger.log('❌ 無法讀取 CSV');
            continue;
          }
          
          // 使用智慧提取
          const extraction = smartExtractAmounts(csvContent);
          
          if (extraction && extraction.recommendedAmount > 0) {
            result.amount = extraction.recommendedAmount;
            result.description = `財政部 - 電子發票彙整 (${extraction.recommendedCount} 張發票)`;
            
            Logger.log(`✅ 超級修復成功: ${result.amount} 元, ${extraction.recommendedCount} 張發票`);
            Logger.log(`🏆 使用策略: ${extraction.bestStrategy}`);
            
            return result;
          } else {
            Logger.log('❌ 智慧提取也失敗了');
          }
          
        } catch (csvError) {
          Logger.log(`❌ CSV 處理錯誤: ${csvError.toString()}`);
        }
      }
    }
    
    // 如果 CSV 完全失敗，嘗試從郵件內容提取
    Logger.log('⚠️ CSV 處理失敗，嘗試郵件內容...');
    
    const plainBody = message.getPlainBody();
    const htmlBody = message.getBody();
    const textToSearch = plainBody || htmlBody.replace(/<[^>]*>/g, ' ');
    
    // 更強的郵件內容金額提取
    const emailAmountPatterns = [
      /總金額[：:\s]*([0-9,]+)/gi,
      /合計[：:\s]*([0-9,]+)/gi,
      /總計[：:\s]*([0-9,]+)/gi,
      /金額[：:\s]*([0-9,]+)/gi,
      /([0-9,]+)\s*元/g,
      /NT\$?\s*([0-9,]+)/gi,
      /\$\s*([0-9,]+)/g,
      /共計[：:\s]*([0-9,]+)/gi
    ];
    
    let extractedAmounts = [];
    
    for (let pattern of emailAmountPatterns) {
      const matches = textToSearch.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const cleanAmount = match.replace(/[^0-9]/g, '');
          const amount = parseFloat(cleanAmount);
          if (!isNaN(amount) && amount > 0 && amount <= 10000000) {
            extractedAmounts.push(amount);
          }
        });
      }
    }
    
    if (extractedAmounts.length > 0) {
      // 選擇最大的合理金額
      result.amount = Math.max(...extractedAmounts);
      Logger.log(`✅ 從郵件內容提取金額: ${result.amount}`);
    } else {
      Logger.log('❌ 完全無法提取金額');
    }
    
    return result;
    
  } catch (error) {
    Logger.log(`❌ 超級修復版失敗: ${error.toString()}`);
    return result;
  }
}

/**
 * 🧪 測試超級修復版處理器
 */
function testUltraFixedProcessor() {
  Logger.log('🧪 測試超級修復版處理器...');
  
  try {
    // 先執行深度分析
    Logger.log('🔬 執行深度分析...');
    const analysis = deepAnalyzeCsvContent();
    
    if (!analysis) {
      Logger.log('❌ 深度分析失敗');
      return null;
    }
    
    // 搜尋測試郵件
    const threads = GmailApp.search('from:einvoice@einvoice.nat.gov.tw subject:彙整', 0, 1);
    
    if (threads.length === 0) {
      Logger.log('❌ 找不到測試郵件');
      return null;
    }
    
    const message = threads[0].getMessages()[0];
    
    let result = {
      date: Utilities.formatDate(message.getDate(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      amount: 0,
      currency: 'TWD',
      category: '其他',
      description: '財政部 - 電子發票彙整',
      merchant: '財政部',
      source: 'Email : 電子收據'
    };
    
    // 使用超級修復版處理器
    result = processGovernmentEInvoiceUltraFixed(message, result);
    
    Logger.log(`\n🧪 超級修復測試結果:`);
    Logger.log(`  金額: ${result.amount}`);
    Logger.log(`  描述: ${result.description}`);
    Logger.log(`  商家: ${result.merchant}`);
    
    if (result.amount > 0) {
      Logger.log('🎉 超級修復成功！');
      
      // 可選：實際儲存到 Google Sheets 進行完整測試
      Logger.log('💾 是否要儲存測試結果到 Google Sheets？');
      Logger.log('如果要儲存，請執行 saveTestResult()');
      
    } else {
      Logger.log('😞 超級修復也失敗了，需要人工檢查 CSV 格式');
    }
    
    return result;
    
  } catch (error) {
    Logger.log(`❌ 測試失敗: ${error.toString()}`);
    return null;
  }
}

/**
 * 💾 儲存測試結果
 */
function saveTestResult() {
  Logger.log('💾 儲存測試結果...');
  
  try {
    const testResult = testUltraFixedProcessor();
    
    if (!testResult || testResult.amount <= 0) {
      Logger.log('❌ 沒有有效的測試結果可儲存');
      return false;
    }
    
    const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    if (!mainLedgerId) {
      Logger.log('❌ MAIN_LEDGER_ID 未設定');
      return false;
    }
    
    const ss = SpreadsheetApp.openById(mainLedgerId);
    const sheet = ss.getSheetByName('All Records');
    
    if (!sheet) {
      Logger.log('❌ 找不到 All Records 工作表');
      return false;
    }
    
    const newRow = [
      testResult.date,                    // A: TIMESTAMP
      testResult.amount,                  // B: AMOUNT
      testResult.currency,                // C: CURRENCY
      1,                                 // D: EXCHANGE RATE
      '',                                // E: Amount (TWD) - 由公式計算
      testResult.category,               // F: CATEGORY
      testResult.description,            // G: ITEM
      '私人',                            // H: ACCOUNT TYPE
      '',                                // I: Linked_IOU_EventID
      '',                                // J: INVOICE NO.
      '',                                // K: REFERENCES NO.
      '',                                // L: BUYER NAME
      '',                                // M: BUYER TAX ID
      '',                                // N: SELLER TAX ID
      '',                                // O: RECEIPT IMAGE
      '待確認',                          // P: STATUS
      testResult.source,                 // Q: SOURCE
      '',                                // R: NOTES
      '超級修復版測試',                   // S: Original Text (OCR)
      '',                                // T: Translation (AI)
      JSON.stringify({                   // U: META_DATA
        testMode: true,
        processor: 'processGovernmentEInvoiceUltraFixed',
        testTime: new Date().toISOString()
      })
    ];
    
    sheet.appendRow(newRow);
    Logger.log(`✅ 測試結果已儲存: ${testResult.amount} 元`);
    
    return true;
    
  } catch (error) {
    Logger.log(`❌ 儲存失敗: ${error.toString()}`);
    return false;
  }
}

/**
 * 📋 生成完整的修復報告
 */
function generateFixReport() {
  Logger.log('📋 生成完整修復報告...');
  
  try {
    Logger.log('\n=== 財政部電子發票 CSV 修復報告 ===');
    Logger.log(`報告時間: ${new Date().toISOString()}`);
    
    // 1. 深度分析
    Logger.log('\n1. 深度分析結果:');
    const analysis = deepAnalyzeCsvContent();
    
    // 2. 測試結果
    Logger.log('\n2. 超級修復測試:');
    const testResult = testUltraFixedProcessor();
    
    // 3. 總結建議
    Logger.log('\n3. 修復建議:');
    if (testResult && testResult.amount > 0) {
      Logger.log('✅ 超級修復版處理器可以解決問題');
      Logger.log('建議：將 processGovernmentEInvoiceUltraFixed 整合到主處理器');
    } else {
      Logger.log('❌ 需要進一步人工分析 CSV 格式');
      Logger.log('建議：檢查財政部是否變更了 CSV 格式');
    }
    
    Logger.log('\n=== 報告結束 ===');
    
  } catch (error) {
    Logger.log(`❌ 報告生成失敗: ${error.toString()}`);
  }
}