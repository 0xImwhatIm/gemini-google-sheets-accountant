// =================================================================================================
// 台北自來水事業處電子帳單 Email 規則
// 版本：V47.4.1 - 2025-08-05
// 用途：直接從 HTML 內文提取帳單金額，避免處理需要密碼的 PDF 附件
// =================================================================================================

/**
 * 🚰 台北自來水事業處電子帳單專用處理規則
 * 寄件者：ebill@water.gov.taipei
 * 特點：PDF 需要密碼，但 HTML 內文包含金額信息
 */
function createWaterBillEmailRule() {
  const waterBillRule = {
    // 基本識別信息
    name: "台北自來水事業處電子帳單",
    description: "處理台北自來水事業處的電子帳單，從 HTML 內文提取金額",
    
    // 匹配條件
    conditions: {
      senderEmail: "ebill@water.gov.taipei",
      subjectContains: ["臺北自來水事業處", "水費", "電子帳單"],
      hasAttachment: true, // 通常有 PDF 附件，但我們不處理它
      contentType: "html" // 重點：處理 HTML 內文
    },
    
    // 處理邏輯
    processing: {
      method: "html_content_extraction", // 從 HTML 內文提取
      skipAttachments: true, // 跳過附件處理
      extractFromBody: true, // 從郵件內文提取
      
      // 金額提取規則
      amountExtraction: {
        // 多種可能的金額格式
        patterns: [
          /應繳金額[：:\s]*([0-9,]+)\s*元/,
          /本期應繳[：:\s]*([0-9,]+)\s*元/,
          /繳費金額[：:\s]*([0-9,]+)\s*元/,
          /總計[：:\s]*([0-9,]+)\s*元/,
          /NT\$\s*([0-9,]+)/,
          /\$([0-9,]+)/
        ],
        // 清理規則
        cleanup: {
          removeCommas: true,
          convertToNumber: true
        }
      },
      
      // 日期提取規則
      dateExtraction: {
        patterns: [
          /繳費期限[：:\s]*(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})/,
          /到期日[：:\s]*(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})/,
          /(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})[日\s]*到期/
        ],
        defaultToReceiveDate: true // 如果找不到日期，使用收信日期
      }
    },
    
    // 記帳分類
    accounting: {
      category: "住", // 水費屬於居住類別
      currency: "TWD",
      merchant: "台北自來水事業處",
      item: "水費",
      notes: "自動從電子帳單 HTML 內文提取"
    }
  };
  
  return waterBillRule;
}

/**
 * 🔍 台北自來水帳單 HTML 內文解析器
 */
function parseWaterBillHtmlContent(htmlContent, emailSubject, receivedDate) {
  try {
    Logger.log('[WaterBill] 開始解析台北自來水帳單 HTML 內文');
    
    // 移除 HTML 標籤，保留文字內容
    const textContent = htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    Logger.log(`[WaterBill] 提取的文字內容長度: ${textContent.length}`);
    
    // 提取金額
    const amount = extractAmountFromWaterBill(textContent);
    
    // 提取用戶編號（如果有）
    const userNumber = extractUserNumberFromWaterBill(textContent);
    
    // 使用郵件接收時間作為記帳時間戳（而非帳單上的繳費期限）
    const recordingTime = formatDateForAccounting(receivedDate);
    
    // 構建記帳資料
    const accountingData = {
      date: recordingTime,  // 直接使用郵件接收時間
      amount: amount,
      currency: "TWD",
      category: "住",
      item: userNumber ? `水費 (用戶號: ${userNumber})` : "水費",
      merchant: "台北自來水事業處",
      notes: `電子帳單自動提取 - ${emailSubject}`,
      source: "email_html_water_bill",
      originalContent: textContent.substring(0, 500) // 保留部分原始內容供查證
    };
    
    Logger.log(`[WaterBill] 解析結果: 金額=${amount}, 日期=${accountingData.date}, 用戶號=${userNumber}`);
    return accountingData;
    
  } catch (error) {
    Logger.log(`[WaterBill] HTML 內文解析失敗: ${error.toString()}`);
    throw new Error(`台北自來水帳單解析失敗: ${error.message}`);
  }
}

/**
 * 💰 從水費帳單文字中提取金額（根據實際截圖優化）
 */
