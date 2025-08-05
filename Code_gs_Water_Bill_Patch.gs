// =================================================================================================
// Code.gs 台北自來水帳單處理補丁 - V47.4.1
// 版本：V47.4.1 - 2025-08-05
// 用途：將台北自來水帳單 HTML 內文處理功能整合到現有的 Code.gs 中
// 使用方法：將以下代碼添加到你的 Code.gs 文件末尾
// =================================================================================================

// =================================================================================================
// 【V47.4.1 新增】台北自來水帳單 HTML 內文處理功能
// =================================================================================================

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
 * 🚰 處理台北自來水事業處電子帳單（整合到現有 Email 處理系統）
 */
function processWaterBillEmails() {
  Logger.log('🚰 === 開始處理台北自來水事業處電子帳單 ===');
  
  try {
    // 搜尋台北自來水的郵件
    const searchQuery = 'from:ebill@water.gov.taipei subject:(臺北自來水事業處 OR 水費 OR 電子帳單) is:unread';
    const threads = GmailApp.search(searchQuery, 0, 10);
    
    Logger.log(`🔍 找到 ${threads.length} 封台北自來水帳單郵件`);
    
    let processedCount = 0;
    
    for (const thread of threads) {
      const messages = thread.getMessages();
      
      for (const message of messages) {
        try {
          Logger.log(`📧 處理郵件: ${message.getSubject()}`);
          
          // 獲取 HTML 內容
          const htmlBody = message.getBody();
          const subject = message.getSubject();
          const receivedDate = message.getDate();
          
          if (!htmlBody) {
            Logger.log('⚠️ 郵件沒有 HTML 內容，跳過');
            continue;
          }
          
          // 使用專門的水費帳單解析器
          const accountingData = parseWaterBillHtmlContent(htmlBody, subject, receivedDate);
          
          if (accountingData && accountingData.amount > 0) {
            // 使用修正後的水費專用寫入函數
            const writeSuccess = writeWaterBillToSheet(accountingData, 'email_water_bill');
            
            if (writeSuccess) {
              // 標記為已讀
              message.markRead();
              processedCount++;
              
              Logger.log(`✅ 台北自來水帳單處理成功: ${accountingData.amount} 元`);
              
              // 發送通知
              sendNotification(
                '台北自來水帳單自動記帳', 
                `金額: ${accountingData.amount} 元\n項目: ${accountingData.item}\n日期: ${accountingData.date}`, 
                'INFO'
              );
            } else {
              Logger.log('❌ 寫入 Sheets 失敗');
            }
          } else {
            Logger.log('⚠️ 無法從 HTML 內容提取有效的帳單信息');
          }
          
        } catch (messageError) {
          Logger.log(`❌ 處理單封郵件失敗: ${messageError.toString()}`);
        }
      }
    }
    
    Logger.log(`🚰 台北自來水帳單處理完成，共處理 ${processedCount} 封`);
    return processedCount;
    
  } catch (error) {
    Logger.log(`❌ 台北自來水帳單處理失敗: ${error.toString()}`);
    return 0;
  }
}

// =================================================================================================
// 【V47.4.1 修改】更新現有的 processAutomatedEmails 函數
// 將台北自來水帳單處理整合到現有的 Email 處理流程中
// =================================================================================================

/**
 * 🔄 V47.4.1 增強版 processAutomatedEmails
 * 整合台北自來水帳單處理功能
 * 
 * 注意：這個函數會替換你現有的 processAutomatedEmails 函數
 * 如果你已經有自訂的 processAutomatedEmails，請手動整合 processWaterBillEmails() 調用
 */
function processAutomatedEmailsWithWaterBill() {
  return withPhase4ErrorHandling(() => {
    Logger.log('🔄 === V47.4.1 增強版 Email 自動處理開始 ===');
    
    let totalProcessed = 0;
    
    try {
      // 1. 處理台北自來水帳單（新增功能）
      Logger.log('🚰 處理台北自來水帳單...');
      const waterBillCount = processWaterBillEmails();
      totalProcessed += waterBillCount;
      
      // 2. 調用現有的 Email 處理邏輯
      Logger.log('📧 調用現有的 Email 處理邏輯...');
      if (typeof processAutomatedEmailsFixed === 'function') {
        Logger.log('✅ 調用修復版電子郵件處理');
        const existingCount = processAutomatedEmailsFixed();
        totalProcessed += (existingCount || 0);
      } else if (typeof processAutomatedEmailsV46Compatible === 'function') {
        Logger.log('✅ 調用 V46 相容版電子郵件處理');
        const existingCount = processAutomatedEmailsV46Compatible();
        totalProcessed += (existingCount || 0);
      } else {
        Logger.log('⚠️ 找不到現有的電子郵件處理實作函數，僅處理台北自來水帳單');
      }
      
      Logger.log(`✅ === V47.4.1 Email 處理完成，共處理 ${totalProcessed} 封郵件 ===`);
      return totalProcessed > 0;
      
    } catch (error) {
      Logger.log(`❌ V47.4.1 Email 處理失敗: ${error.toString()}`);
      sendNotification('Email 自動處理失敗', error.toString(), 'ERROR');
      return false;
    }
  }, {}, 'processAutomatedEmailsWithWaterBill');
}

// =================================================================================================
// 【V47.4.1 測試】台北自來水帳單處理測試函數
// =================================================================================================

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

// =================================================================================================
// 【使用說明】Code.gs 整合指南
// =================================================================================================
/*
📋 整合步驟：

1. 將以上所有代碼複製並添加到你的 Code.gs 文件末尾

2. 更新你的觸發器：
   - 如果你想使用新的整合版本，將觸發器改為調用 processAutomatedEmailsWithWaterBill
   - 或者在現有的 processAutomatedEmails 函數中添加 processWaterBillEmails() 調用

3. 測試功能：
   - 執行 testWaterBillParsing() 測試解析功能
   - 執行 processWaterBillEmails() 測試實際郵件處理

4. 設定 Email Rules（可選）：
   - 執行 addWaterBillRuleToEmailRules() 添加處理規則

✅ 完成後，你的系統就能自動處理台北自來水的電子帳單了！
*/