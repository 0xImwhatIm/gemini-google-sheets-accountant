/**
 * 智慧記帳 GEM - Phase 4 錯誤處理框架整合與測試
 * 
 * 提供完整的錯誤處理流程整合和測試功能
 */

// =================================================================================================
// Phase 4 錯誤處理整合管理器
// =================================================================================================

class Phase4ErrorHandlingIntegration {
  constructor() {
    this.errorHandler = phase4ErrorHandler;
    this.transactionManager = new Phase4TransactionManager();
    this.consistencyChecker = new Phase4ConsistencyChecker();
    this.notificationManager = new Phase4NotificationManager();
    this.linkDetector = phase4LedgerLinkDetector;
    this.expenseHandler = phase4ExpenseRealizationHandler;
    this.recoveryManager = phase4LinkRecoveryManager;
  }

  /**
   * 完整的 Phase 4 帳本關聯處理流程
   * @param {Object} iouData - IOU 資料
   * @param {Object} mainLedgerData - 主帳本資料
   * @param {Object} options - 處理選項
   * @returns {Object} 處理結果
   */
  async processLedgerLinking(iouData, mainLedgerData, options = {}) {
    const processId = this.generateProcessId();
    const startTime = new Date();
    
    const result = {
      processId: processId,
      startTime: startTime,
      success: false,
      steps: [],
      errors: [],
      warnings: [],
      transactionId: null,
      recoveryId: null
    };
    
    let transactionId = null;
    let recoveryId = null;
    
    try {
      Logger.log(`[Phase4Integration] 開始帳本關聯處理: ${processId}`);
      
      // 1. 開始事務
      transactionId = this.transactionManager.beginTransaction('LEDGER_LINKING', {
        processId: processId,
        iouEventIds: this.extractIOUEventIds(iouData),
        options: options
      });
      result.transactionId = transactionId;
      
      // 2. 開始恢復管理
      recoveryId = await this.recoveryManager.startLinkOperation(processId, {
        iouEventIds: this.extractIOUEventIds(iouData),
        transactionId: transactionId
      });
      result.recoveryId = recoveryId;
      
      // 3. 執行關聯前檢測
      const detectionResult = await this.linkDetector.detectLinkErrors(iouData, mainLedgerData, {
        processId: processId,
        transactionId: transactionId
      });
      
      result.steps.push({
        step: 'LINK_DETECTION',
        success: detectionResult.summary.errorsFound === 0,
        details: detectionResult
      });
      
      if (detectionResult.summary.errorsFound > 0) {
        // 有錯誤時嘗試處理
        const errorHandlingResult = await this.handleDetectedErrors(detectionResult, {
          processId: processId,
          transactionId: transactionId
        });
        
        result.steps.push({
          step: 'ERROR_HANDLING',
          success: errorHandlingResult.success,
          details: errorHandlingResult
        });
        
        if (!errorHandlingResult.success) {
          throw new Error('關聯錯誤處理失敗');
        }
      }
      
      // 4. 建立檢查點
      await this.recoveryManager.createCheckpoint(recoveryId, 'DETECTION_COMPLETE', {
        detectionResult: detectionResult
      });
      
      // 5. 執行支出真實化
      if (options.realizeExpenses !== false) {
        const expenseResult = await this.processExpenseRealization(iouData, {
          processId: processId,
          transactionId: transactionId,
          recoveryId: recoveryId
        });
        
        result.steps.push({
          step: 'EXPENSE_REALIZATION',
          success: expenseResult.success,
          details: expenseResult
        });
        
        if (!expenseResult.success && !options.continueOnExpenseError) {
          throw new Error('支出真實化失敗');
        }
      }
      
      // 6. 執行一致性檢查
      const consistencyResult = await this.consistencyChecker.performFullConsistencyCheck();
      
      result.steps.push({
        step: 'CONSISTENCY_CHECK',
        success: consistencyResult.summary.failedChecks === 0,
        details: consistencyResult
      });
      
      if (consistencyResult.summary.failedChecks > 0 && !options.ignoreConsistencyErrors) {
        throw new Error('一致性檢查失敗');
      }
      
      // 7. 提交事務
      const commitResult = await this.transactionManager.commitTransaction(transactionId);
      
      result.steps.push({
        step: 'TRANSACTION_COMMIT',
        success: commitResult.success,
        details: commitResult
      });
      
      if (!commitResult.success) {
        throw new Error('事務提交失敗');
      }
      
      // 8. 完成恢復管理
      await this.recoveryManager.completeOperation(recoveryId, { success: true });
      
      result.success = true;
      Logger.log(`[Phase4Integration] 帳本關聯處理成功: ${processId}`);
      
    } catch (error) {
      Logger.log(`[Phase4Integration] 帳本關聯處理失敗: ${processId} - ${error.toString()}`);
      
      result.error = error.toString();
      
      // 錯誤處理
      try {
        // 回滾事務
        if (transactionId) {
          const rollbackResult = await this.transactionManager.rollbackTransaction(transactionId);
          result.steps.push({
            step: 'TRANSACTION_ROLLBACK',
            success: rollbackResult.success,
            details: rollbackResult
          });
        }
        
        // 嘗試恢復
        if (recoveryId) {
          const recoveryResult = await this.recoveryManager.recoverFromInterruption(recoveryId);
          result.steps.push({
            step: 'RECOVERY_ATTEMPT',
            success: recoveryResult.success,
            details: recoveryResult
          });
        }
        
        // 發送錯誤通知
        await this.errorHandler.handleError(error, {
          processId: processId,
          transactionId: transactionId,
          recoveryId: recoveryId,
          iouData: iouData
        }, 'LEDGER_LINKING');
        
      } catch (cleanupError) {
        Logger.log(`[Phase4Integration] 錯誤清理失敗: ${cleanupError.toString()}`);
        result.cleanupError = cleanupError.toString();
      }
    }
    
    result.endTime = new Date();
    result.duration = result.endTime - startTime;
    
    return result;
  }

