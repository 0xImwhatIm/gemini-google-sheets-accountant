// =================================================================================================
// 金額診斷工具 - 2025-08-04
// 專門診斷 Google、中華電信、財政部的金額提取問題
// =================================================================================================

/**
 * 🔍 執行所有金額診斷
 */
function runAllAmountDiagnosis() {
  Logger.log('🔍 開始執行所有金額診斷...');
  
  try {
    Logger.log('\n=== 金額診斷報告 ===');
    
    // 1. Google 金額診斷
    Logger.log('\n1. 🔍 Google 金額診斷:');
    diagnoseGoogleAmount();
    
    // 2. 中華電信金額診斷
    Logger.log('\n2. 📱 中華電信金額診斷:');
    diagnoseCHTAmount();
    
    // 3. 財政部金額診斷
    Logger.log('\n3. 🏛️ 財政部金額診斷:');
    diagnoseGovernmentAmount();
    
    Logger.log('\n✅ 所有金額診斷完成');
    
  } catch (error) {
    Logger.log(`❌ 診斷失敗: ${error.toString()}`);
  }
}

/**
 * 🔍 Google 金額診斷 - 尋找正確的 NT$72
 */
function diagnoseGoogleAmount() {
  Logger.log('🔍 診斷 Google 金額問題...');
  
  try {
    const threads = GmailApp.search('from:payments-noreply@google.com subject:應付憑據', 0, 1);
    
    if (threads.length === 0) {
      Logger.log('❌ 找不到 Google 應付憑據郵件');
      return;
    }
    
    const message = threads[0].getMessages()[0];
    Logger.log(`📧 分析郵件: ${message.getSubject()}`);
    Logger.log(`📅 日期: ${message.getDate()}`);
    
    // 分析郵件內容
    const plainBody = message.getPlainBody();
    const htmlBody = message.getBody();
    
    Logger.log('\n--- 純文字內容金額分析 ---');
    analyzeAmountPatterns(plainBody, 'Plain Text');
    
    Logger.log('\n--- HTML 內容金額分析 ---');
    analyzeAmountPatterns(htmlBody, 'HTML');
    
    // 分析附件
    const attachments = message.getAttachments();
    Logger.log(`\n--- 附件分析 (共 ${attachments.length} 個) ---`);
    
    attachments.forEach((attachment, index) => {
      const fileName = attachment.getName();
      Logger.log(`📎 附件 ${index + 1}: ${fileName}`);
      
      if (fileName.toLowerCase().includes('.pdf')) {
        try {
          const pdfData = attachment.getDataAsString('UTF-8');
          Logger.log('\n--- PDF 內容金額分析 ---');
          analyzeAmountPatterns(pdfData, 'PDF');
        } catch (pdfError) {
          Logger.log(`❌ PDF 讀取失敗: ${pdfError.toString()}`);
        }
      }
    });
    
  } catch (error) {
    Logger.log(`❌ Google 診斷失敗: ${error.toString()}`);
  }
}

/**
 * 📱 中華電信金額診斷 - 比較 1184 vs 4484
 */
function diagnoseCHTAmount() {
  Logger.log('📱 診斷中華電信金額問題...');
  
  try {
    const threads = GmailApp.search('from:invoice@cht.com.tw subject:電子發票', 0, 1);
    
    if (threads.length === 0) {
      Logger.log('❌ 找不到中華電信發票郵件');
      return;
    }
    
    const message = threads[0].getMessages()[0];
    Logger.log(`📧 分析郵件: ${message.getSubject()}`);
    Logger.log(`📅 日期: ${message.getDate()}`);
    
    // 分析附件
    const attachments = message.getAttachments();
    Logger.log(`\n--- 附件分析 (共 ${attachments.length} 個) ---`);
    
    attachments.forEach((attachment, index) => {
      const fileName = attachment.getName();
      Logger.log(`📎 附件 ${index + 1}: ${fileName}`);
      
      if (fileName.toLowerCase().includes('.htm')) {
        try {
          // 嘗試不同編碼
          Logger.log('\n--- HTML 附件內容分析 (UTF-8) ---');
          let htmlContent = attachment.getDataAsString('UTF-8');
          analyzeCHTAmountInHTML(htmlContent, 'UTF-8');
          
          Logger.log('\n--- HTML 附件內容分析 (Big5) ---');
          htmlContent = attachment.getDataAsString('Big5');
          analyzeCHTAmountInHTML(htmlContent, 'Big5');
          
        } catch (htmlError) {
          Logger.log(`❌ HTML 讀取失敗: ${htmlError.toString()}`);
        }
      }
    });
    
  } catch (error) {
    Logger.log(`❌ 中華電信診斷失敗: ${error.toString()}`);
  }
}

/**
 * 🏛️ 財政部金額診斷 - 分析每筆發票詳細資料
 */
