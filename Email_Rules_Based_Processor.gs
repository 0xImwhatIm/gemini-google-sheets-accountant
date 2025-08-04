// =================================================================================================
// Email Rules 智能處理器 - 2025-08-04
// 解決分類、日期、重複記錄三大問題的完整方案
// =================================================================================================

/**
 * 🎯 智能分類系統
 */
class SmartCategoryClassifier {
  constructor() {
    this.categoryRules = {
      '食': {
        keywords: ['超商', '全聯', '全家', '統一', '便利商店', '餐', '食品', '麥當勞', '肯德基', '星巴克', '咖啡', '茶', '飲料', '7-ELEVEN', '好市多', 'Costco'],
        patterns: [
          /統一超商.*分公司/,
          /全家便利商店.*分公司/,
          /全聯實業.*分公司/,
          /.*食品.*公司/,
          /.*餐.*公司/,
          /.*咖啡.*公司/
        ]
      },
      '行': {
        keywords: ['中華電信', '台灣大哥大', '遠傳', '加油站', '中油', '台塑', '停車', '計程車', '捷運', '公車', '交通', '電信'],
        patterns: [
          /中華電信.*營運處/,
          /.*電信.*公司/,
          /.*加油站/,
          /.*停車場/,
          /.*交通.*公司/
        ]
      },
      '衣': {
        keywords: ['服飾', '衣服', '鞋', '包', '配件', 'UNIQLO', 'ZARA', 'H&M', '時尚', '服裝'],
        patterns: [
          /.*服飾.*公司/,
          /.*時尚.*公司/,
          /.*服裝.*公司/
        ]
      },
      '住': {
        keywords: ['水電', '瓦斯', '房租', '修繕', '家具', 'IKEA', '特力屋', '建材', '裝潢'],
        patterns: [
          /.*建材.*公司/,
          /.*家具.*公司/,
          /.*裝潢.*公司/
        ]
      },
      '育': {
        keywords: ['書店', '文具', '教育', '課程', '補習', '學費', 'Apple', 'Google', 'Netflix', 'Spotify', '雲端', '軟體', '數位'],
        patterns: [
          /Apple.*International/,
          /Google.*Pte.*Ltd/,
          /Netflix.*Ltd/,
          /.*教育.*公司/,
          /.*文具.*公司/
        ]
      },
      '樂': {
        keywords: ['電影', '遊戲', '娛樂', '旅遊', '飯店', '民宿', '門票', '休閒', '運動'],
        patterns: [
          /.*娛樂.*公司/,
          /.*遊戲.*公司/,
          /.*旅遊.*公司/
        ]
      },
      '醫療': {
        keywords: ['醫院', '診所', '藥局', '健保', '醫療', '藥品', '保健'],
        patterns: [
          /.*醫院/,
          /.*診所/,
          /.*藥局/
        ]
      },
      '保險': {
        keywords: ['保險', '壽險', '產險', '理賠'],
        patterns: [
          /.*保險.*公司/,
          /.*壽險.*公司/
        ]
      }
    };
  }
  
  /**
   * 🔍 智能分類判斷
   */
  classify(merchantName, itemDetails = '') {
    const searchText = `${merchantName} ${itemDetails}`.toLowerCase();
    
    // 優先使用模式匹配（更精確）
    for (const [category, rules] of Object.entries(this.categoryRules)) {
      for (const pattern of rules.patterns) {
        if (pattern.test(merchantName)) {
          Logger.log(`✅ 模式匹配分類: ${merchantName} → ${category}`);
          return category;
        }
      }
    }
    
    // 回退到關鍵字匹配
    for (const [category, rules] of Object.entries(this.categoryRules)) {
      for (const keyword of rules.keywords) {
        if (searchText.includes(keyword.toLowerCase())) {
          Logger.log(`✅ 關鍵字匹配分類: ${merchantName} → ${category} (關鍵字: ${keyword})`);
          return category;
        }
      }
    }
    
    Logger.log(`⚠️ 無法分類，使用預設: ${merchantName} → 其他`);
    return '其他';
  }
}

/**
 * 🗓️ 智能日期處理器
 */
