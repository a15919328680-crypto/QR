# Requirements Document

## Introduction

本功能提供一个“在线二维码生成工具”，面向个人用户与运营/设计人员，在浏览器内完成二维码内容编辑、样式个性化、预览与导出。

默认假设：
- 纯前端实现（不依赖后端服务），尽可能离线可用
- 不收集/上传用户数据（隐私优先）

## Glossary

- **System**: 二维码在线生成工具（Web 页面）
- **Payload**: 要编码进二维码的内容（例如文本、URL、WiFi、vCard 等）
- **ECC**: Error Correction Level（L/M/Q/H）
- **Module**: 二维码的单个方块单元
- **Quiet Zone**: 二维码四周留白（margin）
- **Eyes**: 二维码的定位图形（角上的“眼睛”）
- **Preset**: 一组可复用的生成配置（样式与部分字段）

## Requirements

### R1: 基础生成

**User Story:** 作为普通用户，我希望输入内容后立即生成二维码，以便直接使用。

#### Acceptance Criteria
1. WHEN 用户修改 Payload，System SHALL 在 300ms 内更新预览（允许使用防抖，但最终结果必须与输入一致）。
2. WHEN Payload 为空，System SHALL 显示“请输入内容”状态，并禁用导出按钮。
3. WHEN Payload 超出编码能力或编码失败，System SHALL 显示可理解的错误信息，并保持上一次成功预览不被清空。

### R2: 多类型内容模板

**User Story:** 作为运营人员，我希望快速生成常见类型二维码（URL/WiFi/名片等），减少手工拼格式错误。

#### Acceptance Criteria
1. WHEN 用户选择“文本/URL”，System SHALL 将输入内容直接作为 Payload。
2. WHEN 用户选择“WiFi”，System SHALL 提供 SSID、加密方式、密码、隐藏网络开关，并生成符合 WiFi QR 规范的 Payload。
3. WHEN 用户选择“vCard”，System SHALL 提供姓名、电话、邮箱、公司、职位、网址字段，并生成 vCard Payload。
4. WHEN 用户选择“电话/SMS/Email/地理位置/日历事件”，System SHALL 提供对应表单并生成对应 Payload。
5. WHEN 用户切换内容类型，System SHALL 保留该类型上次输入（至少在当前会话中）。
6. WHEN 用户选择“图片/文件/音频/视频/表单/H5”，System SHALL 以链接输入为主并生成可扫码的 URL Payload。
7. WHEN 用户选择“微信/QQ/抖音/小红书/公众号跳转”或“聚合码”，System SHALL 生成一个聚合跳转页链接，并在该页面展示多个入口供用户选择打开。

### R3: 纠错与尺寸

**User Story:** 作为设计/印刷场景用户，我希望调整纠错等级、尺寸与留白，保证扫码成功与印刷适配。

#### Acceptance Criteria
1. WHEN 用户选择 ECC（L/M/Q/H），System SHALL 以该纠错等级重新编码并更新预览。
2. WHEN 用户调整输出尺寸（像素）与 Quiet Zone（模块或像素），System SHALL 按配置渲染到画布。
3. IF 用户启用 Logo 叠加，System SHALL 提示推荐 ECC（例如建议 Q/H），并在 ECC 过低时给出警告但不强制阻止导出。

### R4: 颜色与风格个性化

**User Story:** 作为品牌设计人员，我希望二维码支持多种视觉风格（颜色、渐变、圆角点阵等），用于不同物料。

#### Acceptance Criteria
1. WHEN 用户修改前景色/背景色，System SHALL 立即更新预览。
2. WHEN 用户启用渐变，System SHALL 支持至少两色线性渐变并可调整角度。
3. WHEN 用户选择模块形状（方形/圆角/圆点），System SHALL 按选择渲染二维码模块。
4. WHEN 用户选择 Eyes 样式（至少 2 种），System SHALL 仅改变定位图形样式而不影响数据区编码。

### R5: Logo 与标题/边框

**User Story:** 作为品牌方，我希望在二维码中添加 Logo、标题或边框，提高识别度。

#### Acceptance Criteria
1. WHEN 用户上传 Logo 图片，System SHALL 在预览中居中叠加 Logo，并提供大小比例控制。
2. IF Logo 图片过大导致遮挡风险，System SHALL 提示风险并给出建议的最大比例。
3. WHEN 用户设置标题/副标题，System SHALL 在二维码下方渲染文字区域，且导出的图片包含该文字。
4. WHEN 用户启用边框/卡片背景，System SHALL 以可配置的圆角与投影渲染外框（不影响二维码本体的 Quiet Zone）。

### R6: 导出与复制

