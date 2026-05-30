// =================================================================================================
// V50.1 圖片和語音處理邏輯
// =================================================================================================

// =================================================================================================
// 圖片處理 (整合現有 AI 邏輯)
// =================================================================================================
function handleTelegramPhoto(message) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  
  Logger.log(`[V50.1-Photo] 處理圖片訊息`);
  
  try {
    // 1. 發送處理中訊息
    sendTelegramMessage(chatId, "📸 收到照片！正在分析中...");
    
    // 2. 下載圖片
    const imageBlob = downloadTelegramPhoto(message.photo);
    if (!imageBlob) {
      throw new Error('圖片下載失敗');
    }
    
    // 3. 調用現有的 AI 處理邏輯
    sendTelegramMessage(chatId, "🧠 AI 正在識別收據內容...");
    const aiResult = callGeminiForVision(imageBlob, "");
    
    // 4. 解析 AI 結果
    const transactionData = extractJsonFromText(aiResult);
    
    if (!transactionData || !transactionData.amount) {
      throw new Error('無法識別收據內容');
    }
    
    // 5. 格式化確認訊息
    const confirmText = formatTransactionConfirmation(transactionData);
    sendTelegramMessageWithKeyboard(chatId, confirmText, getConfirmationKeyboard());
    
    // 6. 設定用戶狀態
    setUserState(userId, 'telegram', {
      state: USER_STATES.WAITING_CONFIRMATION,
      pendingData: transactionData,
      timestamp: new Date().toISOString(),
      source: 'photo'
    });
    
    Logger.log(`[V50.1-Photo] 圖片處理完成，等待用戶確認`);
    
  } catch (error) {
    Logger.log(`[V50.1-Photo] 圖片處理失敗: ${error.message}`);
    
    const errorText = `❌ 圖片處理失敗

可能原因：
• 圖片不夠清晰
• 不是收據或發票
• 網路連線問題

💡 請嘗試：
1. 重新拍攝更清晰的照片
2. 使用語音記帳：說出消費內容
3. 手動輸入：如「午餐 150 元」`;
    
    sendTelegramMessage(chatId, errorText);
  }
}

// =================================================================================================
// 語音處理 (整合現有 AI 邏輯)
// =================================================================================================
function handleTelegramVoice(message) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  
  Logger.log(`[V50.1-Voice] 處理語音訊息`);
  
  try {
    // 1. 發送處理中訊息
    sendTelegramMessage(chatId, "🎤 收到語音！正在處理中...");
    
    // 2. 下載語音檔案
    const voiceBlob = downloadTelegramVoice(message.voice);
    if (!voiceBlob) {
      throw new Error('語音下載失敗');
    }
    
    // 3. 轉換為文字 (這裡可以用 Google Speech-to-Text 或直接傳給 Gemini)
    sendTelegramMessage(chatId, "🧠 AI 正在理解語音內容...");
    
    // 方法1: 直接用文字處理 (如果 Telegram 提供了文字轉換)
    // 方法2: 調用現有的語音處理邏輯
    const voiceText = convertVoiceToText(voiceBlob); // 需要實作
    
    if (!voiceText) {
      // 如果無法轉文字，直接用現有邏輯處理
      const aiResult = callGeminiForVoice("語音記帳請求"); // 可能需要調整
    } else {
      // 用文字處理邏輯
      const aiResult = callGeminiForVoice(voiceText);
    }
    
    // 4. 解析結果
    const transactionData = extractJsonFromText(aiResult);
    
    if (!transactionData || !transactionData.amount) {
      throw new Error('無法理解語音內容');
    }
    
    // 5. 格式化確認訊息
    const confirmText = formatTransactionConfirmation(transactionData);
    sendTelegramMessageWithKeyboard(chatId, confirmText, getConfirmationKeyboard());
    
    // 6. 設定用戶狀態
    setUserState(userId, 'telegram', {
      state: USER_STATES.WAITING_CONFIRMATION,
      pendingData: transactionData,
      timestamp: new Date().toISOString(),
      source: 'voice',
      originalText: voiceText
    });
    
    Logger.log(`[V50.1-Voice] 語音處理完成，等待用戶確認`);
    
  } catch (error) {
    Logger.log(`[V50.1-Voice] 語音處理失敗: ${error.message}`);
    
    const errorText = `❌ 語音處理失敗

可能原因：
• 語音不夠清晰
• 背景噪音太大
• 語音內容不完整

💡 請嘗試：
1. 重新錄製更清晰的語音
2. 直接輸入文字：如「午餐 150 元」
3. 拍攝收據照片`;
    
    sendTelegramMessage(chatId, errorText);
  }
}

