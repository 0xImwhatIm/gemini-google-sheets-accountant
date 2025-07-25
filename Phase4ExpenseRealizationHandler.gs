/**
 * 智慧記帳 GEM - Phase 4 支出真實化錯誤處理器
 * 
 * 專門處理代墊支出記錄到主帳本時的各種錯誤情況
 */

class Phase4ExpenseRealizationHandler {
  constructor() {
    this.realizationRules = this.loadRealizationRules();
    this.realizationHistory = [];
    this.defaultCategories = this.loadDefaultCategories();
  }

  /**
   * 處理支出真實化錯誤的主要入口點
   * @param {Object} expenseData - 支出資料
   * @param {Object} context - 處理上下文
   * @returns {Object} 處理結果
   */
  async handleExpenseRealizationErrors(expenseData, context = {}) {
    const handlerId = this.generateHandlerId();
    const startTime = new Date();
    
    const result = {
      handlerId: handlerId,
      startTime: startTime,
      context: context,
      originalData: expenseData,
      processedData: null,
      errors: [],
      warnings: [],
      actions: [],
      summary: {
        totalIssues: 0,
        resolvedIssues: 0,
        requiresManualReview: false
      }
    };
    
    try {
      Logger.log(`[Phase4ExpenseRealizationHandler] 開始支出真實化錯誤處理: ${handlerId}`);
      
      // 1. 處理支出記錄寫入失敗
      const writeFailureResult = await this.handleWriteFailures(expenseData, context);
      this.mergeHandlingResult(result, writeFailureResult);
      
      // 2. 處理金額計算錯誤
      const calculationResult = await this.handleCalculationErrors(expenseData, context);
      this.mergeHandlingResult(result, calculationResult);
      
      // 3. 處理分類錯誤和預設值設定
      const categoryResult = await this.handleCategoryErrors(expenseData, context);
      this.mergeHandlingResult(result, categoryResult);
      
      // 4. 處理重複檢測錯誤
      const duplicateResult = await this.handleDuplicateDetectionErrors(expenseData, context);
      this.mergeHandlingResult(result, duplicateResult);
      
      // 5. 處理資料格式錯誤
      const formatResult = await this.handleFormatErrors(expenseData, context);
      this.mergeHandlingResult(result, formatResult);
      
      // 6. 處理參與者資訊錯誤
      const participantResult = await this.handleParticipantErrors(expenseData, context);
      this.mergeHandlingResult(result, participantResult);
      
      // 統計結果
      result.summary.totalIssues = result.errors.length + result.warnings.length;
      result.summary.resolvedIssues = result.actions.filter(a => a.success).length;
      result.summary.requiresManualReview = result.errors.some(e => e.requiresManualReview);
      
      result.endTime = new Date();
      result.duration = result.endTime - startTime;
      
      // 記錄處理歷史
      this.recordRealizationHandling(result);
      
      Logger.log(`[Phase4ExpenseRealizationHandler] 處理完成: 解決 ${result.summary.resolvedIssues}/${result.summary.totalIssues} 個問題`);
      
      return result;
      
    } catch (error) {
      Logger.log(`[Phase4ExpenseRealizationHandler] 處理過程發生錯誤: ${error.toString()}`);
      
      result.error = error.toString();
      result.endTime = new Date();
      
      return result;
    }
  }

