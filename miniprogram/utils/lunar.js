/**
 * utils/lunar.js
 * 农历（阴历）与公历（阳历）转换模块
 * 支持公历↔农历互转、农历生日提醒计算
 * 数据覆盖 1900-2099 年
 */

// 农历数据表 1900-2099
// 每个 int 编码：bits 0-3=闰月月份(0=无闰月), bits 4-15=12个月大小月(1=30天, 0=29天), bit 16=闰月大小月
const LUNAR_INFO = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0,
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
  0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252,
];

const LUNAR_MONTH_NAMES = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const LUNAR_DAY_PREFIX = ['初', '十', '廿', '卅'];
const LUNAR_DAY_DIGITS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

/**
 * 获取农历年闰月月份 (0=无闰月)
 */
const leapMonth = (year) => LUNAR_INFO[year - 1900] & 0xf;

/**
 * 获取农历年闰月天数
 */
const leapDays = (year) => {
  if (leapMonth(year) === 0) return 0;
  return LUNAR_INFO[year - 1900] & 0x10000 ? 30 : 29;
};

/**
 * 获取农历年总天数
 */
const yearDays = (year) => {
  let sum = 348;
  for (let i = 0x8000; i > 0x8; i >>= 1) {
    sum += LUNAR_INFO[year - 1900] & i ? 1 : 0;
  }
  return sum + leapDays(year);
};

/**
 * 获取农历月天数 (1-12, 不含闰月)
 */
const monthDays = (year, month) => {
  return LUNAR_INFO[year - 1900] & (0x10000 >> month) ? 30 : 29;
};

/**
 * 公历转农历
 * @param {number} year  公历年
 * @param {number} month 公历月 1-12
 * @param {number} day   公历日
 * @returns {{year, month, day, isLeap, monthName, dayName}}
 */
const solarToLunar = (year, month, day) => {
  const baseDate = new Date(1900, 0, 31);
  const objDate = new Date(year, month - 1, day);
  let offset = Math.floor((objDate - baseDate) / 86400000);

  let i, temp = 0;

  for (i = 1900; i < 2100 && offset > 0; i++) {
    temp = yearDays(i);
    offset -= temp;
  }
  if (offset < 0) {
    offset += temp;
    i--;
  }

  const lunarYear = i;
  const leap = leapMonth(i);
  let isLeap = false;

  for (i = 1; i < 13 && offset > 0; i++) {
    if (leap > 0 && i === leap + 1 && !isLeap) {
      i--;
      isLeap = true;
      temp = leapDays(lunarYear);
    } else {
      temp = monthDays(lunarYear, i);
    }

    if (isLeap && i === leap + 1) isLeap = false;

    offset -= temp;
  }

  if (offset === 0 && leap > 0 && i === leap + 1) {
    if (isLeap) {
      isLeap = false;
    } else {
      isLeap = true;
      i--;
    }
  }

  if (offset < 0) {
    offset += temp;
    i--;
  }

  const lunarMonth = i;
  const lunarDay = offset + 1;

  return {
    year: lunarYear,
    month: lunarMonth,
    day: lunarDay,
    isLeap: isLeap,
    monthName: LUNAR_MONTH_NAMES[lunarMonth - 1] || String(lunarMonth),
    dayName: formatLunarDay(lunarDay),
  };
};

/**
 * 农历转公历
 * @param {number} year    农历年
 * @param {number} month   农历月 1-12
 * @param {number} day     农历日
 * @param {boolean} isLeap 是否闰月
 * @returns {{year, month, day}}
 */
const lunarToSolar = (year, month, day, isLeap) => {
  const baseDate = new Date(1900, 0, 31);
  let offset = 0;

  for (let y = 1900; y < year; y++) {
    offset += yearDays(y);
  }

  const leap = leapMonth(year);

  for (let i = 1; i <= 12; i++) {
    if (i === month && !isLeap) break;

    offset += monthDays(year, i);

    if (leap > 0 && i === leap) {
      if (i === month && isLeap) break;
      offset += leapDays(year);
    }
  }

  offset += day - 1;

  const result = new Date(1900, 0, 31);
  result.setDate(result.getDate() + offset);

  return {
    year: result.getFullYear(),
    month: result.getMonth() + 1,
    day: result.getDate(),
  };
};

/**
 * 格式化农历日
 */
function formatLunarDay(day) {
  if (day === 10) return '初十';
  if (day === 20) return '二十';
  if (day === 30) return '三十';
  const prefixIdx = Math.floor((day - 1) / 10);
  const digitIdx = (day % 10 === 0 ? 9 : day % 10) - 1;
  return LUNAR_DAY_PREFIX[prefixIdx] + LUNAR_DAY_DIGITS[digitIdx];
}

/**
 * 格式化农历日期为可读字符串
 * @param {number} month   农历月 1-12
 * @param {number} day     农历日
 * @param {boolean} isLeap 是否闰月
 * @returns {string} "农历腊月十五" / "农历闰四月廿一"
 */
const formatLunarDate = (month, day, isLeap) => {
  const monthName = LUNAR_MONTH_NAMES[month - 1] || String(month);
  const dayName = formatLunarDay(day);
  const leapPrefix = isLeap ? '闰' : '';
  return `农历${leapPrefix}${monthName}月${dayName}`;
};

/**
 * 计算下一个农历生日对应的公历日期
 * @param {number} lunarMonth 农历月 1-12
 * @param {number} lunarDay   农历日
 * @param {boolean} isLeap    是否闰月
 * @param {Date} fromDate     起算日期（默认今天）
 * @returns {string} YYYY-MM-DD 格式的公历日期
 */
const getNextLunarBirthday = (lunarMonth, lunarDay, isLeap, fromDate) => {
  const from = fromDate || new Date();
  const fromYear = from.getFullYear();

  for (let year = fromYear; year <= fromYear + 2; year++) {
    const solar = lunarToSolar(year, lunarMonth, lunarDay, isLeap);
    const solarDate = new Date(solar.year, solar.month - 1, solar.day);

    // Compare with start of today
    const todayStart = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    if (solarDate >= todayStart) {
      return (
        solar.year +
        '-' +
        String(solar.month).padStart(2, '0') +
        '-' +
        String(solar.day).padStart(2, '0')
      );
    }
  }

  return null;
};

/**
 * 公历日期字符串转农历信息
 * @param {string} dateStr YYYY-MM-DD
 * @returns {{year, month, day, isLeap, monthName, dayName, display}}
 */
const solarStrToLunar = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  const lunar = solarToLunar(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]));
  lunar.display = formatLunarDate(lunar.month, lunar.day, lunar.isLeap);
  return lunar;
};

module.exports = {
  LUNAR_MONTH_NAMES,
  solarToLunar,
  lunarToSolar,
  formatLunarDate,
  formatLunarDay,
  getNextLunarBirthday,
  solarStrToLunar,
};