class SmartDateProcessor {
  /**
   * 解析財政部 CSV 日期格式 (YYYYMMDD)
   */
  parseInvoiceDate(dateString) {
    if (!dateString || typeof dateString !== 'string') {
      return null;
    }
    
    // 移除空白字符
    const cleanDate = dateString.trim();
    
    // 匹配 YYYYMMDD 格式
    const match = cleanDate.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (match) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]);
      const day = parseInt(match[3]);
      
      // 驗證日期有效性
      if (year >= 2020 && year <= 2030 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const date = new Date(year, month - 1, day);
        Logger.log(`✅ 日期解析成功: ${dateString} → ${date.toISOString().split('T')[0]}`);
        return date;
      }
    }
    
    Logger.log(`❌ 日期解析失敗: ${dateString}`);
    return null;
  }
  
  /**
   * 格式化日期為字串
   */
  formatDate(date) {
    if (!date || !(date instanceof Date)) {
      return new Date().toISOString().split('T')[0];
    }
    
    return date.toISOString().split('T')[0];
  }
}

/**
 * 🚫 重複記錄檢測器
 */
class DuplicateDetector {
  constructor() {
    this.existingRecords = new Map();
    this.loadExistingRecords();
  }
  
  /**
   * 載入現有記錄
   */
  loadExistingRecords() {
    try {
      const mainLedgerId = PropertiesService.getScriptProperties().getProperty('MAIN_LEDGER_ID');
      if (!mainLedgerId) {
        Logger.log('❌ 未設定 MAIN_LEDGER_ID，跳過重複檢測');
        return;
      }
      
      const ss = SpreadsheetApp.openById(mainLedgerId);
      const sheet = ss.getSheetByName('All Records');
      
      const data = sheet.getDataRange().getValues();
      
      // 跳過標題行，載入所有記錄
      for (let i = 1; i < data.length; i++) {
        try {
          const row = data[i];
          
          // 安全地處理每個欄位
          const record = {
            date: row[0] || new Date(),
            amount: this.safeParseNumber(row[1]),
            currency: this.safeParseString(row[2]) || 'TWD',
            item: this.safeParseString(row[6]) || '',
            invoiceNumber: this.safeParseString(row[9]) || '',
            source: this.safeParseString(row[16]) || '',
            metaData: this.safeParseString(row[20]) || ''
          };
          
          // 生成多個檢測鍵
          const keys = this.generateDetectionKeys(record);
          keys.forEach(key => {
            if (!this.existingRecords.has(key)) {
              this.existingRecords.set(key, []);
            }
            this.existingRecords.get(key).push({ rowIndex: i, record });
          });
          
        } catch (rowError) {
          Logger.log(`⚠️ 處理第 ${i} 行記錄時出錯: ${rowError.toString()}`);
          continue;
        }
      }
      
      Logger.log(`✅ 載入了 ${data.length - 1} 筆現有記錄用於重複檢測`);
      
    } catch (error) {
      Logger.log(`❌ 載入現有記錄失敗: ${error.toString()}`);
      Logger.log('⚠️ 重複檢測將被停用');
    }
  }
  
  /**
   * 安全解析數字
   */
  safeParseNumber(value) {
    if (value === null || value === undefined || value === '') {
      return 0;
    }
    
    const num = parseFloat(String(value));
    return isNaN(num) ? 0 : num;
  }
  
  /**
   * 安全解析字串
   */
  safeParseString(value) {
    if (value === null || value === undefined) {
      return '';
    }
    
    return String(value).trim();
  }
  
