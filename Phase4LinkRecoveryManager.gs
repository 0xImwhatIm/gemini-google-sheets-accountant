/**
 * 智慧記帳 GEM - Phase 4 關聯操作恢復管理器
 * 
 * 負責處理帳本關聯操作的中斷恢復和狀態持久化
 */

class Phase4LinkRecoveryManager {
  constructor() {
    this.recoveryStates = new Map();
    this.recoveryHistory = [];
    this.checkpointInterval = 30000; // 30秒檢查點間隔
    this.maxRecoveryAttempts = 3;
  }

  /**
   * 開始關聯操作並建立恢復點
   * @param {string} operationId - 操作 ID
   * @param {Object} operationData - 操作資料
   * @param {Object} context - 操作上下文
   * @returns {string} 恢復點 ID
   */
  async startLinkOperation(operationId, operationData, context = {}) {
    const recoveryId = this.generateRecoveryId();
    const startTime = new Date();
    
    const recoveryState = {
      recoveryId: recoveryId,
      operationId: operationId,
      startTime: startTime,
      status: 'ACTIVE',
      currentStep: 0,
      totalSteps: this.calculateTotalSteps(operationData),
      operationData: operationData,
      context: context,
      checkpoints: [],
      lastCheckpoint: null,
      recoveryAttempts: 0
    };
    
    // 儲存恢復狀態
    this.recoveryStates.set(recoveryId, recoveryState);
    
    // 建立初始檢查點
    await this.createCheckpoint(recoveryId, 'OPERATION_START', {
      message: '關聯操作開始',
      data: operationData
    });
    
    Logger.log(`[Phase4LinkRecoveryManager] 開始關聯操作: ${operationId} (恢復ID: ${recoveryId})`);
    
    return recoveryId;
  }

  /**
   * 建立檢查點
   * @param {string} recoveryId - 恢復 ID
   * @param {string} stepName - 步驟名稱
   * @param {Object} stepData - 步驟資料
   */
  async createCheckpoint(recoveryId, stepName, stepData = {}) {
    const recoveryState = this.recoveryStates.get(recoveryId);
    if (!recoveryState) {
      throw new Error(`恢復狀態不存在: ${recoveryId}`);
    }
    
    const checkpoint = {
      checkpointId: this.generateCheckpointId(),
      timestamp: new Date(),
      stepName: stepName,
      stepNumber: recoveryState.currentStep,
      stepData: stepData,
      systemState: await this.captureSystemState(recoveryState)
    };
    
    recoveryState.checkpoints.push(checkpoint);
    recoveryState.lastCheckpoint = checkpoint;
    recoveryState.currentStep++;
    
    // 持久化檢查點
    await this.persistCheckpoint(recoveryId, checkpoint);
    
    Logger.log(`[Phase4LinkRecoveryManager] 建立檢查點: ${stepName} (${recoveryId})`);
  }

  /**
   * 從中斷點恢復操作
   * @param {string} recoveryId - 恢復 ID
   * @returns {Object} 恢復結果
   */
  async recoverFromInterruption(recoveryId) {
    const recoveryState = this.recoveryStates.get(recoveryId);
    if (!recoveryState) {
      // 嘗試從持久化儲存載入
      const loadedState = await this.loadRecoveryState(recoveryId);
      if (!loadedState) {
        throw new Error(`恢復狀態不存在: ${recoveryId}`);
      }
      this.recoveryStates.set(recoveryId, loadedState);
      recoveryState = loadedState;
    }
    
    const recoveryResult = {
      recoveryId: recoveryId,
      startTime: new Date(),
      originalOperation: recoveryState.operationId,
      recoveryAttempt: recoveryState.recoveryAttempts + 1,
      success: false,
      steps: [],
      error: null
    };
    
    try {
      Logger.log(`[Phase4LinkRecoveryManager] 開始恢復操作: ${recoveryId} (第 ${recoveryResult.recoveryAttempt} 次嘗試)`);
      
      // 檢查恢復嘗試次數
      if (recoveryState.recoveryAttempts >= this.maxRecoveryAttempts) {
        throw new Error(`超過最大恢復嘗試次數 (${this.maxRecoveryAttempts})`);
      }
      
      // 更新恢復狀態
      recoveryState.status = 'RECOVERING';
      recoveryState.recoveryAttempts++;
      
      // 驗證系統狀態
      const stateValidation = await this.validateSystemState(recoveryState);
      if (!stateValidation.valid) {
        throw new Error(`系統狀態驗證失敗: ${stateValidation.reason}`);
      }
      
      // 從最後一個檢查點恢復
      const lastCheckpoint = recoveryState.lastCheckpoint;
      if (!lastCheckpoint) {
        throw new Error('沒有可用的檢查點');
      }
      
      // 恢復系統狀態到檢查點
      const stateRecovery = await this.restoreSystemState(lastCheckpoint.systemState);
      recoveryResult.steps.push({
        step: 'RESTORE_SYSTEM_STATE',
        success: stateRecovery.success,
        details: stateRecovery
      });
      
      if (!stateRecovery.success) {
        throw new Error(`系統狀態恢復失敗: ${stateRecovery.error}`);
      }
      
      // 從中斷點繼續執行
      const continuationResult = await this.continueFromCheckpoint(recoveryState, lastCheckpoint);
      recoveryResult.steps.push({
        step: 'CONTINUE_FROM_CHECKPOINT',
        success: continuationResult.success,
        details: continuationResult
      });
      
      if (continuationResult.success) {
        recoveryState.status = 'COMPLETED';
        recoveryResult.success = true;
        
        Logger.log(`[Phase4LinkRecoveryManager] 恢復成功: ${recoveryId}`);
      } else {
        throw new Error(`從檢查點繼續執行失敗: ${continuationResult.error}`);
      }
      
    } catch (error) {
      Logger.log(`[Phase4LinkRecoveryManager] 恢復失敗: ${recoveryId} - ${error.toString()}`);
      
      recoveryState.status = 'RECOVERY_FAILED';
      recoveryResult.error = error.toString();
      
      // 如果還有恢復嘗試機會，標記為待恢復
      if (recoveryState.recoveryAttempts < this.maxRecoveryAttempts) {
        recoveryState.status = 'PENDING_RECOVERY';
      }
    }
    
    recoveryResult.endTime = new Date();
    recoveryResult.duration = recoveryResult.endTime - recoveryResult.startTime;
    
    // 記錄恢復歷史
    this.recordRecoveryAttempt(recoveryResult);
    
    return recoveryResult;
  }

