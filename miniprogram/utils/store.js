/**
 * utils/store.js
 * 数据层 - 使用本地存储 (wx.setStorageSync)
 * 设计上可平滑替换为云开发
 * v2: 支持周期任务、生日提醒、AI 配置
 */

const TASKS_KEY = 'todo_tasks';
const CATEGORIES_KEY = 'todo_categories';
const SETTINGS_KEY = 'todo_settings';

/* ==================== Tasks ==================== */

const getTasks = (filter = {}) => {
  const tasks = wx.getStorageSync(TASKS_KEY) || [];
  let result = tasks;

  if (filter.completed !== undefined) {
    result = result.filter((t) => t.completed === filter.completed);
  }
  if (filter.category && filter.category !== 'all') {
    result = result.filter((t) => t.category === filter.category);
  }
  if (filter.dueDate) {
    result = result.filter((t) => t.dueDate === filter.dueDate);
  }
  if (filter.overdue) {
    const today = new Date().toISOString().split('T')[0];
    result = result.filter((t) => t.dueDate && t.dueDate < today && !t.completed);
  }
  if (filter.keyword) {
    const kw = filter.keyword.toLowerCase();
    result = result.filter(
      (t) => t.title.toLowerCase().includes(kw) || (t.note && t.note.toLowerCase().includes(kw))
    );
  }

  // 排序：未完成在前，再按优先级降序，再按到期日期升序，最后按创建时间降序
  return result.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.priority !== b.priority) return b.priority - a.priority;
    if (a.dueDate && b.dueDate) {
      if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueTime && b.dueTime) return a.dueTime.localeCompare(b.dueTime);
      if (a.dueTime) return -1;
      if (b.dueTime) return 1;
      return 0;
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
};

const addTask = (taskData) => {
  const tasks = wx.getStorageSync(TASKS_KEY) || [];
  const now = new Date().toISOString();
  const newTask = {
    id: 't_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    title: taskData.title || '新任务',
    note: taskData.note || '',
    priority: taskData.priority !== undefined ? taskData.priority : 0,
    category: taskData.category || 'inbox',
    dueDate: taskData.dueDate || '',
    dueTime: taskData.dueTime || '',
    completed: false,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    // v2 新增字段
    recurrence: taskData.recurrence || { type: 'none', interval: 1 },
    isBirthday: taskData.isBirthday || false,
    birthdayName: taskData.birthdayName || '',
    calendarType: taskData.calendarType || 'solar',
    // 农历生日的原始数据（用于跨年计算）
    birthdayLunarMonth: taskData.birthdayLunarMonth || 0,
    birthdayLunarDay: taskData.birthdayLunarDay || 0,
    birthdayLunarIsLeap: taskData.birthdayLunarIsLeap || false,
    // 生日提醒提前天数
    birthdayAdvanceDays: taskData.birthdayAdvanceDays || 0,
    // 提醒设置（分钟，null=不提醒）
    reminderOffset: taskData.reminderOffset !== undefined ? taskData.reminderOffset : null,
    snoozeUntil: null,
    parentId: taskData.parentId || null,
  };
  tasks.push(newTask);
  wx.setStorageSync(TASKS_KEY, tasks);
  return newTask;
};

