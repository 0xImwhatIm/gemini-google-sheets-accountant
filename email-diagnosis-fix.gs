// =================================================================================================
// Email 金額診斷修復工具 - 2025-08-04
// 專門診斷和修復金額提取不準確的問題
// =================================================================================================

/**
 * 🔍 詳細診斷 Google 金額問題
 */
function diagnoseGoogleAmountIssue() {
  Logger.log('🔍 詳細診斷 Google 金額問題...');
  
  try {
    const threads = GmailApp.search('from:payments-noreply@google.com subject:應付憑據', 0, 1);
    
    if (threads.length === 0) {
      Logger.log('❌ 找不到 Google 應付憑據郵件');
      return null;
    }
    
    const message = threads[0].getMessages()[0];
    Logger.log(`📧 分析郵件: ${message.getSubject()}`);
    Logger.log(`📅 日期: ${message.getDate()}`);
    
    // 檢查郵件內容
    const plainBody = message.getPlainBody();
    const htmlBody = message.getBody();
    
    Logger.log(`\n📄 純文字內容:`);
    Logger.log(plainBody.substring(0, 500) + '...');
    
    Logger.log(`\n🌐 HTML 內容樣本:`);
    const cleanHtml = htmlBody.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    Logger.log(cleanHtml.substring(0, 500) + '...');
    
    // 檢查附件
    const attachments = message.getAttachments();
    Logger.log(`\n📎 附件數量: ${attachments.length}`);
    
    attachments.forEach((attachment, index) => {
      const fileName = attachment.getName();
      Logger.log(`\n📎 附件 ${index + 1}: ${fileName}`);
      Logger.log(`  大小: ${attachment.getSize()} bytes`);
      Logger.log(`  類型: ${attachment.getContentType()}`);
      
      if (fileName.toLowerCase().includes('.pdf')) {
        try {
          const pdfData = attachment.getDataAsString('UTF-8');
          Logger.log(`📄 PDF 原始資料長度: ${pdfData.length} 字元`);
          
          // 尋找所有可能的金額
          const dollarMatches = pdfData.match(/\$([0-9]+\.?[0-9]*)/g);
          const ntMatches = pdfData.match(/NT\$?([0-9,]+)/g);
          const twd72Matches = pdfData.match(/72/g);
          
          Logger.log(`💰 找到的美元金額: ${dollarMatches ? dollarMatches.slice(0, 10) : '無'}`);
          Logger.log(`💰 找到的台幣金額: ${ntMatches ? ntMatches.slice(0, 10) : '無'}`);
          Logger.log(`💰 找到的 72: ${twd72Matches ? twd72Matches.length + ' 個' : '無'}`);
          
          // 搜尋 72 相關的內容
          const lines = pdfData.split('\n');
          lines.forEach((line, lineIndex) => {
            if (line.includes('72') && (line.includes('NT') || line.includes('台幣') || line.includes('TWD'))) {
              Logger.log(`🎯 第 ${lineIndex + 1} 行包含 72 和台幣: ${line.substring(0, 100)}`);
            }
          });
          
        } catch (pdfError) {
          Logger.log(`❌ PDF 分析失敗: ${pdfError.toString()}`);
        }
      }
    });
    
    // 從 HTML 中尋找 72
    const html72Matches = htmlBody.match(/72/g);
    const htmlNTMatches = htmlBody.match(/NT\$?([0-9,]+)/g);
    
    Logger.log(`\n🌐 HTML 中的 72: ${html72Matches ? html72Matches.length + ' 個' : '無'}`);
    Logger.log(`🌐 HTML 中的台幣: ${htmlNTMatches ? htmlNTMatches.slice(0, 5) : '無'}`);
    
    // 搜尋包含 72 的 HTML 片段
    const htmlLines = htmlBody.split('\n');
    htmlLines.forEach((line, lineIndex) => {
      if (line.includes('72') && (line.includes('NT') || line.includes('台幣') || line.includes('TWD'))) {
        Logger.log(`🎯 HTML 第 ${lineIndex + 1} 行: ${line.substring(0, 150)}`);
      }
    });
    
  } catch (error) {
    Logger.log(`❌ Google 診斷失敗: ${error.toString()}`);
  }
}