function diagnoseGovernmentAmount() {
  Logger.log('🏛️ 診斷財政部金額問題...');
  
  try {
    const threads = GmailApp.search('from:einvoice@einvoice.nat.gov.tw subject:彙整', 0, 1);
    
    if (threads.length === 0) {
      Logger.log('❌ 找不到財政部發票郵件');
      return;
    }
    
    const message = threads[0].getMessages()[0];
    Logger.log(`📧 分析郵件: ${message.getSubject()}`);
    Logger.log(`📅 日期: ${message.getDate()}`);
    
    // 分析附件
    const attachments = message.getAttachments();
    Logger.log(`\n--- 附件分析 (共 ${attachments.length} 個) ---`);
    
    attachments.forEach((attachment, index) => {
      const fileName = attachment.getName();
      Logger.log(`📎 附件 ${index + 1}: ${fileName}`);
      
      if (fileName.toLowerCase().includes('.csv')) {
        try {
          const csvContent = attachment.getDataAsString('UTF-8');
          Logger.log('\n--- CSV 內容詳細分析 ---');
          analyzeGovernmentCSV(csvContent);
          
        } catch (csvError) {
          Logger.log(`❌ CSV 讀取失敗: ${csvError.toString()}`);
        }
      }
    });
    
  } catch (error) {
    Logger.log(`❌ 財政部診斷失敗: ${error.toString()}`);
  }
}

/**
 * 🔍 通用金額模式分析
 */
function analyzeAmountPatterns(content, source) {
  Logger.log(`\n--- ${source} 金額模式分析 ---`);
  
  const patterns = [
    { name: 'NT$ 格式', regex: /NT\$\s*([0-9,]+(?:\.[0-9]{1,2})?)/g },
    { name: 'USD 格式', regex: /\$\s*([0-9,]+(?:\.[0-9]{1,2})?)/g },
    { name: '元 格式', regex: /([0-9,]+(?:\.[0-9]{1,2})?)\s*元/g },
    { name: '總計格式', regex: /總計[：:\s]*([0-9,]+(?:\.[0-9]{1,2})?)/gi },
    { name: 'Total格式', regex: /Total[：:\s]*\$?\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi },
    { name: '純數字', regex: /\b([0-9]{2,6}(?:\.[0-9]{1,2})?)\b/g }
  ];
  
  patterns.forEach(pattern => {
    const matches = content.match(pattern.regex);
    if (matches && matches.length > 0) {
      Logger.log(`✅ ${pattern.name}: 找到 ${matches.length} 個匹配`);
      matches.slice(0, 5).forEach((match, index) => {
        Logger.log(`   ${index + 1}. ${match}`);
      });
      if (matches.length > 5) {
        Logger.log(`   ... 還有 ${matches.length - 5} 個匹配`);
      }
    } else {
      Logger.log(`❌ ${pattern.name}: 無匹配`);
    }
  });
  
  // 特別尋找 72 相關的數字
  const seventyTwoMatches = content.match(/\b72\b/g);
  if (seventyTwoMatches) {
    Logger.log(`🎯 特別關注 "72": 找到 ${seventyTwoMatches.length} 個匹配`);
    
    // 尋找 72 前後的上下文
    const contextMatches = content.match(/.{0,20}\b72\b.{0,20}/g);
    if (contextMatches) {
      contextMatches.forEach((context, index) => {
        Logger.log(`   上下文 ${index + 1}: "${context.trim()}"`);
      });
    }
  }
}

/**
 * 📱 中華電信 HTML 金額分析
 */
function analyzeCHTAmountInHTML(htmlContent, encoding) {
  Logger.log(`\n--- 中華電信 HTML 分析 (${encoding}) ---`);
  
  // 尋找所有可能的金額
  const amountPatterns = [
    { name: '應繳金額', regex: /應繳金額[：:\s]*([0-9,]+)/gi },
    { name: '總金額', regex: /總金額[：:\s]*([0-9,]+)/gi },
    { name: '本期費用', regex: /本期費用[：:\s]*([0-9,]+)/gi },
    { name: 'TD標籤數字', regex: />([0-9,]+)<\/td>/gi },
    { name: '四位數字', regex: /\b([0-9]{4})\b/g }
  ];
  
  amountPatterns.forEach(pattern => {
    const matches = htmlContent.match(pattern.regex);
    if (matches && matches.length > 0) {
      Logger.log(`✅ ${pattern.name}: 找到 ${matches.length} 個匹配`);
      matches.slice(0, 10).forEach((match, index) => {
        Logger.log(`   ${index + 1}. ${match}`);
      });
    }
  });
  
  // 特別尋找 1184 和 4484
  const targetNumbers = ['1184', '4484'];
  targetNumbers.forEach(number => {
    const numberMatches = htmlContent.match(new RegExp(`\\b${number}\\b`, 'g'));
    if (numberMatches) {
      Logger.log(`🎯 特別關注 "${number}": 找到 ${numberMatches.length} 個匹配`);
      
      // 尋找上下文
      const contextMatches = htmlContent.match(new RegExp(`.{0,30}\\b${number}\\b.{0,30}`, 'g'));
      if (contextMatches) {
        contextMatches.forEach((context, index) => {
          Logger.log(`   上下文 ${index + 1}: "${context.trim()}"`);
        });
      }
    }
  });
}

