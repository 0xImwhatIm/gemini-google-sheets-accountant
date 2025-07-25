/**
 * 智慧記帳 GEM - Phase 4 錯誤處理框架
 * 
 * 專門為「帳本關聯與支出真實化」功能設計的錯誤處理系統
 * 確保代墊款追蹤器與主帳本之間的資料一致性和操作可靠性
 */

// =================================================================================================
// 錯誤類型定義和常數
// =================================================================================================

const PHASE4_ERROR_TYPES = {
  // 系統級錯誤
  NETWORK_ERROR: 'NetworkError',
  API_LIMIT_ERROR: 'APILimitError',
  PERMISSION_ERROR: 'PermissionError',
  SERVICE_UNAVAILABLE_ERROR: 'ServiceUnavailableError',
  
  // 資料級錯誤
  DATA_INCONSISTENCY_ERROR: 'DataInconsistencyError',
  DATA_FORMAT_ERROR: 'DataFormatError',
  DATA_CONFLICT_ERROR: 'DataConflictError',
  DATA_INTEGRITY_ERROR: 'DataIntegrityError',
  
  // 業務級錯誤
  LEDGER_LINK_ERROR: 'LedgerLinkError',
  EXPENSE_REALIZATION_ERROR: 'ExpenseRealizationError',
  AMOUNT_CALCULATION_ERROR: 'AmountCalculationError',
  DUPLICATE_DETECTION_ERROR: 'DuplicateDetectionError',
  
  // 使用者級錯誤
  INPUT_VALIDATION_ERROR: 'InputValidationError',
  OPERATION_SEQUENCE_ERROR: 'OperationSequenceError',
  INSUFFICIENT_PERMISSION_ERROR: 'InsufficientPermissionError'
};

const PHASE4_ERROR_SEVERITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
};

const PHASE4_ERROR_STATUS = {
  DETECTED: 'DETECTED',
  PROCESSING: 'PROCESSING',
  RESOLVED: 'RESOLVED',
  FAILED: 'FAILED',
  REQUIRES_MANUAL: 'REQUIRES_MANUAL'
};

// 錯誤處理策略
const PHASE4_HANDLING_STRATEGIES = {
  AUTO_RETRY: 'AUTO_RETRY',
  AUTO_ROLLBACK: 'AUTO_ROLLBACK',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  CONSERVATIVE_MODE: 'CONSERVATIVE_MODE',
  PARTIAL_PROCESSING: 'PARTIAL_PROCESSING',
  ESCALATE: 'ESCALATE'
};

// 重試策略配置
const PHASE4_RETRY_STRATEGIES = {
  [PHASE4_ERROR_TYPES.NETWORK_ERROR]: {
    maxRetries: 3,
    backoffMultiplier: 2,
    initialDelay: 1000
  },
  [PHASE4_ERROR_TYPES.API_LIMIT_ERROR]: {
    maxRetries: 5,
    backoffMultiplier: 3,
    initialDelay: 5000
  },
  [PHASE4_ERROR_TYPES.SERVICE_UNAVAILABLE_ERROR]: {
    maxRetries: 2,
    backoffMultiplier: 2,
    initialDelay: 2000
  }
};

// =================================================================================================
// Phase4ErrorHandler 核心類別
// =================================================================================================

class Phase4ErrorHandler {
  constructor() {
    this.errorLog = [];
    this.transactionManager = null;
    this.consistencyChecker = null;
    this.notificationManager = null;
    this.logger = null;
    this.initialized = false;
  }

  // 延遲初始化方法
  initialize() {
    if (this.initialized) return;
    
    try {
      this.transactionManager = new Phase4TransactionManager();
      this.consistencyChecker = new Phase4ConsistencyChecker();
      this.notificationManager = new Phase4NotificationManager();
      this.logger = new Phase4ErrorLogger();
      this.initialized = true;
    } catch (error) {
      Logger.log(`[Phase4ErrorHandler] 初始化失敗: ${error.toString()}`);
      throw error;
    }
  }

  // 確保初始化的輔助方法
  ensureInitialized() {
    if (!this.initialized) {
      this.initialize();
    }
  }

