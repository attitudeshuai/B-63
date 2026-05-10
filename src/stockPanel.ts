import * as vscode from 'vscode';
import { WebviewMessage, ExtensionMessage, StockState } from './types';
import { StockService, StockInfo } from './stockService';

export class StockPanelProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'ashare-watch.stockPanel';
    private webviewView?: vscode.WebviewView;
    private stockService: StockService;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.stockService = new StockService();
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this.webviewView = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };

        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
            await this.handleMessage(message);
        });

        this.sendState();
    }

    private async handleMessage(message: WebviewMessage): Promise<void> {
        switch (message.type) {
            case 'addStock':
                await this.addStock(message.payload);
                break;
            case 'removeStock':
                await this.removeStock(message.payload);
                break;
            case 'updateInterval':
                await this.updateInterval(message.payload);
                break;
            case 'getState':
                this.sendState();
                break;
            case 'searchStock':
                await this.searchStock(message.payload);
                break;
        }
    }

    private async addStock(code: string): Promise<void> {
        const normalizedCode = this.normalizeCode(code);
        if (!normalizedCode) {
            this.sendMessage({ type: 'error', payload: 'Invalid stock code format' });
            return;
        }

        const config = vscode.workspace.getConfiguration('ashare-watch');
        const stocks = config.get<string[]>('stocks', []);

        if (stocks.includes(normalizedCode)) {
            this.sendMessage({ type: 'error', payload: 'Stock already exists' });
            return;
        }

        try {
            const stockData = await this.stockService.fetchStockData([normalizedCode]);
            if (stockData.length === 0) {
                this.sendMessage({ type: 'error', payload: 'Stock not found' });
                return;
            }

            stocks.push(normalizedCode);
            await config.update('stocks', stocks, vscode.ConfigurationTarget.Global);
            this.sendMessage({ type: 'success', payload: `Added ${stockData[0].name}` });
            this.sendState();
        } catch (error) {
            this.sendMessage({ type: 'error', payload: 'Failed to add stock' });
        }
    }

    private async removeStock(code: string): Promise<void> {
        const config = vscode.workspace.getConfiguration('ashare-watch');
        const stocks = config.get<string[]>('stocks', []);
        const newStocks = stocks.filter(s => s !== code);

        if (newStocks.length === stocks.length) {
            this.sendMessage({ type: 'error', payload: 'Stock not found in list' });
            return;
        }

        await config.update('stocks', newStocks, vscode.ConfigurationTarget.Global);
        this.sendMessage({ type: 'success', payload: 'Stock removed' });
        this.sendState();
    }

    private async updateInterval(interval: number): Promise<void> {
        if (interval < 1000 || interval > 300000) {
            this.sendMessage({ type: 'error', payload: 'Interval must be between 1000 and 300000 ms' });
            return;
        }

        const config = vscode.workspace.getConfiguration('ashare-watch');
        await config.update('updateInterval', interval, vscode.ConfigurationTarget.Global);
        this.sendMessage({ type: 'success', payload: 'Interval updated' });
        this.sendState();
    }

    private async searchStock(query: string): Promise<void> {
        const normalizedQuery = this.normalizeCode(query);
        if (!normalizedQuery) {
            this.sendMessage({ type: 'searchResult', payload: [] });
            return;
        }

        try {
            const stockData = await this.stockService.fetchStockData([normalizedQuery]);
            this.sendMessage({ type: 'searchResult', payload: stockData });
        } catch (error) {
            this.sendMessage({ type: 'searchResult', payload: [] });
        }
    }

    private normalizeCode(code: string): string | null {
        const trimmed = code.trim().toLowerCase();
        if (/^(sh|sz)\d{6}$/.test(trimmed)) {
            return trimmed;
        }
        if (/^\d{6}$/.test(trimmed)) {
            const prefix = trimmed.startsWith('6') ? 'sh' : 'sz';
            return `${prefix}${trimmed}`;
        }
        return null;
    }

    private getState(): StockState {
        const config = vscode.workspace.getConfiguration('ashare-watch');
        return {
            stocks: config.get<string[]>('stocks', []),
            updateInterval: config.get<number>('updateInterval', 5000)
        };
    }

    private async sendState(): Promise<void> {
        const state = this.getState();
        const stocks = state.stocks.length > 0 
            ? await this.stockService.fetchStockData(state.stocks)
            : [];
        this.sendMessage({
            type: 'state',
            payload: {
                ...state,
                stockDetails: stocks
            }
        });
    }

    private sendMessage(message: ExtensionMessage): void {
        if (this.webviewView) {
            this.webviewView.webview.postMessage(message);
        }
    }

    public refresh(): void {
        this.sendState();
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>股票管理</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 16px;
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
            color: var(--vscode-textLink-foreground);
        }
        .input-group {
            display: flex;
            gap: 8px;
            margin-bottom: 12px;
        }
        input {
            flex: 1;
            padding: 6px 8px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-size: 13px;
        }
        input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        button {
            padding: 6px 12px;
            border: none;
            border-radius: 2px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            font-size: 13px;
            cursor: pointer;
        }
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        button.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        button.secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        button.danger {
            background: var(--vscode-errorForeground);
        }
        .stock-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .stock-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 12px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 4px;
        }
        .stock-info {
            flex: 1;
        }
        .stock-name {
            font-weight: 500;
            font-size: 13px;
        }
        .stock-code {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-top: 2px;
        }
        .stock-price {
            font-size: 13px;
            font-weight: 600;
            margin-right: 12px;
        }
        .up {
            color: var(--vscode-charts-red);
        }
        .down {
            color: var(--vscode-charts-green);
        }
        .empty-state {
            text-align: center;
            padding: 32px 16px;
            color: var(--vscode-descriptionForeground);
            font-size: 13px;
        }
        .interval-group {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .interval-group label {
            font-size: 13px;
            white-space: nowrap;
        }
        .interval-group input {
            width: 100px;
            flex: none;
        }
        .interval-group span {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .message {
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            margin-bottom: 12px;
        }
        .message.success {
            background: var(--vscode-terminal-ansiGreen);
            color: var(--vscode-editor-background);
        }
        .message.error {
            background: var(--vscode-terminal-ansiRed);
            color: var(--vscode-editor-background);
        }
        .search-result {
            margin-top: 8px;
            padding: 8px 12px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
    </style>
</head>
<body>
    <div id="message"></div>
    
    <div class="section">
        <div class="section-title">添加股票</div>
        <div class="input-group">
            <input type="text" id="stockInput" placeholder="输入股票代码，如 600519 或 sh600519" />
            <button id="searchBtn">搜索</button>
        </div>
        <div id="searchResult"></div>
    </div>
    
    <div class="section">
        <div class="section-title">自选股列表</div>
        <div id="stockList" class="stock-list"></div>
    </div>
    
    <div class="section">
        <div class="section-title">刷新设置</div>
        <div class="interval-group">
            <label for="intervalInput">刷新间隔:</label>
            <input type="number" id="intervalInput" min="1000" max="300000" step="1000" />
            <span>毫秒</span>
            <button id="updateIntervalBtn">更新</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        const stockInput = document.getElementById('stockInput');
        const searchBtn = document.getElementById('searchBtn');
        const searchResult = document.getElementById('searchResult');
        const stockList = document.getElementById('stockList');
        const intervalInput = document.getElementById('intervalInput');
        const updateIntervalBtn = document.getElementById('updateIntervalBtn');
        const messageDiv = document.getElementById('message');

        function showMessage(text, type = 'success') {
            messageDiv.textContent = text;
            messageDiv.className = 'message ' + type;
            setTimeout(() => {
                messageDiv.textContent = '';
                messageDiv.className = '';
            }, 3000);
        }

        function renderStockList(stocks, stockDetails) {
            stockList.innerHTML = '';
            
            if (stocks.length === 0) {
                stockList.innerHTML = '<div class="empty-state">暂无自选股，添加一个吧！</div>';
                return;
            }

            const detailsMap = new Map(stockDetails.map(s => [s.code, s]));

            stocks.forEach(code => {
                const detail = detailsMap.get(code);
                const item = document.createElement('div');
                item.className = 'stock-item';
                
                const priceClass = detail && detail.percent > 0 ? 'up' : 
                                   detail && detail.percent < 0 ? 'down' : '';
                
                item.innerHTML = \`
                    <div class="stock-info">
                        <div class="stock-name">\${detail ? detail.name : code}</div>
                        <div class="stock-code">\${code}</div>
                    </div>
                    \${detail ? \`<div class="stock-price \${priceClass}">
                        \${detail.price.toFixed(2)} 
                        \${detail.percent >= 0 ? '+' : ''}\${detail.percent.toFixed(2)}%
                    </div>\` : ''}
                    <button class="secondary danger" data-code="\${code}">删除</button>
                \`;
                
                stockList.appendChild(item);
            });

            stockList.querySelectorAll('button.danger').forEach(btn => {
                btn.addEventListener('click', () => {
                    const code = btn.getAttribute('data-code');
                    if (code) {
                        vscode.postMessage({ type: 'removeStock', payload: code });
                    }
                });
            });
        }

        function renderSearchResult(stockData) {
            searchResult.innerHTML = '';
            if (stockData.length === 0) {
                return;
            }

            const stock = stockData[0];
            const div = document.createElement('div');
            div.className = 'search-result';
            div.innerHTML = \`
                <div>
                    <strong>\${stock.name}</strong>
                    <span style="color: var(--vscode-descriptionForeground); margin-left: 8px">\${stock.code}</span>
                </div>
                <button id="addBtn">添加</button>
            \`;
            searchResult.appendChild(div);

            document.getElementById('addBtn').addEventListener('click', () => {
                vscode.postMessage({ type: 'addStock', payload: stock.code });
                searchResult.innerHTML = '';
                stockInput.value = '';
            });
        }

        searchBtn.addEventListener('click', () => {
            const code = stockInput.value.trim();
            if (code) {
                vscode.postMessage({ type: 'searchStock', payload: code });
            }
        });

        stockInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchBtn.click();
            }
        });

        updateIntervalBtn.addEventListener('click', () => {
            const value = parseInt(intervalInput.value, 10);
            if (!isNaN(value)) {
                vscode.postMessage({ type: 'updateInterval', payload: value });
            }
        });

        window.addEventListener('message', (event) => {
            const message = event.data;
            switch (message.type) {
                case 'state':
                    renderStockList(message.payload.stocks, message.payload.stockDetails || []);
                    intervalInput.value = message.payload.updateInterval;
                    break;
                case 'success':
                    showMessage(message.payload, 'success');
                    break;
                case 'error':
                    showMessage(message.payload, 'error');
                    break;
                case 'searchResult':
                    renderSearchResult(message.payload);
                    break;
            }
        });

        vscode.postMessage({ type: 'getState' });
    </script>
</body>
</html>`;
    }
}
