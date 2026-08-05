Component({
  properties: {
    task: {
      type: Object,
      value: {},
    },
    showCategory: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    priorityColors: {
      3: '#E24B4A',
      2: '#EF9F27',
      1: '#4A90D9',
      0: '#CCCCCC',
    },
    priorityLabels: {
      3: '高',
      2: '中',
      1: '低',
      0: '',
    },
  },

  methods: {
    onToggle() {
      this.triggerEvent('toggle', { id: this.data.task.id });
    },

    onTap() {
      this.triggerEvent('tap', { id: this.data.task.id });
    },

    onDelete() {
      this.triggerEvent('delete', { id: this.data.task.id });
    },
  },
});