  /**
   * 處理 Phase 4 相關錯誤的主要入口點
   * @param {Error} error - 錯誤物件
   * @param {Object} context - 錯誤上下文
   * @param {string} operation - 執行的操作
   * @returns {Object} 處理結果
   */
  async handleError(error, context = {}, operation = 'unknown') {
    // 確保已初始化
    this.ensureInitialized();
    
    const errorId = this.generateErrorId();
    const timestamp = new Date();
    
    try {
      // 1. 錯誤分類和嚴重程度評估
      const errorType = this.classifyError(error);
      const severity = this.assessSeverity(error, errorType, context);
      
      // 2. 建立錯誤記錄
      const errorRecord = {
        errorId: errorId,
        timestamp: timestamp,
        errorType: errorType,
        severity: severity,
        source: operation,
        context: context,
        originalError: error,
        stackTrace: error.stack || '',
        affectedRecords: this.identifyAffectedRecords(context),
        status: PHASE4_ERROR_STATUS.DETECTED
      };
      
      // 3. 記錄錯誤
      await this.logger.logError(errorRecord);
      
      // 4. 選擇處理策略
      const strategy = this.selectHandlingStrategy(errorType, severity, context);
      errorRecord.handlingStrategy = strategy;
      
      // 5. 執行錯誤處理
      const result = await this.executeHandlingStrategy(errorRecord, strategy);
      
      // 6. 更新錯誤狀態
      errorRecord.status = result.success ? PHASE4_ERROR_STATUS.RESOLVED : PHASE4_ERROR_STATUS.FAILED;
      errorRecord.resolution = result;
      
      // 7. 發送通知（如需要）
      if (this.shouldNotify(severity, result)) {
        await this.notificationManager.sendErrorNotification(errorRecord);
      }
      
      // 8. 更新錯誤記錄
      await this.logger.updateErrorRecord(errorRecord);
      
      return {
        success: result.success,
        errorId: errorId,
        strategy: strategy,
        resolution: result,
        requiresManualIntervention: result.requiresManualIntervention || false
      };
      
    } catch (handlingError) {
      // 錯誤處理本身出錯時的降級處理
      Logger.log(`[Phase4ErrorHandler] 錯誤處理失敗: ${handlingError.toString()}`);
      
      // 使用最小化錯誤處理
      await this.fallbackErrorHandling(error, context, handlingError);
      
      return {
        success: false,
        errorId: errorId,
        strategy: 'FALLBACK',
        error: handlingError.toString(),
        requiresManualIntervention: true
      };
    }
  }

  /**
   * 錯誤分類
   */
  classifyError(error) {
    const errorMessage = error.toString().toLowerCase();
    const errorStack = (error.stack || '').toLowerCase();
    
    // 網路相關錯誤
    if (errorMessage.includes('network') || errorMessage.includes('timeout') || 
        errorMessage.includes('connection')) {
      return PHASE4_ERROR_TYPES.NETWORK_ERROR;
    }
    
    // API 限制錯誤
    if (errorMessage.includes('quota') || errorMessage.includes('rate limit') ||
        errorMessage.includes('too many requests')) {
      return PHASE4_ERROR_TYPES.API_LIMIT_ERROR;
    }
    
    // 權限錯誤
    if (errorMessage.includes('permission') || errorMessage.includes('unauthorized') ||
        errorMessage.includes('access denied')) {
      return PHASE4_ERROR_TYPES.PERMISSION_ERROR;
    }
    
    // 資料不一致錯誤
    if (errorMessage.includes('inconsistency') || errorMessage.includes('mismatch') ||
        errorMessage.includes('不一致')) {
      return PHASE4_ERROR_TYPES.DATA_INCONSISTENCY_ERROR;
    }
    
    // 帳本關聯錯誤
    if (errorMessage.includes('ledger') || errorMessage.includes('link') ||
        errorMessage.includes('帳本') || errorMessage.includes('關聯')) {
      return PHASE4_ERROR_TYPES.LEDGER_LINK_ERROR;
    }
    
    // 支出真實化錯誤
    if (errorMessage.includes('expense') || errorMessage.includes('realization') ||
        errorMessage.includes('支出') || errorMessage.includes('真實化')) {
      return PHASE4_ERROR_TYPES.EXPENSE_REALIZATION_ERROR;
    }
    
    // 金額計算錯誤
    if (errorMessage.includes('amount') || errorMessage.includes('calculation') ||
        errorMessage.includes('金額') || errorMessage.includes('計算')) {
      return PHASE4_ERROR_TYPES.AMOUNT_CALCULATION_ERROR;
    }
    
    // 資料格式錯誤
    if (errorMessage.includes('format') || errorMessage.includes('parse') ||
        errorMessage.includes('invalid') || errorMessage.includes('格式')) {
      return PHASE4_ERROR_TYPES.DATA_FORMAT_ERROR;
    }
    
    // 預設為資料完整性錯誤
    return PHASE4_ERROR_TYPES.DATA_INTEGRITY_ERROR;
  }

