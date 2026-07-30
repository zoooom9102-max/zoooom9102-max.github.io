# Wenzo Lee Personal Portfolio

李文政（Wenzo Lee）的个人作品集网站。仓库同时构建主作品集和“多模态 AI 评测与标注思路”项目子站，并通过 GitHub Pages 发布到同一域名。

## 正式地址

- 主网站：<https://zoooom9102-max.github.io/>
- 评测与标注子网站：<https://zoooom9102-max.github.io/work/evaluation-labeling/>

## 仓库结构

```text
.
├─ apps/
│  ├─ portfolio/                 # React + Vite 主作品集
│  └─ evaluation-labeling/       # 静态 Vite 项目子站
├─ scripts/assemble-pages.mjs    # 合并两个构建产物
├─ .github/workflows/            # GitHub Pages 自动部署
├─ .nojekyll                     # 禁用 Jekyll 处理
└─ README.md
```

GitHub Actions 会把主站输出到网站根目录，并把子站输出到 `work/evaluation-labeling/`。

## 本地预览

环境要求：Node.js 22。

主网站：

```bash
cd apps/portfolio
npm ci
npm run dev
```

项目子网站：

```bash
cd apps/evaluation-labeling
npm ci
npm run dev
```

完整构建：

```bash
npm ci --prefix apps/portfolio
npm ci --prefix apps/evaluation-labeling
npm run build
```

合并后的静态文件位于 `site/`。

## GitHub Pages 部署方式

推送到 `main` 分支后，`.github/workflows/deploy-pages.yml` 会自动：

1. 安装两个应用的依赖；
2. 分别执行生产构建；
3. 合并静态产物并添加 `.nojekyll`；
4. 上传并部署 GitHub Pages artifact。

也可以在 GitHub 仓库的 **Actions → Deploy portfolio to GitHub Pages → Run workflow** 手动重新部署。

## 新增一个项目子页面

1. 在 `apps/` 下新建独立应用目录，例如 `apps/new-project/`。
2. 为 Vite 项目设置对应 base，例如 `/work/new-project/`。
3. 在 `scripts/assemble-pages.mjs` 中把该应用的 `dist/` 复制到 `site/work/new-project/`。
4. 在工作流中增加依赖安装与构建步骤。
5. 在主站 `apps/portfolio/src/data/projects.ts` 中增加或更新入口 URL。

## 修改项目封面和链接

- 封面文件：`apps/portfolio/public/media/eval-method-cover.png`
- 项目文案与线上地址：`apps/portfolio/src/data/projects.ts`
- 项目卡片的打开方式：`apps/portfolio/src/pages/ProjectsPage.tsx`

替换同名封面文件后不需要修改组件代码。

## 更新并重新发布

```bash
git pull --ff-only
# 修改并本地验证
npm run build
git add .
git commit -m "Update portfolio content"
git push origin main
```

推送完成后 GitHub Actions 会自动重新发布。请先等待 Pages 工作流变为绿色，再检查主站、子站、媒体播放和移动端布局。

## 媒体说明

当前部署暂时保留约 73 MiB 的 `game-cg-montage.webm`。后续获得小于 50 MiB 的版本时，替换 `apps/portfolio/public/media/game-cg-montage.webm`，保持文件名不变即可。