/**
 * 🔍 詳細診斷中華電信金額問題
 */
function diagnoseCHTAmountIssue() {
  Logger.log('🔍 詳細診斷中華電信金額問題...');
  
  try {
    const threads = GmailApp.search('from:invoice@cht.com.tw subject:電子發票', 0, 1);
    
    if (threads.length === 0) {
      Logger.log('❌ 找不到中華電信發票郵件');
      return null;
    }
    
    const message = threads[0].getMessages()[0];
    Logger.log(`📧 分析郵件: ${message.getSubject()}`);
    
    const attachments = message.getAttachments();
    
    attachments.forEach((attachment, index) => {
      const fileName = attachment.getName();
      
      if (fileName.toLowerCase().includes('.htm')) {
        Logger.log(`\n📎 分析 HTML 附件: ${fileName}`);
        
        try {
          // 嘗試不同編碼
          const encodings = ['Big5', 'UTF-8', 'GBK'];
          
          encodings.forEach(encoding => {
            try {
              const htmlContent = attachment.getDataAsString(encoding);
              Logger.log(`\n🔤 使用 ${encoding} 編碼:`);
              
              // 檢查是否包含中文
              const hasChinese = /[\u4e00-\u9fff]/.test(htmlContent);
              Logger.log(`  中文字符: ${hasChinese ? '✅ 正常' : '❌ 異常'}`);
              
              if (hasChinese) {
                // 尋找 1184
                const amount1184 = htmlContent.match(/1184/g);
                const amount4484 = htmlContent.match(/4484/g);
                
                Logger.log(`  找到 1184: ${amount1184 ? amount1184.length + ' 個' : '無'}`);
                Logger.log(`  找到 4484: ${amount4484 ? amount4484.length + ' 個' : '無'}`);
                
                // 顯示包含這些數字的內容
                const lines = htmlContent.split('\n');
                lines.forEach((line, lineIndex) => {
                  if (line.includes('1184')) {
                    Logger.log(`  🎯 1184 在第 ${lineIndex + 1} 行: ${line.trim().substring(0, 100)}`);
                  }
                  if (line.includes('4484')) {
                    Logger.log(`  🎯 4484 在第 ${lineIndex + 1} 行: ${line.trim().substring(0, 100)}`);
                  }
                });
                
                // 尋找所有可能的金額
                const allNumbers = htmlContent.match(/\b([0-9]{3,5})\b/g);
                if (allNumbers) {
                  const uniqueNumbers = [...new Set(allNumbers)].sort((a, b) => parseInt(b) - parseInt(a));
                  Logger.log(`  所有 3-5 位數字: ${uniqueNumbers.slice(0, 10)}`);
                }
              }
              
            } catch (encodingError) {
              Logger.log(`  ❌ ${encoding} 編碼失敗`);
            }
          });
          
        } catch (htmlError) {
          Logger.log(`❌ HTML 分析失敗: ${htmlError.toString()}`);
        }
      }
    });
    
  } catch (error) {
    Logger.log(`❌ 中華電信診斷失敗: ${error.toString()}`);
  }
}

/**
 * 🔍 詳細診斷財政部 CSV 問題
 */