  /**
   * 處理支出記錄寫入失敗
   */
  async handleWriteFailures(expenseData, context) {
    const result = {
      handlerName: '支出記錄寫入失敗處理',
      errors: [],
      warnings: [],
      actions: []
    };
    
    try {
      // 檢查是否有寫入失敗的記錄
      if (context.writeFailures && Array.isArray(context.writeFailures)) {
        for (const failure of context.writeFailures) {
          const failureType = this.classifyWriteFailure(failure);
          
          switch (failureType) {
            case 'PERMISSION_ERROR':
              result.actions.push(await this.handlePermissionError(failure, expenseData));
              break;
              
            case 'QUOTA_EXCEEDED':
              result.actions.push(await this.handleQuotaError(failure, expenseData));
              break;
              
            case 'NETWORK_ERROR':
              result.actions.push(await this.handleNetworkError(failure, expenseData));
              break;
              
            case 'DATA_VALIDATION_ERROR':
              result.actions.push(await this.handleDataValidationError(failure, expenseData));
              break;
              
            default:
              result.errors.push({
                type: 'UNKNOWN_WRITE_FAILURE',
                severity: 'HIGH',
                message: '未知的寫入失敗類型',
                details: failure,
                requiresManualReview: true
              });
          }
        }
      }
      
      // 檢查 IOU 記錄狀態是否保持不變
      if (context.iouRecordStatus) {
        const statusCheck = await this.verifyIOURecordStatus(expenseData, context);
        if (!statusCheck.consistent) {
          result.errors.push({
            type: 'IOU_STATUS_INCONSISTENCY',
            severity: 'HIGH',
            message: '支出寫入失敗後 IOU 記錄狀態發生意外變化',
            details: statusCheck,
            requiresManualReview: true
          });
        }
      }
      
    } catch (error) {
      result.errors.push({
        type: 'HANDLER_ERROR',
        severity: 'CRITICAL',
        message: '寫入失敗處理過程發生錯誤',
        error: error.toString()
      });
    }
    
    return result;
  }

  /**
   * 處理金額計算錯誤
   */
  async handleCalculationErrors(expenseData, context) {
    const result = {
      handlerName: '金額計算錯誤處理',
      errors: [],
      warnings: [],
      actions: []
    };
    
    try {
      // 檢查總金額計算
      if (expenseData.totalAmount !== undefined) {
        const calculatedTotal = this.calculateTotalAmount(expenseData);
        const providedTotal = parseFloat(expenseData.totalAmount) || 0;
        
        if (Math.abs(calculatedTotal - providedTotal) > 0.01) {
          const correctionAction = await this.correctAmountCalculation(
            expenseData, 
            calculatedTotal, 
            providedTotal
          );
          
          result.actions.push(correctionAction);
          
          if (correctionAction.success) {
            expenseData.totalAmount = calculatedTotal;
            result.warnings.push({
              type: 'AMOUNT_CORRECTED',
              severity: 'MEDIUM',
              message: '總金額計算錯誤已自動修正',
              details: {
                originalAmount: providedTotal,
                correctedAmount: calculatedTotal,
                difference: calculatedTotal - providedTotal
              }
            });
          } else {
            result.errors.push({
              type: 'AMOUNT_CALCULATION_ERROR',
              severity: 'HIGH',
              message: '無法自動修正金額計算錯誤',
              details: correctionAction,
              requiresManualReview: true
            });
          }
        }
      }
      
      // 檢查個別參與者金額
      if (expenseData.participants && Array.isArray(expenseData.participants)) {
        for (const participant of expenseData.participants) {
          const participantAmount = parseFloat(participant.amount) || 0;
          
          if (participantAmount < 0) {
            result.errors.push({
              type: 'NEGATIVE_PARTICIPANT_AMOUNT',
              severity: 'MEDIUM',
              participantId: participant.id,
              message: '參與者金額不能為負數',
              details: {
                participantName: participant.name,
                amount: participantAmount
              },
              requiresManualReview: true
            });
          }
          
          if (isNaN(participantAmount)) {
            const correctionAction = await this.correctParticipantAmount(participant);
            result.actions.push(correctionAction);
            
            if (correctionAction.success) {
              participant.amount = correctionAction.correctedAmount;
            } else {
              result.errors.push({
                type: 'INVALID_PARTICIPANT_AMOUNT',
                severity: 'HIGH',
                participantId: participant.id,
                message: '參與者金額格式無效且無法自動修正',
                requiresManualReview: true
              });
            }
          }
        }
      }
      
      // 檢查分攤計算
      if (expenseData.splitMethod) {
        const splitValidation = await this.validateSplitCalculation(expenseData);
        if (!splitValidation.valid) {
          result.errors.push({
            type: 'SPLIT_CALCULATION_ERROR',
            severity: 'HIGH',
            message: '分攤計算錯誤',
            details: splitValidation,
            requiresManualReview: true
          });
        }
      }
      
    } catch (error) {
      result.errors.push({
        type: 'HANDLER_ERROR',
        severity: 'CRITICAL',
        message: '金額計算錯誤處理過程發生錯誤',
        error: error.toString()
      });
    }
    
    return result;
  }

