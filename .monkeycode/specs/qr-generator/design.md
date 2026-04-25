# QR Generator Online

Feature Name: qr-generator
Updated: 2026-04-25

## Description

实现一个纯前端的二维码生成页面，提供更完整的内容模板（文本/URL、URL(UTM)、WiFi、vCard/MeCard、电话/SMS/Email、地理位置、日历事件），丰富样式（颜色/渐变/模块形状/Eyes）、Logo 叠加、标题与卡片外框、PNG/SVG 导出、复制到剪贴板、分享链接、轻量批量生成，并内置“应用场景模板”与“精选/全部”风格库。

核心目标：
- 生成结果可扫码（正确性优先）
- 操作顺滑（实时预览，避免卡顿）
- 样式足够“精致”（默认主题与细节打磨）

## Architecture

页面为静态 Web 应用：
- `index.html`: 页面骨架
- `assets/app.js`: UI 交互与状态管理（无框架，减少依赖）
- `assets/qr/encoder.js`: QR 编码与矩阵获取（可嵌入小型 QR encoder 实现）
- `assets/qr/renderer-canvas.js`: Canvas 渲染（支持圆角/圆点/渐变/Logo/卡片）
- `assets/qr/renderer-svg.js`: SVG 渲染与导出
- `assets/storage.js`: 分享链接编解码与 preset apply（不提供“保存为我的预设”入口）
- `assets/style.css`: 视觉样式

渲染数据流：
1. 读取 UI 状态 `QrSettings`
2. 将“内容模板表单”映射为 `payload` 字符串
3. 以 `payload + ecc` 编码得到 `moduleMatrix`
4. 将 `moduleMatrix + style` 渲染到 Canvas（预览/导出）
5. 可选：按需生成 SVG 文本用于下载

## Components and Interfaces

### Settings Model

`QrSettings`（序列化到 localStorage 与 URL）：
- `mode`: `single | batch`
- `payloadType`: `text | url | wifi | vcard | mecard | tel | sms | email | geo | event`
  - 以及链接类扩展：`image | file | audio | video | form | h5 | social | multi`
- `payload`: string（text 模式）
- `wifi`: `{ ssid, auth, password, hidden }`
- `vcard`: `{ name, phone, email, org, title, url }`
- `ecc`: `L | M | Q | H`
- `sizePx`: number
- `marginModules`: number
- `fg`: string（hex）
- `bg`: string（hex）
- `bgTransparent`: boolean（导出透明背景）
- `gradient`: `{ enabled, color2, angleDeg }`
- `moduleShape`: `square | rounded | dot | blob | soft`
- `eyeStyle`: `square | rounded | dot | ring | orbit | notched | double`
- `moduleEffect`: `{ insetEnabled, inset }`（模块描边/镂空细节）
- `logo`: `{ enabled, dataUrl, scale }`
- `caption`: `{ enabled, title, subtitle }`
- `card`: `{ enabled, radius, paddingPx }`
- `card.bg`: string（hex，卡片背景色，允许与 QR 背景色不同）

### Aggregate Redirect (go.html)

为支持“微信/QQ/抖音/小红书/公众号跳转”与“聚合码”，项目新增静态跳转页：
- `go.html` + `assets/go.js`
- 编码方式：将跳转配置 JSON base64url 后放入 hash：`go.html#p=<encoded>`
- 该页面负责展示多个入口按钮，并在仅一个入口时可选择自动跳转（best-effort）

### Encoder Interface

`encodeQr(payload, ecc) -> { matrix, version }`
- `matrix` 为布尔二维数组（true 表示黑模块）
- 失败时抛出可读错误（例如：payload 太长）

### Renderer Interface

`renderToCanvas(canvas, matrix, settings) -> void`

`renderToSvg(matrix, settings) -> string`

### Performance Strategy

- 对输入频繁变更（文本输入、滑块）使用 100-200ms 防抖。
- 仅在 settings 的“编码相关字段”（payload、ecc）变化时重新编码；样式变化只重绘。
- Canvas 渲染使用 `requestAnimationFrame` 合并多次更新。

## Data Models

### Built-in Presets & Scene Templates

工具内置两类“快速套用”能力：
- 风格库：`BUILTIN_PRESETS`（精选/全部）。精选用于覆盖核心风格方向；全部用于提供更丰富的玩法。
- 场景模板：`SCENES`（按类目筛选），一键套用推荐版式/标题/风格，默认不覆盖用户已填内容。

### Share Link

URL hash: `#s=<base64url(json)>`
- 默认包含样式 + 内容字段
- 对敏感字段（例如 WiFi 密码）提供显式开关决定是否写入 URL
- 打开链接时自动恢复 settings，并显示“来自分享链接”的提示

## Correctness Properties

- 导出 PNG/SVG 的二维码主体必须与预览一致。
- Quiet Zone（margin）必须始终存在，且不被卡片背景/阴影侵蚀。
- Logo 叠加不得修改编码矩阵本身，只允许在渲染阶段遮盖中心区域；需要给出风险提示。
- SVG 渲染必须使用整数坐标与像素对齐，避免缩放模糊导致扫码失败。
- 透明背景导出时，二维码浅色区域不绘制（背景为空），由使用者叠加底图；此模式下工具应提示对比度无法自动评估。

## Error Handling

- 编码失败：展示错误条，保留上一次成功预览。
- Logo 加载失败：提示“图片无法读取”，并回退到无 Logo。
- 剪贴板不支持：提示用户使用下载按钮。
- localStorage 不可用（隐身模式等）：不影响核心功能（本工具默认不提供“保存为我的预设”入口）。

## Test Strategy

- 手工测试清单：
  - 不同 payloadType 与典型输入（URL、中文文本、长文本）
  - ECC 切换与 logo 开关组合
  - PNG/SVG 导出后用至少两种扫码工具验证
  - 移动端布局与可点击性
- 轻量自动化（可选）：
  - 对 `wifiPayload()`、`vcardPayload()`、share link 编解码函数做纯函数断言测试（浏览器内运行即可）。

## Batch ZIP

批量 ZIP 打包在纯前端实现：
- 生成每条内容对应的 PNG 二进制
- 使用最小 ZIP Writer（store 模式，不压缩）组装 zip，避免引入第三方依赖
- 文件命名策略：`qr-0001.png`、`qr-0002.png` ...（可选支持自定义前缀）

## References

（实现阶段会在此补充编码库来源与许可证信息，以及关键文件链接。）
