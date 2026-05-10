# A-Share Watch (A股看盘)

这是一款 VS Code 插件，让你可以在状态栏实时关注 A 股行情。

## 功能特性

- **实时行情**: 在状态栏显示股票名称、当前价格和涨跌幅。
- **红涨绿跌**: 符合国内市场习惯，上涨显示红色，下跌显示绿色。
- **详细信息**: 鼠标悬停在状态栏可查看详细数据（开盘价、最高价、最低价等）。
- **自动刷新**: 默认每 5 秒刷新一次数据（可配置）。

## 安装与更新说明

本插件目前提供 `.vsix` 安装包。

### 安装 / 更新步骤：
1. **(更新必做)** 如果已安装旧版本，请先在扩展面板中右键点击插件选择 **Uninstall (卸载)**，并**重启 VS Code** (或点击 "Reload Required") 以彻底清除旧缓存。
2. 获取/生成最新的 `vscode-ashare-watch-0.0.1.vsix` 文件。
3. 在 VS Code 中打开 **Extensions (扩展)** 面板 (`Cmd+Shift+X`)。
4. 点击面板右上角的 **...** (Views and More Actions) 菜单。
5. 选择 **Install from VSIX...**。
6. 选择本项目根目录下的 `.vsix` 文件进行安装。

## 开发与打包

如果你想自己修改源码并打包生成 `.vsix` 文件：

1. 确保已安装 [Node.js](https://nodejs.org/)。
2. 在项目根目录下安装依赖：
   ```bash
   npm install
   ```
3. 运行打包命令：
   ```bash
   npx vsce package
   ```
   命令执行成功后，会在根目录下生成 `vscode-ashare-watch-0.0.1.vsix` 文件。

## 使用说明

1. 安装插件后，状态栏会自动显示默认关注的股票（如茅台、平安）。
2. 点击状态栏区域可以手动刷新数据。

## 配置操作指南

### 方法一：图形界面配置 (推荐)

1. 在 VS Code 中，打开 **设置 (Settings)**：
   - Mac: 按 `Command + ,`
   - Windows: 按 `Ctrl + ,`
   - 或者点击左下角齿轮图标 -> Settings
2. 在设置搜索框中输入 `ashare`。
3. 你会看到 **Ashare-watch: Stocks** 和 **Ashare-watch: Update Interval** 两个配置项。
4. **修改股票列表**:
   - 点击 **Add Item** 添加新股票。
   - 输入股票代码，例如 `sh600036` (招商银行)。
   - 点击 **OK** 保存。
   - 要删除股票，点击代码旁边的垃圾桶图标。
5. **修改刷新间隔**:
   - 直接输入数字（单位毫秒），例如 `2000` 表示 2 秒刷新一次。

### 方法二：编辑 JSON 配置

1. 打开命令面板 (`Cmd + Shift + P` 或 `Ctrl + Shift + P`)。
2. 输入并选择 `Preferences: Open User Settings (JSON)`。
3. 在文件中添加或修改以下配置：
   ```json
   "ashare-watch.stocks": [
       "sh600519",
       "sz000001",
       "sh600036"
   ],
   "ashare-watch.updateInterval": 5000
   ```

## 配置项说明

- `ashare-watch.stocks`: **关注股票列表**
  - 格式示例: `sh600519` (上海), `sz000001` (深圳)。
- `ashare-watch.updateInterval`: **刷新间隔**
  - 单位为毫秒，默认为 `5000` (5秒)。

## 常见问题

**Q: 为什么显示乱码？**
A: 插件使用 GBK 解码新浪财经数据，如果出现乱码请确保系统支持相关字符集，一般情况下 Windows/Mac 均正常支持。

**Q: 如何添加创业板股票？**
A: 使用 `sz` 前缀加上股票代码即可，例如 `sz300059`。

