# bilibili-learning-progress

一个用于 `Bilibili` 课程学习页的 Chrome 插件小工具。

它会在 `https://www.bilibili.com/video/*` 页面右下角显示一个悬浮按钮，鼠标移入后展示：

- 当前累计学习时长
- 总课程时长
- 当前学习进度百分比
- Progress Bar
- Pie Chart
- 当前所在课时

统计规则：

- 从 `.video-pod__body > .list > div` 读取课程列表
- 读取每节课的标题和时长
- 找到带有 `.active` 类名的当前课时
- 按页面顺序累计到当前课时为止的总时长
- 用 `累计时长 / 全部课程总时长` 计算学习进度

## 本地开发

要求：

- Node.js >= 14.18
- 推荐使用 `pnpm`

安装依赖：

```bash
pnpm install
```

启动开发：

```bash
pnpm dev
```

## 加载到 Chrome

1. 打开 Chrome 扩展管理页
2. 打开右上角“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择项目构建输出目录 `build`

## 构建

```bash
pnpm build
```

构建完成后，`build` 目录就是可直接加载的扩展内容。

## 使用说明

1. 打开任意 `Bilibili` 视频页，URL 需要匹配 `https://www.bilibili.com/video/*`
2. 确保页面中能看到课程分集列表
3. 页面右下角会出现“进度”悬浮按钮
4. 鼠标移入按钮后，会显示学习进度卡片

## 当前实现说明

- 仅在 `Bilibili` 视频详情页注入
- 通过 `MutationObserver` 监听页面分集列表变化
- 兼容页面异步渲染后的重新统计
- 使用原生 DOM + CSS 绘制悬浮卡片与图表，没有额外图表依赖