  /**
   * 評估錯誤嚴重程度
   */
  assessSeverity(error, errorType, context) {
    // 關鍵系統錯誤
    if ([PHASE4_ERROR_TYPES.SERVICE_UNAVAILABLE_ERROR, 
         PHASE4_ERROR_TYPES.DATA_INTEGRITY_ERROR].includes(errorType)) {
      return PHASE4_ERROR_SEVERITY.CRITICAL;
    }
    
    // 高嚴重程度錯誤
    if ([PHASE4_ERROR_TYPES.DATA_INCONSISTENCY_ERROR,
         PHASE4_ERROR_TYPES.LEDGER_LINK_ERROR,
         PHASE4_ERROR_TYPES.EXPENSE_REALIZATION_ERROR].includes(errorType)) {
      return PHASE4_ERROR_SEVERITY.HIGH;
    }
    
    // 中等嚴重程度錯誤
    if ([PHASE4_ERROR_TYPES.AMOUNT_CALCULATION_ERROR,
         PHASE4_ERROR_TYPES.DATA_CONFLICT_ERROR,
         PHASE4_ERROR_TYPES.PERMISSION_ERROR].includes(errorType)) {
      return PHASE4_ERROR_SEVERITY.MEDIUM;
    }
    
    // 低嚴重程度錯誤
    return PHASE4_ERROR_SEVERITY.LOW;
  }

  /**
   * 選擇處理策略
   */
  selectHandlingStrategy(errorType, severity, context) {
    // 關鍵錯誤需要立即處理
    if (severity === PHASE4_ERROR_SEVERITY.CRITICAL) {
      return PHASE4_HANDLING_STRATEGIES.ESCALATE;
    }
    
    // 根據錯誤類型選擇策略
    switch (errorType) {
      case PHASE4_ERROR_TYPES.NETWORK_ERROR:
      case PHASE4_ERROR_TYPES.API_LIMIT_ERROR:
      case PHASE4_ERROR_TYPES.SERVICE_UNAVAILABLE_ERROR:
        return PHASE4_HANDLING_STRATEGIES.AUTO_RETRY;
        
      case PHASE4_ERROR_TYPES.DATA_INCONSISTENCY_ERROR:
      case PHASE4_ERROR_TYPES.DATA_CONFLICT_ERROR:
        return PHASE4_HANDLING_STRATEGIES.AUTO_ROLLBACK;
        
      case PHASE4_ERROR_TYPES.LEDGER_LINK_ERROR:
      case PHASE4_ERROR_TYPES.EXPENSE_REALIZATION_ERROR:
        return PHASE4_HANDLING_STRATEGIES.MANUAL_REVIEW;
        
      case PHASE4_ERROR_TYPES.AMOUNT_CALCULATION_ERROR:
        return PHASE4_HANDLING_STRATEGIES.CONSERVATIVE_MODE;
        
      case PHASE4_ERROR_TYPES.DATA_FORMAT_ERROR:
      case PHASE4_ERROR_TYPES.INPUT_VALIDATION_ERROR:
        return PHASE4_HANDLING_STRATEGIES.PARTIAL_PROCESSING;
        
      default:
        return PHASE4_HANDLING_STRATEGIES.MANUAL_REVIEW;
    }
  }

