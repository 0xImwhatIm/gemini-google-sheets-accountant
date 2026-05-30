// =================================================================================================
// V50.1 Bot 核心處理邏輯 - 完整版
// =================================================================================================

// 用戶狀態常數
const USER_STATES = {
  IDLE: 'idle',
  WAITING_CONFIRMATION: 'waiting_confirmation',
  EDITING_RECORD: 'editing_record',
  SELECTING_CATEGORY: 'selecting_category'
};

// =================================================================================================
// Bot Webhook 主處理函數 (改進版)
// =================================================================================================
function doPost_Bot(e) {
  return safeExecute(() => {
    const contents = e.postData.contents;
    const update = JSON.parse(contents);
    
    Logger.log(`[V50.1-Bot] 收到 Webhook: ${JSON.stringify(update)}`);
    
    if (update.update_id && update.message) {
      Logger.log('[V50.1-Bot] 處理 Telegram 訊息');
      handleTelegramBot(update);
    } else if (update.callback_query) {
      Logger.log('[V50.1-Bot] 處理 Telegram 回調');
      handleTelegramCallback(update);
    } else {
      Logger.log(`[V50.1-Bot] 未知的請求格式: ${contents}`);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ "status": "ok" }))
      .setMimeType(ContentService.MimeType.JSON);
  }, { name: 'doPost_Bot' });
}

// =================================================================================================
// Telegram Bot 訊息處理 (完整版)
// =================================================================================================
function handleTelegramBot(update) {
  const message = update.message;
  const chatId = message.chat.id;
  const userId = message.from.id;
  const from = message.from.first_name || message.from.username || 'User';
  
  Logger.log(`[V50.1-Telegram] 來自 ${from} (ID: ${userId}, Chat: ${chatId})`);
  
  try {
    // 獲取用戶狀態
    const userState = getUserState(userId, 'telegram');
    Logger.log(`[V50.1-State] 用戶狀態: ${userState.state}`);
    
    // 根據狀態處理訊息
    if (userState.state === USER_STATES.WAITING_CONFIRMATION) {
      handleConfirmation(message, userState);
    } else if (message.text && message.text.startsWith('/')) {
      handleTelegramCommand(message);
    } else if (message.photo) {
      handleTelegramPhoto(message);
    } else if (message.voice) {
      handleTelegramVoice(message);
    } else if (message.text) {
      handleTelegramText(message);
    } else {
      sendTelegramMessage(chatId, "❓ 抱歉，我還不支援這種訊息類型\n\n輸入 /help 查看使用說明");
    }
    
  } catch (error) {
    Logger.log(`[V50.1-Error] 處理訊息失敗: ${error.message}`);
    sendTelegramMessage(chatId, "❌ 處理訊息時發生錯誤，請稍後重試");
  }
}

// =================================================================================================
// 指令處理
// =================================================================================================
function handleTelegramCommand(message) {
  const command = message.text.toLowerCase();
  const chatId = message.chat.id;
  const userId = message.from.id;
  const from = message.from.first_name || 'User';
  
  Logger.log(`[V50.1-Command] 處理指令: ${command}`);
  
  switch(command) {
    case '/start':
      sendWelcomeMessage(chatId, from);
      break;
    case '/help':
      sendHelpMessage(chatId);
      break;
    case '/stats':
      sendStatsMessage(chatId, userId);
      break;
    case '/cancel':
      cancelCurrentOperation(chatId, userId);
      break;
    default:
      sendTelegramMessage(chatId, `❓ 未知指令: ${command}\n\n輸入 /help 查看可用指令`);
  }
}

function sendWelcomeMessage(chatId, userName) {
  const welcomeText = `🤖 歡迎 ${userName}！

我是智慧記帳助手，可以幫你：

📸 **拍照記帳** - 發送收據照片，我會自動識別
🎤 **語音記帳** - 發送語音訊息，說出消費內容
✏️ **文字記帳** - 直接輸入消費資訊

📊 **查詢功能**:
/stats - 查看消費統計
/help - 查看詳細說明

現在就試試發送一張收據照片吧！📸`;
  
  sendTelegramMessage(chatId, welcomeText);
}

function sendHelpMessage(chatId) {
  const helpText = `📖 **使用說明**

**記帳方式**:
📸 發送收據照片 → 自動識別金額和項目
🎤 發送語音訊息 → 語音轉文字記帳
✏️ 輸入文字 → 如「午餐 150 元」

**指令列表**:
/start - 開始使用
/help - 查看說明
/stats - 消費統計
/cancel - 取消當前操作

**範例**:
• 拍攝收據照片
• 語音：「今天中午麥當勞花了 120 元」
• 文字：「咖啡 50 元」

有問題隨時問我！😊`;
  
  sendTelegramMessage(chatId, helpText);
}

function sendStatsMessage(chatId, userId) {
  try {
    // 這裡可以整合現有的統計功能
    const today = new Date().toLocaleDateString('zh-TW');
    const statsText = `📊 **消費統計** (${today})

今日支出: 計算中...
本月支出: 計算中...
主要類別: 計算中...

💡 完整統計功能開發中，敬請期待！`;
    
    sendTelegramMessage(chatId, statsText);
  } catch (error) {
    Logger.log(`[V50.1-Stats] 統計查詢失敗: ${error.message}`);
    sendTelegramMessage(chatId, "❌ 統計查詢失敗，請稍後重試");
  }
}

function cancelCurrentOperation(chatId, userId) {
  // 清除用戶狀態
  clearUserState(userId, 'telegram');
  sendTelegramMessage(chatId, "✅ 已取消當前操作");
}