  /**
   * 處理分類錯誤和預設值設定
   */
  async handleCategoryErrors(expenseData, context) {
    const result = {
      handlerName: '分類錯誤處理',
      errors: [],
      warnings: [],
      actions: []
    };
    
    try {
      // 檢查支出分類
      if (!expenseData.category || expenseData.category.trim() === '') {
        const defaultCategory = this.getDefaultCategory(expenseData);
        
        const categoryAction = {
          type: 'SET_DEFAULT_CATEGORY',
          success: true,
          originalCategory: expenseData.category,
          defaultCategory: defaultCategory,
          message: '使用預設分類'
        };
        
        expenseData.category = defaultCategory;
        expenseData.needsReview = true; // 標記需要人工確認
        
        result.actions.push(categoryAction);
        result.warnings.push({
          type: 'DEFAULT_CATEGORY_APPLIED',
          severity: 'LOW',
          message: '支出分類為空，已使用預設分類',
          details: {
            defaultCategory: defaultCategory,
            needsManualConfirmation: true
          }
        });
      }
      
      // 檢查分類是否有效
      if (expenseData.category && !this.isValidCategory(expenseData.category)) {
        const suggestedCategory = this.suggestCategory(expenseData);
        
        if (suggestedCategory) {
          const suggestionAction = {
            type: 'SUGGEST_CATEGORY',
            success: true,
            originalCategory: expenseData.category,
            suggestedCategory: suggestedCategory,
            confidence: this.calculateCategoryConfidence(expenseData, suggestedCategory)
          };
          
          result.actions.push(suggestionAction);
          result.warnings.push({
            type: 'INVALID_CATEGORY_SUGGESTED',
            severity: 'MEDIUM',
            message: '無效的支出分類，已提供建議分類',
            details: suggestionAction,
            requiresManualReview: true
          });
        } else {
          result.errors.push({
            type: 'INVALID_CATEGORY_NO_SUGGESTION',
            severity: 'MEDIUM',
            message: '無效的支出分類且無法提供建議',
            details: {
              invalidCategory: expenseData.category
            },
            requiresManualReview: true
          });
        }
      }
      
      // 檢查子分類
      if (expenseData.subcategory && !this.isValidSubcategory(expenseData.category, expenseData.subcategory)) {
        const defaultSubcategory = this.getDefaultSubcategory(expenseData.category);
        
        if (defaultSubcategory) {
          expenseData.subcategory = defaultSubcategory;
          expenseData.needsReview = true;
          
          result.actions.push({
            type: 'SET_DEFAULT_SUBCATEGORY',
            success: true,
            originalSubcategory: expenseData.subcategory,
            defaultSubcategory: defaultSubcategory
          });
          
          result.warnings.push({
            type: 'DEFAULT_SUBCATEGORY_APPLIED',
            severity: 'LOW',
            message: '無效的子分類，已使用預設子分類',
            details: {
              category: expenseData.category,
              defaultSubcategory: defaultSubcategory
            }
          });
        }
      }
      
    } catch (error) {
      result.errors.push({
        type: 'HANDLER_ERROR',
        severity: 'CRITICAL',
        message: '分類錯誤處理過程發生錯誤',
        error: error.toString()
      });
    }
    
    return result;
  }

