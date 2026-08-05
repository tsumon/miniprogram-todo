/**
 * utils/recurring.js
 * 周期任务引擎
 * 支持 daily / weekly / monthly / quarterly / yearly 五种周期
 *
 * 季度(quarterly)模型：
 *   {
 *     type: 'quarterly',
 *     interval: 1,
 *     mode: 'date' | 'week',
 *     dayOfMonth: 15,        // mode='date'：季度首月第 N 号
 *     weekOfQuarter: 2,      // mode='week'：季度第几周（1-13）
 *     dayOfWeek: 3           // mode='week'：该周的星期几（0=周日）
 *   }
 * 例："每季度第二周周三" → mode:'week', weekOfQuarter:2, dayOfWeek:3
 *     "每季度15号"     → mode:'date', dayOfMonth:15
 */

const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

/**
 * 将 YYYY-MM-DD 或 Date 格式化为 YYYY-MM-DD 字符串
 */
const formatDate = (date) => {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * 获取某月天数
 */
const daysInMonth = (year, month) => {
  return new Date(year, month + 1, 0).getDate();
};

/**
 * 规范化周期规则，补齐缺失字段
 */
const normalize = (recurrence) => {
  const r = Object.assign({}, recurrence || { type: 'none', interval: 1 });
  r.type = String(r.type || 'none').toLowerCase();
  r.interval = r.interval || 1;

  // 兼容旧字段 weekOfMonth（季度场景）
  if (r.type === 'quarterly') {
    if (r.weekOfQuarter === undefined && r.weekOfMonth) {
      r.weekOfQuarter = r.weekOfMonth;
    }
    if (!r.mode) {
      r.mode = r.weekOfQuarter ? 'week' : 'date';
    }
  }
  return r;
};

/**
 * 计算某个季度起始月（1/4/7/10 月 1 日）对应的具体到期日
 */
const computeQuarterOccurrence = (qStart, baseDate) => {
  const year = qStart.getFullYear();
  const month = qStart.getMonth();

  if (r_mode === 'week') {
    // 季度第 N 周：weekStart = 季度第1天 + (N-1)*7 天，再取该周指定星期几
    const weekStart = new Date(year, month, 1 + (r_weekOfQuarter - 1) * 7);
    const dow = r_dayOfWeek !== null && r_dayOfWeek !== undefined ? r_dayOfWeek : weekStart.getDay();
    const diff = (dow - weekStart.getDay() + 7) % 7;
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + diff);
    return d;
  }

  // 默认按日期：季度首月第 dayOfMonth 号
  const day = r_dayOfMonth || qStart.getDate();
  const maxDay = daysInMonth(year, month);
  return new Date(year, month, Math.min(day, maxDay));
};

// 当前季度规则上下文（在 computeNextOccurrence 中填充，供 computeQuarterOccurrence 使用）
let r_mode = 'date';
let r_weekOfQuarter = 1;
let r_dayOfWeek = null;
let r_dayOfMonth = 1;

/**
 * 计算下一次到期日期（严格晚于 fromDate）
 * @param {Object} recurrence  周期规则
 * @param {string} fromDateString 当前到期日期 YYYY-MM-DD
 * @returns {string|null}
 */
const computeNextOccurrence = (recurrence, fromDateString) => {
  if (!recurrence || !recurrence.type) return null;
  const rec = normalize(recurrence);
  if (rec.type === 'none') return null;
  if (!fromDateString) return null;

  const fromDate = new Date(fromDateString + 'T00:00:00');
  const interval = rec.interval;

  // 结束条件
  if (rec.endDate && fromDateString >= rec.endDate) return null;

  let nextDate = null;

  switch (rec.type) {
    case 'daily': {
      nextDate = new Date(fromDate);
      nextDate.setDate(nextDate.getDate() + interval);
      break;
    }

    case 'weekly': {
      nextDate = new Date(fromDate);
      nextDate.setDate(nextDate.getDate() + interval * 7);
      if (rec.dayOfWeek !== null && rec.dayOfWeek !== undefined) {
        const diff = (rec.dayOfWeek - nextDate.getDay() + 7) % 7;
        nextDate.setDate(nextDate.getDate() + diff);
      }
      break;
    }

    case 'monthly': {
      nextDate = new Date(fromDate);
      nextDate.setMonth(nextDate.getMonth() + interval);
      const targetDay = rec.dayOfMonth || fromDate.getDate();
      nextDate.setDate(Math.min(targetDay, daysInMonth(nextDate.getFullYear(), nextDate.getMonth())));
      break;
    }

    case 'quarterly': {
      r_mode = rec.mode;
      r_weekOfQuarter = rec.weekOfQuarter || 1;
      r_dayOfWeek = rec.dayOfWeek;
      r_dayOfMonth = rec.dayOfMonth || 1;

      let baseYear = fromDate.getFullYear();
      let baseMonth = Math.floor(fromDate.getMonth() / 3) * 3; // 0,3,6,9
      let candidate = null;

      // 最多向前推算 8 个季度，找到第一个晚于 fromDate 的日期
      for (let i = 0; i < 8; i++) {
        const qStart = new Date(baseYear, baseMonth, 1);
        const occ = computeQuarterOccurrence(qStart);
        if (occ > fromDate) {
          candidate = occ;
          break;
        }
        baseMonth += 3 * interval;
        while (baseMonth >= 12) {
          baseMonth -= 12;
          baseYear++;
        }
      }
      nextDate = candidate;
      break;
    }

    case 'yearly': {
      nextDate = new Date(fromDate);
      nextDate.setFullYear(nextDate.getFullYear() + interval);
      if (rec.monthOfYear) {
        nextDate.setMonth(rec.monthOfYear - 1);
      }
      const targetDay = rec.dayOfMonth || fromDate.getDate();
      nextDate.setDate(Math.min(targetDay, daysInMonth(nextDate.getFullYear(), nextDate.getMonth())));
      break;
    }

    default:
      return null;
  }

  if (!nextDate) return null;

  // 结束条件（晚于结束日则返回 null）
  if (rec.endDate) {
    const endDate = new Date(rec.endDate + 'T00:00:00');
    if (nextDate > endDate) return null;
  }

  return formatDate(nextDate);
};

