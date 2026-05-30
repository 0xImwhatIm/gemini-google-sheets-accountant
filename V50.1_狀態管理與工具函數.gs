// =================================================================================================
// V50.1 狀態管理與工具函數
// =================================================================================================

// =================================================================================================
// 用戶狀態管理
// =================================================================================================
function getUserState(userId, platform) {
  try {
    const key = `user_state_${platform}_${userId}`;
    const stateJson = PropertiesService.getScriptProperties().getProperty(key);
    
    if (stateJson) {
      const state = JSON.parse(stateJson);
      
      // 檢查狀態是否過期 (30分鐘)
      if (state.timestamp) {
        const stateTime = new Date(state.timestamp);
        const now = new Date();
        const diffMinutes = (now - stateTime) / (1000 * 60);
        
        if (diffMinutes > 30) {
          Logger.log(`[V50.1-State] 用戶狀態已過期，清除狀態`);
          clearUserState(userId, platform);
          return { state: USER_STATES.IDLE };
        }
      }
      
      return state;
    }
    
    return { state: USER_STATES.IDLE };
  } catch (error) {
    Logger.log(`[V50.1-State] 獲取用戶狀態失敗: ${error.message}`);
    return { state: USER_STATES.IDLE };
  }
}

function setUserState(userId, platform, state) {
  try {
    const key = `user_state_${platform}_${userId}`;
    state.timestamp = new Date().toISOString();
    PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(state));
    Logger.log(`[V50.1-State] 已設定用戶狀態: ${state.state}`);
  } catch (error) {
    Logger.log(`[V50.1-State] 設定用戶狀態失敗: ${error.message}`);
  }
}

function clearUserState(userId, platform) {
  try {
    const key = `user_state_${platform}_${userId}`;
    PropertiesService.getScriptProperties().deleteProperty(key);
    Logger.log(`[V50.1-State] 已清除用戶狀態`);
  } catch (error) {
    Logger.log(`[V50.1-State] 清除用戶狀態失敗: ${error.message}`);
  }
}

// =================================================================================================
// Telegram API 工具函數
// =================================================================================================
function sendTelegramMessage(chatId, text) {
  const token = CONFIG.TELEGRAM_BOT_TOKEN;
  
  if (!token || token === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
    Logger.log('[V50.1-Telegram] 錯誤: TELEGRAM_BOT_TOKEN 未設定');
    return false;
  }
  
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const payload = {
    'chat_id': String(chatId),
    'text': text,
    'parse_mode': 'Markdown'
  };
  
  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload)
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    
    if (result.ok) {
      Logger.log(`[V50.1-Telegram] 訊息發送成功`);
      return true;
    } else {
      Logger.log(`[V50.1-Telegram] 訊息發送失敗: ${result.description}`);
      return false;
    }
  } catch (error) {
    Logger.log(`[V50.1-Telegram] 發送訊息異常: ${error.message}`);
    return false;
  }
}

function sendTelegramMessageWithKeyboard(chatId, text, keyboard) {
  const token = CONFIG.TELEGRAM_BOT_TOKEN;
  
  if (!token || token === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
    Logger.log('[V50.1-Telegram] 錯誤: TELEGRAM_BOT_TOKEN 未設定');
    return false;
  }
  
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const payload = {
    'chat_id': String(chatId),
    'text': text,
    'parse_mode': 'Markdown',
    'reply_markup': JSON.stringify(keyboard)
  };
  
  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload)
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    
    if (result.ok) {
      Logger.log(`[V50.1-Telegram] 帶鍵盤的訊息發送成功`);
      return true;
    } else {
      Logger.log(`[V50.1-Telegram] 帶鍵盤的訊息發送失敗: ${result.description}`);
      return false;
    }
  } catch (error) {
    Logger.log(`[V50.1-Telegram] 發送帶鍵盤訊息異常: ${error.message}`);
    return false;
  }
}

function answerCallbackQuery(callbackQueryId, text = '') {
  const token = CONFIG.TELEGRAM_BOT_TOKEN;
  const url = `https://api.telegram.org/bot${token}/answerCallbackQuery`;
  
  const payload = {
    'callback_query_id': callbackQueryId,
    'text': text
  };
  
  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload)
  };
  
  try {
    UrlFetchApp.fetch(url, options);
    Logger.log(`[V50.1-Telegram] 回調查詢已回應`);
  } catch (error) {
    Logger.log(`[V50.1-Telegram] 回應回調查詢失敗: ${error.message}`);
  }
}

