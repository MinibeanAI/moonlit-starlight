# 星光 · 把愿望装进星空

一个温暖的星空互动网页：通过摄像头识别双手，摘下星星和月亮，收藏进许愿瓶。

## 在线体验

- Cloudflare Pages：https://moonlit-starlight.pages.dev/
- GitHub：https://github.com/MinibeanAI/moonlit-starlight

## 玩法

1. 开启摄像头，让一只或两只手进入镜头。
2. 靠近星星或月亮，捏合拇指和食指，轻轻拉开一段距离。
3. 将摘下的星光带到瓶口，张开手收藏。
4. 双手可分别抓取，也可共同拖动同一个物体；共同抓取时，最后一只手松开才放下。
5. 张开手轻抚兔子，可触发头部、耳朵和爱心反馈。

支持手机/电脑、柔光摄像头预览、星河拉拽回弹、本地音乐与卡片导出。镜头帧在浏览器内处理，不录制、不上传。离开页面会释放摄像头。

## 运行

需要 Node.js 18+ 构建；本地预览脚本需要 Python 3。

```sh
npm run build
npm run dev
```

访问 http://127.0.0.1:4177 。手机访问须使用部署后的 HTTPS 地址；手机的 localhost 指向手机自身。

## 部署

- Vercel：构建命令 `npm run build`，输出目录 `dist`。
- Cloudflare Pages：构建命令 `npm run build`，输出目录 `dist`；也可 `wrangler pages deploy dist --project-name moonlit-starlight`。
- 无后端服务、API 密钥或数据库要求。所有识别模型、WASM 与 Three.js 依赖均随站点提供。

## 摄像头说明

首次启动需允许摄像头权限。若浏览器提示 `NotReadableError: Could not start video source`，表示未能启动视频源，不一定是占用；错误弹窗提供原始错误及摄像头选择。可选择内置镜头，并检查系统权限和其他使用镜头的应用。

模拟双手回归已覆盖独立/共同抓取、入瓶、手部丢失恢复与响应式布局。真实设备的镜头驱动和遮挡表现取决于浏览器及硬件。

## 技术与素材

Three.js + MediaPipe Hand Landmarker，原生 ES Modules，无需框架依赖安装。素材说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