// =================================================================================================
// 文字處理
// =================================================================================================
function handleTelegramText(message) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text;
  
  Logger.log(`[V50.1-Text] 處理文字訊息: ${text}`);
  
  try {
    // 發送處理中訊息
    sendTelegramMessage(chatId, "✏️ 正在分析文字內容...");
    
    // 調用現有的語音處理邏輯 (因為都是文字分析)
    const aiResult = callGeminiForVoice(text);
    
    // 解析結果
    const transactionData = extractJsonFromText(aiResult);
    
    if (!transactionData || !transactionData.amount) {
      throw new Error('無法理解文字內容');
    }
    
    // 格式化確認訊息
    const confirmText = formatTransactionConfirmation(transactionData);
    sendTelegramMessageWithKeyboard(chatId, confirmText, getConfirmationKeyboard());
    
    // 設定用戶狀態
    setUserState(userId, 'telegram', {
      state: USER_STATES.WAITING_CONFIRMATION,
      pendingData: transactionData,
      timestamp: new Date().toISOString(),
      source: 'text',
      originalText: text
    });
    
    Logger.log(`[V50.1-Text] 文字處理完成，等待用戶確認`);
    
  } catch (error) {
    Logger.log(`[V50.1-Text] 文字處理失敗: ${error.message}`);
    
    const errorText = `❌ 無法理解這段文字

💡 請嘗試更清楚的描述，例如：
• 「午餐 150 元」
• 「今天買咖啡花了 50 元」
• 「7-11 消費 89 元」

或者：
📸 拍攝收據照片
🎤 發送語音訊息`;
    
    sendTelegramMessage(chatId, errorText);
  }
}

// =================================================================================================
// 確認處理
// =================================================================================================
function handleConfirmation(message, userState) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  
  Logger.log(`[V50.1-Confirm] 處理確認回應`);
  
  // 這個函數會在用戶點擊確認按鈕時被 handleTelegramCallback 調用
  // 這裡處理文字回應的情況
  if (message.text) {
    const text = message.text.toLowerCase();
    
    if (text.includes('確認') || text.includes('是') || text.includes('yes') || text === 'y') {
      confirmAndSaveTransaction(chatId, userId, userState);
    } else if (text.includes('取消') || text.includes('否') || text.includes('no') || text === 'n') {
      cancelTransaction(chatId, userId);
    } else {
      sendTelegramMessage(chatId, "請點擊下方按鈕確認或取消，或輸入「確認」/「取消」");
    }
  }
}

// =================================================================================================
// 回調處理 (按鈕點擊)
// =================================================================================================
function handleTelegramCallback(update) {
  const callbackQuery = update.callback_query;
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;
  
  Logger.log(`[V50.1-Callback] 處理回調: ${data}`);
  
  // 獲取用戶狀態
  const userState = getUserState(userId, 'telegram');
  
  switch(data) {
    case 'confirm_transaction':
      confirmAndSaveTransaction(chatId, userId, userState);
      break;
    case 'cancel_transaction':
      cancelTransaction(chatId, userId);
      break;
    case 'edit_amount':
      startEditAmount(chatId, userId, userState);
      break;
    case 'edit_description':
      startEditDescription(chatId, userId, userState);
      break;
    default:
      Logger.log(`[V50.1-Callback] 未知回調: ${data}`);
  }
  
  // 回應 Telegram (避免按鈕一直轉圈)
  answerCallbackQuery(callbackQuery.id);
}

function confirmAndSaveTransaction(chatId, userId, userState) {
  try {
    const transactionData = userState.pendingData;
    
    // 調用現有的記帳邏輯
    const result = writeToSheet(transactionData, 'telegram_bot');
    
    if (result) {
      const successText = `✅ **記帳成功！**

💰 金額：${transactionData.amount} 元
📝 項目：${transactionData.description}
🏷️ 分類：${transactionData.category || '未分類'}
📅 日期：${transactionData.date || new Date().toLocaleDateString('zh-TW')}

繼續發送收據或語音來記帳吧！`;
      
      sendTelegramMessage(chatId, successText);
      
      // 清除用戶狀態
      clearUserState(userId, 'telegram');
      
    } else {
      throw new Error('寫入試算表失敗');
    }
    
  } catch (error) {
    Logger.log(`[V50.1-Save] 記帳失敗: ${error.message}`);
    sendTelegramMessage(chatId, "❌ 記帳失敗，請稍後重試");
  }
}

function cancelTransaction(chatId, userId) {
  clearUserState(userId, 'telegram');
  sendTelegramMessage(chatId, "❌ 已取消記帳\n\n可以重新發送收據、語音或文字來記帳");
}