  /**
   * 處理重複檢測錯誤
   */
  async handleDuplicateDetectionErrors(expenseData, context) {
    const result = {
      handlerName: '重複檢測錯誤處理',
      errors: [],
      warnings: [],
      actions: []
    };
    
    try {
      // 使用保守策略檢查重複
      const duplicateCheck = await this.conservativeDuplicateCheck(expenseData, context);
      
      if (duplicateCheck.isDuplicate) {
        const conservativeAction = {
          type: 'CONSERVATIVE_DUPLICATE_HANDLING',
          success: true,
          action: 'SKIP_RECORD',
          reason: '保守策略：跳過可能重複的記錄',
          duplicateDetails: duplicateCheck.details
        };
        
        result.actions.push(conservativeAction);
        result.warnings.push({
          type: 'DUPLICATE_RECORD_SKIPPED',
          severity: 'MEDIUM',
          message: '使用保守策略跳過可能重複的記錄',
          details: duplicateCheck,
          requiresManualReview: true
        });
        
        // 標記為跳過處理
        expenseData.skipProcessing = true;
        expenseData.skipReason = 'Potential duplicate detected';
      }
      
      // 檢查是否有重複檢測失敗的情況
      if (context.duplicateCheckFailed) {
        result.errors.push({
          type: 'DUPLICATE_CHECK_FAILED',
          severity: 'MEDIUM',
          message: '重複檢測過程失敗，使用保守策略',
          details: context.duplicateCheckFailed,
          requiresManualReview: true
        });
        
        // 在重複檢測失敗時，標記記錄需要人工審查
        expenseData.needsReview = true;
        expenseData.reviewReason = 'Duplicate check failed';
      }
      
    } catch (error) {
      result.errors.push({
        type: 'HANDLER_ERROR',
        severity: 'CRITICAL',
        message: '重複檢測錯誤處理過程發生錯誤',
        error: error.toString()
      });
    }
    
    return result;
  }

  /**
   * 處理資料格式錯誤
   */
  async handleFormatErrors(expenseData, context) {
    const result = {
      handlerName: '資料格式錯誤處理',
      errors: [],
      warnings: [],
      actions: []
    };
    
    try {
      // 處理日期格式錯誤
      if (expenseData.date) {
        const dateValidation = this.validateAndCorrectDate(expenseData.date);
        if (!dateValidation.valid) {
          if (dateValidation.corrected) {
            expenseData.date = dateValidation.correctedDate;
            result.actions.push({
              type: 'DATE_FORMAT_CORRECTED',
              success: true,
              originalDate: expenseData.date,
              correctedDate: dateValidation.correctedDate
            });
            
            result.warnings.push({
              type: 'DATE_FORMAT_CORRECTED',
              severity: 'LOW',
              message: '日期格式已自動修正',
              details: dateValidation
            });
          } else {
            result.errors.push({
              type: 'INVALID_DATE_FORMAT',
              severity: 'HIGH',
              message: '無效的日期格式且無法自動修正',
              details: dateValidation,
              requiresManualReview: true
            });
          }
        }
      }
      
      // 處理描述格式問題
      if (expenseData.description) {
        const cleanedDescription = this.cleanDescription(expenseData.description);
        if (cleanedDescription !== expenseData.description) {
          expenseData.description = cleanedDescription;
          result.actions.push({
            type: 'DESCRIPTION_CLEANED',
            success: true,
            originalDescription: expenseData.description,
            cleanedDescription: cleanedDescription
          });
        }
      }
      
      // 處理金額格式問題
      if (expenseData.totalAmount) {
        const amountValidation = this.validateAndCorrectAmount(expenseData.totalAmount);
        if (!amountValidation.valid) {
          if (amountValidation.corrected) {
            expenseData.totalAmount = amountValidation.correctedAmount;
            result.actions.push({
              type: 'AMOUNT_FORMAT_CORRECTED',
              success: true,
              originalAmount: expenseData.totalAmount,
              correctedAmount: amountValidation.correctedAmount
            });
          } else {
            result.errors.push({
              type: 'INVALID_AMOUNT_FORMAT',
              severity: 'HIGH',
              message: '無效的金額格式且無法自動修正',
              details: amountValidation,
              requiresManualReview: true
            });
          }
        }
      }
      
    } catch (error) {
      result.errors.push({
        type: 'HANDLER_ERROR',
        severity: 'CRITICAL',
        message: '格式錯誤處理過程發生錯誤',
        error: error.toString()
      });
    }
    
    return result;
  }

