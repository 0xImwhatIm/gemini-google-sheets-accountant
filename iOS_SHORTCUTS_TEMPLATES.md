# iOS 捷徑範本文件

## 📱 捷徑範本下載

以下是三個預配置的 iOS 捷徑範本，您可以直接匯入使用：

---

## 🎤 語音記帳捷徑範本

### 捷徑配置 JSON
```json
{
  "name": "語音記帳",
  "icon": "mic.fill",
  "color": "blue",
  "actions": [
    {
      "type": "DictateText",
      "parameters": {
        "prompt": "請說出您的交易內容，例如：我今天買了一杯咖啡花了150元",
        "language": "zh-TW"
      }
    },
    {
      "type": "URLEncode",
      "parameters": {
        "input": "DictatedText"
      }
    },
    {
      "type": "Text",
      "parameters": {
        "text": "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?endpoint=voice&text=EncodedURL"
      }
    },
    {
      "type": "GetContentsOfURL",
      "parameters": {
        "url": "Text",
        "method": "GET"
      }
    },
    {
      "type": "ShowNotification",
      "parameters": {
        "title": "記帳完成",
        "body": "ContentsOfURL"
      }
    }
  ]
}
```

### 手動設定步驟
1. 開啟捷徑 App → 點擊「+」
2. 設定名稱：「語音記帳」
3. 按順序添加以下動作：
   - **聽寫文字**：提示「請說出交易內容」，語言「繁體中文」
   - **編碼 URL**：輸入「聽寫的文字」
   - **文字**：`https://script.google.com/macros/s/YOUR_ID/exec?endpoint=voice&text=編碼的URL`
   - **取得 URL 內容**：URL「文字」，方法「GET」
   - **顯示通知**：標題「記帳完成」，內容「URL 的內容」

---

## 📷 拍照記帳捷徑範本

### 捷徑配置 JSON
```json
{
  "name": "拍照記帳",
  "icon": "camera.fill",
  "color": "green",
  "actions": [
    {
      "type": "TakePhoto",
      "parameters": {
        "showCameraPreview": true
      }
    },
    {
      "type": "Base64Encode",
      "parameters": {
        "input": "Photo"
      }
    },
    {
      "type": "GetDictionaryValue",
      "parameters": {
        "dictionary": {
          "image": "Base64EncodedData",
          "filename": "receipt.jpg"
        }
      }
    },
    {
      "type": "GetContentsOfURL",
      "parameters": {
        "url": "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?endpoint=image",
        "method": "POST",
        "requestBody": "Dictionary",
        "headers": {
          "Content-Type": "application/json"
        }
      }
    },
    {
      "type": "GetDictionaryValue",
      "parameters": {
        "dictionary": "ContentsOfURL",
        "key": "message"
      }
    },
    {
      "type": "ShowNotification",
      "parameters": {
        "title": "拍照記帳完成",
        "body": "DictionaryValue"
      }
    }
  ]
}
```

### 手動設定步驟
1. 開啟捷徑 App → 點擊「+」
2. 設定名稱：「拍照記帳」
3. 按順序添加以下動作：
   - **拍照**：顯示相機預覽「開啟」
   - **編碼為 Base64**：輸入「照片」
   - **取得字典的值**：字典 `{"image": "Base64編碼", "filename": "receipt.jpg"}`
   - **取得 URL 內容**：
     - URL：`https://script.google.com/macros/s/YOUR_ID/exec?endpoint=image`
     - 方法：POST
     - 請求內文：字典
     - 標頭：`Content-Type: application/json`
   - **取得字典的值**：字典「URL 的內容」，鍵「message」
   - **顯示通知**：標題「拍照記帳完成」，內容「字典值」

---

## 📷🎤 拍照+語音記帳捷徑範本

### 捷徑配置 JSON
```json
{
  "name": "拍照+語音記帳",
  "icon": "camera.badge.ellipsis",
  "color": "orange",
  "actions": [
    {
      "type": "TakePhoto",
      "parameters": {
        "showCameraPreview": true
      }
    },
    {
      "type": "DictateText",
      "parameters": {
        "prompt": "請說出補充說明，例如：這是公司聚餐費用",
        "language": "zh-TW"
      }
    },
    {
      "type": "Base64Encode",
      "parameters": {
        "input": "Photo"
      }
    },
    {
      "type": "GetDictionaryValue",
      "parameters": {
        "dictionary": {
          "image": "Base64EncodedData",
          "filename": "receipt.jpg",
          "voiceNote": "DictatedText"
        }
      }
    },
    {
      "type": "GetContentsOfURL",
      "parameters": {
        "url": "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?endpoint=image",
        "method": "POST",
        "requestBody": "Dictionary",
        "headers": {
          "Content-Type": "application/json"
        }
      }
    },
    {
      "type": "GetDictionaryValue",
      "parameters": {
        "dictionary": "ContentsOfURL",
        "key": "message"
      }
    },
    {
      "type": "ShowNotification",
      "parameters": {
        "title": "組合記帳完成",
        "body": "DictionaryValue"
      }
    }
  ]
}
```

