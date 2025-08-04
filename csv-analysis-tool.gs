// =================================================================================================
// CSV 結構分析工具 - 2025-08-04
// 深度分析財政部 CSV 的完整結構和欄位內容
// =================================================================================================

/**
 * 🔍 深度分析財政部 CSV 結構
 */
function analyzeGovernmentCSVStructure() {
  Logger.log('🔍 深度分析財政部 CSV 結構...');
  
  try {
    const threads = GmailApp.search('from:einvoice@einvoice.nat.gov.tw subject:彙整', 0, 1);
    
    if (threads.length === 0) {
      Logger.log('❌ 找不到財政部發票郵件');
      return;
    }
    
    const message = threads[0].getMessages()[0];
    const attachments = message.getAttachments();
    
    attachments.forEach((attachment, index) => {
      const fileName = attachment.getName();
      
      if (fileName.toLowerCase().includes('.csv')) {
        Logger.log(`\n📎 分析 CSV: ${fileName}`);
        
        try {
          const csvContent = attachment.getDataAsString('UTF-8');
          const lines = csvContent.split('\n');
          
          Logger.log(`📊 總行數: ${lines.length}`);
          
          // 分析標題行
          if (lines.length > 0) {
            Logger.log(`\n--- 標題行分析 ---`);
            Logger.log(`原始標題: ${lines[0]}`);
            
            const headers = lines[0].split('|');
            Logger.log(`標題欄位數: ${headers.length}`);
            headers.forEach((header, i) => {
              Logger.log(`  欄位 ${i}: "${header.trim()}"`);
            });
          }
          
          // 分析前 10 筆主記錄 (M)
          Logger.log(`\n--- 主記錄 (M) 詳細分析 ---`);
          let mRecordCount = 0;
          
          for (let i = 1; i < lines.length && mRecordCount < 10; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const columns = line.split('|');
            
            if (columns.length > 0 && columns[0].trim() === 'M') {
              mRecordCount++;
              Logger.log(`\n主記錄 ${mRecordCount}:`);
              Logger.log(`  完整行: ${line}`);
              Logger.log(`  欄位數: ${columns.length}`);
              
              // 分析每個欄位
              columns.forEach((col, index) => {
                Logger.log(`    欄位 ${index}: "${col.trim()}"`);
              });
              
              // 特別分析可能的日期欄位
              if (columns.length >= 4) {
                const dateField = columns[3] ? columns[3].trim() : '';
                Logger.log(`  🗓️ 可能的日期欄位 (欄位3): "${dateField}"`);
                
                // 嘗試解析日期
                if (dateField) {
                  const dateFormats = [
                    /^(\d{4})(\d{2})(\d{2})$/,  // YYYYMMDD
                    /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
                    /^(\d{4})\/(\d{2})\/(\d{2})$/, // YYYY/MM/DD
                    /^(\d{2})\/(\d{2})\/(\d{4})$/, // MM/DD/YYYY
                  ];
                  
                  dateFormats.forEach((format, formatIndex) => {
                    const match = dateField.match(format);
                    if (match) {
                      Logger.log(`    ✅ 匹配日期格式 ${formatIndex + 1}: ${match[0]}`);
                      
                      if (formatIndex === 0) { // YYYYMMDD
                        const year = match[1];
                        const month = match[2];
                        const day = match[3];
                        Logger.log(`      解析為: ${year}-${month}-${day}`);
                      }
                    }
                  });
                }
              }
              
              // 分析商家名稱以推測分類
              if (columns.length >= 6) {
                const merchantName = columns[5] ? columns[5].trim() : '';
                Logger.log(`  🏪 商家名稱: "${merchantName}"`);
                
                // 分析可能的分類
                const categoryKeywords = {
                  '食': ['超商', '全聯', '全家', '統一', '便利商店', '餐', '食品', '麥當勞', '肯德基', '星巴克', '咖啡', '茶', '飲料'],
                  '行': ['中華電信', '台灣大哥大', '遠傳', '加油站', '中油', '台塑', '停車', '計程車', '捷運', '公車'],
                  '衣': ['服飾', '衣服', '鞋', '包', '配件', 'UNIQLO', 'ZARA', 'H&M'],
                  '住': ['水電', '瓦斯', '房租', '修繕', '家具', 'IKEA', '特力屋'],
                  '育': ['書店', '文具', '教育', '課程', '補習', '學費', 'Apple', 'Google', 'Netflix', 'Spotify'],
                  '樂': ['電影', '遊戲', '娛樂', '旅遊', '飯店', '民宿', '門票'],
                  '醫療': ['醫院', '診所', '藥局', '健保', '醫療'],
                  '保險': ['保險', '壽險', '產險']
                };
                
                let suggestedCategory = '其他';
                for (const [category, keywords] of Object.entries(categoryKeywords)) {
                  if (keywords.some(keyword => merchantName.includes(keyword))) {
                    suggestedCategory = category;
                    break;
                  }
                }
                
                Logger.log(`  📂 建議分類: "${suggestedCategory}"`);
              }
            }
          }
          
          // 分析明細記錄 (D)
          Logger.log(`\n--- 明細記錄 (D) 分析 ---`);
          let dRecordCount = 0;
          
          for (let i = 1; i < lines.length && dRecordCount < 5; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const columns = line.split('|');
            
            if (columns.length > 0 && columns[0].trim() === 'D') {
              dRecordCount++;
              Logger.log(`\n明細記錄 ${dRecordCount}:`);
              Logger.log(`  完整行: ${line}`);
              Logger.log(`  欄位數: ${columns.length}`);
              
              columns.forEach((col, index) => {
                Logger.log(`    欄位 ${index}: "${col.trim()}"`);
              });
            }
          }
          
          // 統計摘要
          Logger.log(`\n--- 統計摘要 ---`);
          let totalM = 0, totalD = 0;
          
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const columns = line.split('|');
            if (columns.length > 0) {
              if (columns[0].trim() === 'M') totalM++;
              if (columns[0].trim() === 'D') totalD++;
            }
          }
          
          Logger.log(`📊 主記錄 (M) 總數: ${totalM}`);
          Logger.log(`📝 明細記錄 (D) 總數: ${totalD}`);
          Logger.log(`📈 平均每筆主記錄的明細數: ${totalD > 0 ? (totalD / totalM).toFixed(2) : 0}`);
          
        } catch (csvError) {
          Logger.log(`❌ CSV 分析失敗: ${csvError.toString()}`);
        }
      }
    });
    
  } catch (error) {
    Logger.log(`❌ 分析失敗: ${error.toString()}`);
  }
}

