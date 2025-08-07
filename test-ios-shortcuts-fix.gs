/**
 * 🧪 iOS 捷徑拍照記帳修復測試
 * 
 * 這個函數模擬 iOS 捷徑的調用方式，測試修復是否生效
 */
function testIOSShortcutsFix() {
  Logger.log('🚀 開始測試 iOS 捷徑拍照記帳修復...');
  
  try {
    // 模擬 iOS 捷徑的 POST 請求資料
    const mockPostData = {
      postData: {
        contents: JSON.stringify({
          image: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
          mimeType: 'image/png',
          filename: 'test-receipt.png',
          voiceNote: '測試修復版本的拍照記帳功能'
        })
      }
    };
    
    // 調用 doPost_Image 函數（這是 iOS 捷徑實際調用的函數）
    Logger.log('📱 模擬 iOS 捷徑調用 doPost_Image...');
    const result = doPost_Image(mockPostData);
    
    // 解析結果
    const responseText = result.getContent();
    const responseData = JSON.parse(responseText);
    
    Logger.log('📊 測試結果：');
    Logger.log(`狀態: ${responseData.status}`);
    Logger.log(`訊息: ${responseData.message}`);
    
    if (responseData.status === 'success') {
      Logger.log('✅ iOS 捷徑拍照記帳修復成功！');
      Logger.log('📝 記帳資料：');
      Logger.log(`  日期: ${responseData.data.date}`);
      Logger.log(`  金額: ${responseData.data.amount}`);
      Logger.log(`  類別: ${responseData.data.category}`);
      Logger.log(`  項目: ${responseData.data.item}`);
      
      return {
        success: true,
        message: 'iOS 捷徑拍照記帳修復測試通過',
        data: responseData.data
      };
    } else {
      Logger.log('❌ 測試失敗：' + responseData.message);
      return {
        success: false,
        message: responseData.message
      };
    }
    
  } catch (error) {
    Logger.log('💥 測試過程中發生錯誤：' + error.message);
    Logger.log('🔍 錯誤堆疊：' + error.stack);
    
    return {
      success: false,
      message: '測試失敗：' + error.message,
      error: error.stack
    };
  }
}

/**
 * 🔧 直接測試強制修復函數
 */
function testForcedFunctionDirectly() {
  Logger.log('🔧 直接測試 callGeminiForVisionForced 函數...');
  
  try {
    // 創建測試圖片
    const testImageData = Utilities.base64Decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==');
    const testBlob = Utilities.newBlob(testImageData, 'image/png', 'test.png');
    
    // 直接調用強制修復函數
    const result = callGeminiForVisionForced(testBlob, '直接測試強制修復函數');
    
    Logger.log('✅ 強制修復函數調用成功');
    Logger.log('📊 返回結果：' + result);
    
    const parsedResult = JSON.parse(result);
    Logger.log('📝 解析後的資料：');
    Logger.log(`  日期: ${parsedResult.date}`);
    Logger.log(`  金額: ${parsedResult.amount}`);
    Logger.log(`  類別: ${parsedResult.category}`);
    
    return {
      success: true,
      message: '強制修復函數測試通過',
      data: parsedResult
    };
    
  } catch (error) {
    Logger.log('❌ 強制修復函數測試失敗：' + error.message);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * 🏃‍♂️ 快速驗證修復狀態
 */
function quickFixVerification() {
  Logger.log('⚡ 快速驗證修復狀態...');
  
  // 檢查函數是否存在
  try {
    if (typeof callGeminiForVisionForced === 'function') {
      Logger.log('✅ callGeminiForVisionForced 函數存在');
    } else {
      Logger.log('❌ callGeminiForVisionForced 函數不存在');
      return false;
    }
    
    // 檢查 doPost_Image 函數內容
    const doPostImageCode = doPost_Image.toString();
    if (doPostImageCode.includes('callGeminiForVisionForced')) {
      Logger.log('✅ doPost_Image 已修改為使用強制修復版本');
    } else {
      Logger.log('❌ doPost_Image 仍在使用原版本');
      return false;
    }
    
    Logger.log('🎉 所有檢查通過，修復已生效！');
    return true;
    
  } catch (error) {
    Logger.log('💥 驗證過程中發生錯誤：' + error.message);
    return false;
  }
}