  /**
   * 完成關聯操作
   * @param {string} recoveryId - 恢復 ID
   * @param {Object} result - 操作結果
   */
  async completeOperation(recoveryId, result) {
    const recoveryState = this.recoveryStates.get(recoveryId);
    if (!recoveryState) {
      Logger.log(`[Phase4LinkRecoveryManager] 警告: 恢復狀態不存在: ${recoveryId}`);
      return;
    }
    
    // 建立完成檢查點
    await this.createCheckpoint(recoveryId, 'OPERATION_COMPLETE', {
      message: '關聯操作完成',
      result: result,
      success: result.success || false
    });
    
    // 更新狀態
    recoveryState.status = result.success ? 'COMPLETED' : 'FAILED';
    recoveryState.endTime = new Date();
    recoveryState.duration = recoveryState.endTime - recoveryState.startTime;
    recoveryState.finalResult = result;
    
    // 清理恢復狀態（保留一段時間用於查詢）
    setTimeout(() => {
      this.cleanupRecoveryState(recoveryId);
    }, 24 * 60 * 60 * 1000); // 24小時後清理
    
    Logger.log(`[Phase4LinkRecoveryManager] 操作完成: ${recoveryState.operationId} (${recoveryState.status})`);
  }

  /**
   * 捕獲系統狀態
   */
  async captureSystemState(recoveryState) {
    const systemState = {
      timestamp: new Date(),
      operationId: recoveryState.operationId,
      currentStep: recoveryState.currentStep,
      dataSnapshots: {}
    };
    
    try {
      // 捕獲相關工作表的狀態
      const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
      
      // IOU Events 狀態
      if (recoveryState.operationData.iouEventIds) {
        systemState.dataSnapshots.iouEvents = await this.captureIOUEventsState(
          recoveryState.operationData.iouEventIds
        );
      }
      
      // IOU Debts 狀態
      if (recoveryState.operationData.debtIds) {
        systemState.dataSnapshots.iouDebts = await this.captureIOUDebtsState(
          recoveryState.operationData.debtIds
        );
      }
      
      // Main Ledger 狀態
      if (recoveryState.operationData.mainLedgerIds) {
        systemState.dataSnapshots.mainLedger = await this.captureMainLedgerState(
          recoveryState.operationData.mainLedgerIds
        );
      }
      
    } catch (error) {
      Logger.log(`[Phase4LinkRecoveryManager] 捕獲系統狀態失敗: ${error.toString()}`);
      systemState.error = error.toString();
    }
    
    return systemState;
  }

