# Production v3 · 实机验收

2026-09-08。个人网站的角色、环境、作品展台、动作和声音完成本轮实现。保留传统中英文主页、CV、真实论文与项目媒体；作品阅读、简历和联系方式可以直接访问，游戏始终是可选项。

本机完整构建：[个人网站](http://127.0.0.1:4200/)。实机证据：[验收画廊](http://127.0.0.1:4201/) / [仓库内归档](evidence/production-v3/index.html)。本地链接需要预览服务保持运行。

## 实现结果

| 范围 | 交付 |
| --- | --- |
| 人物与服装 | 255,660 三角形骑手、43 骨骼、8 段动作；魔法帽、全脸面具、分片外套、薄翻领、内搭、袖口、手套、披风及雕刻扫帚。守护灵 68,116 三角形。两者包含可编辑 Blender 源文件与来源清单。 |
| 材质与环境 | 保留原始 4K 岩石扫描通道、羊毛及皮革纹理；增加城堡基础、岸脚岩组、8 处低矮种植边界及 6 块双语标牌。38 棵树按空间与投影尺寸选择完整三维细节层级，近景几何逐字节保留；风动与阴影共用风向。 |
| 作品展台 | 实体方法书、作者铭牌、真实输出屏幕及媒体索引。书册和铭牌分别打开正确的方法、作者段落，屏幕打开项目原始图片；中英文切换保留内容和返回位置。桌面使用可辨认的木纹、书页与装订结构。 |
| 光影和动作 | 明亮月夜采用冷色石墙与局部暖窗，经同机位 A/B/C 复核；保留昼夜转换。施法由实际动画在 0.18 秒释放，使用当帧魔杖位置；加速、施法、命中与传送有对应动作或特效。暂停保持姿态，取消施法正确退款。 |
| 声音 | 用户主动开启后播放本地授权配乐、区域水声和风声；音乐、效果可独立调节。加入加速、施法、传送、翻页声音，阅读时降低音乐。修复循环接缝、后台挂起和快速恢复的音频竞态。 |

## 实际验证

- **浏览器交互：** 实际点击三维方法书、作者铭牌和媒体屏幕，验证正确段落、焦点、原始图片与返回行为；英文转中文保留 AutoDesign 的 6 项媒体。窄屏实际 CSS 312×675 无文档横向溢出，完整展台与控制可见。传统英文主页、中文主页和 CV 在完整构建中实际打开。[交互记录](evidence/production-v3/ui-interaction-evidence.md)
- **人物动作：** 实际 Three.js 服装及背面截图经独立美术复核，拒绝并修复了旧版厚翻领、异常腹部衣褶与塑料感领口。原始动作录屏 479 帧，PTS 0.000–15.932 秒；检查 16 张原分辨率帧，含施法连续 5 帧，未见明显支撑脱离或姿态跳变。[动态记录](evidence/production-v3/rider-motion-review.md)
- **场景与展台：** 实看白天/月夜、完整地图、庭院、桥岸和展台近景；岸壁贴图混轴拉丝已修复，桥面误放植物已移除。岸壁薄片和悬挂岩体候选被退回，最终采用与水线连接的岸脚体积岩石。展台木纹、纸面与夜间可读性复拍后保留。[实际图像与录像](evidence/production-v3/index.html)
- **声音：** 浏览器真实混音输出录制为 24 秒、48 kHz 双声道；峰值 −17.83 dBFS、RMS −33.04 dBFS，无削波和非有限样本。这里只给信号与播放行为证据，不声称完成了主观听感评审。[试听](evidence/production-v3/audio-mix.mp3) · [信号分析](evidence/production-v3/audio-signal-analysis.json)
- **程序与构建：** 最终完整测试 213/213 通过；Vite 与 Jekyll 整站构建通过，包含 43 个旧页重定向。156 个资源 HTTP/字节检查、21 个 GLB 清单检查及 8 个额外来源哈希通过；完整生产首页载入成功，警告/错误日志为空。[测试结果](evidence/production-v3/test-results.txt) · [HTTP / GLB 验证](evidence/production-v3/verification.json) · [材质哈希](evidence/production-v3/material-hashes.json)

## 性能与边界

性能以实际浏览器固定 1024×576 CSS、DPR 2.5、2560×1440 画布、高画质、4× MSAA、4096 阴影测量；每次预热 3.5 秒、正式测量 20 秒。旧版与本版使用相同机位。完整结果、GPU 查询有效性和 CPU 提交耗时保留在 [测量索引](evidence/production-v3/performance-summary.json)。录屏与性能测量分开。

本机 Apple M2 Pro（19 核 GPU、16 GB）实测：庭院 19.65 FPS / P95 62.7 ms，鸟瞰 17.22 FPS / P95 71.8 ms；旧版分别为 22.01 与 23.55 FPS。新版增加的资源有明确成本。最高画质的成本明显，不能据此宣称 60 FPS 或商业 3A 画质。不会因帧率低而偷偷降低分辨率或近景模型质量；用户可以主动选择其他画质。两组扫描 GLB 共约 31.8 MB，六张 4K 贴图按未压缩 RGBA mip 链估算约 512 MiB，实际 GPU 驻留取决于驱动。提交三角形包含阴影和反射重复绘制，并非唯一模型面数。

画面仍属于精细化的风格化网页场景。远景树冠覆盖率、完整岸壁的地质造型，以及连续布料碰撞仿真仍有提升空间；披风目前采用蒙皮与跟随响应。单机测量和浏览器窄屏测试不代表实体手机性能。

## 来源和复现

- [人物结构、动作与可编辑源文件](character-production-v3.md) · [角色来源](../world/public/models/characters/source/sources.json)
- [环境扫描、几何层级与成本](environment-production-v3.md) · [扫描清单](../world/public/models/environment/scans/manifest.json)
- [展台结构、材质与交互](exhibit-production-v3.md) · [庭院 A/B/C 配光复核](art-review-v3.md)
- [动作与音频集成复核](evidence/production-v3/action-audio-review.md) · [测量工具有效性边界](evidence/production-v3/measurement-repair-report.md)

```sh
npm --prefix world ci
npm --prefix world test
npm run build:site
python3 -m http.server 4200 --bind 127.0.0.1 --directory dist
```

开发服务中的 `/quality-review.html` 可以选择固定机位、光照、采样与植被模式，导出真实画帧、测量 JSON 和录屏。其本地证据保存接口只在开发模式启用。
