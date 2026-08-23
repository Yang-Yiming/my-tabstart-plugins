# Glass Effect

自研的液态玻璃主题插件：用纯 CSS + SVG 滤镜实现面板的折射、磨砂、边框与高光，**无第三方依赖**。

- 目录：`user-plugins/<repo>/glass-effect/`
- 依赖：无（`package.json` 没有 dependencies）
- 主题 id：`glass-effect`（Settings → Appearance 中切换）
- 调参 widget：`glass-effect-tuner`（Settings → Widgets 中调整）

## 实现

`LiquidGlassSurface.tsx` 渲染 3 个堆叠层（都在内容的负 z-index 之下）：

1. **折射层 `.slg-glass`** —— `backdrop-filter: blur() saturate() url(#自建滤镜)`
2. **渐变边框 `.slg-border`** —— 1px 渐变 rim（padding-box mask 技巧）
3. **顶部高光 `.slg-shine`** —— 对角白色渐变

折射用的 SVG 滤镜完全程序化生成：

```
feTurbulence (fractalNoise) → feDisplacementMap ×3 (R/G/B 错开 = 色差) → feColorMatrix → feBlend screen
```

## ⚠️ 重要踩坑记录：为什么"折射"这么难搞

### 现象

市面上两个最流行的 liquid glass 库（`liquid-glass-react`、`simple-liquid-glass`）在 Chromium 里**都表现不出折射**——只有磨砂模糊，没有弯曲。

### 根本原因

这两个库（以及多数同类）的折射机制是一样的：它们把一张**预生成的位移贴图**塞进 SVG 滤镜的 `feImage`：

```xml
<feImage href="data:image/png;base64,..." />
```

问题是：**Chromium 屏蔽了 SVG 滤镜（`<feImage>`）里的 `data:` URL**（安全策略），导致这张位移贴图永远加载不出来 → `feDisplacementMap` 拿到空图 → 等于没有位移 → 折射静默失效（不报错，只是没效果）。

关键细节（实测确认）：

- `feImage` + `data:` URL → **被屏蔽**（条纹测试 0 像素变化）
- `feImage` + `blob:` URL（运行时生成）→ **可用**（我们曾用这个方案绕行过 liquid-glass-react）
- `feTurbulence`（程序化噪声，不需要任何图片）→ **在 `backdrop-filter: url(#...)` 中完全可用**
- `backdrop-filter: url(#svg滤镜)` 在 Chromium **是支持的**（很多旧印象认为不支持，实测 Chrome 151 下 feTurbulence 位移正常工作）

### 结论 / 方案

- 要"真的能折射"，**不要依赖位移贴图（feImage data:）**，用 `feTurbulence` 程序化生成位移场。
- `feImage` 的 `data:` 限制在 MV3 扩展页面 CSP 下依然存在（MV3 默认 CSP 不禁 `fetch(data:)`，但 SVG 滤镜内的 `feImage` data: 是 Chromium 引擎层限制，与 CSP 无关）。
- 曾尝试"读库渲染的 feImage → 转 blob → 克隆库滤镜"绕行方案，能用但库的折射效果（边缘折射、中央清透）在真实壁纸上几乎不可见，已放弃（liquid-glass 插件已删除）。

### 给以后开发者的建议

1. 想写"真折射"，直接用本项目 `LiquidGlassSurface.tsx` 里的 feTurbulence 方案，别引入 feImage 贴图。
2. 想评估第三方 liquid glass 库，先做条纹背景测试（黑白斜条纹 wallpaper），别用复杂壁纸——否则弯曲根本看不出来，容易误判"有效/无效"。
3. `backdrop-filter` 的 `url(#id)` 引用只要滤镜 id 存在于同一 document 即可，跨元素引用没问题。
4. 位移强度（`displacementScale`）要够大（默认 70，建议 100–160）才能在真实壁纸上看到弯曲，且给用户可调。

## 调参参数

| 参数 | 作用 | 默认 |
| --- | --- | --- |
| displacementScale | 折射/弯曲强度 | 70 |
| aberrationIntensity | 色差（RGB 错位） | 3 |
| blur | 磨砂模糊 (px) | 8 |
| saturation | 饱和度 (%) | 125 |
| frost | 白色磨砂强度 | 0.32 |
| radius | 圆角 (px) | 24 |