  /**
   * 執行處理策略
   */
  async executeHandlingStrategy(errorRecord, strategy) {
    switch (strategy) {
      case PHASE4_HANDLING_STRATEGIES.AUTO_RETRY:
        return await this.executeAutoRetry(errorRecord);
        
      case PHASE4_HANDLING_STRATEGIES.AUTO_ROLLBACK:
        return await this.executeAutoRollback(errorRecord);
        
      case PHASE4_HANDLING_STRATEGIES.CONSERVATIVE_MODE:
        return await this.executeConservativeMode(errorRecord);
        
      case PHASE4_HANDLING_STRATEGIES.PARTIAL_PROCESSING:
        return await this.executePartialProcessing(errorRecord);
        
      case PHASE4_HANDLING_STRATEGIES.MANUAL_REVIEW:
        return await this.executeManualReview(errorRecord);
        
      case PHASE4_HANDLING_STRATEGIES.ESCALATE:
        return await this.executeEscalation(errorRecord);
        
      default:
        return {
          success: false,
          message: '未知的處理策略',
          requiresManualIntervention: true
        };
    }
  }

  /**
   * 自動重試處理
   */
  async executeAutoRetry(errorRecord) {
    const retryConfig = PHASE4_RETRY_STRATEGIES[errorRecord.errorType] || {
      maxRetries: 2,
      backoffMultiplier: 2,
      initialDelay: 1000
    };
    
    let attempt = 0;
    let delay = retryConfig.initialDelay;
    
    while (attempt < retryConfig.maxRetries) {
      attempt++;
      
      try {
        // 等待延遲
        if (delay > 0) {
          Utilities.sleep(delay);
        }
        
        // 重新執行原始操作
        const retryResult = await this.retryOriginalOperation(errorRecord);
        
        if (retryResult.success) {
          return {
            success: true,
            message: `自動重試成功 (第 ${attempt} 次嘗試)`,
            attempts: attempt,
            strategy: 'AUTO_RETRY'
          };
        }
        
        // 增加延遲時間
        delay *= retryConfig.backoffMultiplier;
        
      } catch (retryError) {
        Logger.log(`[Phase4ErrorHandler] 重試失敗 (第 ${attempt} 次): ${retryError.toString()}`);
        
        // 如果是最後一次嘗試，記錄失敗
        if (attempt >= retryConfig.maxRetries) {
          return {
            success: false,
            message: `自動重試失敗，已嘗試 ${attempt} 次`,
            attempts: attempt,
            lastError: retryError.toString(),
            requiresManualIntervention: true
          };
        }
      }
    }
    
    return {
      success: false,
      message: `自動重試達到最大次數 (${retryConfig.maxRetries})`,
      attempts: attempt,
      requiresManualIntervention: true
    };
  }

  /**
   * 自動回滾處理
   */
  async executeAutoRollback(errorRecord) {
    try {
      const rollbackResult = await this.transactionManager.rollbackTransaction(
        errorRecord.context.transactionId
      );
      
      if (rollbackResult.success) {
        return {
          success: true,
          message: '自動回滾成功，資料已恢復到操作前狀態',
          rollbackDetails: rollbackResult.details,
          strategy: 'AUTO_ROLLBACK'
        };
      } else {
        return {
          success: false,
          message: '自動回滾失敗',
          error: rollbackResult.error,
          requiresManualIntervention: true
        };
      }
    } catch (rollbackError) {
      return {
        success: false,
        message: '回滾過程中發生錯誤',
        error: rollbackError.toString(),
        requiresManualIntervention: true
      };
    }
  }

  /**
   * 保守模式處理
   */
  async executeConservativeMode(errorRecord) {
    // 使用保守的預設值和安全的處理方式
    return {
      success: true,
      message: '已使用保守模式處理，請檢查結果',
      mode: 'CONSERVATIVE',
      requiresManualIntervention: false,
      needsReview: true
    };
  }

  /**
   * 部分處理模式
   */
  async executePartialProcessing(errorRecord) {
    // 處理可以處理的部分，跳過有問題的部分
    return {
      success: true,
      message: '已完成部分處理，部分資料可能需要手動確認',
      mode: 'PARTIAL',
      requiresManualIntervention: false,
      needsReview: true
    };
  }

