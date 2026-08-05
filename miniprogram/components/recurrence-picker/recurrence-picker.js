Component({
  properties: {
    recurrence: {
      type: Object,
      value: { type: 'none', interval: 1 },
    },
    show: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    typeOptions: [
      { value: 'none', label: '不重复' },
      { value: 'daily', label: '每天' },
      { value: 'weekly', label: '每周' },
      { value: 'monthly', label: '每月' },
      { value: 'quarterly', label: '每季度' },
      { value: 'yearly', label: '每年' },
    ],
    weekdayOptions: [
      { value: 0, label: '日' },
      { value: 1, label: '一' },
      { value: 2, label: '二' },
      { value: 3, label: '三' },
      { value: 4, label: '四' },
      { value: 5, label: '五' },
      { value: 6, label: '六' },
    ],
    // 季度第 N 周（一个季度约 13 周）
    weekOfQuarterOptions: Array.from({ length: 13 }, (_, i) => ({
      value: i + 1,
      label: `第${i + 1}周`,
    })),
    // 本地编辑态
    localType: 'none',
    localInterval: 1,
    localDayOfWeek: null,
    localDayOfMonth: null,
    localMonthOfYear: null,
    localMode: 'date',
    localWeekOfQuarter: 2,
    todayDayOfWeek: 0,
  },

  observers: {
    recurrence: function (val) {
      if (val) {
        this.setData({
          localType: val.type || 'none',
          localInterval: val.interval || 1,
          localDayOfWeek: val.dayOfWeek !== undefined ? val.dayOfWeek : null,
          localDayOfMonth: val.dayOfMonth || null,
          localMonthOfYear: val.monthOfYear || null,
          localMode: val.mode || (val.weekOfQuarter ? 'week' : 'date'),
          localWeekOfQuarter: val.weekOfQuarter || 2,
        });
      }
    },
  },

  lifetimes: {
    attached() {
      this.setData({ todayDayOfWeek: new Date().getDay() });
    },
  },

  methods: {
    onTypeSelect(e) {
      const type = e.currentTarget.dataset.value;
      const updates = { localType: type };

      if (type === 'weekly' && this.data.localDayOfWeek === null) {
        updates.localDayOfWeek = this.data.todayDayOfWeek;
      }
      if (type === 'monthly' && !this.data.localDayOfMonth) {
        updates.localDayOfMonth = new Date().getDate();
      }
      if (type === 'quarterly') {
        if (!this.data.localMode || (this.data.localMode === 'date' && !this.data.localDayOfMonth)) {
          updates.localMode = 'date';
          updates.localDayOfMonth = new Date().getDate();
        }
      }
      if (type === 'yearly' && !this.data.localMonthOfYear) {
        updates.localMonthOfYear = new Date().getMonth() + 1;
        updates.localDayOfMonth = new Date().getDate();
      }

      this.setData(updates);
    },

    onIntervalChange(e) {
      const v = parseInt(e.currentTarget.dataset.value);
      if (v >= 1) this.setData({ localInterval: v });
    },

    onWeekdaySelect(e) {
      this.setData({ localDayOfWeek: parseInt(e.currentTarget.dataset.value) });
    },

    onDayOfMonthInput(e) {
      const v = parseInt(e.detail.value) || 1;
      this.setData({ localDayOfMonth: Math.max(1, Math.min(31, v)) });
    },

    onMonthSelect(e) {
      this.setData({ localMonthOfYear: parseInt(e.currentTarget.dataset.value) });
    },

    // 季度：切换 按周次 / 按日期
    onQuarterlyModeChange(e) {
      const mode = e.currentTarget.dataset.mode;
      if (mode === 'week') {
        this.setData({
          localMode: 'week',
          localWeekOfQuarter: this.data.localWeekOfQuarter || 2,
          localDayOfWeek: this.data.localDayOfWeek === null ? this.data.todayDayOfWeek : this.data.localDayOfWeek,
          localDayOfMonth: null,
        });
      } else {
        this.setData({
          localMode: 'date',
          localDayOfMonth: this.data.localDayOfMonth || new Date().getDate(),
          localWeekOfQuarter: null,
          localDayOfWeek: null,
        });
      }
    },

    onWeekOfQuarterSelect(e) {
      this.setData({ localWeekOfQuarter: parseInt(e.currentTarget.dataset.value) });
    },

    onConfirm() {
      const result = {
        type: this.data.localType,
        interval: this.data.localInterval,
        dayOfWeek: this.data.localDayOfWeek,
        dayOfMonth: this.data.localDayOfMonth,
        monthOfYear: this.data.localMonthOfYear,
        mode: this.data.localMode,
        weekOfQuarter: this.data.localWeekOfQuarter,
      };

      if (result.type === 'none') {
        Object.assign(result, {
          interval: 1, dayOfWeek: null, dayOfMonth: null,
          monthOfYear: null, mode: 'date', weekOfQuarter: null,
        });
      } else if (result.type === 'daily') {
        Object.assign(result, {
          dayOfWeek: null, dayOfMonth: null, monthOfYear: null,
          mode: 'date', weekOfQuarter: null,
        });
      } else if (result.type === 'weekly') {
        Object.assign(result, {
          dayOfMonth: null, monthOfYear: null, mode: 'date', weekOfQuarter: null,
        });
      } else if (result.type === 'monthly') {
        Object.assign(result, {
          monthOfYear: null, mode: 'date', weekOfQuarter: null, dayOfWeek: null,
        });
      } else if (result.type === 'quarterly') {
        // 季度：根据模式保留对应字段
        if (result.mode === 'week') {
          result.dayOfMonth = null;
          result.monthOfYear = null;
        } else {
          result.weekOfQuarter = null;
          result.dayOfWeek = null;
          result.monthOfYear = null;
        }
      } else if (result.type === 'yearly') {
        Object.assign(result, { mode: 'date', weekOfQuarter: null, dayOfWeek: null });
      }

      this.triggerEvent('confirm', { recurrence: result });
    },

    onCancel() {
      this.triggerEvent('cancel');
    },
  },
});
