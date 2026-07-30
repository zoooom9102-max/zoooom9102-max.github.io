# Wenzo Lee Personal Portfolio

李文政（Wenzo Lee）的个人作品集网站。仓库同时构建主作品集和“多模态 AI 评测与标注思路”项目子站，并将同一套静态产物发布到 GitHub Pages 和腾讯云 CloudBase。

## 正式地址

- CloudBase 主网站（国内访问）：<https://wenzo-lee-d2gosqi9p84442044-1460788976.tcloudbaseapp.com/>
- CloudBase 评测与标注子网站：<https://wenzo-lee-d2gosqi9p84442044-1460788976.tcloudbaseapp.com/work/evaluation-labeling/>
- GitHub Pages 主网站：<https://zoooom9102-max.github.io/>
- GitHub Pages 评测与标注子网站：<https://zoooom9102-max.github.io/work/evaluation-labeling/>

## 仓库结构

```text
.
├─ apps/
│  ├─ portfolio/                 # React + Vite 主作品集
│  └─ evaluation-labeling/       # 静态 Vite 项目子站
├─ scripts/assemble-pages.mjs    # 合并两个构建产物
├─ .github/workflows/            # GitHub Pages 自动部署
├─ cloudbaserc.json              # CloudBase 构建与部署配置
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
npm run verify
```

合并后的静态文件位于 `site/`。

## GitHub Pages 部署方式

推送到 `main` 分支后，`.github/workflows/deploy-pages.yml` 会自动：

1. 安装两个应用的依赖；
2. 分别执行生产构建；
3. 合并静态产物并添加 `.nojekyll`；
4. 上传并部署 GitHub Pages artifact。

也可以在 GitHub 仓库的 **Actions → Deploy portfolio to GitHub Pages → Run workflow** 手动重新部署。

## CloudBase 部署方式

CloudBase 环境 ID 为 `wenzo-lee-d2gosqi9p84442044`，应用名为 `portfolio`，部署到静态网站根路径 `/`。构建参数保存在 `cloudbaserc.json`：

- 安装命令：`npm run install:cloudbase`
- 构建命令：`npm run build:cloudbase`
- 构建产物目录：`site`
- Node.js：22（Git 仓库持续部署）
- Git 源：`zoooom9102-max/zoooom9102-max.github.io` 的 `main` 分支
- 首次成功的 Git 构建版本：`portfolio-005`（2026-07-30）

CloudBase 控制台绑定 GitHub 仓库的 `main` 分支后，推送代码会自动触发构建和发布。手动部署前需安装并登录官方 CLI：

```bash
npm install --global @cloudbase/cli
tcb login
tcb app deploy portfolio
```

CloudBase CLI 的登录凭证仅保存在本机，不应提交 SecretId、SecretKey、Token 或 `.env` 文件。

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

推送完成后 GitHub Actions 和 CloudBase 会分别自动重新发布同一套 `site/` 产物。请等待两个平台的部署状态成功，再检查主站、子站、媒体播放和移动端布局。

CloudBase 免费体验环境当前到期时间为 `2027-01-30 23:59:59`。到期前一个月内可在 **CloudBase 控制台 → 环境管理/套餐管理 → 续费** 手动续期 6 个月，免费体验环境不支持自动续费。

## 媒体说明

当前部署使用约 6.8 MiB 的 `section-scroll-video.mp4` 和约 44.5 MiB 的 `game-cg-montage.mp4`。后续需要更新视频时，直接替换 `apps/portfolio/public/media/` 中的同名文件即可。