**User Story:** 作为内容发布者，我希望导出为图片/SVG，并能一键复制以便直接粘贴到文档。

#### Acceptance Criteria
1. WHEN 用户点击“下载 PNG”，System SHALL 下载包含当前样式的 PNG 文件。
2. WHEN 用户点击“下载 SVG”，System SHALL 下载等价视觉效果的 SVG（在不支持某些效果时允许降级，但必须保持可扫码）。
3. WHEN 用户点击“复制 PNG”，System SHALL 将图像写入剪贴板（若浏览器不支持，System SHALL 提示替代方案）。

### R7: 预设与分享

**User Story:** 作为经常生成二维码的人，我希望一键套用内置风格，并能分享链接给同事复用。

#### Acceptance Criteria
1. WHEN 用户点击某个“预设/灵感”按钮，System SHALL 立即套用该风格并更新预览。
2. WHEN System 初次加载且无分享链接，System SHALL 默认套用一个“精选”风格，呈现更完成的默认视觉。
3. WHEN 用户点击“复制分享链接”，System SHALL 将当前配置编码到 URL，并可被他人打开后复现样式与内容。
4. IF 当前配置包含敏感字段（例如 WiFi 密码），System SHALL 提示用户是否从分享链接中排除敏感字段，并在选择排除时从 URL 中移除这些字段。

### R10: 应用场景模板

**User Story:** 作为运营/门店/活动人员，我希望按场景快速套用推荐版式（海报/贴纸/名片等），减少反复调参。

#### Acceptance Criteria
1. WHEN 用户点击某个“应用场景”按钮，System SHALL 套用该场景的推荐版式与风格（例如导出模板、标题文案、风格预设），并立即更新预览。
2. WHEN 用户点击场景按钮，System SHALL 默认不修改用户已输入的内容字段（例如 URL、WiFi、名片信息），避免覆盖已有输入。
3. System SHALL 内置覆盖常见场景类别：私域引流、商业收款、门店经营、办公活动、资料传播、生活便民、品牌推广、溯源管理、政务校园、个人使用。

### R11: 风格库覆盖（精选与全部）

**User Story:** 作为设计人员，我希望既有少量“精选”可直接用，也有更丰富的“全部”风格可用于不同物料。

#### Acceptance Criteria
1. System SHALL 提供“精选/全部”两档切换。
2. WHILE 选择“精选”，System SHALL 展示少量高质量风格，覆盖以下风格方向：标准通用商用款、科技极简风、企业商务VI风、轻奢高级ins风、极简黑白经典风、透明背景专用、高端黑金品牌风、圆角柔和可爱风。
3. WHILE 选择“全部”，System SHALL 展示显著更多的风格按钮（数量明显大于“精选”）。

### R12: 可扫码规范与一键修复

**User Story:** 作为商用/印刷用户，我希望工具能提示并修复常见不可扫码风险。

#### Acceptance Criteria
1. IF Quiet Zone 小于推荐值（例如 < 4 modules），System SHALL 显示风险提示，并提供“一键设置留白=4”。
2. IF 对比度不足（前景/背景或渐变极端值），System SHALL 显示风险提示，并提供“一键提高对比度”。
3. IF 启用 Logo 且大小超过推荐阈值（例如 > 1/4），System SHALL 显示风险提示，并提供一键缩小。
4. IF 用户启用了会降低兼容性的风格（例如定位图形 Eyes 非标准），System SHALL 给出商用建议（例如建议 Eyes=方形）并提供一键修复。

### R8: 批量生成（轻量）

**User Story:** 作为运营人员，我希望一次输入多条内容并批量生成多个二维码，提升效率。

#### Acceptance Criteria
1. WHEN 用户切换到“批量模式”，System SHALL 支持按行输入多条 Payload。
2. WHEN 用户点击“生成列表”，System SHALL 渲染多个二维码预览卡片，并支持逐个下载。
3. WHEN 用户点击“ZIP 打包下载”，System SHALL 将批量生成的 PNG 文件打包为一个 zip 并下载。
4. IF 输入条目超过上限（默认 50 条），System SHALL 提示并阻止生成以避免页面卡顿。

### R9: 易用性与可访问性

**User Story:** 作为移动端用户，我希望在手机上也能顺畅使用并准确点按。

#### Acceptance Criteria
1. WHILE 视口宽度较小（移动端），System SHALL 采用上下布局：上方预览、下方配置。
2. WHEN 用户使用键盘操作，System SHALL 支持表单可聚焦、按钮可触发、关键操作有可见焦点样式。
3. System SHALL 为主要控件提供可读的 label，并避免仅用颜色表达状态。
