# NOESIS

NOESIS 是一款本地优先的个人思想卡片 App，使用 Expo、React Native 和 TypeScript 构建，数据保存在设备的 SQLite 数据库中。

```powershell
cd D:\Auto-Research\NOESIS
npm install
npm start
```

在 Expo Go 中扫描终端显示的二维码。手机与开发电脑需能访问同一个局域网开发服务器。

## 功能

- 命题、概念和来源卡片，支持 Markdown 正文、标签、收藏、搜索和自动保存
- 卡牌翻面、滑动，牌组封面与管理
- 卡片关系、可拖动缩放的思想图谱
- 来源引用、修订历史、文本差异和历史版本恢复
- 本地 SQLite 持久化与数据库迁移
- 完整 JSON 备份，以及 Markdown 和 CSV 批量导入导出
- 深色和浅色主题

云同步和 AI 服务尚未接入；项目留有接口供后续扩展。

## 数据

设置页可导出完整 JSON 备份并恢复。恢复会替换本机所有数据，请先备份。Markdown 导出包含卡片 ID，修改后可重新导入并更新原卡片。设置页还可以导出全部卡片的 CSV，在表格软件中修改后重新导入；空 ID 创建新卡，已有 ID 更新对应卡片。导入内容变更会写入修订历史。不能使用已软删除卡片的 ID。

Markdown 示例见 `examples/thought.md`；CSV 示例见 `examples/thoughts.csv`。支持字段为 `id`、`title`、`summary`、`content`、`type`、`status`、`tags`、`decks`。Markdown 的标签和牌组是 YAML 列表；CSV 可使用分号分隔多个值，导出时则使用 JSON 列表以保留包含分号的名称。可一次选择多个 Markdown/CSV 文件；更新时未提供的字段保留原值。CSV 中包含但为空的摘要、正文、标签或牌组字段会清空对应值；Markdown 正文始终替换原正文。不存在的牌组会创建；重名牌组会使整批导入回滚。关系和版本历史使用 JSON 备份迁移。批量更新前建议导出 JSON 备份。

## 当前进度

当前是开发中的基础版本，并非需求文档的完整交付。已初步实现卡片 CRUD、自动保存、标签和收藏、内容修订及差异、牌组管理、来源引用、关系、图谱、搜索、JSON 备份、Markdown/CSV 导入和演示数据。仍需真机验证，以及补齐完整手势与动画、同步预留等功能。

开发检查：`npx tsc --noEmit` 和 `npm test`。测试使用 Node 的 SQLite 适配器检查数据操作，不替代手机上的 Expo 原生运行测试。