const updateTask = (id, updates) => {
  const tasks = wx.getStorageSync(TASKS_KEY) || [];
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;
  tasks[index] = {
    ...tasks[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  wx.setStorageSync(TASKS_KEY, tasks);
  return tasks[index];
};

const deleteTask = (id) => {
  let tasks = wx.getStorageSync(TASKS_KEY) || [];
  tasks = tasks.filter((t) => t.id !== id);
  wx.setStorageSync(TASKS_KEY, tasks);
  return true;
};

/**
 * 切换任务完成状态
 * 如果是周期任务，完成时自动创建下一次
 * 如果是生日任务，完成时自动计算下一次生日日期
 */
const toggleTask = (id) => {
  const tasks = wx.getStorageSync(TASKS_KEY) || [];
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;

  tasks[index].completed = !tasks[index].completed;
  tasks[index].completedAt = tasks[index].completed ? new Date().toISOString() : null;
  tasks[index].updatedAt = new Date().toISOString();

  // 完成周期任务 → 自动创建下一次
  if (tasks[index].completed && tasks[index].recurrence) {
    const recurrence = tasks[index].recurrence;
    if (recurrence.type && recurrence.type !== 'none') {
      const recurring = require('./recurring');
      const nextDate = recurring.computeNextOccurrence(recurrence, tasks[index].dueDate);

      if (nextDate) {
        // 检查是否已存在同 parentId + 同 dueDate 的任务
        const exists = tasks.some(
          (t) => t.parentId === tasks[index].id && t.dueDate === nextDate
        );
        if (!exists) {
          const now = new Date().toISOString();
          tasks.push({
            ...tasks[index],
            id: 't_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            dueDate: nextDate,
            completed: false,
            completedAt: null,
            createdAt: now,
            updatedAt: now,
            parentId: tasks[index].id,
            snoozeUntil: null,
          });
        }
      }
    }
  }

  // 完成生日任务 → 自动计算下一次生日
  if (tasks[index].completed && tasks[index].isBirthday) {
    const lunar = require('./lunar');
    let nextBirthday = null;

    if (tasks[index].calendarType === 'lunar' && tasks[index].birthdayLunarMonth) {
      nextBirthday = lunar.getNextLunarBirthday(
        tasks[index].birthdayLunarMonth,
        tasks[index].birthdayLunarDay,
        tasks[index].birthdayLunarIsLeap,
        new Date()
      );
    } else {
      // 公历生日：计算明年
      const today = new Date();
      const parts = tasks[index].dueDate.split('-');
      const month = parseInt(parts[1]);
      const day = parseInt(parts[2]);
      const nextYear = today.getFullYear() + 1;
      nextBirthday =
        nextYear + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    }

    if (nextBirthday) {
      // 如果有提前提醒天数，到期日 = 生日 - 提前天数
      let dueDate = nextBirthday;
      if (tasks[index].birthdayAdvanceDays > 0) {
        const d = new Date(nextBirthday + 'T00:00:00');
        d.setDate(d.getDate() - tasks[index].birthdayAdvanceDays);
        dueDate = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      }

      const now = new Date().toISOString();
      tasks.push({
        ...tasks[index],
        id: 't_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        dueDate: dueDate,
        completed: false,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
        parentId: tasks[index].id,
        // 保存实际的生日日期用于显示
        actualBirthday: nextBirthday,
        snoozeUntil: null,
      });
    }
  }

  wx.setStorageSync(TASKS_KEY, tasks);
  return tasks[index];
};

const getTaskById = (id) => {
  const tasks = wx.getStorageSync(TASKS_KEY) || [];
  return tasks.find((t) => t.id === id) || null;
};

/**
 * 检查并生成逾期的周期任务
 * 应在 app onShow 时调用
 */
const checkRecurringTasks = () => {
  const tasks = wx.getStorageSync(TASKS_KEY) || [];
  const recurring = require('./recurring');
  const newTasks = recurring.checkAndGenerateRecurring(tasks);

  if (newTasks.length > 0) {
    const allTasks = [...tasks, ...newTasks];
    wx.setStorageSync(TASKS_KEY, allTasks);
  }

  return newTasks.length;
};

/* ==================== Categories ==================== */

const getCategories = () => {
  return wx.getStorageSync(CATEGORIES_KEY) || [];
};

const getCategoryById = (id) => {
  const cats = getCategories();
  return cats.find((c) => c.id === id) || { id: 'inbox', name: '收件箱', color: '#888888' };
};

/* ==================== Stats ==================== */

const getStats = () => {
  const tasks = wx.getStorageSync(TASKS_KEY) || [];
  const today = new Date().toISOString().split('T')[0];

  const todayTasks = tasks.filter((t) => t.dueDate === today);
  const overdueTasks = tasks.filter((t) => t.dueDate && t.dueDate < today && !t.completed);
  const completedToday = tasks.filter(
    (t) => t.completed && t.completedAt && t.completedAt.startsWith(today)
  );
  const allCompleted = tasks.filter((t) => t.completed);
  const allPending = tasks.filter((t) => !t.completed);

  // 计算连续完成天数
  let streak = 0;
  const dateSet = new Set();
  allCompleted.forEach((t) => {
    if (t.completedAt) {
      dateSet.add(t.completedAt.split('T')[0]);
    }
  });
  let checkDate = new Date();
  if (!dateSet.has(checkDate.toISOString().split('T')[0])) {
    checkDate.setDate(checkDate.getDate() - 1);
  }
  while (dateSet.has(checkDate.toISOString().split('T')[0])) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  // 统计生日任务数
  const birthdayTasks = allPending.filter((t) => t.isBirthday);

  // 待提醒任务数（本地提醒引擎）
  let pendingReminders = 0;
  const now = Date.now();
  allPending.forEach((t) => {
    if (t.reminderOffset === null || t.reminderOffset === undefined || !t.dueDate) return;
    const [y, m, d] = t.dueDate.split('-').map(Number);
    let hh = 9;
    let mm = 0;
    if (t.dueTime) {
      const p = t.dueTime.split(':');
      hh = parseInt(p[0]) || 0;
      mm = parseInt(p[1]) || 0;
    }
    const ts = new Date(y, m - 1, d, hh, mm, 0, 0).getTime() - (t.reminderOffset || 0) * 60000;
    if (ts <= now && (!t.snoozeUntil || t.snoozeUntil <= now)) pendingReminders++;
  });

  return {
    total: tasks.length,
    pending: allPending.length,
    completed: allCompleted.length,
    todayTotal: todayTasks.length,
    todayCompleted: todayTasks.filter((t) => t.completed).length,
    todayPending: todayTasks.filter((t) => !t.completed).length,
    overdue: overdueTasks.length,
    completionRate: tasks.length > 0 ? Math.round((allCompleted.length / tasks.length) * 100) : 0,
    streak: streak,
    birthdayCount: birthdayTasks.length,
    pendingReminders: pendingReminders,
  };
};

/* ==================== Settings ==================== */

const getSettings = () => {
  return (
    wx.getStorageSync(SETTINGS_KEY) || {
      notifyEnabled: false,
      sortBy: 'priority',
      theme: 'light',
      // AI 配置
      apiBaseUrl: '',
      apiKey: '',
      model: 'gpt-4o-mini',
      sttUrl: '',
      systemPrompt: '',
      aiMode: 'direct', // 'direct' 直连 | 'cloud' 云函数转发
      cloudEnv: '', // 云开发环境 ID（aiMode==='cloud' 时需要）
    }
  );
};

const updateSettings = (updates) => {
  const current = getSettings();
  const newSettings = { ...current, ...updates };
  wx.setStorageSync(SETTINGS_KEY, newSettings);
  return newSettings;
};

/* ==================== Batch Operations ==================== */

/**
 * 批量删除已完成的任务（保留周期任务的父记录）
 */
const clearCompleted = () => {
  let tasks = wx.getStorageSync(TASKS_KEY) || [];
  tasks = tasks.filter((t) => !t.completed);
  wx.setStorageSync(TASKS_KEY, tasks);
  return tasks.length;
};

module.exports = {
  getTasks,
  addTask,
  updateTask,
  deleteTask,
  toggleTask,
  getTaskById,
  checkRecurringTasks,
  getCategories,
  getCategoryById,
  getStats,
  getSettings,
  updateSettings,
  clearCompleted,
};