/**
 * 🏛️ 財政部 CSV 詳細分析
 */
function analyzeGovernmentCSV(csvContent) {
  Logger.log('\n--- 財政部 CSV 詳細分析 ---');
  
  const lines = csvContent.split('\n');
  Logger.log(`📊 總行數: ${lines.length}`);
  
  if (lines.length > 0) {
    Logger.log(`📋 標題行: ${lines[0]}`);
  }
  
  let totalAmount = 0;
  let invoiceCount = 0;
  let detailCount = 0;
  
  Logger.log('\n--- 逐行分析 ---');
  
  for (let i = 1; i < Math.min(lines.length, 20); i++) { // 限制顯示前20行
    const line = lines[i].trim();
    if (!line) continue;
    
    const columns = line.split('|');
    Logger.log(`第 ${i} 行: ${columns.length} 欄位`);
    Logger.log(`   類型: ${columns[0] || 'N/A'}`);
    
    if (columns.length >= 8) {
      Logger.log(`   金額欄位: ${columns[7] || 'N/A'}`);
      
      if (columns[0] && columns[0].trim() === 'M') {
        invoiceCount++;
        const amountStr = columns[7] ? columns[7].trim() : '';
        const amount = parseFloat(amountStr);
        
        if (!isNaN(amount) && amount > 0) {
          totalAmount += amount;
          Logger.log(`   ✅ 主記錄 ${invoiceCount}: ${amount} 元`);
          
          // 顯示更多欄位資訊
          if (columns.length >= 6) {
            Logger.log(`      商家: ${columns[5] || 'N/A'}`);
          }
          if (columns.length >= 4) {
            Logger.log(`      發票號碼: ${columns[3] || 'N/A'}`);
          }
        }
      } else if (columns[0] && columns[0].trim() === 'D') {
        detailCount++;
        Logger.log(`   📝 明細記錄 ${detailCount}`);
      }
    }
    
    Logger.log(''); // 空行分隔
  }
  
  if (lines.length > 20) {
    Logger.log(`... 還有 ${lines.length - 20} 行未顯示`);
  }
  
  Logger.log('\n--- 統計摘要 ---');
  Logger.log(`📊 發票總數: ${invoiceCount} 張`);
  Logger.log(`📝 明細總數: ${detailCount} 筆`);
  Logger.log(`💰 總金額: ${totalAmount} 元`);
  Logger.log(`📈 平均金額: ${invoiceCount > 0 ? (totalAmount / invoiceCount).toFixed(2) : 0} 元`);
}

/**
 * 🎯 快速測試特定郵件的金額提取
 */
function testSpecificEmailAmount(emailType) {
  Logger.log(`🎯 測試 ${emailType} 郵件金額提取...`);
  
  const queries = {
    'Google': 'from:payments-noreply@google.com subject:應付憑據',
    'CHT': 'from:invoice@cht.com.tw subject:電子發票',
    'Government': 'from:einvoice@einvoice.nat.gov.tw subject:彙整'
  };
  
  const query = queries[emailType];
  if (!query) {
    Logger.log(`❌ 未知的郵件類型: ${emailType}`);
    return;
  }
  
  try {
    const threads = GmailApp.search(query, 0, 1);
    if (threads.length === 0) {
      Logger.log(`❌ 找不到 ${emailType} 郵件`);
      return;
    }
    
    const message = threads[0].getMessages()[0];
    
    // 使用現有的處理邏輯
    let result = {
      date: Utilities.formatDate(message.getDate(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      amount: 0,
      currency: 'TWD',
      category: '其他',
      description: message.getSubject(),
      merchant: '',
      invoiceNumber: '',
      source: 'Email : 電子收據'
    };
    
    switch (emailType) {
      case 'Google':
        result = processGooglePaymentComplete(message, result);
        break;
      case 'CHT':
        result = processCHTInvoiceComplete(message, result);
        break;
      case 'Government':
        result = processGovernmentInvoiceComplete(message, result);
        break;
    }
    
    Logger.log(`\n✅ ${emailType} 處理結果:`);
    Logger.log(`   金額: ${result.amount} ${result.currency}`);
    Logger.log(`   商家: ${result.merchant}`);
    Logger.log(`   描述: ${result.description}`);
    
  } catch (error) {
    Logger.log(`❌ 測試失敗: ${error.toString()}`);
  }
}