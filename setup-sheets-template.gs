/**
 * 智慧記帳 GEM - Google Sheets 模板設定腳本
 * 
 * 使用方法：
 * 1. 建立新的 Google Sheets
 * 2. 開啟 Apps Script 編輯器
 * 3. 貼上此腳本並執行 setupSheetsTemplate() 函式
 * 4. 執行完成後即可開始使用
 */

function setupSheetsTemplate() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 刪除預設的 Sheet1
  const defaultSheet = ss.getSheetByName('工作表1') || ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }
  
  // 建立主要工作表
  setupAllRecordsSheet(ss);
  setupEmailRulesSheet(ss);
  setupSettingsSheet(ss);
  
  // 建立 IOU 功能工作表
  setupEventsSheet(ss);
  setupParticipantsSheet(ss);
  setupDebtsSheet(ss);
  
  // 設定預設資料
  setupDefaultData(ss);
  
  Logger.log('✅ Google Sheets 模板設定完成！');
  
  // 顯示完成訊息
  SpreadsheetApp.getUi().alert(
    '設定完成',
    '智慧記帳 GEM 的 Google Sheets 模板已成功建立！\n\n' +
    '接下來請：\n' +
    '1. 記錄此 Sheets 的 ID\n' +
    '2. 繼續進行 Apps Script 部署\n' +
    '3. 參考 DEPLOYMENT_GUIDE.md 完成其他設定',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function setupAllRecordsSheet(ss) {
  const sheet = ss.insertSheet('All Records');
  
  // 設定標題列
  const headers = [
    'Date', 'Amount', 'Currency', 'Category', 'Description', 
    'Source', 'Status', 'RawText', 'FileUrl', 'Translation', 'MetaData'
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // 格式化標題列
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('white');
  headerRange.setFontWeight('bold');
  
  // 設定欄位格式
  sheet.getRange('A:A').setNumberFormat('yyyy-mm-dd'); // Date
  sheet.getRange('B:B').setNumberFormat('#,##0.00'); // Amount
  sheet.getRange('C:C').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(['TWD', 'USD', 'JPY', 'EUR', 'CNY'])
    .build()); // Currency
  
  // 自動調整欄寬
  sheet.autoResizeColumns(1, headers.length);
}

function setupEmailRulesSheet(ss) {
  const sheet = ss.insertSheet('EmailRules');
  
  const headers = [
    'RuleName', 'SenderPattern', 'SubjectPattern', 
    'BodyPattern', 'Category', 'IsActive', 'Priority'
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // 格式化標題列
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#34a853');
  headerRange.setFontColor('white');
  headerRange.setFontWeight('bold');
  
  // 設定範例規則
  const sampleRules = [
    ['電子發票', 'noreply@einvoice.nat.gov.tw', '電子發票', '', '購物', true, 1],
    ['信用卡帳單', 'bank@', '信用卡', '消費', '信用卡', true, 2],
    ['網購訂單', 'order@', '訂單確認', '', '網購', true, 3]
  ];
  
  if (sampleRules.length > 0) {
    sheet.getRange(2, 1, sampleRules.length, headers.length).setValues(sampleRules);
  }
  
  sheet.autoResizeColumns(1, headers.length);
}

function setupSettingsSheet(ss) {
  const sheet = ss.insertSheet('Settings');
  
  const headers = ['SettingKey', 'SettingValue', 'Description'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // 格式化標題列
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#ff9800');
  headerRange.setFontColor('white');
  headerRange.setFontWeight('bold');
  
  // 設定預設設定值
  const defaultSettings = [
    ['DEFAULT_CURRENCY', 'TWD', '預設幣別'],
    ['NOTIFICATION_EMAIL', '', '通知信箱'],
    ['WEBHOOK_URL', '', 'Webhook 通知 URL'],
    ['AUTO_MERGE_ENABLED', 'true', '啟用自動合併'],
    ['DUPLICATE_THRESHOLD', '0.8', '重複判定閾值']
  ];
  
  sheet.getRange(2, 1, defaultSettings.length, headers.length).setValues(defaultSettings);
  sheet.autoResizeColumns(1, headers.length);
}

function setupEventsSheet(ss) {
  const sheet = ss.insertSheet('Events');
  
  const headers = ['EventID', 'EventName', 'TotalAmount', 'EventDate', 'Notes'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // 格式化標題列
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#9c27b0');
  headerRange.setFontColor('white');
  headerRange.setFontWeight('bold');
  
  // 設定欄位格式
  sheet.getRange('C:C').setNumberFormat('#,##0.00'); // TotalAmount
  sheet.getRange('D:D').setNumberFormat('yyyy-mm-dd hh:mm:ss'); // EventDate
  
  sheet.autoResizeColumns(1, headers.length);
}

function setupParticipantsSheet(ss) {
  const sheet = ss.insertSheet('Participants');
  
  const headers = ['ParticipantID', 'EventID', 'PersonName', 'PaidAmount'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // 格式化標題列
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#795548');
  headerRange.setFontColor('white');
  headerRange.setFontWeight('bold');
  
  // 設定欄位格式
  sheet.getRange('D:D').setNumberFormat('#,##0.00'); // PaidAmount
  
  sheet.autoResizeColumns(1, headers.length);
}

function setupDebtsSheet(ss) {
  const sheet = ss.insertSheet('Debts');
  
  const headers = [
    'DebtID', 'EventID', 'Payer', 'Debtor', 
    'Amount', 'ItemDetail', 'Status', 'SettlementDate'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // 格式化標題列
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#f44336');
  headerRange.setFontColor('white');
  headerRange.setFontWeight('bold');
  
  // 設定欄位格式
  sheet.getRange('E:E').setNumberFormat('#,##0.00'); // Amount
  sheet.getRange('G:G').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(['Unsettled', 'Settled'])
    .build()); // Status
  sheet.getRange('H:H').setNumberFormat('yyyy-mm-dd hh:mm:ss'); // SettlementDate
  
  sheet.autoResizeColumns(1, headers.length);
}

function setupDefaultData(ss) {
  // 在 Settings 工作表中設定使用者需要填入的項目
  const settingsSheet = ss.getSheetByName('Settings');
  if (settingsSheet) {
    // 高亮顯示需要使用者填入的設定
    const emailRow = findRowByValue(settingsSheet, 'NOTIFICATION_EMAIL');
    const webhookRow = findRowByValue(settingsSheet, 'WEBHOOK_URL');
    
    if (emailRow > 0) {
      settingsSheet.getRange(emailRow, 2).setBackground('#fff2cc');
      settingsSheet.getRange(emailRow, 2).setNote('請填入您的通知信箱');
    }
    
    if (webhookRow > 0) {
      settingsSheet.getRange(webhookRow, 2).setBackground('#fff2cc');
      settingsSheet.getRange(webhookRow, 2).setNote('可選：填入 Slack/Discord Webhook URL');
    }
  }
}

function findRowByValue(sheet, searchValue) {
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === searchValue) {
      return i + 1; // 回傳 1-based 的列號
    }
  }
  return -1;
}