/**
 * 🔍 分析現有記錄以避免重複
 */
function analyzeExistingRecords() {
  Logger.log('🔍 分析現有記錄以避免重複...');
  
  try {
    const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
    const ss = SpreadsheetApp.openById(mainLedgerId);
    const sheet = ss.getSheetByName('All Records');
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    Logger.log(`📊 現有記錄總數: ${data.length - 1}`);
    Logger.log(`📋 欄位: ${headers.join(', ')}`);
    
    // 分析最近的記錄
    Logger.log(`\n--- 最近 10 筆記錄分析 ---`);
    
    for (let i = Math.max(1, data.length - 10); i < data.length; i++) {
      const row = data[i];
      Logger.log(`\n記錄 ${i}:`);
      Logger.log(`  日期: ${row[0]}`);
      Logger.log(`  金額: ${row[1]} ${row[2]}`);
      Logger.log(`  分類: ${row[5]}`);
      Logger.log(`  項目: ${row[6]}`);
      Logger.log(`  發票號碼: ${row[9]}`);
      Logger.log(`  來源: ${row[16]}`);
      
      // 分析 META_DATA
      if (row[20]) {
        try {
          const metaData = JSON.parse(row[20]);
          Logger.log(`  處理器: ${metaData.processor || 'N/A'}`);
          Logger.log(`  郵件ID: ${metaData.messageId || 'N/A'}`);
          Logger.log(`  商家: ${metaData.merchant || 'N/A'}`);
        } catch (parseError) {
          Logger.log(`  META_DATA 解析失敗`);
        }
      }
    }
    
    // 分析重複的可能性
    Logger.log(`\n--- 重複記錄分析 ---`);
    
    const duplicateChecks = new Map();
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const date = row[0];
      const amount = row[1];
      const merchant = row[6]; // ITEM 欄位
      
      const key = `${date}_${amount}_${merchant}`;
      
      if (duplicateChecks.has(key)) {
        duplicateChecks.get(key).push(i);
      } else {
        duplicateChecks.set(key, [i]);
      }
    }
    
    // 顯示可能的重複記錄
    let duplicateCount = 0;
    duplicateChecks.forEach((rows, key) => {
      if (rows.length > 1) {
        duplicateCount++;
        Logger.log(`🚨 可能重複 ${duplicateCount}: ${key}`);
        Logger.log(`  出現在行: ${rows.join(', ')}`);
      }
    });
    
    if (duplicateCount === 0) {
      Logger.log('✅ 未發現明顯的重複記錄');
    }
    
  } catch (error) {
    Logger.log(`❌ 分析現有記錄失敗: ${error.toString()}`);
  }
}

/**
 * 🧪 測試完整分析
 */
function runCompleteAnalysis() {
  Logger.log('🧪 執行完整分析...');
  
  try {
    Logger.log('\n=== 1. CSV 結構分析 ===');
    analyzeGovernmentCSVStructure();
    
    Logger.log('\n=== 2. 現有記錄分析 ===');
    analyzeExistingRecords();
    
    Logger.log('\n✅ 完整分析完成');
    
  } catch (error) {
    Logger.log(`❌ 完整分析失敗: ${error.toString()}`);
  }
}