  /**
   * 恢復系統狀態
   */
  async restoreSystemState(systemState) {
    const result = {
      success: true,
      restoredItems: [],
      errors: []
    };
    
    try {
      if (systemState.dataSnapshots) {
        // 恢復 IOU Events
        if (systemState.dataSnapshots.iouEvents) {
          const iouEventsResult = await this.restoreIOUEventsState(
            systemState.dataSnapshots.iouEvents
          );
          result.restoredItems.push('iouEvents');
          if (!iouEventsResult.success) {
            result.errors.push(`IOU Events 恢復失敗: ${iouEventsResult.error}`);
          }
        }
        
        // 恢復 IOU Debts
        if (systemState.dataSnapshots.iouDebts) {
          const iouDebtsResult = await this.restoreIOUDebtsState(
            systemState.dataSnapshots.iouDebts
          );
          result.restoredItems.push('iouDebts');
          if (!iouDebtsResult.success) {
            result.errors.push(`IOU Debts 恢復失敗: ${iouDebtsResult.error}`);
          }
        }
        
        // 恢復 Main Ledger
        if (systemState.dataSnapshots.mainLedger) {
          const mainLedgerResult = await this.restoreMainLedgerState(
            systemState.dataSnapshots.mainLedger
          );
          result.restoredItems.push('mainLedger');
          if (!mainLedgerResult.success) {
            result.errors.push(`Main Ledger 恢復失敗: ${mainLedgerResult.error}`);
          }
        }
      }
      
      if (result.errors.length > 0) {
        result.success = false;
        result.error = result.errors.join('; ');
      }
      
    } catch (error) {
      result.success = false;
      result.error = error.toString();
    }
    
    return result;
  }

  /**
   * 從檢查點繼續執行
   */
  async continueFromCheckpoint(recoveryState, checkpoint) {
    const result = {
      success: false,
      message: '',
      continuedSteps: []
    };
    
    try {
      const stepName = checkpoint.stepName;
      const stepNumber = checkpoint.stepNumber;
      
      Logger.log(`[Phase4LinkRecoveryManager] 從檢查點繼續: ${stepName} (步驟 ${stepNumber})`);
      
      // 根據檢查點類型決定繼續執行的邏輯
      switch (stepName) {
        case 'OPERATION_START':
          result = await this.continueFromStart(recoveryState);
          break;
          
        case 'IOU_EVENTS_PROCESSED':
          result = await this.continueFromIOUEventsProcessed(recoveryState);
          break;
          
        case 'DEBTS_LINKED':
          result = await this.continueFromDebtsLinked(recoveryState);
          break;
          
        case 'MAIN_LEDGER_UPDATED':
          result = await this.continueFromMainLedgerUpdated(recoveryState);
          break;
          
        default:
          result = await this.continueFromGenericStep(recoveryState, checkpoint);
      }
      
    } catch (error) {
      result.success = false;
      result.error = error.toString();
    }
    
    return result;
  }

  /**
   * 驗證系統狀態
   */
  async validateSystemState(recoveryState) {
    const validation = {
      valid: true,
      issues: []
    };
    
    try {
      // 檢查工作表是否可存取
      const ss = SpreadsheetApp.openById(MAIN_LEDGER_ID);
      
      const requiredSheets = [IOU_EVENTS_SHEET_NAME, IOU_DEBTS_SHEET_NAME, SHEET_NAME];
      for (const sheetName of requiredSheets) {
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) {
          validation.valid = false;
          validation.issues.push(`必要工作表不存在: ${sheetName}`);
        }
      }
      
      // 檢查相關記錄是否仍然存在
      if (recoveryState.operationData.iouEventIds) {
        const missingEvents = await this.checkMissingIOUEvents(
          recoveryState.operationData.iouEventIds
        );
        if (missingEvents.length > 0) {
          validation.valid = false;
          validation.issues.push(`IOU 事件記錄遺失: ${missingEvents.join(', ')}`);
        }
      }
      
    } catch (error) {
      validation.valid = false;
      validation.issues.push(`系統狀態驗證錯誤: ${error.toString()}`);
    }
    
    if (!validation.valid) {
      validation.reason = validation.issues.join('; ');
    }
    
