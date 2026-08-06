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
    // 按需初始化云开发（仅当 AI 调用方式设为「云函数」且配置了环境 ID）
    this.initCloud();
    // Check and auto-generate recurring tasks
    this.checkRecurring();
    // 启动提醒检查
    this.checkReminders();
  },

  initCloud() {
    try {
      const store = require('./utils/store');
      const settings = store.getSettings();
      // 只要配置了云环境 ID 就初始化（AI 云函数转发 / 服务通知推送都用它）
      if (settings.cloudEnv && typeof wx.cloud !== 'undefined') {
        wx.cloud.init({
          env: settings.cloudEnv,
          traceUser: true,
        });
      }
    } catch (e) {
      console.error('initCloud error:', e);
    }
  },

  onShow() {
    // Check recurring tasks when app comes to foreground
    this.checkRecurring();
    // 检查提醒（带去重保护）
    this.checkReminders();
    // 同步待提醒任务到云端 + 每日申请订阅授权（服务通知推送）
    this.syncPush();
  },

  /**
   * 服务通知推送：同步任务到云端。
   * 注意：订阅授权必须由用户点击触发（微信限制），后台自动调用无效，
   * 所以在「设置页 - 立即同步任务/申请推送权限」的手势里请求授权。
   * 这里每天提示一次去授权，避免忘记。
   */
  syncPush() {
    try {
      const push = require('./utils/push');
      if (!push.isReady()) return;
      push.sync();
      // 每天提示一次去设置页授权（一次性订阅需每天攒 1 次）
      const lastAsk = wx.getStorageSync('push_ask_date');
      const today = new Date().toISOString().split('T')[0];
      if (lastAsk !== today) {
        wx.setStorageSync('push_ask_date', today);
        setTimeout(() => {
          wx.showModal({
            title: '开启服务通知',
            content: '微信规定订阅授权需手动点击。到「我的 → 设置 → 服务通知推送」点一次「申请推送权限」，每天可攒 1 次推送机会。',
            confirmText: '去设置',
            cancelText: '知道了',
            success: (res) => {
              if (res.confirm) wx.switchTab({ url: '/pages/profile/profile' });
            },
          });
        }, 1500);
      }
    } catch (e) {
      console.error('syncPush error:', e);
    }
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
    try {
      const reminder = require('./utils/reminder');

      // 一次性：启动 60 秒定时器（后台可能暂停，但 onShow 会补检）
      if (!this._reminderTimer) {
        this._reminderTimer = setInterval(() => {
          try {
            this._showRemindersOnce(reminder);
          } catch (e) {
            this._reminderShowing = false;
            console.error('interval reminder error:', e);
          }
        }, 60000);
      }

      // 每次调用都即时检查提醒
      this._showRemindersOnce(reminder);
    } catch (e) {
      console.error('checkReminders error:', e);
    }
  },

  /**
   * 展示一次提醒弹窗队列（带并发保护）
   */
  _showRemindersOnce(reminder) {
    if (this._reminderShowing) return;
    const pending = reminder.getPendingReminders();
    if (pending.length === 0) return;
    this._reminderShowing = true;
    reminder.showReminders(() => {
      this._reminderShowing = false;
    });
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
