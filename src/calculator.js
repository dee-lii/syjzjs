/**
 * VPS 剩余价值计算核心模块
 * 提供价值计算、验证等功能
 */

/**
 * 计算 VPS 剩余价值
 * @param {number} totalCost - 总成本（元）
 * @param {number} totalDays - 总天数
 * @param {number} usedDays - 已使用天数
 * @returns {Object} 计算结果
 */
function calculateRemainingValue(totalCost, totalDays, usedDays) {
  // 参数验证
  validateInputs(totalCost, totalDays, usedDays);

  // 计算日均消耗
  const dailyRate = totalCost / totalDays;

  // 计算已使用价值
  const usedValue = dailyRate * usedDays;

  // 计算剩余天数
  const remainingDays = totalDays - usedDays;

  // 计算剩余价值
  const remainingValue = dailyRate * remainingDays;

  // 计算使用率
  const usageRate = (usedDays / totalDays) * 100;

  return {
    remainingValue: parseFloat(remainingValue.toFixed(2)),
    usedValue: parseFloat(usedValue.toFixed(2)),
    remainingDays,
    usageRate: parseFloat(usageRate.toFixed(2)),
    dailyRate: parseFloat(dailyRate.toFixed(2))
  };
}

/**
 * 验证输入参数
 * @param {number} totalCost - 总成本
 * @param {number} totalDays - 总天数
 * @param {number} usedDays - 已使用天数
 * @throws {Error} 参数不合法时抛出异常
 */
function validateInputs(totalCost, totalDays, usedDays) {
  if (!isValidNumber(totalCost) || totalCost <= 0) {
    throw new Error('总成本必须是大于 0 的数字');
  }

  if (!isValidNumber(totalDays) || totalDays <= 0) {
    throw new Error('总天数必须是大于 0 的整数');
  }

  if (!isValidNumber(usedDays) || usedDays < 0) {
    throw new Error('已使用天数必须是非负整数');
  }

  if (usedDays > totalDays) {
    throw new Error('已使用天数不能超过总天数');
  }
}

/**
 * 检查是否为有效数字
 * @param {*} value - 待检查的值
 * @returns {boolean}
 */
function isValidNumber(value) {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * 根据付款周期获取总天数
 * @param {string} cycle - 付款周期：'monthly' | 'yearly' | 'biennial' | 'triennial'
 * @returns {number} 总天数
 */
function getDaysByCycle(cycle) {
  const cycleDays = {
    monthly: 30,
    yearly: 365,
    biennial: 730,
    triennial: 1095
  };

  if (!cycleDays[cycle]) {
    throw new Error(`不支持的付款周期：${cycle}`);
  }

  return cycleDays[cycle];
}

/**
 * 计算已使用天数（从购买日期到今天）
 * @param {string|Date} purchaseDate - 购买日期
 * @returns {number} 已使用天数
 */
function calculateUsedDays(purchaseDate) {
  const purchase = new Date(purchaseDate);

  if (isNaN(purchase.getTime())) {
    throw new Error('购买日期格式不正确');
  }

  const now = new Date();
  const diffTime = now - purchase;

  if (diffTime < 0) {
    throw new Error('购买日期不能晚于当前日期');
  }

  // 转换为天数（向下取整）
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

module.exports = {
  calculateRemainingValue,
  validateInputs,
  isValidNumber,
  getDaysByCycle,
  calculateUsedDays
};
