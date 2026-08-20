# dsh-ui-polish · 界面焕新

DeepSeek Harness Code 的**注入式界面美化插件**：不改任何官方文件，通过官方客户端模块/插槽（slot）机制注入一张样式表、一个视口守卫脚本和一个设置页，卸载即还原。

## 功能（四个可独立开关的分组）

| 分组             | 说明                                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| 全局动效         | 消息入场、菜单逐项弹出、对话框升起、按钮按压回弹、悬浮反馈；遵循系统「减弱动态效果」                 |
| 模型二级菜单修复 | 二级飞出菜单改从一级菜单**左侧**展开（原版在窗口右边缘顶满/被遮挡）；视口空间不足时自动换边或收窄    |
| 侧边栏质感       | 会话行圆角 + 悬浮反馈、选中会话的高亮指示条、底部按钮过渡                                            |
| 设置面板清晰化   | 设置弹窗导航药丸态、正文排版节奏、表单聚焦描边；并把「插件管理」（super-injector）页面重排为原生风格 |

另含全局质感打底：细圆角滚动条、主题色文本选中色（始终启用，跟随 `--dsw-*` 设计令牌，明暗主题通用）。

## 安装（任选其一）

**A. 通过 dsh-super-injector（推荐，热加载）**

在应用内打开 设置 → 插件管理，把本目录路径填入输入框，点「直接注入」；或对 Agent 说：

> 注入 `/Users/trip/TRUE 开发/deepseek/dsh-ui-polish` 这个插件

**B. 通过 web profile（持久安装）**

在 `dsh-home/profiles/web/package.json` 的 `dependencies` 与 `dsh.profile.bundles` 中加入本目录的 link 依赖，然后重载插件。

## 配置

打开 **设置 → 界面焕新**，四个分组各有独立开关，改动**即时生效、无需刷新**，配置保存在本机 `localStorage`。

## 技术要点

- 客户端模块：`window.__ModuleLoader__.load()` 注册，`exports.inject = ['slots']`。
- 设置页：`slots.register({ name: 'settings.section', id: 'ui-polish', order: 80 })`。
- 开关实现：`<html>` 上的 `data-uip-<group>="off"` 属性 + CSS `:root:not(...)` 门控，即时切换。
- 二级菜单守卫：`MutationObserver` 监听 `.m2-flyout` 挂载，按一级菜单位置计算左右剩余空间，选择最佳一侧（`data-uip-side="right"`）或收敛 `max-width`。
- 所有颜色取自 `--dsw-*` 设计令牌；动画全部包裹在 `prefers-reduced-motion: no-preference` 内。