    return validation;
  }

  /**
   * 持久化檢查點
   */
  async persistCheckpoint(recoveryId, checkpoint) {
    try {
      // 將檢查點資訊儲存到 Google Sheets 或 Properties Service
      const checkpointData = {
        recoveryId: recoveryId,
        checkpointId: checkpoint.checkpointId,
        timestamp: checkpoint.timestamp,
        stepName: checkpoint.stepName,
        stepNumber: checkpoint.stepNumber,
        stepData: JSON.stringify(checkpoint.stepData),
        systemState: JSON.stringify(checkpoint.systemState)
      };
      
      // 使用 Properties Service 儲存（適合小量資料）
      const key = `checkpoint_${recoveryId}_${checkpoint.checkpointId}`;
      PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(checkpointData));
      
    } catch (error) {
      Logger.log(`[Phase4LinkRecoveryManager] 持久化檢查點失敗: ${error.toString()}`);
    }
  }

  /**
   * 載入恢復狀態
   */
  async loadRecoveryState(recoveryId) {
    try {
      // 從 Properties Service 載入恢復狀態
      const key = `recovery_state_${recoveryId}`;
      const stateData = PropertiesService.getScriptProperties().getProperty(key);
      
      if (stateData) {
        return JSON.parse(stateData);
      }
      
    } catch (error) {
      Logger.log(`[Phase4LinkRecoveryManager] 載入恢復狀態失敗: ${error.toString()}`);
    }
    
    return null;
  }

  /**
   * 清理恢復狀態
   */
  cleanupRecoveryState(recoveryId) {
    try {
      // 從記憶體中移除
      this.recoveryStates.delete(recoveryId);
      
      // 從 Properties Service 中清理
      const properties = PropertiesService.getScriptProperties();
      const allProperties = properties.getProperties();
      
      Object.keys(allProperties).forEach(key => {
        if (key.includes(recoveryId)) {
          properties.deleteProperty(key);
        }
      });
      
      Logger.log(`[Phase4LinkRecoveryManager] 清理恢復狀態: ${recoveryId}`);
      
    } catch (error) {
      Logger.log(`[Phase4LinkRecoveryManager] 清理恢復狀態失敗: ${error.toString()}`);
    }
  }

  /**
   * 輔助方法
   */
  generateRecoveryId() {
    return `P4LR-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
  }

  generateCheckpointId() {
    return `CP-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  }

  calculateTotalSteps(operationData) {
    // 根據操作資料估算總步驟數
    let steps = 1; // 基本步驟
    
    if (operationData.iouEventIds) {
      steps += operationData.iouEventIds.length;
    }
    
    if (operationData.debtIds) {
      steps += operationData.debtIds.length;
    }
    
    return steps;
  }

  recordRecoveryAttempt(recoveryResult) {
    this.recoveryHistory.push({
      recoveryId: recoveryResult.recoveryId,
      timestamp: recoveryResult.startTime,
      attempt: recoveryResult.recoveryAttempt,
      success: recoveryResult.success,
      duration: recoveryResult.duration,
      error: recoveryResult.error
    });
    
    // 限制歷史記錄數量
    if (this.recoveryHistory.length > 100) {
      this.recoveryHistory = this.recoveryHistory.slice(-50);
    }
  }

  /**
   * 獲取恢復統計
   */
  getRecoveryStats(timeRange = 24 * 60 * 60 * 1000) { // 24小時
    const cutoffTime = new Date(Date.now() - timeRange);
    const recentRecoveries = this.recoveryHistory.filter(r => 
      r.timestamp > cutoffTime
    );
    
    return {
      totalRecoveries: recentRecoveries.length,
      successfulRecoveries: recentRecoveries.filter(r => r.success).length,
      failedRecoveries: recentRecoveries.filter(r => !r.success).length,
      averageDuration: recentRecoveries.length > 0 
        ? recentRecoveries.reduce((sum, r) => sum + (r.duration || 0), 0) / recentRecoveries.length 
        : 0,
      activeRecoveries: Array.from(this.recoveryStates.values()).filter(s => 
        ['ACTIVE', 'RECOVERING', 'PENDING_RECOVERY'].includes(s.status)
      ).length
    };
  }

  /**
   * 獲取活動中的恢復操作
   */
  getActiveRecoveries() {
    return Array.from(this.recoveryStates.values()).filter(state => 
      ['ACTIVE', 'RECOVERING', 'PENDING_RECOVERY'].includes(state.status)
    );
  }

  // 以下是需要根據具體業務邏輯實作的方法
  async captureIOUEventsState(eventIds) { /* 實作細節 */ }
  async captureIOUDebtsState(debtIds) { /* 實作細節 */ }
  async captureMainLedgerState(recordIds) { /* 實作細節 */ }
  async restoreIOUEventsState(snapshot) { /* 實作細節 */ }
  async restoreIOUDebtsState(snapshot) { /* 實作細節 */ }
  async restoreMainLedgerState(snapshot) { /* 實作細節 */ }
  async continueFromStart(recoveryState) { /* 實作細節 */ }
  async continueFromIOUEventsProcessed(recoveryState) { /* 實作細節 */ }
  async continueFromDebtsLinked(recoveryState) { /* 實作細節 */ }
  async continueFromMainLedgerUpdated(recoveryState) { /* 實作細節 */ }
  async continueFromGenericStep(recoveryState, checkpoint) { /* 實作細節 */ }
  async checkMissingIOUEvents(eventIds) { /* 實作細節 */ }
}

// 全域實例
const phase4LinkRecoveryManager = new Phase4LinkRecoveryManager();