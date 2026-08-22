# sg-helper

新加坡女佣雇佣管理私有项目。覆盖四件事：

1. **法律与流程研究** — MOM 雇佣外籍女佣（MDW）的法规、成本与完整流程
2. **中介情报** — 主流中介的真实评论、联系方式、收费与口碑对比
3. **候选人档案** — 每份女佣简历生成一个标准 HTML 档案，便于对比选择
4. **入职规划** — 确定人选后的 WP 申请、保险、接机、到岗 checklist

> **Public 仓库 + GitHub Pages**：在线预览 https://kindle0088-sys.github.io/sg-helper/
>
> **脱敏策略（重要）**：仓库公开，凡涉及候选人个人信息的字段一律脱敏入库——
> - 姓名 → 缩写（如 `S.N.（印尼）`），不存全名
> - 照片、身份证件、联系方式 → 不入库，仅存本地 `data/candidates/raw/`（已 gitignore）
> - 页面/JSON 中出现的电话号码、住址等 → 一律脱敏或省略
> - 简历原件 PDF/图片只存在本地，不发到任何公开渠道

## 目录结构

```
sg-helper/
├── docs/                # 法律与流程研究（Markdown）
├── data/                # 结构化数据（手动维护入口）
│   ├── agencies.json    # 中介主数据
│   ├── candidates/      # 候选人 JSON（一人一文件，raw/ 简历原件不入库）
│   └── decisions.md     # 决策日志
├── scripts/             # Node.js 构建脚本（JSON → HTML）
├── agencies/            # 生成：中介详情页 + 对比报告
├── candidates/          # 生成：候选人档案页
├── index.html           # 生成：项目看板
└── logs/                # 运行日志（不入库）
```

## 数据流

```
手动/抓取数据 → data/*.json → scripts/build-*.mjs → agencies/ candidates/ index.html
```

## 部署

GitHub Pages 从 `main` 分支根目录自动部署，push 即生效。
在线地址：https://kindle0088-sys.github.io/sg-helper/

## 状态

- [x] 仓库骨架（public + GitHub Pages 就绪）
- [ ] 阶段 2：MOM 法律流程研究（docs/）
- [ ] 阶段 3：中介清单 + 评论收集（小红书 / Google / 官网）
- [ ] 阶段 4：中介对比评分
- [ ] 阶段 5：候选人档案模板 + 生成脚本
- [ ] 阶段 6：入职 checklist 工具

## 常用命令

```bash
npm run build            # 重新生成所有页面
npm run build:agency     # 只生成中介报告
npm run build:candidate  # 只生成候选人档案
```