// =================================================================================================
// 檔案下載函數
// =================================================================================================
function downloadTelegramPhoto(photos) {
  try {
    // 選擇最高解析度的圖片 (最後一個元素)
    const photo = photos[photos.length - 1];
    const fileId = photo.file_id;
    
    Logger.log(`[V50.1-Download] 下載圖片 File ID: ${fileId}`);
    
    // 獲取檔案資訊
    const fileInfo = getTelegramFile(fileId);
    if (!fileInfo || !fileInfo.file_path) {
      throw new Error('無法獲取檔案資訊');
    }
    
    // 下載檔案
    const imageBlob = downloadTelegramFileBlob(fileInfo.file_path);
    
    Logger.log(`[V50.1-Download] 圖片下載成功，大小: ${imageBlob.getBytes().length} bytes`);
    return imageBlob;
    
  } catch (error) {
    Logger.log(`[V50.1-Download] 圖片下載失敗: ${error.message}`);
    return null;
  }
}

function downloadTelegramVoice(voice) {
  try {
    const fileId = voice.file_id;
    
    Logger.log(`[V50.1-Download] 下載語音 File ID: ${fileId}`);
    
    // 獲取檔案資訊
    const fileInfo = getTelegramFile(fileId);
    if (!fileInfo || !fileInfo.file_path) {
      throw new Error('無法獲取語音檔案資訊');
    }
    
    // 下載檔案
    const voiceBlob = downloadTelegramFileBlob(fileInfo.file_path);
    
    Logger.log(`[V50.1-Download] 語音下載成功，大小: ${voiceBlob.getBytes().length} bytes`);
    return voiceBlob;
    
  } catch (error) {
    Logger.log(`[V50.1-Download] 語音下載失敗: ${error.message}`);
    return null;
  }
}

function getTelegramFile(fileId) {
  const token = CONFIG.TELEGRAM_BOT_TOKEN;
  const url = `https://api.telegram.org/bot${token}/getFile`;
  
  const payload = {
    'file_id': fileId
  };
  
  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload)
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    
    if (result.ok) {
      return result.result;
    } else {
      throw new Error(result.description);
    }
  } catch (error) {
    Logger.log(`[V50.1-File] 獲取檔案資訊失敗: ${error.message}`);
    return null;
  }
}

function downloadTelegramFileBlob(filePath) {
  const token = CONFIG.TELEGRAM_BOT_TOKEN;
  const url = `https://api.telegram.org/file/bot${token}/${filePath}`;
  
  try {
    const response = UrlFetchApp.fetch(url);
    return response.getBlob();
  } catch (error) {
    Logger.log(`[V50.1-File] 下載檔案失敗: ${error.message}`);
    throw error;
  }
}

// =================================================================================================
// 格式化和 UI 函數
// =================================================================================================
function formatTransactionConfirmation(transactionData) {
  const amount = transactionData.amount || '未知';
  const description = transactionData.description || '未知項目';
  const category = transactionData.category || '未分類';
  const date = transactionData.date || new Date().toLocaleDateString('zh-TW');
  
  return `📋 **請確認記帳資訊**

💰 **金額**: ${amount} 元
📝 **項目**: ${description}
🏷️ **分類**: ${category}
📅 **日期**: ${date}

請確認資訊是否正確？`;
}

function getConfirmationKeyboard() {
  return {
    'inline_keyboard': [
      [
        { 'text': '✅ 確認記帳', 'callback_data': 'confirm_transaction' },
        { 'text': '❌ 取消', 'callback_data': 'cancel_transaction' }
      ],
      [
        { 'text': '✏️ 修改金額', 'callback_data': 'edit_amount' },
        { 'text': '📝 修改項目', 'callback_data': 'edit_description' }
      ]
    ]
  };
}

// =================================================================================================
// 語音轉文字 (簡化版)
// =================================================================================================
function convertVoiceToText(voiceBlob) {
  // 這裡可以整合 Google Speech-to-Text API
  // 或者直接返回 null，讓系統用其他方式處理
  
  try {
    // 暫時返回 null，讓系統用現有的 callGeminiForVoice 處理
    // 未來可以在這裡實作語音轉文字功能
    return null;
  } catch (error) {
    Logger.log(`[V50.1-Voice] 語音轉文字失敗: ${error.message}`);
    return null;
  }
}

// =================================================================================================
// 編輯功能 (預留)
// =================================================================================================
function startEditAmount(chatId, userId, userState) {
  sendTelegramMessage(chatId, "💰 請輸入新的金額 (只需要數字):");
  
  setUserState(userId, 'telegram', {
    state: 'editing_amount',
    pendingData: userState.pendingData,
    timestamp: new Date().toISOString()
  });
}

function startEditDescription(chatId, userId, userState) {
  sendTelegramMessage(chatId, "📝 請輸入新的項目描述:");
  
  setUserState(userId, 'telegram', {
    state: 'editing_description',
    pendingData: userState.pendingData,
    timestamp: new Date().toISOString()
  });
}