function extractAmountFromWaterBill(textContent) {
  Logger.log(`[WaterBill] 開始分析文字內容，長度: ${textContent.length}`);
  Logger.log(`[WaterBill] 內容預覽: ${textContent.substring(0, 200)}...`);
  
  // 根據台北自來水帳單的實際格式，優化金額提取模式
  const amountPatterns = [
    // 優先匹配：表格中的金額格式（根據截圖）
    /本期水費[^0-9]*([0-9,]+)\s*元/i,
    /水費[^0-9]*([0-9,]+)\s*元/i,
    /應繳金額[：:\s]*([0-9,]+)\s*元/i,
    /本期應繳[：:\s]*([0-9,]+)\s*元/i,
    /繳費金額[：:\s]*([0-9,]+)\s*元/i,
    /總計[：:\s]*([0-9,]+)\s*元/i,
    /合計[：:\s]*([0-9,]+)\s*元/i,
    
    // 表格格式：可能在 TD 標籤中
    /<td[^>]*>([0-9,]+)\s*元<\/td>/i,
    /<td[^>]*>([0-9,]+)<\/td>/i,
    
    // 通用格式
    /NT\$\s*([0-9,]+)/i,
    /\$([0-9,]+)/i,
    /金額[：:\s]*([0-9,]+)/i,
    
    // 最後嘗試：任何數字+元的組合（但要在合理範圍內）
    /([0-9,]+)\s*元/g
  ];
  
  // 先嘗試精確匹配
  for (let i = 0; i < amountPatterns.length - 1; i++) {
    const pattern = amountPatterns[i];
    const match = textContent.match(pattern);
    if (match) {
      const amountStr = match[1].replace(/,/g, ''); // 移除千分位逗號
      const amount = parseInt(amountStr);
      if (amount > 0 && amount < 100000) { // 合理的水費範圍
        Logger.log(`[WaterBill] 找到金額: ${amount} (使用精確模式: ${pattern})`);
        return amount;
      }
    }
  }
  
  // 如果精確匹配失敗，使用全域搜尋找出所有可能的金額
  Logger.log('[WaterBill] 精確匹配失敗，嘗試全域搜尋...');
  const globalPattern = /([0-9,]+)\s*元/g;
  const allMatches = [...textContent.matchAll(globalPattern)];
  
  if (allMatches.length > 0) {
    Logger.log(`[WaterBill] 找到 ${allMatches.length} 個可能的金額:`);
    
    const validAmounts = [];
    allMatches.forEach((match, index) => {
      const amountStr = match[1].replace(/,/g, '');
      const amount = parseInt(amountStr);
      Logger.log(`[WaterBill] 候選金額 ${index + 1}: ${amount} 元`);
      
      // 水費的合理範圍：50-50000 元
      if (amount >= 50 && amount <= 50000) {
        validAmounts.push(amount);
      }
    });
    
    if (validAmounts.length > 0) {
      // 如果有多個有效金額，選擇最可能的一個
      // 通常水費在 100-5000 元之間，優先選擇這個範圍的
      const preferredAmounts = validAmounts.filter(amount => amount >= 100 && amount <= 5000);
      const finalAmount = preferredAmounts.length > 0 ? preferredAmounts[0] : validAmounts[0];
      
      Logger.log(`[WaterBill] 選擇金額: ${finalAmount} 元`);
      return finalAmount;
    }
  }
  
  Logger.log('[WaterBill] 未找到有效金額，使用預設值 0');
  return 0;
}

/**
 * 📅 從水費帳單文字中提取日期
 */
function extractDateFromWaterBill(textContent) {
  const datePatterns = [
    /繳費期限[：:\s]*(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})/,
    /到期日[：:\s]*(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})/,
    /(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})[日\s]*到期/,
    /(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})/
  ];
  
  for (const pattern of datePatterns) {
    const match = textContent.match(pattern);
    if (match) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]);
      const day = parseInt(match[3]);
      
      if (year >= 2020 && year <= 2030 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const date = new Date(year, month - 1, day);
        Logger.log(`[WaterBill] 找到日期: ${year}-${month}-${day}`);
        return date;
      }
    }
  }
  
  return null;
}

/**
 * 🔢 從水費帳單文字中提取用戶編號
 */
function extractUserNumberFromWaterBill(textContent) {
  const userNumberPatterns = [
    /用戶編號[：:\s]*([0-9A-Z-]+)/,
    /戶號[：:\s]*([0-9A-Z-]+)/,
    /用戶號碼[：:\s]*([0-9A-Z-]+)/,
    /客戶編號[：:\s]*([0-9A-Z-]+)/
  ];
  
  for (const pattern of userNumberPatterns) {
    const match = textContent.match(pattern);
    if (match) {
      Logger.log(`[WaterBill] 找到用戶編號: ${match[1]}`);
      return match[1];
    }
  }
  
  return null;
}