  /**
   * 處理參與者資訊錯誤
   */
  async handleParticipantErrors(expenseData, context) {
    const result = {
      handlerName: '參與者資訊錯誤處理',
      errors: [],
      warnings: [],
      actions: []
    };
    
    try {
      if (expenseData.participants && Array.isArray(expenseData.participants)) {
        for (let i = 0; i < expenseData.participants.length; i++) {
          const participant = expenseData.participants[i];
          
          // 檢查參與者姓名
          if (!participant.name || participant.name.trim() === '') {
            result.errors.push({
              type: 'MISSING_PARTICIPANT_NAME',
              severity: 'HIGH',
              participantIndex: i,
              message: '參與者姓名不能為空',
              requiresManualReview: true
            });
          }
          
          // 檢查參與者 ID
          if (!participant.id) {
            const generatedId = this.generateParticipantId(participant, i);
            participant.id = generatedId;
            
            result.actions.push({
              type: 'PARTICIPANT_ID_GENERATED',
              success: true,
              participantIndex: i,
              generatedId: generatedId
            });
            
            result.warnings.push({
              type: 'PARTICIPANT_ID_GENERATED',
              severity: 'LOW',
              message: '參與者 ID 已自動生成',
              details: {
                participantIndex: i,
                generatedId: generatedId
              }
            });
          }
          
          // 檢查參與者金額
          if (participant.amount === undefined || participant.amount === null) {
            // 嘗試從總金額和參與者數量計算平均金額
            const averageAmount = this.calculateAverageAmount(expenseData);
            participant.amount = averageAmount;
            
            result.actions.push({
              type: 'PARTICIPANT_AMOUNT_ESTIMATED',
              success: true,
              participantIndex: i,
              estimatedAmount: averageAmount
            });
            
            result.warnings.push({
              type: 'PARTICIPANT_AMOUNT_ESTIMATED',
              severity: 'MEDIUM',
              message: '參與者金額已使用平均值估算',
              details: {
                participantIndex: i,
                estimatedAmount: averageAmount
              },
              requiresManualReview: true
            });
          }
        }
      }
      
    } catch (error) {
      result.errors.push({
        type: 'HANDLER_ERROR',
        severity: 'CRITICAL',
        message: '參與者錯誤處理過程發生錯誤',
        error: error.toString()
      });
    }
    
    return result;
  }

  // =================================================================================================
  // 輔助方法
  // =================================================================================================

  /**
   * 分類寫入失敗類型
   */
  classifyWriteFailure(failure) {
    const errorMessage = failure.error ? failure.error.toString().toLowerCase() : '';
    
    if (errorMessage.includes('permission') || errorMessage.includes('access denied')) {
      return 'PERMISSION_ERROR';
    }
    
    if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
      return 'QUOTA_EXCEEDED';
    }
    
