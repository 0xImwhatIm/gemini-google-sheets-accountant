# 圖片處理強制修復部署指南

## 📋 修復概述

**問題**：iOS 捷徑調用拍照記帳功能時，仍然使用有問題的 `callGeminiForVision` 函數，導致 404 錯誤。

**解決方案**：將所有實際調用點改為使用已修復的 `callGeminiForVisionForced` 函數。

## 🔧 修復內容

### 主要修復點

1. **iOS 捷徑入口函數** (`doPost_Image`)
   - 位置：第 1118 行
   - 修改：`callGeminiForVision` → `callGeminiForVisionForced`

2. **測試函數修復**
   - `testImageProcessingBasic()` 中的測試調用
   - `testV47_4_2_Complete()` 中的測試調用
   - 所有測試函數統一使用修復版本

### 函數對比

| 函數名稱 | 狀態 | API 端點 | 使用場景 |
|---------|------|----------|----------|
| `callGeminiForVision` | ❌ 有問題 | gemini-1.5-pro-vision-latest | 被其他文件覆蓋 |
| `callGeminiForVisionForced` | ✅ 正常 | gemini-1.5-flash-latest | 實際使用 |

## 🚀 部署步驟

### 步驟 1：確認修復
```javascript
// 在 GAS 編輯器中運行測試
testForcedImageProcessing();
```

### 步驟 2：部署到生產環境
1. 在 Google Apps Script 編輯器中保存 Code.gs
2. 點擊「部署」→「新增部署」
3. 選擇類型：「網路應用程式」
4. 執行身分：「我」
5. 存取權限：「任何人」
6. 點擊「部署」

### 步驟 3：測試 iOS 捷徑
1. 使用 iOS 捷徑拍照記帳功能
2. 確認不再出現 404 錯誤
3. 驗證記帳資料正確寫入 Google Sheets

## ✅ 驗證清單

- [ ] `callGeminiForVisionForced` 函數存在且正常
- [ ] `doPost_Image` 函數已修改為使用強制版本
- [ ] 所有測試函數已更新
- [ ] GAS 專案已重新部署
- [ ] iOS 捷徑測試通過

## 🔍 故障排除

### 如果仍然出現 404 錯誤
1. 檢查 GAS 編輯器中是否有其他文件定義了 `callGeminiForVision`
2. 確認已正確保存並部署 Code.gs
3. 清除瀏覽器快取並重新測試

### 如果函數未找到錯誤
1. 確認 `callGeminiForVisionForced` 函數存在於 Code.gs 中
2. 檢查函數名稱拼寫是否正確
3. 重新保存並部署專案

## 📝 技術說明

這個修復採用「強制覆蓋」策略，避免了函數名稱衝突問題：

1. **保留原函數**：`callGeminiForVision` 保持不變，避免影響其他可能的調用
2. **創建強制版本**：`callGeminiForVisionForced` 使用正確的 API 端點
3. **修改調用點**：將實際使用的地方改為調用強制版本

這樣既解決了問題，又保持了系統的穩定性。

## 📅 修復日期
2025-08-07

## 👤 修復人員
Kiro AI Assistant