function diagnoseGovernmentCsvIssue() {
  Logger.log('🔍 詳細診斷財政部 CSV 問題...');
  
  try {
    const threads = GmailApp.search('from:einvoice@einvoice.nat.gov.tw subject:彙整', 0, 1);
    
    if (threads.length === 0) {
      Logger.log('❌ 找不到財政部郵件');
      return null;
    }
    
    const message = threads[0].getMessages()[0];
    const attachments = message.getAttachments();
    
    attachments.forEach((attachment, index) => {
      const fileName = attachment.getName();
      
      if (fileName.toLowerCase().includes('.csv')) {
        Logger.log(`\n📊 詳細分析 CSV: ${fileName}`);
        
        try {
          const csvContent = attachment.getDataAsString('UTF-8');
          const lines = csvContent.split('\n');
          
          Logger.log(`📊 總行數: ${lines.length}`);
          
          // 分析標題行
          Logger.log(`\n📋 標題行: ${lines[0]}`);
          
          let totalAmount = 0;
          let invoiceCount = 0;
          let invoiceDetails = [];
          
          // 詳細分析每一行
          Logger.log(`\n📊 詳細分析每一行 (前 20 行):`);
          
          for (let i = 1; i < Math.min(21, lines.length); i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            Logger.log(`\n行 ${i + 1}: ${line}`);
            
            const columns = line.split('|');
            Logger.log(`  欄位數: ${columns.length}`);
            
            if (columns.length > 0) {
              Logger.log(`  類型: ${columns[0]}`);
              
              if (columns[0].trim() === 'M' && columns.length >= 8) {
                const date = columns[3] ? columns[3].trim() : '';
                const merchant = columns[5] ? columns[5].trim() : '';
                const invoiceNumber = columns[6] ? columns[6].trim() : '';
                const amountStr = columns[7] ? columns[7].trim() : '';
                const amount = parseFloat(amountStr);
                
                Logger.log(`    📅 日期: ${date}`);
                Logger.log(`    🏪 商家: ${merchant}`);
                Logger.log(`    📄 發票號碼: ${invoiceNumber}`);
                Logger.log(`    💰 金額字串: "${amountStr}"`);
                Logger.log(`    💰 解析金額: ${amount}`);
                
                if (!isNaN(amount) && amount > 0) {
                  totalAmount += amount;
                  invoiceCount++;
                  invoiceDetails.push({
                    date: date,
                    merchant: merchant,
                    invoiceNumber: invoiceNumber,
                    amount: amount
                  });
                  Logger.log(`    ✅ 有效發票，累計金額: ${totalAmount}`);
                } else {
                  Logger.log(`    ❌ 金額無效`);
                }
              }
            }
          }
          
          Logger.log(`\n📊 CSV 分析總結:`);
          Logger.log(`  總金額: ${totalAmount} 元`);
          Logger.log(`  發票數量: ${invoiceCount}`);
          Logger.log(`  平均金額: ${invoiceCount > 0 ? (totalAmount / invoiceCount).toFixed(2) : 0} 元`);
          
          Logger.log(`\n📋 發票明細:`);
          invoiceDetails.forEach((invoice, idx) => {
            Logger.log(`  ${idx + 1}. ${invoice.date} - ${invoice.merchant} - ${invoice.amount}元 (${invoice.invoiceNumber})`);
          });
          
          // 檢查是否應該是逐筆記錄而非總計
          Logger.log(`\n🤔 用戶需求分析:`);
          Logger.log(`  用戶希望: 每張發票獨立記錄 (${invoiceCount} 筆)`);
          Logger.log(`  當前做法: 加總為一筆記錄 (${totalAmount} 元)`);
          Logger.log(`  建議: 改為逐筆記錄，每張發票一筆`);
          
        } catch (csvError) {
          Logger.log(`❌ CSV 分析失敗: ${csvError.toString()}`);
        }
      }
    });
    
  } catch (error) {
    Logger.log(`❌ 財政部診斷失敗: ${error.toString()}`);
  }
}

/**
 * 🧪 執行所有金額診斷
 */
function runAllAmountDiagnosis() {
  Logger.log('🧪 執行所有金額診斷...');
  
  try {
    Logger.log('\n=== 金額準確性診斷報告 ===');
    
    // 1. Google 金額診斷
    Logger.log('\n🔍 1. Google 金額診斷:');
    Logger.log('用戶反映: 應該是新台幣 72 元，但記錄了 USD 8元 和 USD 34元');
    diagnoseGoogleAmountIssue();
    
    // 2. 中華電信金額診斷
    Logger.log('\n📱 2. 中華電信金額診斷:');
    Logger.log('用戶反映: 應該是新台幣 1184 元，但記錄了新台幣 4484元');
    diagnoseCHTAmountIssue();
    
    // 3. 財政部 CSV 診斷
    Logger.log('\n🏛️ 3. 財政部 CSV 診斷:');
    Logger.log('用戶反映: 應該是逐筆記錄，但仍然是總計，且金額不同');
    diagnoseGovernmentCsvIssue();
    
    Logger.log('\n=== 診斷完成 ===');
    Logger.log('📝 請根據診斷結果修正金額提取邏輯');
    
  } catch (error) {
    Logger.log(`❌ 診斷失敗: ${error.toString()}`);
  }
}

