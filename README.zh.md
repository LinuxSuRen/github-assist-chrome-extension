# GitHub Assist Chrome 扩展

## 概述

GitHub Assist 是一个 Chrome 扩展，它通过显示仓库发布版本的总下载次数来增强您的 GitHub 体验。它还会在发布页面上显示每个发布文件的下载次数。

## 功能

- 在仓库主页显示总下载次数。
- 在发布页面显示每个发布文件的下载次数。
- 支持缓存以减少 API 调用并提高性能。
- 为获取请求提供重试机制以处理网络问题。

## 安装

1. 克隆仓库：
    ```sh
    git clone https://github.com/LinuxSuRen/github-assist-chrome-extension.git
    ```
2. 打开 Chrome 并导航到 `chrome://extensions/`。
3. 通过切换右上角的开关启用“开发者模式”。
4. 点击“加载已解压的扩展程序”，然后选择克隆的仓库文件夹。

## 使用

1. 导航到任何 GitHub 仓库页面。
2. 总下载次数将显示在仓库主页的侧边栏中。
3. 在发布页面上，每个发布文件的下载次数将显示在文件名旁边。

## 权限

此扩展需要以下权限：
- `unlimitedStorage`：存储缓存数据。
- `notifications`：显示通知（如果将来需要更新）。
- `contextMenus`：添加上下文菜单项（如果将来需要更新）。
- `storage`：访问 Chrome 的存储 API 以进行缓存。

## 贡献

欢迎贡献！请打开一个 issue 或提交一个 pull request 来进行更改。

## 许可证

此项目根据 MIT 许可证授权。有关详细信息，请参阅 [LICENSE](LICENSE) 文件。