/**
 * 📅 格式化日期為記帳系統格式（使用實際接收時間）
 */
function formatDateForAccounting(date) {
  if (!date) {
    // 使用當前時區感知的日期時間
    const now = getCurrentTimezoneDateTime();
    return now.dateTime;
  }
  
  // 使用郵件實際接收的時間戳，而不是固定的 12:00:00
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 🧪 測試台北自來水帳單解析功能
 */
function testWaterBillParsing() {
  Logger.log('🧪 === 台北自來水帳單解析測試開始 ===');
  
  try {
    // 模擬 HTML 內容（基於實際截圖：428 元）
    const mockHtmlContent = `
      <html>
        <body>
          <h1>臺北自來水事業處</h1>
          <div class="bill-info">
            <p>臺北自來水事業處(114年07月水費電子帳單收費通知-2-08-019198-4)</p>
            <table border="1">
              <tr>
                <td>114年07月水費電子帳單</td>
                <td></td>
              </tr>
              <tr>
                <td>本期水費</td>
                <td>428元</td>
              </tr>
              <tr>
                <td>用戶編號</td>
                <td>2-08-019198-4</td>
              </tr>
              <tr>
                <td>繳費期限</td>
                <td>2025年08月15日</td>
              </tr>
            </table>
            <p>應繳金額: 428元</p>
            <p>本期應繳: 428元</p>
          </div>
        </body>
      </html>
    `;
    
    // 模擬郵件接收時間（當前時間）
    const mockReceivedDate = new Date();
    
    const result = parseWaterBillHtmlContent(
      mockHtmlContent, 
      "臺北自來水事業處(114年07月水費電子帳單收費通知)", 
      mockReceivedDate
    );
    
    Logger.log('✅ 解析結果:');
    Logger.log(`   金額: ${result.amount} 元 (預期: 428 元)`);
    Logger.log(`   日期: ${result.date} (使用郵件接收時間: ${mockReceivedDate.toLocaleString()})`);
    Logger.log(`   項目: ${result.item}`);
    Logger.log(`   類別: ${result.category}`);
    Logger.log(`   商家: ${result.merchant}`);
    Logger.log(`   用戶編號: ${result.item.includes('2-08-019198-4') ? '✅ 正確提取' : '❌ 提取失敗'}`);
    
    // 驗證金額是否正確
    if (result.amount === 428) {
      Logger.log('🎉 台北自來水帳單解析測試成功！金額正確提取為 428 元');
      Logger.log('✅ 日期使用郵件接收時間，而非帳單繳費期限');
    } else if (result.amount > 0) {
      Logger.log(`⚠️ 金額提取成功但不正確：提取到 ${result.amount} 元，預期 428 元`);
    } else {
      Logger.log('❌ 金額提取失敗，需要調整解析規則');
    }
    
    return result;
    
  } catch (error) {
    Logger.log(`❌ 測試失敗: ${error.toString()}`);
    return null;
  }
  
  Logger.log('=== 台北自來水帳單解析測試結束 ===');
}

/**
 * 📧 整合到現有的 Email 處理系統
 */
function integrateWaterBillRule() {
  Logger.log('📧 整合台北自來水帳單規則到 Email 處理系統...');
  
  try {
    // 獲取現有的 Email Rules
    const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
    const emailRulesSheet = ss.getSheetByName(EMAIL_RULES_SHEET_NAME);
    
    if (!emailRulesSheet) {
      throw new Error(`找不到 Email Rules 工作表: ${EMAIL_RULES_SHEET_NAME}`);
    }
    
    // 檢查是否已存在此規則
    const existingRules = emailRulesSheet.getDataRange().getValues();
    const waterRuleExists = existingRules.some(row => 
      row[0] && row[0].includes('ebill@water.gov.taipei')
    );
    
    if (!waterRuleExists) {
      // 添加新規則
      const newRule = [
        'ebill@water.gov.taipei', // 寄件者
        '臺北自來水事業處', // 關鍵字
        '住', // 類別
        'parseWaterBillHtmlContent', // 處理函數
        'true', // 啟用
        '台北自來水事業處電子帳單 - HTML 內文解析', // 描述
        'html_content', // 處理類型
        'skip_attachments' // 特殊標記
      ];
      
      emailRulesSheet.appendRow(newRule);
      Logger.log('✅ 台北自來水帳單規則已添加到 Email Rules');
    } else {
      Logger.log('ℹ️ 台北自來水帳單規則已存在，跳過添加');
    }
    
  } catch (error) {
    Logger.log(`❌ 整合失敗: ${error.toString()}`);
  }
}