  /**
   * 生成檢測鍵
   */
  generateDetectionKeys(record) {
    const keys = [];
    
    // 鍵 1: 發票號碼（最精確）
    if (record.invoiceNumber) {
      const invoiceNum = String(record.invoiceNumber).trim();
      if (invoiceNum && invoiceNum !== '' && invoiceNum !== 'null' && invoiceNum !== 'undefined') {
        keys.push(`invoice_${invoiceNum}`);
      }
    }
    
    // 鍵 2: 日期 + 金額 + 商家名稱
    let dateStr;
    try {
      if (record.date instanceof Date) {
        dateStr = record.date.toISOString().split('T')[0];
      } else if (record.date) {
        dateStr = String(record.date).split('T')[0];
      } else {
        dateStr = new Date().toISOString().split('T')[0];
      }
    } catch (e) {
      dateStr = new Date().toISOString().split('T')[0];
    }
    
    const merchantName = this.extractMerchantName(record.item);
    if (merchantName && record.amount) {
      keys.push(`date_amount_merchant_${dateStr}_${record.amount}_${merchantName}`);
    }
    
    // 鍵 3: 郵件ID（用於同一封郵件的記錄）
    if (record.metaData) {
      try {
        const meta = typeof record.metaData === 'string' ? 
          JSON.parse(record.metaData) : record.metaData;
        if (meta && meta.messageId) {
          keys.push(`message_${meta.messageId}`);
        }
      } catch (e) {
        // 忽略解析錯誤
      }
    }
    
    return keys;
  }
  
  /**
   * 從項目描述中提取商家名稱
   */
  extractMerchantName(item) {
    if (!item) return null;
    
    // 財政部發票格式: "財政部發票 - 商家名稱"
    const match = item.match(/財政部發票\s*-\s*(.+)/);
    if (match) {
      return match[1].trim();
    }
    
    return item.trim();
  }
  