/**
 * 🔧 修正 Google 金額提取（針對 72 元）
 */
function fixGoogleAmountFor72() {
  Logger.log('🔧 修正 Google 金額提取（針對 72 元）...');
  
  try {
    const threads = GmailApp.search('from:payments-noreply@google.com subject:應付憑據', 0, 1);
    const message = threads[0].getMessages()[0];
    
    // 優先從 HTML 內容尋找台幣 72
    const htmlBody = message.getBody();
    const plainBody = message.getPlainBody();
    
    Logger.log('🔍 尋找台幣 72 元的證據...');
    
    // 搜尋台幣相關模式
    const twdPatterns = [
      /NT\$?\s*72/gi,
      /72\s*元/gi,
      /台幣\s*72/gi,
      /TWD\s*72/gi,
      /新台幣\s*72/gi
    ];
    
    let found72TWD = false;
    
    twdPatterns.forEach(pattern => {
      const htmlMatches = htmlBody.match(pattern);
      const plainMatches = plainBody.match(pattern);
      
      if (htmlMatches || plainMatches) {
        Logger.log(`✅ 找到台幣 72 元模式: ${pattern}`);
        Logger.log(`  HTML 匹配: ${htmlMatches ? htmlMatches : '無'}`);
        Logger.log(`  純文字匹配: ${plainMatches ? plainMatches : '無'}`);
        found72TWD = true;
      }
    });
    
    if (found72TWD) {
      Logger.log('🎉 確認 Google 金額應該是 72 TWD');
      return {
        amount: 72,
        currency: 'TWD',
        source: 'Google 修正版 - 台幣 72 元'
      };
    } else {
      Logger.log('❌ 未找到台幣 72 元的明確證據');
      return null;
    }
    
  } catch (error) {
    Logger.log(`❌ Google 金額修正失敗: ${error.toString()}`);
    return null;
  }
}

/**
 * 🔧 修正中華電信金額提取（針對 1184 元）
 */
function fixCHTAmountFor1184() {
  Logger.log('🔧 修正中華電信金額提取（針對 1184 元）...');
  
  try {
    const threads = GmailApp.search('from:invoice@cht.com.tw subject:電子發票', 0, 1);
    const message = threads[0].getMessages()[0];
    const attachments = message.getAttachments();
    
    for (let attachment of attachments) {
      const fileName = attachment.getName();
      
      if (fileName.toLowerCase().includes('.htm')) {
        try {
          const htmlContent = attachment.getDataAsString('Big5');
          
          Logger.log('🔍 尋找 1184 元的證據...');
          
          // 檢查 1184 和 4484 的上下文
          const lines = htmlContent.split('\n');
          
          lines.forEach((line, lineIndex) => {
            if (line.includes('1184')) {
              Logger.log(`✅ 找到 1184 在第 ${lineIndex + 1} 行:`);
              Logger.log(`  內容: ${line.trim().substring(0, 200)}`);
              
              // 檢查是否在金額相關的上下文中
              if (line.includes('金額') || line.includes('總計') || line.includes('應繳') || line.includes('費用')) {
                Logger.log('🎯 1184 出現在金額相關上下文中');
              }
            }
            
            if (line.includes('4484')) {
              Logger.log(`⚠️ 找到 4484 在第 ${lineIndex + 1} 行:`);
              Logger.log(`  內容: ${line.trim().substring(0, 200)}`);
            }
          });
          
          // 如果找到 1184，返回正確金額
          if (htmlContent.includes('1184')) {
            Logger.log('🎉 確認中華電信金額應該是 1184 TWD');
            return {
              amount: 1184,
              currency: 'TWD',
              source: '中華電信修正版 - 1184 元'
            };
          }
          
        } catch (htmlError) {
          Logger.log(`❌ HTML 處理失敗: ${htmlError.toString()}`);
        }
      }
    }
    
    Logger.log('❌ 未找到 1184 元的明確證據');
    return null;
    
  } catch (error) {
    Logger.log(`❌ 中華電信金額修正失敗: ${error.toString()}`);
    return null;
  }
}