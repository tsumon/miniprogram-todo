/**
 * utils/date.js
 * Date formatting and calculation utilities
 */

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

/**
 * Get today's date string in YYYY-MM-DD format
 */
const getToday = () => {
  return new Date().toISOString().split('T')[0];
};

/**
 * Get tomorrow's date string
 */
const getTomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
};

/**
 * Format date for display: "今天", "明天", "周X", "M月D日"
 */
const formatDateLabel = (dateStr) => {
  if (!dateStr) return '';
  const today = getToday();
  const tomorrow = getTomorrow();

  if (dateStr === today) return '今天';
  if (dateStr === tomorrow) return '明天';

  const date = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const diffDays = Math.floor((date - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);

  if (diffDays === -1) return '昨天';
  if (diffDays > 1 && diffDays < 7) {
    return '周' + WEEKDAYS[date.getDay()];
  }
  if (diffDays < 0) {
    return `逾期${Math.abs(diffDays)}天`;
  }

  return `${date.getMonth() + 1}月${date.getDate()}日`;
};

/**
 * Format date with time: "今天 09:00" or "3月15日 14:30"
 */
const formatDateTime = (dateStr, timeStr) => {
  let label = formatDateLabel(dateStr);
  if (timeStr) {
    label += ' ' + timeStr;
  }
  return label;
};

/**
 * Get full date display: "2024年1月15日 周一"
 */
const formatFullDate = (date) => {
  const d = date || new Date();
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 周${WEEKDAYS[d.getDay()]}`;
};

/**
 * Get greeting based on time of day
 */
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了';
  if (hour < 9) return '早上好';
  if (hour < 12) return '上午好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  if (hour < 22) return '晚上好';
  return '夜深了';
};

/**
 * Check if a date is overdue
 */
const isOverdue = (dateStr) => {
  if (!dateStr) return false;
  return dateStr < getToday();
};

/**
 * Get date N days from now
 */
const getDateAfter = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

/**
 * Get date range for upcoming tasks (next 7 days)
 */
const getUpcomingDates = () => {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    dates.push(getDateAfter(i));
  }
  return dates;
};

module.exports = {
  WEEKDAYS,
  MONTHS,
  getToday,
  getTomorrow,
  formatDateLabel,
  formatDateTime,
  formatFullDate,
  getGreeting,
  isOverdue,
  getDateAfter,
  getUpcomingDates,
};
