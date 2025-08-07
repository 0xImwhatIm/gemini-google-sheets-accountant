/**
 * 🔍 診斷 Vision API 調用問題
 */
function diagnoseVisionAPI() {
  Logger.log('🔍 開始診斷 Vision API 問題...');
  
  try {
    // 1. 檢查函數是否存在
    Logger.log('📋 檢查函數存在性：');
    Logger.log(`callGeminiForVision 存在: ${typeof callGeminiForVision === 'function'}`);
    Logger.log(`callGeminiForVisionForced 存在: ${typeof callGeminiForVisionForced === 'function'}`);
    
    // 2. 檢查 doPost_Image 函數內容
    Logger.log('📋 檢查 doPost_Image 函數內容：');
    const doPostImageCode = doPost_Image.toString();
    const usesForced = doPostImageCode.includes('callGeminiForVisionForced');
    const usesOriginal = doPostImageCode.includes('callGeminiForVision(');
    Logger.log(`doPost_Image 使用 Forced 版本: ${usesForced}`);
    Logger.log(`doPost_Image 使用原版: ${usesOriginal}`);
    
    // 3. 檢查原版函數的 API 端點
    Logger.log('📋 檢查原版函數 API 端點：');
    const originalCode = callGeminiForVision.toString();
    const usesFlashLatest = originalCode.includes('gemini-1.5-flash-latest');
    const usesVisionLatest = originalCode.includes('gemini-1.5-pro-vision-latest');
    Logger.log(`原版函數使用 flash-latest: ${usesFlashLatest}`);
    Logger.log(`原版函數使用 vision-latest: ${usesVisionLatest}`);
    
    // 4. 檢查強制版本函數的 API 端點
    Logger.log('📋 檢查強制版本函數 API 端點：');
    const forcedCode = callGeminiForVisionForced.toString();
    const forcedUsesFlash = forcedCode.includes('gemini-1.5-flash-latest');
    Logger.log(`強制版本使用 flash-latest: ${forcedUsesFlash}`);
    
    // 5. 測試直接調用
    Logger.log('📋 測試直接調用強制版本：');
    const testImageData = Utilities.base64Decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==');
    const testBlob = Utilities.newBlob(testImageData, 'image/png', 'test.png');
    
    const result = callGeminiForVisionForced(testBlob, '診斷測試');
    Logger.log('✅ 強制版本調用成功');
    Logger.log(`結果: ${result}`);
    
    return {
      success: true,
      message: '診斷完成',
      details: {
        functionsExist: {
          original: typeof callGeminiForVision === 'function',
          forced: typeof callGeminiForVisionForced === 'function'
        },
        doPostImageUsage: {
          usesForced: usesForced,
          usesOriginal: usesOriginal
        },
        apiEndpoints: {
          originalUsesFlash: usesFlashLatest,
          originalUsesVision: usesVisionLatest,
          forcedUsesFlash: forcedUsesFlash
        }
      }
    };
    
  } catch (error) {
    Logger.log('❌ 診斷過程中發生錯誤：' + error.message);
    Logger.log('🔍 錯誤堆疊：' + error.stack);
    
    return {
      success: false,
      message: error.message,
      stack: error.stack
    };
  }
}

/**
 * 🧪 模擬 iOS 捷徑調用並記錄詳細日誌
 */
function simulateIOSShortcutCall() {
  Logger.log('📱 模擬 iOS 捷徑調用...');
  
  try {
    // 模擬 POST 資料
    const mockEvent = {
      parameter: {
        endpoint: 'image'
      },
      postData: {
        contents: JSON.stringify({
          image: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
          mimeType: 'image/png',
          filename: 'test-receipt.png',
          voiceNote: '模擬 iOS 捷徑調用測試'
        })
      }
    };
    
    Logger.log('📋 調用 doPost 主函數...');
    const result = doPost(mockEvent);
    
    Logger.log('📋 解析回應...');
    const responseText = result.getContent();
    const responseData = JSON.parse(responseText);
    
    Logger.log(`✅ 模擬調用完成，狀態: ${responseData.status}`);
    Logger.log(`訊息: ${responseData.message}`);
    
    if (responseData.status === 'success') {
      Logger.log('🎉 模擬調用成功！');
    } else {
      Logger.log('❌ 模擬調用失敗');
    }
    
    return responseData;
    
  } catch (error) {
    Logger.log('💥 模擬調用過程中發生錯誤：' + error.message);
    Logger.log('🔍 錯誤堆疊：' + error.stack);
    
    return {
      success: false,
      message: error.message,
      stack: error.stack
    };
  }
}