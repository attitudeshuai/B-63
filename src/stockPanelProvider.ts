import * as vscode from 'vscode';
import { StockService, StockInfo } from './stockService';

export interface WebViewMessage {
    type: 'addStock' | 'removeStock' | 'updateInterval' | 'getStocks' | 'searchStock';
    payload?: unknown;
}

export interface StockSearchResult {
    code: string;
    name: string;
}

export class StockPanelProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'stockManagerView';
    private _view?: vscode.WebviewView;
    private readonly stockService: StockService;

    constructor(private readonly extensionUri: vscode.Uri) {
        this.stockService = new StockService();
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (message: WebViewMessage) => {
            switch (message.type) {
                case 'getStocks':
                    this._sendStocks();
                    break;
                case 'addStock':
                    this._addStock(message.payload as string);
                    break;
                case 'removeStock':
                    this._removeStock(message.payload as string);
                    break;
                case 'updateInterval':
                    this._updateInterval(message.payload as number);
                    break;
                case 'searchStock':
                    this._searchStock(message.payload as string);
                    break;
            }
        });

        webviewView.onDidDispose(() => {
            this._view = undefined;
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const config = vscode.workspace.getConfiguration('ashare-watch');
        const stocks = config.get<string[]>('stocks', []);
        const interval = config.get<number>('updateInterval', 5000);

        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>自选股管理</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body {
            padding: 16px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
        }
        .section {
            margin-bottom: 24px;
        }
        .section-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 12px;
            color: var(--vscode-foreground);
        }
        .search-box {
            display: flex;
            gap: 8px;
            margin-bottom: 12px;
        }
        .search-input {
            flex: 1;
            padding: 8px 12px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
            font-size: 13px;
            outline: none;
        }
        .search-input:focus {
            border-color: var(--vscode-focusBorder);
        }
        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: background 0.2s;
        }
        .btn-primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .btn-primary:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .btn-danger {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            padding: 4px 8px;
            font-size: 12px;
        }
        .search-results {
            max-height: 200px;
            overflow-y: auto;
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 4px;
            margin-bottom: 12px;
            display: none;
        }
        .search-results.active {
            display: block;
        }
        .search-item {
            padding: 10px 12px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .search-item:last-child {
            border-bottom: none;
        }
        .search-item:hover {
            background: var(--vscode-list-hoverBackground);
        }
        .search-item-code {
            font-family: var(--vscode-editor-font-family);
            color: var(--vscode-textLink-foreground);
        }
        .stock-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .stock-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 12px;
            background: var(--vscode-list-inactiveSelectionBackground);
            border-radius: 4px;
            border: 1px solid var(--vscode-panel-border);
        }
        .stock-info {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        .stock-name {
            font-weight: 500;
        }
        .stock-code {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            font-family: var(--vscode-editor-font-family);
        }
        .interval-input {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
            font-size: 13px;
            outline: none;
        }
        .interval-input:focus {
            border-color: var(--vscode-focusBorder);
        }
        .interval-label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 6px;
        }
        .empty-state {
            text-align: center;
            padding: 24px;
            color: var(--vscode-descriptionForeground);
            font-size: 13px;
        }
        .search-hint {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 8px;
        }
    </style>
