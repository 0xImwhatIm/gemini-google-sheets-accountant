# 測試指南

## 測試策略

### 單元測試
- AI 解析功能測試
- 數據處理邏輯測試
- 工具函數測試

### 整合測試
- API 端點測試
- Google Sheets 整合測試
- 外部服務整合測試

### 端到端測試
- 完整工作流程測試
- 錯誤處理測試
- 效能測試

## 測試用例

### 圖片處理測試
```javascript
function testImageProcessing() {
  // 測試各種收據格式
  // 測試不同語言收據
  // 測試模糊或損壞圖片
}
```

### IOU 功能測試
```javascript
function testIouProcessing() {
  // 測試單人代墊
  // 測試群組拆分
  // 測試結算功能
}
```

### 錯誤處理測試
```javascript
function testErrorHandling() {
  // 測試 API 失敗情況
  // 測試網路中斷
  // 測試資料格式錯誤
}
```

## 測試數據管理

### 測試環境設定
- 獨立的測試 Google Sheets
- 測試用 API 金鑰
- 模擬數據生成器

### 測試數據清理
- 自動清理測試數據
- 測試環境重置腳本