  /**
   * 處理檢測到的錯誤
   */
  async handleDetectedErrors(detectionResult, context) {
    const result = {
      success: true,
      handledErrors: [],
      unhandledErrors: []
    };
    
    for (const error of detectionResult.errors) {
      try {
        const handlingResult = await this.errorHandler.handleError(
          new Error(error.message),
          {
            ...context,
            errorType: error.type,
            errorDetails: error
          },
          'LINK_DETECTION'
        );
        
        if (handlingResult.success) {
          result.handledErrors.push({
            originalError: error,
            handlingResult: handlingResult
          });
        } else {
          result.unhandledErrors.push({
            originalError: error,
            handlingResult: handlingResult
          });
        }
        
      } catch (handlingError) {
        result.unhandledErrors.push({
          originalError: error,
          handlingError: handlingError.toString()
        });
      }
    }
    
    result.success = result.unhandledErrors.length === 0;
    
    return result;
  }

  /**
   * 處理支出真實化
   */
  async processExpenseRealization(iouData, context) {
    const result = {
      success: true,
      processedExpenses: [],
      failedExpenses: []
    };
    
    try {
      if (iouData.events && Array.isArray(iouData.events)) {
        for (const event of iouData.events) {
          if (event.Status === 'Settled') {
            const expenseData = this.convertIOUEventToExpense(event, iouData);
            
            const realizationResult = await this.expenseHandler.handleExpenseRealizationErrors(
              expenseData,
              {
                ...context,
                iouEventId: event.EventID
              }
            );
            
            if (realizationResult.summary.requiresManualReview) {
              result.failedExpenses.push({
                eventId: event.EventID,
                result: realizationResult
              });
            } else {
              result.processedExpenses.push({
                eventId: event.EventID,
                result: realizationResult
              });
            }
          }
        }
      }
      
      result.success = result.failedExpenses.length === 0;
      
    } catch (error) {
      result.success = false;
      result.error = error.toString();
    }
    
    return result;
  }

  /**
   * 輔助方法：提取 IOU 事件 ID
   */
  extractIOUEventIds(iouData) {
    if (iouData.events && Array.isArray(iouData.events)) {
      return iouData.events.map(event => event.EventID);
    }
    return [];
  }

  /**
   * 輔助方法：轉換 IOU 事件為支出資料
   */
  convertIOUEventToExpense(iouEvent, iouData) {
    const expenseData = {
      eventId: iouEvent.EventID,
      date: iouEvent.EventDate,
      description: iouEvent.Description || '代墊支出',
      totalAmount: iouEvent.TotalAmount,
      category: iouEvent.Category || '其他',
      participants: []
    };
    
    // 添加參與者資訊
    if (iouData.participants && Array.isArray(iouData.participants)) {
      const eventParticipants = iouData.participants.filter(p => p.EventID === iouEvent.EventID);
      expenseData.participants = eventParticipants.map(p => ({
        id: p.ParticipantID,
        name: p.Name,
        amount: p.Amount || 0
      }));
    }
    
    return expenseData;
  }