</head>
<body>
    <div class="section">
        <div class="section-title">搜索添加股票</div>
        <div class="search-box">
            <input type="text" class="search-input" id="searchInput" placeholder="输入完整股票代码（如：sh600519）" />
            <button class="btn btn-primary" id="searchBtn">搜索</button>
        </div>
        <div class="search-results" id="searchResults"></div>
        <div class="search-hint">内置股票：贵州茅台、平安银行、浦发银行、万科A、中国平安、五粮液、招商银行、比亚迪、工商银行、宁德时代、长江电力、美的集团；也可直接输入完整股票代码添加</div>
    </div>

    <div class="section">
        <div class="section-title">我的自选股</div>
        <div class="stock-list" id="stockList"></div>
    </div>

    <div class="section">
        <div class="section-title">刷新设置</div>
        <input type="number" class="interval-input" id="intervalInput" value="${interval}" min="1000" step="1000" />
        <div class="interval-label">刷新间隔（毫秒，最小值 1000）</div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');
        const searchResults = document.getElementById('searchResults');
        const stockList = document.getElementById('stockList');
        const intervalInput = document.getElementById('intervalInput');

        let currentStocks = ${JSON.stringify(stocks)};

        function renderStocks() {
            if (currentStocks.length === 0) {
                stockList.innerHTML = '<div class="empty-state">暂无自选股</div>';
                return;
            }
            stockList.innerHTML = currentStocks.map(code => \`
                <div class="stock-item">
                    <div class="stock-info">
                        <span class="stock-name">\${code}</span>
                        <span class="stock-code">\${code}</span>
                    </div>
                    <button class="btn btn-danger" onclick="removeStock('\${code}')">删除</button>
                </div>
            \`).join('');
        }

        function removeStock(code) {
            vscode.postMessage({ type: 'removeStock', payload: code });
            currentStocks = currentStocks.filter(s => s !== code);
            renderStocks();
        }

        function addStock(code) {
            if (!currentStocks.includes(code)) {
                vscode.postMessage({ type: 'addStock', payload: code });
                currentStocks.push(code);
                renderStocks();
            }
            searchResults.classList.remove('active');
            searchInput.value = '';
        }

        searchBtn.addEventListener('click', () => {
            const query = searchInput.value.trim();
            if (query) {
                vscode.postMessage({ type: 'searchStock', payload: query });
            }
        });

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchBtn.click();
            }
        });

        let intervalTimeout;
        intervalInput.addEventListener('input', () => {
            clearTimeout(intervalTimeout);
            intervalTimeout = setTimeout(() => {
                let value = parseInt(intervalInput.value) || 5000;
                if (value < 1000) value = 1000;
                intervalInput.value = value;
                vscode.postMessage({ type: 'updateInterval', payload: value });
            }, 500);
        });

        window.addEventListener('message', (event) => {
            const message = event.data;
            switch (message.type) {
                case 'searchResults':
                    renderSearchResults(message.payload);
                    break;
                case 'stockInfo':
                    updateStockNames(message.payload);
                    break;
            }
        });

        function renderSearchResults(results) {
            if (results.length === 0) {
                searchResults.innerHTML = '<div class="search-item">未找到结果</div>';
            } else {
                searchResults.innerHTML = results.map(item => \`
                    <div class="search-item" onclick="addStock('\${item.code}')">
                        <span>\${item.name}</span>
                        <span class="search-item-code">\${item.code}</span>
                    </div>
                \`).join('');
            }
            searchResults.classList.add('active');
        }

        function updateStockNames(stocks) {
            const items = stockList.querySelectorAll('.stock-item');
            items.forEach((item, index) => {
                const nameEl = item.querySelector('.stock-name');
                const stock = stocks.find(s => s.code === currentStocks[index]);
                if (nameEl && stock) {
                    nameEl.textContent = stock.name;
                }
            });
        }

        renderStocks();

        if (currentStocks.length > 0) {
            vscode.postMessage({ type: 'getStocks' });
        }
    </script>
</body>
</html>`;
    }

    private async _sendStocks(): Promise<void> {
        if (!this._view) {
            return;
        }

        const config = vscode.workspace.getConfiguration('ashare-watch');
        const codes = config.get<string[]>('stocks', []);

        try {
            const stocks = await this.stockService.fetchStockData(codes);
            this._view.webview.postMessage({ type: 'stockInfo', payload: stocks });
        } catch (error) {
            console.error('Failed to fetch stock data', error);
        }
    }

    private async _addStock(code: string): Promise<void> {
        const config = vscode.workspace.getConfiguration('ashare-watch');
        const stocks = config.get<string[]>('stocks', []);

        if (!stocks.includes(code)) {
            stocks.push(code);
            await config.update('stocks', stocks, vscode.ConfigurationTarget.Global);
        }
    }

    private async _removeStock(code: string): Promise<void> {
        const config = vscode.workspace.getConfiguration('ashare-watch');
        const stocks = config.get<string[]>('stocks', []);
        const newStocks = stocks.filter(s => s !== code);
        await config.update('stocks', newStocks, vscode.ConfigurationTarget.Global);
    }

    private async _updateInterval(interval: number): Promise<void> {
        const config = vscode.workspace.getConfiguration('ashare-watch');
        await config.update('updateInterval', interval, vscode.ConfigurationTarget.Global);
    }

    private async _searchStock(query: string): Promise<void> {
        if (!this._view) {
            return;
        }

        const results: StockSearchResult[] = [];
        const lowerQuery = query.toLowerCase();

        const commonStocks: StockSearchResult[] = [
            { code: 'sh600519', name: '贵州茅台' },
            { code: 'sz000001', name: '平安银行' },
            { code: 'sh600000', name: '浦发银行' },
            { code: 'sz000002', name: '万科A' },
            { code: 'sh601318', name: '中国平安' },
            { code: 'sz000858', name: '五粮液' },
            { code: 'sh600036', name: '招商银行' },
            { code: 'sz002594', name: '比亚迪' },
            { code: 'sh601398', name: '工商银行' },
            { code: 'sz300750', name: '宁德时代' },
            { code: 'sh600900', name: '长江电力' },
            { code: 'sz000333', name: '美的集团' }
        ];

        for (const stock of commonStocks) {
            if (stock.code.toLowerCase().includes(lowerQuery) ||
                stock.name.toLowerCase().includes(lowerQuery)) {
                results.push(stock);
            }
        }

        if (query.match(/^(sh|sz)\d{6}$/i)) {
            try {
                const stocks = await this.stockService.fetchStockData([query.toLowerCase()]);
                if (stocks.length > 0) {
                    const exactMatch = results.find(r => r.code === query.toLowerCase());
                    if (!exactMatch) {
                        results.unshift({ code: stocks[0].code, name: stocks[0].name });
                    }
                }
            } catch (error) {
                    console.error('Search stock error', error);
                }
            }

            this._view.webview.postMessage({ type: 'searchResults', payload: results.slice(0, 10) });
    }
}
