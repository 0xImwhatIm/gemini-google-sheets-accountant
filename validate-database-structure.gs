// =================================================================================================
// 財政部 CSV 結構深度診斷工具 - 2025-08-04
// 專門分析財政部電子發票 CSV 的實際格式和內容
// =================================================================================================

/**
 * 🔬 超詳細 CSV 結構分析
 */
function ultraDetailedCsvAnalysis() {
  Logger.log('🔬 開始超詳細 CSV 結構分析...');
  
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
      Logger.log(`\n📎 附件: ${fileName} (${attachment.getSize()} bytes)`);
      
      if (fileName.toLowerCase().includes('.csv')) {
        Logger.log(`\n📊 超詳細分析 CSV: ${fileName}`);
        
        // 嘗試多種編碼
        let csvContent = null;
        let usedEncoding = null;
        
        const encodings = ['UTF-8', 'Big5', 'GBK', 'UTF-16'];
        for (let encoding of encodings) {
          try {
            csvContent = attachment.getDataAsString(encoding);
            usedEncoding = encoding;
            Logger.log(`✅ 成功使用 ${encoding} 編碼讀取`);
            break;
          } catch (error) {
            Logger.log(`❌ ${encoding} 編碼失敗`);
          }
        }
        
        if (!csvContent) {
          Logger.log('❌ 所有編碼都失敗');
          continue;
        }
        
        // 分析 CSV 基本結構
        const lines = csvContent.split('\n');
        Logger.log(`\n📊 CSV 基本資訊:`);
        Logger.log(`  - 總行數: ${lines.length}`);
        Logger.log(`  - 編碼: ${usedEncoding}`);
        Logger.log(`  - 內容長度: ${csvContent.length} 字元`);
        
        // 分析分隔符
        const firstLine = lines[0] || '';
        const separators = [',', ';', '\t', '|'];
        let bestSeparator = ',';
        let maxColumns = 0;
        
        separators.forEach(sep => {
          const columns = firstLine.split(sep);
          if (columns.length > maxColumns) {
            maxColumns = columns.length;
            bestSeparator = sep;
          }
        });
        
        Logger.log(`  - 分隔符: "${bestSeparator}" (${maxColumns} 欄位)`);
        
        // 詳細分析前 15 行
        Logger.log(`\n📋 詳細行分析 (前 15 行):`);
        for (let i = 0; i < Math.min(15, lines.length); i++) {
          const line = lines[i].trim();
          if (!line) {
            Logger.log(`行 ${i + 1}: (空行)`);
            continue;
          }
          
          Logger.log(`\n行 ${i + 1}:`);
          Logger.log(`  原始內容: ${line.substring(0, 150)}${line.length > 150 ? '...' : ''}`);
          
          const columns = line.split(bestSeparator);
          Logger.log(`  欄位數: ${columns.length}`);
          
          // 分析每個欄位
          columns.forEach((col, colIndex) => {
            const cleanCol = col.replace(/["\s]/g, '');
            const originalCol = col.trim();
            
            Logger.log(`    欄位 ${colIndex + 1}: "${originalCol}"`);
            
            // 數字分析
            const numValue = parseFloat(cleanCol);
            if (!isNaN(numValue) && numValue > 0) {
              let numType = '';
              
              if (numValue < 1) {
                numType = '小數';
              } else if (numValue >= 1 && numValue <= 10000) {
                numType = '可能金額';
              } else if (numValue > 10000 && numValue <= 1000000) {
                numType = '大金額或代碼';
              } else {
                numType = '超大數字(可能是ID/日期)';
              }
              
              Logger.log(`      -> 數值: ${numValue} (${numType})`);
            } else if (cleanCol.length > 0) {
              // 文字分析
              let textType = '';
              
              if (/^\d{4}-\d{2}-\d{2}/.test(cleanCol)) {
                textType = '日期格式';
              } else if (/^[A-Z]{2}\d{8}$/.test(cleanCol)) {
                textType = '發票號碼格式';
              } else if (/^\d{8}$/.test(cleanCol)) {
                textType = '統一編號格式';
              } else if (cleanCol.includes('公司') || cleanCol.includes('有限')) {
                textType = '公司名稱';
              } else {
                textType = '一般文字';
              }
              
              Logger.log(`      -> 文字: "${cleanCol}" (${textType})`);
            }
          });
        }
        
        // 嘗試智慧識別欄位類型
        Logger.log(`\n🧠 智慧欄位識別:`);
        if (lines.length > 0) {
          const headers = lines[0].split(bestSeparator);
          
          headers.forEach((header, index) => {
            const cleanHeader = header.replace(/["\s]/g, '');
            Logger.log(`\n欄位 ${index + 1}: "${cleanHeader}"`);
            
            // 分析這個欄位在所有行中的內容
            let fieldAnalysis = {
              numbers: [],
              texts: [],
              patterns: []
            };
            
            for (let i = 1; i < Math.min(10, lines.length); i++) {
              const columns = lines[i].split(bestSeparator);
              if (index < columns.length) {
                const cellValue = columns[index].replace(/["\s]/g, '');
                const numValue = parseFloat(cellValue);
                
                if (!isNaN(numValue) && numValue > 0) {
                  fieldAnalysis.numbers.push(numValue);
                } else if (cellValue.length > 0) {
                  fieldAnalysis.texts.push(cellValue);
                }
              }
            }
            
            // 分析結果
            if (fieldAnalysis.numbers.length > 0) {
              const avgNum = fieldAnalysis.numbers.reduce((a, b) => a + b, 0) / fieldAnalysis.numbers.length;
              const minNum = Math.min(...fieldAnalysis.numbers);
              const maxNum = Math.max(...fieldAnalysis.numbers);
              
              Logger.log(`  數字統計: 平均=${avgNum.toFixed(2)}, 最小=${minNum}, 最大=${maxNum}`);
              Logger.log(`  樣本數字: ${fieldAnalysis.numbers.slice(0, 5).join(', ')}`);
              
              // 判斷是否可能是金額欄位
              if (avgNum >= 1 && avgNum <= 50000 && maxNum <= 500000) {
                Logger.log(`  🎯 可能是金額欄位！`);
              } else if (maxNum > 1000000) {
                Logger.log(`  ⚠️ 數字過大，可能是ID或代碼`);
              }
            }
            
            if (fieldAnalysis.texts.length > 0) {
              Logger.log(`  文字樣本: ${fieldAnalysis.texts.slice(0, 3).join(', ')}`);
            }
          });
        }
        
        return {
          fileName: fileName,
          encoding: usedEncoding,
          totalLines: lines.length,
          separator: bestSeparator,
          columnCount: maxColumns,
          sampleLines: lines.slice(0, 5)
        };
      }
    }
    
    return null;
    
  } catch (error) {
    Logger.log(`❌ 超詳細分析失敗: ${error.toString()}`);
    return null;
  }
}

/**
 * 🎯 基於實際結構的金額提取
 */
function extractAmountBasedOnActualStructure() {
  Logger.log('🎯 基於實際結構提取金額...');
  
  try {
    // 先執行結構分析
    const analysis = ultraDetailedCsvAnalysis();
    
    if (!analysis) {
      Logger.log('❌ 無法分析結構');
      return null;
    }
    
    // 基於分析結果提取金額
    const threads = GmailApp.search('from:einvoice@einvoice.nat.gov.tw subject:彙整', 0, 1);
    const message = threads[0].getMessages()[0];
    const attachments = message.getAttachments();
    
    for (let attachment of attachments) {
      const fileName = attachment.getName();
      
      if (fileName.toLowerCase().includes('.csv')) {
        let csvContent = attachment.getDataAsString('UTF-8');
        const lines = csvContent.split('\n');
        
        Logger.log(`\n💰 基於實際結構提取金額:`);
        
        let totalAmount = 0;
        let recordCount = 0;
        let amountDetails = [];
        
        // 使用更寬鬆的金額範圍
        const MIN_REASONABLE = 0.1;    // 最小 0.1 元
        const MAX_REASONABLE = 500000; // 最大 50 萬元
        
        for (let i = 1; i < Math.min(lines.length, 100); i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const columns = line.split(analysis.separator);
          
          // 策略：尋找每行中最合理的金額
          let bestAmount = 0;
          let bestColumn = -1;
          
          for (let col = 0; col < columns.length; col++) {
            const cellValue = columns[col].replace(/["\s]/g, '');
            const amount = parseFloat(cellValue);
            
            if (!isNaN(amount) && amount >= MIN_REASONABLE && amount <= MAX_REASONABLE) {
              // 優先選擇有小數點的金額
              if (cellValue.includes('.') && amount > bestAmount) {
                bestAmount = amount;
                bestColumn = col;
              } else if (!cellValue.includes('.') && amount > bestAmount && bestAmount === 0) {
                bestAmount = amount;
                bestColumn = col;
              }
            }
          }
          
          if (bestAmount > 0) {
            totalAmount += bestAmount;
            recordCount++;
            amountDetails.push({
              row: i + 1,
              column: bestColumn + 1,
              amount: bestAmount
            });
            
            Logger.log(`行 ${i + 1}, 欄位 ${bestColumn + 1}: ${bestAmount} 元`);
          }
        }
        
        Logger.log(`\n📊 提取結果:`);
        Logger.log(`  總金額: ${totalAmount} 元`);
        Logger.log(`  記錄數: ${recordCount}`);
        Logger.log(`  平均金額: ${recordCount > 0 ? (totalAmount / recordCount).toFixed(2) : 0} 元`);
        
        if (totalAmount > 0 && recordCount > 0) {
          const avgAmount = totalAmount / recordCount;
          
          if (avgAmount >= 1 && avgAmount <= 10000) {
            Logger.log('✅ 提取的金額看起來合理！');
            return {
              totalAmount: totalAmount,
              recordCount: recordCount,
              averageAmount: avgAmount,
              details: amountDetails.slice(0, 10) // 只返回前10個樣本
            };
          } else {
            Logger.log('⚠️ 平均金額可能不太合理，需要人工確認');
            return {
              totalAmount: totalAmount,
              recordCount: recordCount,
              averageAmount: avgAmount,
              details: amountDetails.slice(0, 10),
              warning: '平均金額異常'
            };
          }
        } else {
          Logger.log('❌ 無法提取到任何合理金額');
          return null;
        }
      }
    }
    
    return null;
    
  } catch (error) {
    Logger.log(`❌ 基於結構提取失敗: ${error.toString()}`);
    return null;
  }
}

/**
 * 🧪 測試基於實際結構的處理器
 */
function testStructureBasedProcessor() {
  Logger.log('🧪 測試基於實際結構的處理器...');
  
  try {
    const extractResult = extractAmountBasedOnActualStructure();
    
    if (!extractResult) {
      Logger.log('❌ 無法提取金額');
      return null;
    }
    
    // 搜尋測試郵件
    const threads = GmailApp.search('from:einvoice@einvoice.nat.gov.tw subject:彙整', 0, 1);
    const message = threads[0].getMessages()[0];
    
    let result = {
      date: Utilities.formatDate(message.getDate(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      amount: extractResult.totalAmount,
      currency: 'TWD',
      category: '其他',
      description: `財政部 - 電子發票彙整 (${extractResult.recordCount} 張發票, 平均 ${extractResult.averageAmount.toFixed(0)} 元)`,
      merchant: '財政部',
      source: 'Email : 電子收據'
    };
    
    Logger.log(`\n🧪 基於結構的測試結果:`);
    Logger.log(`  金額: ${result.amount} 元`);
    Logger.log(`  描述: ${result.description}`);
    Logger.log(`  發票數量: ${extractResult.recordCount}`);
    Logger.log(`  平均金額: ${extractResult.averageAmount.toFixed(2)} 元`);
    
    // 合理性評估
    if (extractResult.averageAmount >= 1 && extractResult.averageAmount <= 10000) {
      Logger.log('🎉 結果看起來非常合理！');
      Logger.log('✅ 建議使用此結果');
    } else if (extractResult.averageAmount > 10000) {
      Logger.log('⚠️ 平均金額偏高，請人工確認');
    } else {
      Logger.log('⚠️ 平均金額偏低，可能有問題');
    }
    
    if (extractResult.warning) {
      Logger.log(`⚠️ 警告: ${extractResult.warning}`);
    }
    
    return result;
    
  } catch (error) {
    Logger.log(`❌ 測試失敗: ${error.toString()}`);
    return null;
  }
}

/**
 * 📋 生成 CSV 結構報告
 */
function generateCsvStructureReport() {
  Logger.log('📋 生成 CSV 結構報告...');
  
  try {
    Logger.log('\n=== 財政部 CSV 結構分析報告 ===');
    Logger.log(`報告時間: ${new Date().toISOString()}`);
    
    // 1. 超詳細結構分析
    Logger.log('\n1. 結構分析:');
    const structureAnalysis = ultraDetailedCsvAnalysis();
    
    // 2. 金額提取測試
    Logger.log('\n2. 金額提取測試:');
    const extractionTest = testStructureBasedProcessor();
    
    // 3. 建議
    Logger.log('\n3. 建議:');
    if (extractionTest && extractionTest.amount > 0) {
      Logger.log('✅ 找到可行的金額提取方案');
      Logger.log('建議: 使用基於實際結構的提取邏輯');
      Logger.log(`推薦金額: ${extractionTest.amount} 元`);
    } else {
      Logger.log('❌ 仍無法找到合適的金額提取方案');
      Logger.log('建議: 需要人工檢查 CSV 格式或聯絡財政部確認格式變更');
    }
    
    Logger.log('\n=== 報告結束 ===');
    
    return {
      structure: structureAnalysis,
      extraction: extractionTest
    };
    
  } catch (error) {
    Logger.log(`❌ 報告生成失敗: ${error.toString()}`);
    return null;
  }
}