### 手動設定步驟
1. 開啟捷徑 App → 點擊「+」
2. 設定名稱：「拍照+語音記帳」
3. 按順序添加以下動作：
   - **拍照**：顯示相機預覽「開啟」
   - **聽寫文字**：提示「請說出補充說明」，語言「繁體中文」
   - **編碼為 Base64**：輸入「照片」
   - **取得字典的值**：字典 `{"image": "Base64編碼", "filename": "receipt.jpg", "voiceNote": "聽寫的文字"}`
   - **取得 URL 內容**：
     - URL：`https://script.google.com/macros/s/YOUR_ID/exec?endpoint=image`
     - 方法：POST
     - 請求內文：字典
     - 標頭：`Content-Type: application/json`
   - **取得字典的值**：字典「URL 的內容」，鍵「message」
   - **顯示通知**：標題「組合記帳完成」，內容「字典值」

---

## 🔧 進階範本：帶錯誤處理的語音記帳

### 完整錯誤處理版本
```json
{
  "name": "語音記帳Pro",
  "icon": "mic.badge.plus",
  "color": "purple",
  "actions": [
    {
      "type": "DictateText",
      "parameters": {
        "prompt": "請說出您的交易內容",
        "language": "zh-TW"
      }
    },
    {
      "type": "If",
      "parameters": {
        "condition": "DictatedText is empty"
      },
      "ifTrue": [
        {
          "type": "ShowNotification",
          "parameters": {
            "title": "錯誤",
            "body": "語音識別失敗，請重試"
          }
        },
        {
          "type": "StopShortcut"
        }
      ]
    },
    {
      "type": "URLEncode",
      "parameters": {
        "input": "DictatedText"
      }
    },
    {
      "type": "Text",
      "parameters": {
        "text": "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?endpoint=voice&text=EncodedURL"
      }
    },
    {
      "type": "GetContentsOfURL",
      "parameters": {
        "url": "Text",
        "method": "GET"
      }
    },
    {
      "type": "GetDictionaryFromInput",
      "parameters": {
        "input": "ContentsOfURL"
      }
    },
    {
      "type": "GetDictionaryValue",
      "parameters": {
        "dictionary": "Dictionary",
        "key": "status"
      }
    },
    {
      "type": "If",
      "parameters": {
        "condition": "DictionaryValue equals success"
      },
      "ifTrue": [
        {
          "type": "GetDictionaryValue",
          "parameters": {
            "dictionary": "Dictionary",
            "key": "message"
          }
        },
        {
          "type": "ShowNotification",
          "parameters": {
            "title": "✅ 記帳成功",
            "body": "DictionaryValue"
          }
        }
      ],
      "ifFalse": [
        {
          "type": "GetDictionaryValue",
          "parameters": {
            "dictionary": "Dictionary",
            "key": "message"
          }
        },
        {
          "type": "ShowNotification",
          "parameters": {
            "title": "❌ 記帳失敗",
            "body": "DictionaryValue"
          }
        }
      ]
    }
  ]
}
```

---

## 📋 設定檢查清單

### 設定前檢查
- [ ] 已獲取 Google Apps Script 部署 URL
- [ ] 已確認 API 金鑰設定正確
- [ ] iPhone/iPad 已安裝「捷徑」App
- [ ] iOS 版本 13.0 以上

### 設定後測試
- [ ] 語音記帳：說「我買了咖啡花150元」
- [ ] 拍照記帳：拍攝任何收據
- [ ] 組合記帳：拍照 + 說明用途
- [ ] 錯誤處理：測試網路中斷情況
- [ ] 權限確認：相機、麥克風、網路權限

### 優化設定
- [ ] 添加到主畫面
- [ ] 設定 Siri 語音啟動
- [ ] 添加到控制中心
- [ ] 設定捷徑圖示和顏色
- [ ] 配置通知樣式

---

## 🚀 一鍵匯入連結

### 語音記帳捷徑
```
shortcuts://import-shortcut?url=https://your-domain.com/voice-accounting-shortcut.shortcut
```

### 拍照記帳捷徑
```
shortcuts://import-shortcut?url=https://your-domain.com/photo-accounting-shortcut.shortcut
```

### 組合記帳捷徑
```
shortcuts://import-shortcut?url=https://your-domain.com/combo-accounting-shortcut.shortcut
```

---

## 💡 自訂技巧

### 個人化設定
1. **修改提示文字**：根據個人習慣調整語音提示
2. **調整通知樣式**：選擇橫幅或警告樣式
3. **設定快捷鍵**：為常用捷徑設定 Siri 語音指令
4. **批次處理**：設定多筆交易的批次處理邏輯

### 進階功能
1. **條件邏輯**：根據金額大小選擇不同處理方式
2. **資料驗證**：添加金額和日期格式檢查
3. **離線模式**：設定網路中斷時的本地存儲
4. **統計報告**：添加每日/每月支出統計功能

---

## 📞 技術支援

### 常見問題
1. **捷徑無法執行**：檢查 URL 和權限設定
2. **語音識別失敗**：確保環境安靜，說話清晰
3. **圖片上傳失敗**：檢查圖片大小和網路連接
4. **API 回應錯誤**：驗證部署 ID 和 API 金鑰

### 聯繫方式
- 📧 Email：support@your-domain.com
- 💬 社群：加入用戶討論群組
- 📖 文件：查看完整技術文件
- 🐛 回報：提交 Bug 和功能建議