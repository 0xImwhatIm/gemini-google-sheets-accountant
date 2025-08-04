// =================================================================================================
// CSV 金額提取邏輯修復 - 2025-08-04
// 修復異常大金額問題，加入合理性檢查
// =================================================================================================

/**
 * 🔧 修復版智慧金額提取邏輯
 * 加入更嚴格的金額合理性檢查
 */
function smartExtractAmountsFixed(csvContent) {
  Logger.log('🔧 執行修復版智慧金額提取...');
  
  try {
    const lines = csvContent.split('\n');
    let results = {
      strategy1: { total: 0, count: 0, description: '最後數字欄位策略（合理範圍）', amounts: [] },
      strategy2: { total: 0, count: 0, description: '關鍵字匹配策略', amounts: [] },
      strategy3: { total: 0, count: 0, description: '小數點金額策略', amounts: [] },
      strategy4: { total: 0, count: 0, description: '固定欄位策略（基於標題）', amounts: [] },
      strategy5: { total: 0, count: 0, description: '中等金額範圍策略', amounts: [] }
    };
    
    // 定義合理的金額範圍
    const MIN_AMOUNT = 1;        // 最小金額 1 元
    const MAX_AMOUNT = 100000;   // 最大金額 10 萬元（單張發票合理上限）
    const TYPICAL_MAX = 10000;   // 典型最大金額 1 萬元
    
    Logger.log(`💰 金額合理範圍: ${MIN_AMOUNT} - ${MAX_AMOUNT} 元`);
    
    // 分析標題行找出可能的金額欄位
    const headers = lines.length > 0 ? lines[0].split(',') : [];
    const amountColumnIndexes = [];
    
    Logger.log('\n📋 分析標題行:');
    headers.forEach((header, index) => {
      const cleanHeader = header.replace(/["\s]/g, '').toLowerCase();
      Logger.log(`  欄位 ${index + 1}: "${header.trim()}"`);
      
      if (cleanHeader.includes('金額') || 
          cleanHeader.includes('總計') || 
          cleanHeader.includes('小計') ||
          cleanHeader.includes('稅額') ||
          cleanHeader.includes('amount') ||
          cleanHeader.includes('total') ||
          cleanHeader.includes('price')) {
        amountColumnIndexes.push(index);
        Logger.log(`    💰 識別為金額欄位: ${index + 1}`);
      }
    });
    
    Logger.log(`\n🎯 識別到 ${amountColumnIndexes.length} 個可能的金額欄位`);
    
    // 處理資料行（限制處理數量避免超時）
    const maxRows = Math.min(lines.length, 50);
    Logger.log(`📊 處理 ${maxRows - 1} 行資料...`);
    
    for (let i = 1; i < maxRows; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const columns = line.split(',');
      Logger.log(`\n行 ${i + 1}: ${columns.length} 個欄位`);
      
      // 策略 1: 最後幾個數字欄位（加入合理性檢查）
      for (let col = Math.max(0, columns.length - 4); col < columns.length; col++) {
        const cellValue = columns[col].replace(/["\s]/g, '');
        const amount = parseFloat(cellValue);
        
        if (!isNaN(amount) && amount >= MIN_AMOUNT && amount <= MAX_AMOUNT) {
          results.strategy1.total += amount;
          results.strategy1.count++;
          results.strategy1.amounts.push({ row: i + 1, col: col + 1, amount: amount });
          Logger.log(`  💰 策略1 - 欄位 ${col + 1}: ${amount} 元`);
          break;
        } else if (!isNaN(amount) && amount > 0) {
          Logger.log(`  ⚠️ 策略1 - 欄位 ${col + 1}: ${amount} 元 (超出合理範圍)`);
        }
      }
      
      // 策略 2: 關鍵字匹配（更嚴格）
      for (let col = 0; col < columns.length; col++) {
        const cellValue = columns[col].replace(/["\s]/g, '');
        
        if (cellValue.includes('NT') || cellValue.includes('$') || cellValue.includes('元')) {
          const amount = parseFloat(cellValue.replace(/[^0-9.]/g, ''));
          
          if (!isNaN(amount) && amount >= MIN_AMOUNT && amount <= MAX_AMOUNT) {
            results.strategy2.total += amount;
            results.strategy2.count++;
            results.strategy2.amounts.push({ row: i + 1, col: col + 1, amount: amount });
            Logger.log(`  💰 策略2 - 欄位 ${col + 1}: ${amount} 元 (含符號)`);
            break;
          }
        }
      }
      
      // 策略 3: 小數點金額策略（通常金額會有小數點）
      for (let col = 0; col < columns.length; col++) {
        const cellValue = columns[col].replace(/["\s]/g, '');
        
        if (/^\d+\.\d{1,2}$/.test(cellValue)) {
          const amount = parseFloat(cellValue);
          
          if (amount >= MIN_AMOUNT && amount <= MAX_AMOUNT) {
            results.strategy3.total += amount;
            results.strategy3.count++;
            results.strategy3.amounts.push({ row: i + 1, col: col + 1, amount: amount });
            Logger.log(`  💰 策略3 - 欄位 ${col + 1}: ${amount} 元 (小數點格式)`);
            break;
          }
        }
      }
      
      // 策略 4: 固定欄位策略（基於標題分析）
      for (let colIndex of amountColumnIndexes) {
        if (colIndex < columns.length) {
          const cellValue = columns[colIndex].replace(/["\s]/g, '');
          const amount = parseFloat(cellValue);
          
          if (!isNaN(amount) && amount >= MIN_AMOUNT && amount <= MAX_AMOUNT) {
            results.strategy4.total += amount;
            results.strategy4.count++;
            results.strategy4.amounts.push({ row: i + 1, col: colIndex + 1, amount: amount });
            Logger.log(`  💰 策略4 - 金額欄位 ${colIndex + 1}: ${amount} 元`);
            break;
          }
        }
      }
      
      // 策略 5: 中等金額範圍策略（更保守的範圍）
      for (let col = 0; col < columns.length; col++) {
        const cellValue = columns[col].replace(/["\s]/g, '');
        const amount = parseFloat(cellValue);
        
        if (!isNaN(amount) && amount >= 10 && amount <= TYPICAL_MAX) {
          results.strategy5.total += amount;
          results.strategy5.count++;
          results.strategy5.amounts.push({ row: i + 1, col: col + 1, amount: amount });
          Logger.log(`  💰 策略5 - 欄位 ${col + 1}: ${amount} 元 (中等範圍)`);
          break;
        }
      }
    }
    
    // 輸出各策略結果
    Logger.log('\n📊 修復版各策略提取結果:');
    Object.keys(results).forEach(key => {
      const strategy = results[key];
      Logger.log(`\n${key}: ${strategy.description}`);
      Logger.log(`  總金額: ${strategy.total} 元`);
      Logger.log(`  記錄數: ${strategy.count}`);
      Logger.log(`  平均金額: ${strategy.count > 0 ? (strategy.total / strategy.count).toFixed(2) : 0} 元`);
      
      if (strategy.amounts.length > 0) {
        Logger.log(`  樣本金額: ${strategy.amounts.slice(0, 3).map(a => `${a.amount}元`).join(', ')}`);
      }
    });
    
    // 選擇最佳策略（優先選擇有合理金額的策略）
    let bestStrategy = null;
    let bestScore = 0;
    
    Object.keys(results).forEach(key => {
      const strategy = results[key];
      
      if (strategy.total > 0 && strategy.count > 0) {
        const avgAmount = strategy.total / strategy.count;
        
        // 評分標準：
        // 1. 平均金額在合理範圍內
        // 2. 有足夠的記錄數
        // 3. 總金額合理
        let score = 0;
        
        if (avgAmount >= 10 && avgAmount <= 5000) {
          score += 100; // 平均金額合理
        }
        
        if (strategy.count >= 3) {
          score += 50; // 有足夠記錄數
        }
        
        if (strategy.total <= 500000) {
          score += 30; // 總金額合理
        }
        
        score += Math.min(strategy.count, 20); // 記錄數加分
        
        Logger.log(`${key} 評分: ${score} (平均: ${avgAmount.toFixed(2)}元)`);
        
        if (score > bestScore) {
          bestScore = score;
          bestStrategy = key;
        }
      }
    });
    
    if (bestStrategy) {
      const best = results[bestStrategy];
      Logger.log(`\n🏆 最佳策略: ${bestStrategy} - ${best.description}`);
      Logger.log(`💰 建議總金額: ${best.total} 元`);
      Logger.log(`📊 發票數量: ${best.count} 張`);
      Logger.log(`📈 平均金額: ${(best.total / best.count).toFixed(2)} 元`);
    } else {
      Logger.log('\n❌ 所有策略都無法提取合理金額');
    }
    
    return {
      strategies: results,
      bestStrategy: bestStrategy,
      recommendedAmount: bestStrategy ? results[bestStrategy].total : 0,
      recommendedCount: bestStrategy ? results[bestStrategy].count : 0,
      averageAmount: bestStrategy ? results[bestStrategy].total / results[bestStrategy].count : 0
    };
    
  } catch (error) {
    Logger.log(`❌ 修復版智慧提取失敗: ${error.toString()}`);
    return null;
  }
}

/**
 * 🔧 修復版財政部電子發票處理器
 */
function processGovernmentEInvoiceFixedAmount(message, result) {
  Logger.log('🏛️ 修復版財政部電子發票處理器（金額修復）...');
  
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
          
          // 使用修復版智慧提取
          const extraction = smartExtractAmountsFixed(csvContent);
          
          if (extraction && extraction.recommendedAmount > 0) {
            result.amount = extraction.recommendedAmount;
            result.description = `財政部 - 電子發票彙整 (${extraction.recommendedCount} 張發票, 平均 ${extraction.averageAmount.toFixed(0)} 元)`;
            
            Logger.log(`✅ 修復版處理成功: ${result.amount} 元`);
            Logger.log(`📊 發票數量: ${extraction.recommendedCount} 張`);
            Logger.log(`📈 平均金額: ${extraction.averageAmount.toFixed(2)} 元`);
            Logger.log(`🏆 使用策略: ${extraction.bestStrategy}`);
            
            return result;
          } else {
            Logger.log('❌ 修復版提取也失敗了');
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
    
    // 更保守的郵件內容金額提取
    const emailAmountPatterns = [
      /總金額[：:\s]*([0-9,]{1,8})/gi,
      /合計[：:\s]*([0-9,]{1,8})/gi,
      /總計[：:\s]*([0-9,]{1,8})/gi,
      /([0-9,]{1,8})\s*元/g,
      /NT\$\s*([0-9,]{1,8})/gi
    ];
    
    let extractedAmounts = [];
    
    for (let pattern of emailAmountPatterns) {
      const matches = textToSearch.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const cleanAmount = match.replace(/[^0-9]/g, '');
          const amount = parseFloat(cleanAmount);
          
          // 只接受合理範圍的金額
          if (!isNaN(amount) && amount >= 1 && amount <= 1000000) {
            extractedAmounts.push(amount);
          }
        });
      }
    }
    
    if (extractedAmounts.length > 0) {
      // 選擇最合理的金額（不是最大值）
      const reasonableAmounts = extractedAmounts.filter(amount => amount <= 100000);
      
      if (reasonableAmounts.length > 0) {
        result.amount = Math.max(...reasonableAmounts);
        Logger.log(`✅ 從郵件內容提取合理金額: ${result.amount}`);
      } else {
        Logger.log('⚠️ 郵件內容中的金額都超出合理範圍');
      }
    } else {
      Logger.log('❌ 完全無法提取金額');
    }
    
    return result;
    
  } catch (error) {
    Logger.log(`❌ 修復版處理器失敗: ${error.toString()}`);
    return result;
  }
}

/**
 * 🧪 測試修復版處理器
 */
function testFixedAmountProcessor() {
  Logger.log('🧪 測試修復版金額處理器...');
  
  try {
    // 搜尋測試郵件
    const threads = GmailApp.search('from:einvoice@einvoice.nat.gov.tw subject:彙整', 0, 1);
    
    if (threads.length === 0) {
      Logger.log('❌ 找不到測試郵件');
      return null;
    }
    
    const message = threads[0].getMessages()[0];
    Logger.log(`📧 測試郵件: ${message.getSubject()}`);
    
    let result = {
      date: Utilities.formatDate(message.getDate(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      amount: 0,
      currency: 'TWD',
      category: '其他',
      description: '財政部 - 電子發票彙整',
      merchant: '財政部',
      source: 'Email : 電子收據'
    };
    
    // 使用修復版處理器
    result = processGovernmentEInvoiceFixedAmount(message, result);
    
    Logger.log(`\n🧪 修復版測試結果:`);
    Logger.log(`  金額: ${result.amount} 元`);
    Logger.log(`  描述: ${result.description}`);
    Logger.log(`  商家: ${result.merchant}`);
    
    // 合理性檢查
    if (result.amount > 0 && result.amount <= 1000000) {
      Logger.log('🎉 修復版測試成功！金額在合理範圍內');
      
      if (result.amount <= 100000) {
        Logger.log('✅ 金額非常合理，建議使用此結果');
      } else {
        Logger.log('⚠️ 金額偏高，請人工確認');
      }
      
    } else if (result.amount > 1000000) {
      Logger.log('❌ 金額仍然異常，需要進一步調整邏輯');
    } else {
      Logger.log('❌ 無法提取有效金額');
    }
    
    return result;
    
  } catch (error) {
    Logger.log(`❌ 測試失敗: ${error.toString()}`);
    return null;
  }
}

/**
 * 🔍 詳細分析異常金額來源
 */
function analyzeAbnormalAmount() {
  Logger.log('🔍 分析異常金額來源...');
  
  try {
    const threads = GmailApp.search('from:einvoice@einvoice.nat.gov.tw subject:彙整', 0, 1);
    
    if (threads.length === 0) {
      Logger.log('❌ 找不到測試郵件');
      return;
    }
    
    const message = threads[0].getMessages()[0];
    const attachments = message.getAttachments();
    
    for (let attachment of attachments) {
      const fileName = attachment.getName();
      
      if (fileName.toLowerCase().includes('.csv')) {
        Logger.log(`🔍 分析 CSV: ${fileName}`);
        
        let csvContent = null;
        try {
          csvContent = attachment.getDataAsString('UTF-8');
        } catch (error) {
          csvContent = attachment.getDataAsString('Big5');
        }
        
        if (!csvContent) continue;
        
        const lines = csvContent.split('\n');
        Logger.log(`📊 分析前 5 行，尋找異常大數字...`);
        
        for (let i = 0; i < Math.min(5, lines.length); i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          Logger.log(`\n行 ${i + 1}: ${line}`);
          
          const columns = line.split(',');
          columns.forEach((col, colIndex) => {
            const cleanCol = col.replace(/["\s]/g, '');
            const numValue = parseFloat(cleanCol);
            
            if (!isNaN(numValue)) {
              if (numValue > 1000000) {
                Logger.log(`  ⚠️ 欄位 ${colIndex + 1}: ${numValue} (異常大數字 - 可能是發票號碼或日期)`);
              } else if (numValue > 100000) {
                Logger.log(`  ⚠️ 欄位 ${colIndex + 1}: ${numValue} (偏大數字)`);
              } else if (numValue >= 1 && numValue <= 100000) {
                Logger.log(`  ✅ 欄位 ${colIndex + 1}: ${numValue} (合理金額範圍)`);
              }
            } else if (cleanCol.length > 0) {
              Logger.log(`  📝 欄位 ${colIndex + 1}: "${cleanCol}" (非數字)`);
            }
          });
        }
      }
    }
    
  } catch (error) {
    Logger.log(`❌ 分析失敗: ${error.toString()}`);
  }
}