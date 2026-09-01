# Glass Effect

自研的液态玻璃主题插件：真实折射 + 磨砂质感，**零第三方依赖**（相关库的代码以 vendor 方式内联，见[致谢](#致谢)）。

- 目录：`user-plugins/<repo>/glass-effect/`
- 依赖：无（`package.json` 没有 dependencies）
- 主题 id：`glass-effect`（Settings → Appearance 中切换）
- 调参 widget：`glass-effect-tuner`（Settings → Widgets 中调整）

## 效果

面板背景在边缘处真实弯曲折射、中央保持清透，叠加磨砂模糊、饱和度提升、1px 渐变 rim 与顶部高光。折射引擎可在设置中切换：

| 引擎 | 相图来源 | 特点 |
| --- | --- | --- |
| `lens`（默认） | [simple-liquid-glass](https://github.com/lucaperullo/simple-liquid-glass) 的参数化生成器 | 运行时按元素尺寸/圆角生成 SVG 相图，4 种透镜模式（classic / convex / rim / shift），边缘带宽自动适配强度防撕裂 |
| `lgr` | [liquid-glass-react](https://github.com/rdev/liquid-glass-react) 内置的 3 张静态贴图 | 上游滤镜管线移植（负 scale 三通道色差、screen 合成、微模糊；**上游的"边缘遮罩+中央清透合成"链是恒等函数，已删除**，见[性能深挖](#性能深挖lgr-为什么比-lens-卡))；standard / polar / prominent 三种固定外观，贴图拉伸铺满元素 |
| `noise` | 自研 feTurbulence 噪声场 | 无图片依赖；噪声式扭曲而非光学折射，同时作为相图未就绪时的回退 |

> 折射仅在 Chromium（Chrome / Edge）生效——Safari / Firefox 不支持在 `backdrop-filter` 中运行 SVG 滤镜，这些浏览器上所有引擎都表现为纯磨砂。

## 实现

### 分层结构

`LiquidGlassSurface.tsx` 渲染 3 个堆叠层（都在内容的负 z-index 之下）：

1. **折射层 `.slg-glass`** —— `backdrop-filter: blur() saturate() url(#自建滤镜)`
2. **渐变边框 `.slg-border`** —— 1px 渐变 rim（padding-box mask 技巧）
3. **顶部高光 `.slg-shine`** —— 对角白色渐变

这三个层都是 `position: absolute; inset: 0`，**锚定到最近的已定位祖先**——也就是宿主传给 `ThemeSurface` 的那个元素自身。宿主侧的契约：使用 `LiquidGlassSurface`（`ThemeSurface`）时必须在 `className` 里自带定位（`relative` 或 `absolute`），否则玻璃层会撑满整个页面级的定位祖先（如 `.dashboard-grid`），面板本体则完全透明——漏掉 `relative` 的典型症状就是"玻璃铺满全屏、面板消失"。

### 滤镜管线

三种引擎共享同一骨架：一张"相图"（displacement map）输入 `feDisplacementMap`，按 R/G/B 三通道分别位移后用 `feColorMatrix` 抽取、`feBlend screen` 合成，即色差（chromatic aberration）。区别只在相图从哪来：

```
lens:  运行时 SVG 字符串（渐变+遮罩） → Blob → blob: URL → PNG 栅格化 → feImage
lgr:   内嵌 base64 JPEG/PNG          → Blob → blob: URL → feImage（恒等遮罩链已删，见下方性能深挖）
noise: feTurbulence 程序化噪声（无需任何图片）
```

`lens` 的相图生成器 vendored 在 `slg/displacementMap.ts`，blob URL 缓存在 `slg/mapUrl.ts`（按量化后的尺寸+参数做 key，同一尺寸的面板共享）；`lgr` 的贴图与滤镜分别在 `lgr/maps.ts`、`lgr/LgrGlassFilter.tsx`。

## ⚠️ 踩坑记录：为什么"折射"这么难搞

### 现象

`liquid-glass-react`、`simple-liquid-glass` 等库把位移贴图以 `data:` URI 塞进 `feImage`：

```xml
<feImage href="data:image/png;base64,..." />
```

在我们早期的实测中（Chrome ~13x，MV3 扩展页面），这张贴图加载不出来 → `feDisplacementMap` 拿到空图 → 折射静默失效（不报错，只是没效果），于是当时得出"data: 一律被屏蔽"的结论并转向了 feTurbulence 方案。

### 后续修正（2026-08）

调研上游源码后发现结论下早了：

- **simple-liquid-glass 4.x 的卖点就是 Chromium 真折射**，而它喂给 `feImage` 的是 `data:image/svg+xml`（运行时生成的 SVG，不是 PNG）；
- 它承载滤镜的 `<svg>` 是**实际渲染的**（absolute inset:0 全尺寸），而我们是 `<svg width="0" height="0">`；
- 实测确认可用的是 `feImage` + **`blob:` URL**（运行时 `Blob` + `createObjectURL`）。

因此当前实现统一走 blob: URL 路线，并把滤镜宿主 svg 改为全尺寸渲染。如果以后想进一步省掉 Blob 管理，值得重测的矩阵是：① `data:image/svg+xml` vs `data:image/png`；② defs svg 全尺寸 vs 0×0。

### 关键实测事实（保留）

- `backdrop-filter: url(#svg滤镜)` 在 Chromium 是支持的（旧印象认为不支持，实测正常工作）
- `feTurbulence`（程序化噪声）在该场景完全可用
- `feImage` + `data:` URI → 曾实测失效；`feImage` + `blob:` URL → 可用
- Safari / iOS / Firefox：SVG 滤镜在 `backdrop-filter` 中不执行，静默降级为普通模糊
- **性能（2025-09 实测）**：`backdrop-filter` 里的 `feImage` 若直接引用运行时生成的 SVG blob，整页滚动/hover 会严重掉帧（Chromium 对 filter 内的外部 SVG 资源几乎每次求值都重新光栅化，而我们的 SVG 内部还有 mask/blur/blend，成本极高）。把 SVG 相图**运行时栅格化为 PNG blob**（canvas 导出，每个相图 key 一次）后完全丝滑——PNG 走普通图像解码缓存。曾尝试换赛道用 `filter: url()` 折射自带的 `background-attachment: fixed` 壁纸拷贝来绕开 backdrop-filter，结果 Chromium 在被滤镜元素上把 fixed 附件当 scroll 处理，壁纸撕裂错位，已废弃。

### 性能深挖：`lgr` 为什么比 `lens` 卡（2026-09 代码审计）

`lens` 修成 PNG 后完全丝滑，`lgr` 依旧略卡。逐一核对上游（liquid-glass-react HEAD，本插件移植自它）滤镜图后定位到两个根因，第一个已经实锤并修掉：

1. **上游的"边缘遮罩 + 中央清透合成"链在 Chromium 里是恒等函数（死代码），每帧白跑 7 个全区域 pass。** 链路是 `feColorMatrix(灰度)` → `feComponentTransfer(EDGE_MASK)` → `feOffset(0,0)` → `feComponentTransfer(INVERTED_MASK)` → `2×feComposite`。看它的 color matrix：
   ```xml
   values="0.3 0.3 0.3 0 0
           0.3 0.3 0.3 0 0
           0.3 0.3 0.3 0 0
           0 0 0 1 0"   <!-- 第 4 行：A' = A -->
   ```
   第 4 行把 **alpha** 原样保留，而三张贴图全部**不透明**（standard/polar 是 JPEG、prominent 是 RGB PNG，alpha 恒为 1）→ `EDGE_MASK` 的 alpha 恒为 1、`INVERTED_MASK` 恒为 0 → 最终 `over` 合成的结果逐像素 = `ABERRATED_BLURRED` 本身（中央本来就是全透，边缘遮罩全不透）。上游作者的本意显然是经典的"把亮度写进 alpha"技巧（第 4 行写成 `0.3 0.3 0.3 0 0`），但写成了恒等——所以效果上"边缘遮罩"从未生效过。**已在 `lgr/LgrGlassFilter.tsx` 删除整条链**：17 个图元 → 10 个，与 `lens` 引擎同量级（9-10 个），输出逐像素不变。若以后想启用"只在边缘折射"的观感，正确做法是给 alpha 行补上亮度系数（或按此数学预计算遮罩 PNG 喂 feImage），届时再评估。
2. **滤镜区域 170%×170%（= 元素面积 2.89×）比 `lens` 的 140%（1.96×）大得多**——每帧每个 pass 多约 47% 像素，包括最贵的 3 个 `feDisplacementMap` 和基础 `blur(8px)`。但**不建议直接缩**：LGR 贴图在边缘处的强度很高（实测 luminance：standard 边缘均值 115、最大值 151 就在角上；polar 88），位移在边上需要采样 headroom，缩太小会在小面板 / 大 scale 下撕边（`lens` 敢用 140% 是因为它的相图自带防撕裂边缘带 + 幅度衰减，边缘近似中性）。想试的话从 150% 开始，盯 standard 模式小面板边缘。同理可试的还有删掉末尾 0.2px 的 `feGaussianBlur`（观感是色差毛刺变硬一点）。

### 给以后开发者的建议

1. 想评估第三方 liquid glass 库，先做条纹背景测试（黑白斜条纹壁纸），别用复杂壁纸——否则弯曲根本看不出来。
2. 相图通道语义注意：SLG 相图编码为 R=X、B=Y（`yChannelSelector="B"`）；feTurbulence 用 R/G；LGR 静态图也是 R/B 且需要**负 scale**。
3. `color-interpolation-filters="sRGB"` 必须显式声明，否则位移会在 linearRGB 下算错。
4. 位移强度要够大才能在真实壁纸上看到弯曲，且给用户可调。

## 调参参数

| 参数 | 适用引擎 | 作用 | 默认 |
| --- | --- | --- | --- |
| engine | 全部 | 折射引擎选择 | lens |
| lensMode | lens | classic 边缘弯曲 / convex 凸透镜 / rim 边缘环带 / shift 定向平移 | classic |
| lgrMode | lgr | standard / polar / prominent 三张静态贴图 | standard |
| displacementScale | 全部 | 折射/弯曲强度（lens 下同时决定防撕裂边缘带宽度） | 70 |
| aberrationIntensity | 全部 | 色差（RGB 错位幅度） | 3 |
| lensStrength | lens | 相图场的额外幅度系数 | 1 |
| blur | 全部 | 磨砂模糊 (px) | 8 |
| saturation | 全部 | 饱和度 (%) | 125 |
| frost | 全部 | 白色磨砂强度 | 0.32 |
| radius | 全部 | 圆角 (px)，lens 相图会按它生成匹配的圆角场 | 24 |

## 致谢

本插件的相图路线直接受益于两个优秀的开源项目（均为 MIT 协议，代码以 vendor 方式内联并标注出处，而非 npm 依赖——一是为了保持插件零依赖，二是为了改写 `feImage` 的喂图方式绕开 data: 问题）：

- **[simple-liquid-glass](https://github.com/lucaperullo/simple-liquid-glass)** © [lucaperullo](https://github.com/lucaperullo) —— `slg/displacementMap.ts`、`slg/displacementField.ts` 移植自其 `src/core/` 目录。正是它证明了"运行时参数化生成 SVG 相图"这条路，以及 fold-free 边缘带、量化缓存等工程细节，`lens` 引擎的效果基本全部归功于它。
- **[liquid-glass-react](https://github.com/rdev/liquid-glass-react)** © rdev —— `lgr/maps.ts` 的三张贴图与 `lgr/LgrGlassFilter.tsx` 的滤镜管线移植自其 `src/utils.ts` / `src/index.tsx`，`lgr` 引擎即其"hardcode 路线"的原样复刻。

另外推荐阅读 [Specy 的 Liquid Glass in the Browser](https://specy.app/blog/posts/liquid-glass-in-the-web/)，对整个 displacement map 技术路线有很好的综述。
