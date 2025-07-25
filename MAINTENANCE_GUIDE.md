# 🔧 智慧記帳 GEM 維護指南

## 日常維護任務

### 每週檢查
- [ ] 檢查 Google Sheets 資料完整性
- [ ] 查看 Apps Script 執行記錄
- [ ] 確認 API 配額使用情況
- [ ] 檢查錯誤通知

### 每月檢查
- [ ] 備份 Google Sheets 資料
- [ ] 檢查 API 金鑰有效性
- [ ] 清理過期的執行記錄
- [ ] 更新郵件處理規則

### 每季檢查
- [ ] 檢查系統效能
- [ ] 更新 API 金鑰（建議）
- [ ] 檢查安全性設定
- [ ] 評估功能使用情況

## 常見維護操作

### 備份資料
```javascript
function backupData() {
  const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
  const backupName = `智慧記帳備份_${new Date().toISOString().split('T')[0]}`;
  const backup = ss.copy(backupName);
  console.log('備份完成：' + backup.getUrl());
}
```

### 清理舊資料
```javascript
function cleanupOldData(daysToKeep = 365) {
  const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
  const sheet = ss.getSheetByName('All Records');
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  // 實作清理邏輯
}
```

### 檢查系統健康狀況
```javascript
function dailyHealthCheck() {
  // 使用 quick-start.gs 中的 quickHealthCheck() 函式
  const results = quickHealthCheck();
  
  // 如果有問題，發送通知
  if (Object.values(results).includes(false)) {
    sendNotification('系統健康檢查', '發現系統問題，請檢查', 'WARNING');
  }
}
```

## 效能優化

### 監控指標
- API 回應時間
- Google Sheets 寫入速度
- 記憶體使用量
- 錯誤發生率

### 優化建議
1. **批次處理**：合併多個 Google Sheets 操作
2. **快取機制**：快取常用的 AI 處理結果
3. **資料分片**：大量資料時考慮分表存儲
4. **非同步處理**：使用觸發器處理耗時操作

## 故障排除

### 常見問題診斷

#### API 調用失敗
1. 檢查 API 金鑰是否有效
2. 確認 API 配額是否足夠
3. 檢查網路連線狀況
4. 查看 Apps Script 執行記錄

#### Google Sheets 寫入失敗
1. 確認 Sheets ID 正確
2. 檢查工作表名稱是否存在
3. 驗證資料格式是否正確
4. 確認權限設定

#### 觸發器不執行
1. 檢查觸發器設定
2. 查看執行記錄中的錯誤
3. 確認函式名稱正確
4. 檢查權限授權

### 錯誤記錄分析
```javascript
function analyzeErrors() {
  // 分析 Apps Script 執行記錄
  // 統計錯誤類型和頻率
  // 生成錯誤報告
}
```

## 安全性維護

### 定期安全檢查
- [ ] 檢查 API 金鑰使用記錄
- [ ] 確認 Web App 存取記錄
- [ ] 檢查異常的 API 調用模式
- [ ] 驗證資料存取權限

### 金鑰輪換
```javascript
function rotateApiKey() {
  // 1. 在 GCP Console 建立新的 API 金鑰
  // 2. 更新 Apps Script 中的金鑰
  // 3. 測試新金鑰功能
  // 4. 刪除舊的 API 金鑰
}
```

## 更新與升級

### 版本更新流程
1. **備份現有資料**
2. **測試新版本功能**
3. **更新程式碼**
4. **驗證功能正常**
5. **更新文檔**

### 相容性檢查
- Google Apps Script 平台更新
- Google Sheets API 變更
- Gemini API 版本更新
- 第三方服務整合

## 監控與告警

### 設定監控告警
```javascript
function setupMonitoring() {
  // 設定定期健康檢查
  ScriptApp.newTrigger('dailyHealthCheck')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();
    
  // 設定錯誤告警
  ScriptApp.newTrigger('errorAlert')
    .timeBased()
    .everyHours(6)
    .create();
}
```

### 告警通知
- 電子郵件通知
- Webhook 通知（Slack/Discord）
- 簡訊通知（可選）

## 資料治理

### 資料品質檢查
```javascript
function dataQualityCheck() {
  // 檢查重複記錄
  // 驗證資料完整性
  // 識別異常值
  // 生成品質報告
}
```

### 資料清理
- 移除重複記錄
- 修正格式錯誤
- 補充缺失資料
- 標準化資料格式

## 使用者支援

### 常見使用者問題
1. **記錄未正確識別**
   - 檢查圖片品質
   - 調整 AI prompt
   - 提供使用建議

2. **IOU 功能問題**
   - 確認人名識別
   - 檢查金額計算
   - 驗證狀態更新

3. **同步問題**
   - 檢查網路連線
   - 確認權限設定
   - 重新授權應用

### 使用者回饋處理
- 收集使用者回饋
- 分析改進建議
- 優先級排序
- 實作改進措施

## 文檔維護

### 定期更新
- [ ] 使用手冊更新
- [ ] API 文檔更新
- [ ] 故障排除指南
- [ ] 最佳實踐分享

### 版本記錄
- 功能變更記錄
- 錯誤修復記錄
- 效能改進記錄
- 安全性更新記錄