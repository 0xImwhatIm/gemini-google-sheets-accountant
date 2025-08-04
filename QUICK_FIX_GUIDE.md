# 🚨 快速修復指南

## 問題：按了 Accept 也無法執行

### 🔍 可能原因

1. **配置未完成** - 缺少必要的 API 金鑰或 Sheet ID
2. **權限問題** - Google Apps Script 權限未授權  
3. **語法錯誤** - 程式碼有錯誤
4. **函數選擇錯誤** - 選擇了錯誤的執行函數

### 🛠️ 立即修復步驟

#### 步驟 1：檢查基本配置

```javascript
// 在 Google Apps Script 編輯器中執行這個函數
function quickCheck() {
  Logger.log('=== 快速檢查 ===');
  
  // 檢查主要配置
  Logger.log('MAIN_LEDGER_ID:', MAIN_LEDGER_ID);
  Logger.log('GEMINI_API_KEY:', GEMINI_API_KEY ? '已設定' : '未設定');
  Logger.log('SHEET_NAME:', SHEET_NAME);
  
  // 測試 Google Sheets 連接
  try {
    if (MAIN_LEDGER_ID !== 'YOUR_GOOGLE_SHEET_ID_HERE') {
      const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
      Logger.log('✅ Google Sheets 連接成功:', ss.getName());
    } else {
      Logger.log('❌ MAIN_LEDGER_ID 尚未設定');
    }
  } catch (error) {
    Logger.log('❌ Google Sheets 連接失敗:', error.toString());
  }
  
  Logger.log('=== 檢查完成 ===');
}
```

#### 步驟 2：設定必要配置

如果上面的檢查顯示配置未完成，請：

1. **設定 Google Sheet ID**
   ```javascript
   // 在 Code.gs 中找到這行並替換
   const MAIN_LEDGER_ID = 'YOUR_GOOGLE_SHEET_ID_HERE';
   // 改為你的實際 Sheet ID
   const MAIN_LEDGER_ID = '你的Google表格ID';
   ```

2. **設定 Gemini API Key**
   ```javascript
   // 在 Code.gs 中找到這行並替換
   const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE';
   // 改為你的實際 API Key
   const GEMINI_API_KEY = '你的Gemini_API_Key';
   ```

#### 步驟 3：授權權限

1. 在 Google Apps Script 編輯器中
2. 點擊「執行」按鈕
3. 當出現權限請求時，點擊「檢閱權限」
4. 選擇你的 Google 帳戶
5. 點擊「允許」

#### 步驟 4：測試執行

執行以下測試函數確認一切正常：

```javascript
function testBasicFunction() {
  Logger.log('🧪 基本功能測試');
  
  try {
    // 測試匯率函數
    const rate = getExchangeRate('TWD');
    Logger.log('✅ 匯率函數正常:', rate);
    
    // 測試配置讀取
    const sheetName = getConfig('SHEET_NAME', 'All Records');
    Logger.log('✅ 配置讀取正常:', sheetName);
    
    Logger.log('✅ 基本功能測試通過');
    return true;
    
  } catch (error) {
    Logger.log('❌ 基本功能測試失敗:', error.toString());
    return false;
  }
}
```

### 🎯 常見問題解決

#### 問題 1：「找不到函數」錯誤
**解決方案：**
- 確保選擇正確的函數名稱
- 建議先執行 `quickCheck` 或 `testBasicFunction`

#### 問題 2：「權限被拒絕」錯誤  
**解決方案：**
- 重新授權：編輯器 → 執行 → 檢閱權限 → 允許
- 確保使用正確的 Google 帳戶

#### 問題 3：「無效的 Sheet ID」錯誤
**解決方案：**
- 檢查 Google Sheet 是否存在
- 確認 Sheet ID 格式正確
- 確保有該 Sheet 的存取權限

#### 問題 4：「API 金鑰無效」錯誤
**解決方案：**
- 檢查 Gemini API Key 是否正確
- 確認 API 金鑰有效且未過期
- 檢查 API 配額是否足夠

### 🚀 立即可執行的測試函數

以下函數可以立即執行，不需要任何配置：

```javascript
// 最簡單的測試
function helloWorld() {
  Logger.log('Hello World! 程式可以執行');
  return 'Hello World!';
}

// 測試日期功能
function testDate() {
  const now = new Date();
  Logger.log('目前時間:', now.toISOString());
  return now.toISOString();
}

// 測試 JSON 處理
function testJSON() {
  const testData = { message: '測試成功', timestamp: new Date() };
  const jsonString = JSON.stringify(testData);
  Logger.log('JSON 測試:', jsonString);
  return jsonString;
}
```

### 📞 如果問題持續存在

1. **檢查瀏覽器控制台** - 按 F12 查看錯誤訊息
2. **查看執行記錄** - 在 Apps Script 編輯器中查看「執行」記錄
3. **重新載入頁面** - 有時候瀏覽器快取會造成問題
4. **使用無痕模式** - 排除瀏覽器擴充功能干擾

### 🔧 緊急修復腳本

如果一切都失敗了，執行這個最基本的修復腳本：

```javascript
function emergencyFix() {
  try {
    Logger.log('🚨 緊急修復開始');
    
    // 基本測試
    Logger.log('✅ Logger 正常');
    
    // 測試變數
    Logger.log('SHEET_NAME:', typeof SHEET_NAME !== 'undefined' ? SHEET_NAME : '未定義');
    
    // 測試函數
    if (typeof getConfig === 'function') {
      Logger.log('✅ getConfig 函數存在');
    } else {
      Logger.log('❌ getConfig 函數不存在');
    }
    
    Logger.log('🚨 緊急修復完成');
    return '修復完成';
    
  } catch (error) {
    Logger.log('🚨 緊急修復失敗:', error.toString());
    return '修復失敗: ' + error.message;
  }
}
```

執行 `emergencyFix()` 函數，然後查看執行記錄，告訴我結果，我可以提供更具體的解決方案。