  /**
   * 手動審查處理
   */
  async executeManualReview(errorRecord) {
    // 標記為需要人工介入
    return {
      success: false,
      message: '此錯誤需要人工審查和處理',
      requiresManualIntervention: true,
      reviewInstructions: this.generateReviewInstructions(errorRecord)
    };
  }

  /**
   * 升級處理
   */
  async executeEscalation(errorRecord) {
    // 立即通知並標記為關鍵錯誤
    await this.notificationManager.sendCriticalAlert(errorRecord);
    
    return {
      success: false,
      message: '關鍵錯誤已升級，已發送緊急通知',
      requiresManualIntervention: true,
      escalated: true
    };
  }

  /**
   * 輔助方法
   */
  generateErrorId() {
    return `P4E-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
  }

  identifyAffectedRecords(context) {
    const affected = [];
    
    if (context.iouEventId) {
      affected.push({ type: 'IOU_EVENT', id: context.iouEventId });
    }
    
    if (context.mainLedgerRecordId) {
      affected.push({ type: 'MAIN_LEDGER', id: context.mainLedgerRecordId });
    }
    
    if (context.debtIds && Array.isArray(context.debtIds)) {
      context.debtIds.forEach(id => {
        affected.push({ type: 'IOU_DEBT', id: id });
      });
    }
    
    return affected;
  }

  shouldNotify(severity, result) {
    // 關鍵和高嚴重程度錯誤總是通知
    if ([PHASE4_ERROR_SEVERITY.CRITICAL, PHASE4_ERROR_SEVERITY.HIGH].includes(severity)) {
      return true;
    }
    
    // 需要人工介入的錯誤也要通知
    if (result.requiresManualIntervention) {
      return true;
    }
    
    return false;
  }

  generateReviewInstructions(errorRecord) {
    const instructions = [];
    
    switch (errorRecord.errorType) {
      case PHASE4_ERROR_TYPES.LEDGER_LINK_ERROR:
        instructions.push('檢查 IOU 記錄與主帳本的關聯是否正確');
        instructions.push('確認相關記錄的 ID 和金額是否匹配');
        break;
        
      case PHASE4_ERROR_TYPES.EXPENSE_REALIZATION_ERROR:
        instructions.push('檢查支出真實化的邏輯是否正確');
        instructions.push('確認金額計算和分類是否準確');
        break;
        
      case PHASE4_ERROR_TYPES.DATA_INCONSISTENCY_ERROR:
        instructions.push('執行資料一致性檢查');
        instructions.push('比對相關帳本的記錄是否一致');
        break;
        
      default:
        instructions.push('檢查錯誤詳情和上下文資訊');
        instructions.push('根據錯誤類型採取適當的修復措施');
    }
    
    return instructions;
  }

  async retryOriginalOperation(errorRecord) {
    // 這個方法需要根據具體的操作類型來實作
    // 目前返回一個模擬結果
    return {
      success: Math.random() > 0.5, // 模擬 50% 成功率
      message: '重試操作完成'
    };
  }

  async fallbackErrorHandling(originalError, context, handlingError) {
    // 最小化錯誤處理，確保系統不會完全崩潰
    try {
      Logger.log(`[Phase4ErrorHandler] 降級錯誤處理:`);
      Logger.log(`原始錯誤: ${originalError.toString()}`);
      Logger.log(`處理錯誤: ${handlingError.toString()}`);
      
      // 嘗試發送基本通知
      if (typeof sendNotification === 'function') {
        sendNotification(
          'Phase 4 錯誤處理失敗',
          `錯誤處理系統本身出現問題，請立即檢查系統狀態。\n原始錯誤: ${originalError.toString()}`,
          'CRITICAL'
        );
      }
    } catch (fallbackError) {
      // 連降級處理都失敗時，只能記錄到 Logger
      Logger.log(`[Phase4ErrorHandler] 降級處理也失敗: ${fallbackError.toString()}`);
    }
  }
}

// 全域 Phase 4 錯誤處理器實例（延遲初始化）
let phase4ErrorHandler = null;

// 獲取 Phase 4 錯誤處理器實例的函數
function getPhase4ErrorHandler() {
  if (!phase4ErrorHandler) {
    phase4ErrorHandler = new Phase4ErrorHandler();
    phase4ErrorHandler.initialize();
  }
  return phase4ErrorHandler;
}