  /**
   * 輔助方法：生成處理 ID
   */
  generateProcessId() {
    return `P4PROC-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
  }
}

// =================================================================================================
// 測試和示例函數
// =================================================================================================

/**
 * 測試 Phase 4 錯誤處理框架
 */
async function testPhase4ErrorHandling() {
  Logger.log('=== Phase 4 錯誤處理框架測試開始 ===');
  
  const integration = new Phase4ErrorHandlingIntegration();
  
  // 模擬測試資料
  const testIOUData = {
    events: [
      {
        EventID: 'IOU-20241122-TEST01',
        EventDate: '2024-11-22',
        Description: '測試代墊支出',
        TotalAmount: 1000,
        Status: 'Settled',
        Category: '餐飲'
      }
    ],
    participants: [
      {
        EventID: 'IOU-20241122-TEST01',
        ParticipantID: 'P001',
        Name: '測試用戶A',
        Amount: 500
      },
      {
        EventID: 'IOU-20241122-TEST01',
        ParticipantID: 'P002',
        Name: '測試用戶B',
        Amount: 500
      }
    ],
    debts: [
      {
        EventID: 'IOU-20241122-TEST01',
        DebtID: 'DBT-001',
        DebtorID: 'P002',
        Amount: 500,
        Status: 'Settled'
      }
    ]
  };
  
  const testMainLedgerData = {
    records: []
  };
  
  try {
    // 執行完整的處理流程
    const result = await integration.processLedgerLinking(testIOUData, testMainLedgerData, {
      realizeExpenses: true,
      continueOnExpenseError: false,
      ignoreConsistencyErrors: false
    });
    
    Logger.log('測試結果:');
    Logger.log(`- 處理 ID: ${result.processId}`);
    Logger.log(`- 成功: ${result.success}`);
    Logger.log(`- 執行時間: ${result.duration}ms`);
    Logger.log(`- 步驟數: ${result.steps.length}`);
    
    if (result.error) {
      Logger.log(`- 錯誤: ${result.error}`);
    }
    
    // 顯示各步驟結果
    result.steps.forEach((step, index) => {
      Logger.log(`步驟 ${index + 1}: ${step.step} - ${step.success ? '成功' : '失敗'}`);
    });
    
  } catch (error) {
    Logger.log(`測試失敗: ${error.toString()}`);
  }
  
  Logger.log('=== Phase 4 錯誤處理框架測試結束 ===');
}

/**
 * 測試錯誤檢測功能
 */
async function testErrorDetection() {
  Logger.log('=== 錯誤檢測測試開始 ===');
  
  const detector = phase4LedgerLinkDetector;
  
  // 模擬有錯誤的資料
  const problematicIOUData = {
    events: [
      {
        EventID: 'INVALID-ID', // 無效的 ID 格式
        EventDate: '2024-11-22',
        TotalAmount: 1000,
        Status: 'Settled'
      }
    ],
    debts: [
      {
        EventID: 'INVALID-ID',
        DebtID: 'DBT-001',
        Amount: 1500, // 金額不匹配
        Status: 'Settled'
      }
    ]
  };
  
  const mainLedgerData = {
    records: [
      {
        ID: 'ML-001',
        IOUEventID: 'NONEXISTENT-ID', // 引用不存在的事件
        Amount: 1000
      }
    ]
  };
  
  try {
    const detectionResult = await detector.detectLinkErrors(
      problematicIOUData, 
      mainLedgerData
    );
    
    Logger.log('檢測結果:');
    Logger.log(`- 檢測 ID: ${detectionResult.detectionId}`);
    Logger.log(`- 錯誤數量: ${detectionResult.summary.errorsFound}`);
    Logger.log(`- 警告數量: ${detectionResult.summary.warningsFound}`);
    
    // 顯示發現的錯誤
    detectionResult.errors.forEach((error, index) => {
      Logger.log(`錯誤 ${index + 1}: ${error.type} - ${error.message}`);
    });
    
  } catch (error) {
    Logger.log(`檢測測試失敗: ${error.toString()}`);
  }
  
  Logger.log('=== 錯誤檢測測試結束 ===');
}

/**
 * 測試一致性檢查功能
 */
async function testConsistencyCheck() {
  Logger.log('=== 一致性檢查測試開始 ===');
  
  const checker = new Phase4ConsistencyChecker();
  
  try {
    const checkResult = await checker.performFullConsistencyCheck();
    
    Logger.log('一致性檢查結果:');
    Logger.log(`- 檢查 ID: ${checkResult.checkId}`);
    Logger.log(`- 總檢查項目: ${checkResult.summary.totalChecks}`);
    Logger.log(`- 通過檢查: ${checkResult.summary.passedChecks}`);
    Logger.log(`- 失敗檢查: ${checkResult.summary.failedChecks}`);
    Logger.log(`- 不一致問題: ${checkResult.summary.totalInconsistencies}`);
    
    // 顯示檢查詳情
    Object.entries(checkResult.checks).forEach(([checkName, checkResult]) => {
      Logger.log(`${checkName}: ${checkResult.passed ? '通過' : '失敗'}`);
      if (!checkResult.passed && checkResult.issues) {
        checkResult.issues.forEach(issue => {
          Logger.log(`  - ${issue.type}: ${issue.message || issue}`);
        });
      }
    });
    
  } catch (error) {
    Logger.log(`一致性檢查測試失敗: ${error.toString()}`);
  }
  
  Logger.log('=== 一致性檢查測試結束 ===');
}

/**
 * 手動觸發錯誤處理測試
 */
function manualErrorHandlingTest() {
  // 這個函數可以在 Google Apps Script 編輯器中手動執行
  testPhase4ErrorHandling();
}

/**
 * 手動觸發錯誤檢測測試
 */
function manualErrorDetectionTest() {
  // 這個函數可以在 Google Apps Script 編輯器中手動執行
  testErrorDetection();
}

/**
 * 手動觸發一致性檢查測試
 */
function manualConsistencyCheckTest() {
  // 這個函數可以在 Google Apps Script 編輯器中手動執行
  testConsistencyCheck();
}

// 全域整合實例
const phase4Integration = new Phase4ErrorHandlingIntegration();