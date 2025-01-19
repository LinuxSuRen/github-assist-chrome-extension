# GitHub Assist Chrome Extension

## Overview

GitHub Assist is a Chrome extension that enhances your GitHub experience by displaying the total number of downloads for a repository's releases. It also shows the download count for each release file on the release page and provides a mirror download link. Additionally, it displays a line chart of download counts for different versions on the releases page.

## Features

- Display total downloads on the repository home page.
- Show download counts for each release file on the release page.
- Provide a mirror download link for each release file.
- Display a line chart of download counts for different versions on the releases page.
- Caching support to reduce API calls and improve performance.
- Retry mechanism for fetch requests to handle network issues.

## Screenshots

![image](https://github.com/user-attachments/assets/e0645933-c3f1-4b7e-90ef-55d8cee8ed0a)

![image](https://github.com/user-attachments/assets/b39d9dcb-8932-4421-9987-cf64401ad0f2)

## Installation

1. Clone the repository:
    ```sh
    git clone https://github.com/LinuxSuRen/github-assist-chrome-extension.git
    ```
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable "Developer mode" by toggling the switch in the top right corner.
4. Click on "Load unpacked" and select the cloned repository folder.

## Usage

1. Navigate to any GitHub repository page.
2. The total number of downloads will be displayed in the sidebar on the repository home page.
3. On the release page, the download count for each release file will be shown next to the file name along with a mirror download link.
4. A line chart of download counts for different versions will be displayed at the top of the releases page.

## Permissions

This extension requires the following permissions:
- `unlimitedStorage`: To store cached data.
- `notifications`: To display notifications (if needed in future updates).
- `contextMenus`: To add context menu items (if needed in future updates).
- `storage`: To access Chrome's storage API for caching.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request with your changes.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