  /**
   * 檢測是否重複
   */
  isDuplicate(newRecord) {
    const keys = this.generateDetectionKeys(newRecord);
    
    for (const key of keys) {
      if (this.existingRecords.has(key)) {
        const existingRecords = this.existingRecords.get(key);
        Logger.log(`🚨 發現可能重複記錄: ${key}`);
        Logger.log(`   新記錄: ${newRecord.amount} ${newRecord.currency} - ${newRecord.item}`);
        Logger.log(`   現有記錄數: ${existingRecords.length}`);
        
        // 如果是發票號碼匹配，直接認定為重複
        if (key.startsWith('invoice_')) {
          Logger.log(`❌ 發票號碼重複，跳過記錄`);
          return true;
        }
        
        // 其他情況進行更詳細的比較
        for (const existing of existingRecords) {
          if (this.isDetailedMatch(newRecord, existing.record)) {
            Logger.log(`❌ 詳細比較確認重複，跳過記錄`);
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  /**
   * 詳細匹配比較
   */
  isDetailedMatch(newRecord, existingRecord) {
    // 比較日期（允許1天誤差）
    const newDate = new Date(newRecord.date);
    const existingDate = new Date(existingRecord.date);
    const dayDiff = Math.abs(newDate - existingDate) / (1000 * 60 * 60 * 24);
    
    if (dayDiff > 1) return false;
    
    // 比較金額
    if (Math.abs(newRecord.amount - existingRecord.amount) > 0.01) return false;
    
    // 比較商家
    const newMerchant = this.extractMerchantName(newRecord.item);
    const existingMerchant = this.extractMerchantName(existingRecord.item);
    
    if (newMerchant && existingMerchant && newMerchant === existingMerchant) {
      return true;
    }
    
    return false;
  }
  
  /**
   * 添加新記錄到檢測器
   */
  addRecord(record) {
    const keys = this.generateDetectionKeys(record);
    keys.forEach(key => {
      if (!this.existingRecords.has(key)) {
        this.existingRecords.set(key, []);
      }
      this.existingRecords.get(key).push({ record });
    });
  }
}

/**
 * 🏛️ 優化版財政部發票處理器
 */
function processGovernmentInvoiceOptimized(message, result) {
  Logger.log('🏛️ 優化版財政部發票處理...');
  
  try {
    const classifier = new SmartCategoryClassifier();
    const dateProcessor = new SmartDateProcessor();
    const duplicateDetector = new DuplicateDetector();
    
    const attachments = message.getAttachments();
    const invoiceRecords = [];
    
    for (let attachment of attachments) {
      const fileName = attachment.getName();
      
      if (fileName.toLowerCase().includes('.csv')) {
        try {
          const csvContent = attachment.getDataAsString('UTF-8');
          const lines = csvContent.split('\n');
          
          Logger.log(`📊 處理 CSV: ${fileName}，共 ${lines.length} 行`);
          
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const columns = line.split('|');
            
            // 只處理主記錄 (M)
            if (columns.length >= 8 && columns[0].trim() === 'M') {
              const amountStr = columns[7] ? columns[7].trim() : '';
              const amount = parseFloat(amountStr);
              
              if (!isNaN(amount) && amount > 0) {
                const merchantName = columns[5] ? columns[5].trim() : '未知商家';
                const invoiceNumber = columns[6] ? columns[6].trim() : '';
                const invoiceDateStr = columns[3] ? columns[3].trim() : '';
                
                // 解析實際消費日期
                const actualDate = dateProcessor.parseInvoiceDate(invoiceDateStr);
                const recordDate = actualDate || new Date();
                
                // 智能分類
                const category = classifier.classify(merchantName);
                
                const invoiceRecord = {
                  date: dateProcessor.formatDate(recordDate),
                  amount: amount,
                  currency: 'TWD',
                  category: category,
                  description: `財政部發票 - ${merchantName}`,
                  merchant: merchantName,
                  invoiceNumber: invoiceNumber,
                  source: 'Email : 電子收據 (財政部)',
                  originalData: {
                    載具名稱: columns[1] || '',
                    載具號碼: columns[2] || '',
                    發票日期: columns[3] || '',
                    商店統編: columns[4] || '',
                    商店店名: columns[5] || '',
                    發票號碼: columns[6] || '',
                    總金額: columns[7] || '',
                    發票狀態: columns[8] || '',
                    實際消費日期: actualDate ? actualDate.toISOString() : null,
                    郵件處理日期: new Date().toISOString()
                  }
                };
                
                // 重複檢測
                if (!duplicateDetector.isDuplicate(invoiceRecord)) {
                  invoiceRecords.push(invoiceRecord);
                  duplicateDetector.addRecord(invoiceRecord);
                  Logger.log(`✅ 發票記錄 ${invoiceRecords.length}: ${amount} 元 - ${merchantName} (${category}) [${dateProcessor.formatDate(recordDate)}]`);
                } else {
                  Logger.log(`⏭️ 跳過重複記錄: ${amount} 元 - ${merchantName} [${invoiceNumber}]`);
                }
              }
            }
          }
          
        } catch (csvError) {
          Logger.log(`❌ CSV 附件處理失敗: ${csvError.toString()}`);
        }
      }
    }
    
    Logger.log(`✅ 財政部優化版處理完成: 找到 ${invoiceRecords.length} 張新發票`);
    return invoiceRecords;
    
  } catch (error) {
    Logger.log(`❌ 財政部優化版處理失敗: ${error.toString()}`);
    return [];
  }
}

/**
 * 🎯 優化版完整 Email Rules 處理器
 */
function processReceiptsByEmailRulesOptimized() {
  Logger.log('🎯 優化版完整的 Email Rules 處理器啟動...');
  
  try {
    const emailRules = [
      {
        query: 'from:no_reply@email.apple.com subject:發票通知 is:unread',
        type: 'Apple',
        processor: 'processAppleInvoiceFinal',
        needsAttachment: false
      },
      {
        query: 'from:payments-noreply@google.com subject:應付憑據 is:unread',
        type: 'Google',
        processor: 'processGooglePaymentFinal',
        needsAttachment: true,
        attachmentType: 'PDF'
      },
      {
        query: 'from:invoice@cht.com.tw subject:電子發票 is:unread',
        type: 'CHT',
        processor: 'processCHTInvoiceFinal',
        needsAttachment: true,
        attachmentType: 'HTML'
      },
      {
        query: 'from:einvoice@einvoice.nat.gov.tw subject:彙整 is:unread',
        type: 'Government',
        processor: 'processGovernmentInvoiceOptimized',
        needsAttachment: true,
        attachmentType: 'CSV'
      }
    ];
    
    let totalProcessed = 0;
    let totalSkipped = 0;
    let processedMessageIds = new Set();
    
    emailRules.forEach((rule, index) => {
      Logger.log(`\n🔍 處理規則 ${index + 1}/${emailRules.length}: ${rule.type}`);
      Logger.log(`📧 搜尋條件: ${rule.query}`);
      
      try {
        const threads = GmailApp.search(rule.query, 0, 3);
        Logger.log(`找到 ${threads.length} 個郵件串`);
        
        threads.forEach(thread => {
          const messages = thread.getMessages();
          
          messages.forEach(message => {
            const messageId = message.getId();
            
            if (processedMessageIds.has(messageId)) {
              Logger.log(`⏭️ 跳過已處理的郵件: ${messageId}`);
              return;
            }
            
            if (message.isUnread()) {
              Logger.log(`📨 處理郵件: ${message.getSubject()}`);
              
              try {
                const results = processEmailOptimized(message, rule);
                
                if (results) {
                  let recordsToSave = [];
                  
                  if (Array.isArray(results)) {
                    recordsToSave = results;
                  } else if (results.amount > 0) {
                    recordsToSave = [results];
                  }
                  
                  if (recordsToSave.length > 0) {
                    saveEmailRecordsFinal(recordsToSave, message);
                    totalProcessed += recordsToSave.length;
                    Logger.log(`✅ 處理了 ${recordsToSave.length} 筆記錄`);
                  } else {
                    totalSkipped++;
                    Logger.log('⏭️ 所有記錄都是重複，已跳過');
                  }
                  
                  Utilities.sleep(500);
                  message.markRead();
                  Logger.log('✅ 郵件已標記為已讀');
                  
                  processedMessageIds.add(messageId);
                  Logger.log('✅ 郵件處理完成');
                } else {
                  Logger.log('⚠️ 郵件解析失敗，跳過');
                }
              } catch (emailError) {
                Logger.log(`❌ 處理郵件失敗: ${emailError.toString()}`);
              }
            }
          });
        });
        
      } catch (ruleError) {
        Logger.log(`❌ 處理規則失敗: ${ruleError.toString()}`);
      }
    });
    
    Logger.log(`\n✅ 優化版處理完成`);
    Logger.log(`📊 新增記錄: ${totalProcessed} 筆`);
    Logger.log(`⏭️ 跳過重複: ${totalSkipped} 筆`);
    Logger.log(`🎯 重複檢測和智能分類已啟用`);
    
  } catch (error) {
    Logger.log(`❌ 優化版處理失敗: ${error.toString()}`);
  }
}

/**
 * 📧 優化版郵件處理邏輯
 */
function processEmailOptimized(message, rule) {
  try {
    Logger.log(`🔍 開始處理 ${rule.type} 郵件`);
    
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
    
    // 根據不同類型使用對應的處理邏輯
    switch (rule.type) {
      case 'Apple':
        result = processAppleInvoiceFinal(message, result);
        break;
      case 'Google':
        result = processGooglePaymentFinal(message, result);
        break;
      case 'CHT':
        result = processCHTInvoiceFinal(message, result);
        break;
      case 'Government':
        return processGovernmentInvoiceOptimized(message, result); // 返回陣列
      default:
        Logger.log(`⚠️ 未知的郵件類型: ${rule.type}`);
        break;
    }
    
    return validateResult(result);
    
  } catch (error) {
    Logger.log(`❌ 郵件處理失敗: ${error.toString()}`);
    return null;
  }
}

/**
 * 🧪 測試優化版處理器
 */
function testOptimizedProcessor() {
  Logger.log('🧪 測試優化版處理器...');
  
  try {
    Logger.log('\n=== 測試財政部發票優化處理 ===');
    
    const threads = GmailApp.search('from:einvoice@einvoice.nat.gov.tw subject:彙整', 0, 1);
    if (threads.length > 0) {
      const message = threads[0].getMessages()[0];
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
      
      const results = processGovernmentInvoiceOptimized(message, result);
      Logger.log(`\n✅ 優化版結果: ${results.length} 張發票`);
      
      // 顯示前5筆結果
      results.slice(0, 5).forEach((record, index) => {
        Logger.log(`發票 ${index + 1}: ${record.amount} ${record.currency} - ${record.merchant} (${record.category}) [${record.date}]`);
      });
      
      if (results.length > 5) {
        Logger.log(`... 還有 ${results.length - 5} 張發票`);
      }
    }
    
    Logger.log('\n✅ 優化版測試完成');
    
  } catch (error) {
    Logger.log(`❌ 測試失敗: ${error.toString()}`);
  }
}