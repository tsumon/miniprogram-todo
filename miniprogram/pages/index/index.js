const store = require('../../utils/store');
const dateUtil = require('../../utils/date');
const recurring = require('../../utils/recurring');
const lunar = require('../../utils/lunar');
const reminder = require('../../utils/reminder');

Page({
  data: {
    today: '',
    todayLabel: '',
    greeting: '',
    overdueTasks: [],
    todayTasks: [],
    completedTasks: [],
    stats: {},
    todayProgress: 0,
    pendingReminders: 0,
    loading: true,
  },

  onLoad() {
    this.setData({
      today: dateUtil.getToday(),
      todayLabel: dateUtil.formatFullDate(),
      greeting: dateUtil.getGreeting(),
    });
  },

  onShow() {
    // 检查并生成逾期周期任务
    store.checkRecurringTasks();
    this.loadData();
    // Update greeting in case time changed
    this.setData({ greeting: dateUtil.getGreeting() });
  },

  loadData() {
    const today = dateUtil.getToday();
    const allTasks = store.getTasks();

    // Process tasks with display info
    const processTasks = (tasks) => {
      const todayStr = dateUtil.getToday();
      return tasks.map((t) => {
        const cat = store.getCategoryById(t.category);
        const recurrenceLabel = t.recurrence && t.recurrence.type && t.recurrence.type !== 'none'
          ? recurring.describeRecurrence(t.recurrence)
          : '';
        let birthdayLabel = '';
        if (t.isBirthday && t.calendarType === 'lunar' && t.birthdayLunarMonth) {
          birthdayLabel = lunar.formatLunarDate(t.birthdayLunarMonth, t.birthdayLunarDay, t.birthdayLunarIsLeap);
        }
        return {
          ...t,
          dueDateLabel: dateUtil.formatDateLabel(t.dueDate),
          isOverdue: t.dueDate && t.dueDate < todayStr && !t.completed,
          categoryName: cat.name,
          categoryColor: cat.color,
          recurrenceLabel: recurrenceLabel,
          birthdayLabel: birthdayLabel,
        };
      });
    };

    const overdueTasks = processTasks(
      allTasks.filter((t) => t.dueDate && t.dueDate < today && !t.completed)
    );

    const todayTasks = processTasks(
      allTasks.filter((t) => t.dueDate === today && !t.completed)
    );

    const completedTasks = processTasks(
      allTasks.filter((t) => t.dueDate === today && t.completed)
    );

    const stats = store.getStats();
    const pendingReminders = reminder.getPendingReminders().length;

    this.setData({
      overdueTasks,
      todayTasks,
      completedTasks,
      stats,
      pendingReminders,
      todayProgress: stats.todayTotal > 0 ? Math.round((stats.todayCompleted / stats.todayTotal) * 100) : 0,
      loading: false,
    });
  },

  onShowReminders() {
    if (this.data.pendingReminders === 0) return;
    this._reminderShowing = true;
    reminder.showReminders(() => {
      this._reminderShowing = false;
      this.loadData();
    });
  },

  onToggle(e) {
    const { id } = e.detail;
    store.toggleTask(id);
    this.loadData();
    const task = store.getTaskById(id);
    if (task && task.completed) {
      wx.vibrateShort({ type: 'light' });
    }
  },

  onTap(e) {
    const { id } = e.detail;
    wx.navigateTo({ url: '/pages/detail/detail?id=' + id });
  },

  onDelete(e) {
    const { id } = e.detail;
    wx.showModal({
      title: '删除任务',
      content: '确定要删除这个任务吗？',
      confirmColor: '#E24B4A',
      success: (res) => {
        if (res.confirm) {
          store.deleteTask(id);
          this.loadData();
          wx.showToast({ title: '已删除', icon: 'none' });
        }
      },
    });
  },

  onCreate() {
    wx.navigateTo({ url: '/pages/create/create' });
  },

  onAIInput() {
    wx.navigateTo({ url: '/pages/ai-input/ai-input' });
  },

  onShareAppMessage() {
    return {
      title: 'Todo 清单 - 高效管理你的每日任务',
      path: '/pages/index/index',
    };
  },

  onShareTimeline() {
    return {
      title: 'Todo 清单 - 高效管理你的每日任务',
    };
  },

  onPullDownRefresh() {
    this.loadData();
    wx.stopPullDownRefresh();
  },
});