/**
 * 检查并生成逾期的周期任务（app onShow / index onShow 时调用）
 */
const checkAndGenerateRecurring = (tasks) => {
  const today = formatDate(new Date());
  const newTasks = [];

  tasks.forEach((task) => {
    if (!task.recurrence || task.recurrence.type === 'none' || task.completed) return;
    if (!task.dueDate || task.dueDate >= today) return;

    const nextDate = computeNextOccurrence(task.recurrence, task.dueDate);
    if (nextDate && nextDate !== task.dueDate) {
      const exists =
        tasks.some((t) => t.parentId === task.id && t.dueDate === nextDate) ||
        newTasks.some((t) => t.parentId === task.id && t.dueDate === nextDate);
      if (!exists) {
        newTasks.push({
          ...task,
          id: 't_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          dueDate: nextDate,
          completed: false,
          completedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          parentId: task.id,
        });
      }
    }
  });

  return newTasks;
};

/**
 * 人类可读的周期描述
 * @returns {string} "每天" / "每周三" / "每月15日" / "每季度第2周周三" / "每年1月1日"
 */
const describeRecurrence = (recurrence) => {
  if (!recurrence || !recurrence.type) return '';
  const rec = normalize(recurrence);
  if (rec.type === 'none') return '';
  const interval = rec.interval || 1;

  switch (rec.type) {
    case 'daily':
      return interval === 1 ? '每天' : `每${interval}天`;

    case 'weekly': {
      let base = interval === 1 ? '每周' : `每${interval}周`;
      if (rec.dayOfWeek !== null && rec.dayOfWeek !== undefined) {
        base += '周' + WEEKDAY_NAMES[rec.dayOfWeek];
      }
      return base;
    }

    case 'monthly': {
      let base = interval === 1 ? '每月' : `每${interval}月`;
      if (rec.dayOfMonth) base += `${rec.dayOfMonth}日`;
      return base;
    }

    case 'quarterly': {
      let base = interval === 1 ? '每季度' : `每${interval}季度`;
      if (rec.mode === 'week' && rec.weekOfQuarter) {
        base += `第${rec.weekOfQuarter}周`;
        if (rec.dayOfWeek !== null && rec.dayOfWeek !== undefined) {
          base += '周' + WEEKDAY_NAMES[rec.dayOfWeek];
        }
      } else if (rec.dayOfMonth) {
        base += `${rec.dayOfMonth}日`;
      }
      return base;
    }

    case 'yearly': {
      let base = interval === 1 ? '每年' : `每${interval}年`;
      if (rec.monthOfYear && rec.dayOfMonth) {
        base += `${rec.monthOfYear}月${rec.dayOfMonth}日`;
      } else if (rec.monthOfYear) {
        base += `${rec.monthOfYear}月`;
      }
      return base;
    }

    default:
      return '';
  }
};

/**
 * 获取周期类型的中文名称
 */
const getTypeLabel = (type) => {
  const labels = {
    none: '不重复',
    daily: '每天',
    weekly: '每周',
    monthly: '每月',
    quarterly: '每季度',
    yearly: '每年',
  };
  return labels[type] || type;
};

module.exports = {
  computeNextOccurrence,
  checkAndGenerateRecurring,
  describeRecurrence,
  getTypeLabel,
  normalize,
  formatDate,
  WEEKDAY_NAMES,
};
