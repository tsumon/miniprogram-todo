const store = require('../../utils/store');
const dateUtil = require('../../utils/date');
const recurring = require('../../utils/recurring');
const lunar = require('../../utils/lunar');

Page({
  data: {
    activeTab: 'all',
    tabs: [
      { key: 'all', label: '全部' },
      { key: 'today', label: '今天' },
      { key: 'upcoming', label: '即将' },
      { key: 'completed', label: '已完成' },
    ],
    searchValue: '',
    tasks: [],
    categories: [],
    groupedTasks: [],
    loading: true,
    today: '',
  },

  onLoad() {
    this.setData({
      today: dateUtil.getToday(),
      categories: store.getCategories(),
    });
  },

  onShow() {
    this.loadData();
  },

  loadData() {
    const today = dateUtil.getToday();
    const upcomingDates = dateUtil.getUpcomingDates();
    let filter = {};

    switch (this.data.activeTab) {
      case 'today':
        filter = { dueDate: today, completed: false };
        break;
      case 'upcoming':
        filter = { completed: false };
        break;
      case 'completed':
        filter = { completed: true };
        break;
      default:
        filter = {};
    }

    if (this.data.searchValue) {
      filter.keyword = this.data.searchValue;
    }

    let tasks = store.getTasks(filter);

    // For upcoming tab, filter to future dates only
    if (this.data.activeTab === 'upcoming') {
      tasks = tasks.filter((t) => t.dueDate && t.dueDate > today && upcomingDates.includes(t.dueDate));
    }

    // Process tasks with display info
    tasks = tasks.map((t) => {
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
        isOverdue: t.dueDate && t.dueDate < today && !t.completed,
        categoryName: cat.name,
        categoryColor: cat.color,
        recurrenceLabel: recurrenceLabel,
        birthdayLabel: birthdayLabel,
      };
    });

    // Group tasks by date for display
    let groupedTasks = [];
    if (this.data.activeTab === 'all' || this.data.activeTab === 'upcoming') {
      const groups = {};
      tasks.forEach((t) => {
        const key = t.dueDate || 'no-date';
        if (!groups[key]) {
          groups[key] = {
            date: key,
            label: t.dueDate ? dateUtil.formatDateLabel(t.dueDate) : '未安排',
            tasks: [],
          };
        }
        groups[key].tasks.push(t);
      });
      groupedTasks = Object.values(groups).sort((a, b) => {
        if (a.date === 'no-date') return 1;
        if (b.date === 'no-date') return -1;
        return a.date.localeCompare(b.date);
      });
    }

    this.setData({
      tasks,
      groupedTasks,
      loading: false,
    });
  },

  onTabChange(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ activeTab: key, loading: true });
    this.loadData();
  },

  onSearch(e) {
    this.setData({ searchValue: e.detail.value });
    this.loadData();
  },

  onSearchClear() {
    this.setData({ searchValue: '' });
    this.loadData();
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
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
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

  onShareAppMessage() {
    return {
      title: 'Todo 清单 - 高效管理你的每日任务',
      path: '/pages/index/index',
    };
  },
});
