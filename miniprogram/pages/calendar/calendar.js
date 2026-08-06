const store = require('../../utils/store');
const dateUtil = require('../../utils/date');
const recurring = require('../../utils/recurring');
const lunar = require('../../utils/lunar');

Page({
  data: {
    year: 2026,
    month: 0, // 0-based
    weeks: [], // 6 * 7 个日期格
    selectedDate: '',
    tasksForSelected: [],
    today: '',
    selectedLabel: '',
    totalCount: 0,
  },

  onLoad() {
    const now = new Date();
    const today = dateUtil.getToday();
    this.setData({
      year: now.getFullYear(),
      month: now.getMonth(),
      today: today,
      selectedDate: today,
      selectedLabel: dateUtil.formatFullDate(now),
    });
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  loadData() {
    // 先生成逾期的周期任务和农历生日任务的下一期实例
    store.checkRecurringTasks();

    const { year, month, selectedDate, today } = this.data;
    const tasks = store.getTasks({});

    // 统计每日任务数
    const countMap = {};
    tasks.forEach((t) => {
      if (t.dueDate) countMap[t.dueDate] = (countMap[t.dueDate] || 0) + 1;
    });

    // 构建 6 行 7 列日历
    const firstDay = new Date(year, month, 1).getDay(); // 0=周日
    const startOffset = firstDay; // 从周日开始
    const startDate = new Date(year, month, 1 - startOffset);

    const weeks = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const dsStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      weeks.push({
        date: dsStr,
        day: d.getDate(),
        inMonth: d.getMonth() === month,
        isToday: dsStr === today,
        isSelected: dsStr === selectedDate,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        count: countMap[dsStr] || 0,
      });
    }

    // 选中日期的任务列表
    const selectedTasks = this.processTasks(
      tasks.filter((t) => t.dueDate === selectedDate)
    );

    this.setData({
      weeks,
      tasksForSelected: selectedTasks,
      totalCount: tasks.length,
    });
  },

  processTasks(tasks) {
    const todayStr = dateUtil.getToday();
    return tasks
      .map((t) => {
        const cat = store.getCategoryById(t.category);
        const recurrenceLabel =
          t.recurrence && t.recurrence.type && t.recurrence.type !== 'none'
            ? recurring.describeRecurrence(t.recurrence)
            : '';
        return {
          ...t,
          dueDateLabel: dateUtil.formatDateLabel(t.dueDate),
          isOverdue: t.dueDate && t.dueDate < todayStr && !t.completed,
          categoryName: cat.name,
          categoryColor: cat.color,
          recurrenceLabel: recurrenceLabel,
        };
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (a.dueTime && b.dueTime) return a.dueTime.localeCompare(b.dueTime);
        if (a.dueTime) return -1;
        if (b.dueTime) return 1;
        return 0;
      });
  },

  onPrevMonth() {
    let { year, month } = this.data;
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
    this.setData({ year, month });
    this.loadData();
  },

  onNextMonth() {
    let { year, month } = this.data;
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    this.setData({ year, month });
    this.loadData();
  },

  onSelectDay(e) {
    const date = e.currentTarget.dataset.date;
    const [y, m, d] = date.split('-').map(Number);
    const label = `${y}年${m}月${d}日 周${['日', '一', '二', '三', '四', '五', '六'][new Date(y, m - 1, d).getDay()]}`;
    this.setData({ selectedDate: date, selectedLabel: label });
    this.loadData();
  },

  onToday() {
    const now = new Date();
    const today = dateUtil.getToday();
    this.setData({
      year: now.getFullYear(),
      month: now.getMonth(),
      selectedDate: today,
      selectedLabel: dateUtil.formatFullDate(now),
    });
    this.loadData();
  },

  onTapTask(e) {
    const { id } = e.detail;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },

  onToggleTask(e) {
    const { id } = e.detail;
    store.toggleTask(id);
    this.delayedReload();
  },

  onDeleteTask(e) {
    const { id } = e.detail;
    wx.showModal({
      title: '删除任务',
      content: '确定要删除这个任务吗？',
      confirmColor: '#E24B4A',
      success: (res) => {
        if (res.confirm) {
          store.deleteTask(id);
          this.delayedReload();
        }
      },
    });
  },

  delayedReload() {
    setTimeout(() => this.loadData(), 50);
  },

  onCreate() {
    wx.navigateTo({ url: '/pages/create/create' });
  },
});