    if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      return 'NETWORK_ERROR';
    }
    
    if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      return 'DATA_VALIDATION_ERROR';
    }
    
    return 'UNKNOWN_ERROR';
  }

  /**
   * 處理權限錯誤
   */
  async handlePermissionError(failure, expenseData) {
    return {
      type: 'PERMISSION_ERROR_HANDLED',
      success: false,
      message: '權限錯誤需要人工處理',
      details: failure,
      recommendedAction: '檢查工作表權限設定'
    };
  }

  /**
   * 處理配額錯誤
   */
  async handleQuotaError(failure, expenseData) {
    return {
      type: 'QUOTA_ERROR_HANDLED',
      success: false,
      message: '配額超限，建議稍後重試',
      details: failure,
      recommendedAction: '等待配額重置或優化資料處理'
    };
  }

  /**
   * 處理網路錯誤
   */
  async handleNetworkError(failure, expenseData) {
    return {
      type: 'NETWORK_ERROR_HANDLED',
      success: false,
      message: '網路錯誤，建議重試',
      details: failure,
      recommendedAction: '檢查網路連線並重試操作'
    };
  }

  /**
   * 處理資料驗證錯誤
   */
  async handleDataValidationError(failure, expenseData) {
    return {
      type: 'DATA_VALIDATION_ERROR_HANDLED',
      success: true,
      message: '資料驗證錯誤已處理',
      details: failure,
      correctedData: this.correctValidationErrors(expenseData, failure)
    };
  }

  /**
   * 計算總金額
   */
  calculateTotalAmount(expenseData) {
    if (expenseData.participants && Array.isArray(expenseData.participants)) {
      return expenseData.participants.reduce((sum, participant) => {
        return sum + (parseFloat(participant.amount) || 0);
      }, 0);
    }
    return 0;
  }

  /**
   * 修正金額計算
   */
  async correctAmountCalculation(expenseData, calculatedTotal, providedTotal) {
    return {
      type: 'AMOUNT_CALCULATION_CORRECTED',
      success: true,
      originalAmount: providedTotal,
      correctedAmount: calculatedTotal,
      method: 'RECALCULATED_FROM_PARTICIPANTS'
    };
  }

  /**
   * 獲取預設分類
   */
  getDefaultCategory(expenseData) {
    // 根據描述或其他資訊推測分類
    if (expenseData.description) {
      const description = expenseData.description.toLowerCase();
      
      for (const [category, keywords] of Object.entries(this.defaultCategories)) {
        if (keywords.some(keyword => description.includes(keyword))) {
          return category;
        }
      }
    }
    
    return '其他'; // 預設分類
  }

  /**
   * 檢查分類是否有效
   */
  isValidCategory(category) {
    const validCategories = Object.keys(this.defaultCategories);
    return validCategories.includes(category);
  }

  /**
   * 建議分類
   */
  suggestCategory(expenseData) {
    return this.getDefaultCategory(expenseData);
  }

  /**
   * 計算分類信心度
   */
  calculateCategoryConfidence(expenseData, suggestedCategory) {
    // 簡化的信心度計算
    if (expenseData.description && this.defaultCategories[suggestedCategory]) {
      const keywords = this.defaultCategories[suggestedCategory];
      const description = expenseData.description.toLowerCase();
      const matchCount = keywords.filter(keyword => description.includes(keyword)).length;
      return Math.min(matchCount / keywords.length, 1.0);
    }
    return 0.5; // 預設信心度
  }

  /**
   * 保守的重複檢查
   */
  async conservativeDuplicateCheck(expenseData, context) {
    // 實作保守的重複檢測邏輯
    // 這裡提供一個簡化的實作
    return {
      isDuplicate: false,
      confidence: 0.0,
      details: {
        method: 'CONSERVATIVE_CHECK',
        factors: []
      }
    };
  }

  /**
   * 載入預設分類
   */
  loadDefaultCategories() {
    return {
      '餐飲': ['餐廳', '食物', '飲料', '咖啡', '午餐', '晚餐', '早餐'],
      '交通': ['計程車', '公車', '捷運', '油費', '停車', '交通'],
      '購物': ['購物', '商店', '超市', '網購', '買'],
      '娛樂': ['電影', '遊戲', '娛樂', '休閒', '旅遊'],
      '生活': ['日用品', '清潔', '洗衣', '生活'],
      '其他': []
    };
  }

  /**
   * 載入真實化規則
   */
  loadRealizationRules() {
    return {
      enableAmountValidation: true,
      enableCategoryValidation: true,
      enableDuplicateCheck: true,
      enableFormatValidation: true,
      useConservativeMode: true
    };
  }

  /**
   * 其他輔助方法...
   */
  mergeHandlingResult(mainResult, subResult) {
    if (subResult.errors) {
      mainResult.errors.push(...subResult.errors);
    }
    if (subResult.warnings) {
      mainResult.warnings.push(...subResult.warnings);
    }
    if (subResult.actions) {
      mainResult.actions.push(...subResult.actions);
    }
  }

  generateHandlerId() {
    return `P4ER-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
  }

  recordRealizationHandling(result) {
    this.realizationHistory.push({
      handlerId: result.handlerId,
      timestamp: result.startTime,
      totalIssues: result.summary.totalIssues,
      resolvedIssues: result.summary.resolvedIssues,
      duration: result.duration
    });
    
    // 限制歷史記錄數量
    if (this.realizationHistory.length > 100) {
      this.realizationHistory = this.realizationHistory.slice(-50);
    }
  }
}

// 全域實例
const phase4ExpenseRealizationHandler = new Phase4ExpenseRealizationHandler();