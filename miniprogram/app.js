App({
  globalData: {
    userInfo: null,
    theme: 'light',
    // Edit mode for create page: 'create' or 'edit'
    editTask: null,
  },

  onLaunch() {
    // Initialize default data
    this.initApp();
    // Check and auto-generate recurring tasks
    this.checkRecurring();
    // 启动提醒检查
    this.checkReminders();
  },

  onShow() {
    // Check recurring tasks when app comes to foreground
    this.checkRecurring();
    // 检查提醒（带去重保护）
    this.checkReminders();
  },

  checkRecurring() {
    try {
      const store = require('./utils/store');
      store.checkRecurringTasks();
    } catch (e) {
      console.error('checkRecurring error:', e);
    }
  },

  checkReminders() {
    if (this._reminderChecked) return;
    this._reminderChecked = true;
    try {
      const reminder = require('./utils/reminder');
      // 延后一点，等首页渲染完成再弹
      setTimeout(() => {
        if (this._reminderShowing) return;
        this._reminderShowing = true;
        reminder.showReminders(() => {
          this._reminderShowing = false;
        });
      }, 1500);
      // 前台每 60 秒检查一次（稍后提醒到期后再次弹窗）
      if (!this._reminderTimer) {
        this._reminderTimer = setInterval(() => {
          if (this._reminderShowing) return;
          const pending = reminder.getPendingReminders();
          if (pending.length === 0) return;
          this._reminderShowing = true;
          reminder.showReminders(() => {
            this._reminderShowing = false;
          });
        }, 60000);
      }
    } catch (e) {
      console.error('checkReminders error:', e);
    }
  },

  initApp() {
    // Check if first launch
    const initialized = wx.getStorageSync('app_initialized');
    if (!initialized) {
      // Set default categories
      wx.setStorageSync('todo_categories', [
        { id: 'inbox', name: '收件箱', color: '#888888', sort: 0 },
        { id: 'personal', name: '个人', color: '#4A90D9', sort: 1 },
        { id: 'work', name: '工作', color: '#D85A30', sort: 2 },
        { id: 'shopping', name: '购物', color: '#1D9E75', sort: 3 },
      ]);
      // Add sample tasks for first-time users
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      wx.setStorageSync('todo_tasks', [
        {
          id: 'sample1',
          title: '欢迎使用 Todo 清单',
          note: '点击左侧圆圈可以完成任务，点击任务可以查看详情',
          priority: 2,
          category: 'inbox',
          dueDate: today,
          dueTime: '',
          completed: false,
          completedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'sample2',
          title: '试试创建一个新任务',
          note: '点击右下角的 + 按钮创建任务',
          priority: 1,
          category: 'personal',
          dueDate: today,
          dueTime: '',
          completed: false,
          completedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'sample3',
          title: '明天要做的事情',
          note: '',
          priority: 0,
          category: 'work',
          dueDate: tomorrow,
          dueTime: '09:00',
          completed: false,
          completedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
      wx.setStorageSync('app_initialized', true);
    }

    // Get system info for safe area
    const systemInfo = wx.getWindowInfo();
    const menuButton = wx.getMenuButtonBoundingClientRect();
    this.globalData.statusBarHeight = systemInfo.statusBarHeight;
    this.globalData.navBarHeight = (menuButton.top - systemInfo.statusBarHeight) * 2 + menuButton.height;
    this.globalData.screenHeight = systemInfo.screenHeight;
    this.globalData.safeAreaBottom = systemInfo.screenHeight - systemInfo.safeArea.bottom;
  },
});
