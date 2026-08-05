# Todo 清单 - 微信小程序

一个参考嘀嗒清单设计的待办事项管理小程序，使用原生开发，开箱即用。

## 功能特性

- **今日待办**: 展示今天到期和逾期的任务，支持进度追踪
- **全部任务**: 按日期分组展示所有任务，支持搜索和状态筛选
- **新建任务**: 快速创建任务，支持优先级/日期/时间/分类
- **任务详情**: 查看/编辑任务，一键完成或删除
- **个人中心**: 完成统计、连续打卡天数、今日进度
- **数据本地存储**: 无需服务器，打开即用，数据保存在本地

## 快速开始

### 1. 导入项目

1. 打开微信开发者工具
2. 选择「导入项目」
3. 项目目录选择 `todo-miniprogram` 文件夹
4. AppID 可以选择「测试号」或填入你自己的 AppID

### 2. 运行项目

导入后即可直接运行，无需安装任何依赖。数据使用本地存储，首次启动会自动生成示例任务。

### 3. 目录结构

```
todo-miniprogram/
├── project.config.json          # 项目配置
├── miniprogram/
│   ├── app.js                    # App 入口 & 全局数据
│   ├── app.json                  # 全局配置 (页面路由/tabBar)
│   ├── app.wxss                  # 全局样式
│   ├── sitemap.json              # 搜索索引
│   ├── pages/
│   │   ├── index/                # 今日待办 (首页)
│   │   ├── all/                  # 全部任务
│   │   ├── create/               # 新建任务
│   │   ├── detail/               # 任务详情
│   │   └── profile/              # 个人中心
│   ├── components/
│   │   ├── task-item/            # 任务列表项组件
│   │   └── empty-state/          # 空状态组件
│   └── utils/
│       ├── store.js              # 数据层 (本地存储 CRUD)
│       └── date.js               # 日期工具函数
```

## 后续升级指南

### 接入云开发

当前版本使用本地存储，后续可平滑升级到微信云开发：

1. 在 `app.json` 中添加 `"cloud": true`
2. 在 `app.js` 中初始化 `wx.cloud.init()`
3. 将 `utils/store.js` 中的本地存储操作替换为云数据库操作
4. 部署云函数处理敏感操作

### 添加订阅消息

1. 在微信公众平台申请订阅消息模板
2. 在创建任务时调用 `wx.requestSubscribeMessage`
3. 部署云函数 `sendSubscribeMessage` 定时推送提醒

### 添加 tabBar 图标

1. 准备 6 张图标 (3 个 tab × 普通/选中状态)
2. 图标尺寸 81px×81px，格式 PNG
3. 放入 `miniprogram/assets/tab/` 目录
4. 在 `app.json` 的 tabBar 中配置 iconPath

## 技术栈

- 原生微信小程序开发 (WXML/WXSS/JS)
- 本地存储 (wx.setStorageSync)
- 纯 CSS 绘制图标 (无图片依赖)

## 版本

v1.0.0 - 初始版本
