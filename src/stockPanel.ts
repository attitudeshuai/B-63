import * as vscode from 'vscode';
import * as https from 'https';
import { TextDecoder } from 'util';
import {
    PanelMessage,
    AddStockPayload,
    RemoveStockPayload,
    SetIntervalPayload,
    SearchStockPayload,
    ExtensionMessage,
    StocksUpdatedPayload,
    IntervalUpdatedPayload,
    SearchResultPayload,
    SearchResultItem,
    ErrorPayload,
} from './messageTypes';

export class StockPanel implements vscode.WebviewViewProvider {
    public static readonly viewType = 'ashare-watch.stockPanel';
    private _view?: vscode.WebviewView;
    private readonly _decoder = new TextDecoder('gbk');

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage((message: PanelMessage) => {
            this._handleMessage(message);
        });
    }

    private _handleMessage(message: PanelMessage): void {
        switch (message.type) {
            case 'addStock':
                this._addStock((message.payload as AddStockPayload).code);
                break;
            case 'removeStock':
                this._removeStock((message.payload as RemoveStockPayload).code);
                break;
            case 'setInterval':
                this._setInterval((message.payload as SetIntervalPayload).interval);
                break;
            case 'requestStocks':
                this._sendCurrentStocks();
                break;
            case 'requestInterval':
                this._sendCurrentInterval();
                break;
            case 'searchStock':
                this._searchStock((message.payload as SearchStockPayload).keyword);
                break;
        }
    }

    private _addStock(code: string): void {
        const config = vscode.workspace.getConfiguration('ashare-watch');
        const stocks = config.get<string[]>('stocks', []);
        const normalized = code.toLowerCase().trim();
        if (stocks.includes(normalized)) {
            this._postMessage({ type: 'error', payload: { message: '该股票已在自选列表中' } as ErrorPayload });
            return;
        }
        stocks.push(normalized);
        config.update('stocks', stocks, vscode.ConfigurationTarget.Global).then(() => {
            this._sendCurrentStocks();
        });
    }

    private _removeStock(code: string): void {
        const config = vscode.workspace.getConfiguration('ashare-watch');
        const stocks = config.get<string[]>('stocks', []);
        const normalized = code.toLowerCase().trim();
        const filtered = stocks.filter(s => s !== normalized);
        if (filtered.length === stocks.length) {
            this._postMessage({ type: 'error', payload: { message: '未找到该股票' } as ErrorPayload });
            return;
        }
        config.update('stocks', filtered, vscode.ConfigurationTarget.Global).then(() => {
            this._sendCurrentStocks();
        });
    }

    private _setInterval(interval: number): void {
        const clamped = Math.max(1000, Math.min(60000, interval));
        const config = vscode.workspace.getConfiguration('ashare-watch');
        config.update('updateInterval', clamped, vscode.ConfigurationTarget.Global).then(() => {
            this._sendCurrentInterval();
        });
    }

    private _sendCurrentStocks(): void {
        const config = vscode.workspace.getConfiguration('ashare-watch');
        const stocks = config.get<string[]>('stocks', []);
        this._postMessage({ type: 'stocksUpdated', payload: { stocks } as StocksUpdatedPayload });
    }

    private _sendCurrentInterval(): void {
        const config = vscode.workspace.getConfiguration('ashare-watch');
        const interval = config.get<number>('updateInterval', 5000);
        this._postMessage({ type: 'intervalUpdated', payload: { interval } as IntervalUpdatedPayload });
    }

    private async _searchStock(keyword: string): Promise<void> {
        if (!keyword.trim()) {
            this._postMessage({ type: 'searchResult', payload: { results: [] } as SearchResultPayload });
            return;
        }
        try {
            const results = await this._fetchSearchResults(keyword.trim());
            this._postMessage({ type: 'searchResult', payload: { results } as SearchResultPayload });
        } catch {
            this._postMessage({ type: 'searchResult', payload: { results: [] } as SearchResultPayload });
        }
    }

    private _fetchSearchResults(keyword: string): Promise<SearchResultItem[]> {
        const url = `https://suggest3.sinajs.cn/suggest/type=&key=${encodeURIComponent(keyword)}&name=suggestdata`;
        return new Promise((resolve, reject) => {
            https.get(url, { headers: { Referer: 'https://finance.sina.com.cn' } }, (res) => {
                const chunks: Buffer[] = [];
                res.on('data', (chunk: Buffer) => chunks.push(chunk));
                res.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    const text = this._decoder.decode(buffer);
                    const items: SearchResultItem[] = [];
                    const match = text.match(/suggestdata="([^"]*)"/);
                    if (match && match[1]) {
                        const entries = match[1].split(';');
                        for (const entry of entries) {
                            const parts = entry.split(',');
                            if (parts.length >= 6) {
                                const rawCode = parts[3];
                                const name = parts[4];
                                const marketTag = parts[0];
                                if (marketTag === '11' || marketTag === '12') {
                                    const prefix = rawCode.startsWith('6') ? 'sh' : 'sz';
                                    items.push({ code: `${prefix}${rawCode}`, name });
                                }
                            }
                        }
                    }
                    resolve(items.slice(0, 20));
                });
                res.on('error', (err) => reject(err));
            }).on('error', (err) => reject(err));
        });
    }

    private _postMessage(message: ExtensionMessage): void {
        this._view?.webview.postMessage(message);
    }

    public notifyConfigChanged(): void {
        this._sendCurrentStocks();
        this._sendCurrentInterval();
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const nonce = getNonce();

        return /*html*/ `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Stock Manager</title>
<style nonce="${nonce}">
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:var(--vscode-editor-background);--fg:var(--vscode-editor-foreground);--input-bg:var(--vscode-input-background);--input-fg:var(--vscode-input-foreground);--input-border:var(--vscode-input-border);--btn-bg:var(--vscode-button-background);--btn-fg:var(--vscode-button-foreground);--btn-hover:var(--vscode-button-hoverBackground);--list-hover:var(--vscode-list-hoverBackground);--error:var(--vscode-errorForeground);--dim:var(--vscode-descriptionForeground)}
body{font-family:var(--vscode-font-family);color:var(--fg);background:var(--bg);padding:8px;font-size:13px}
.section{margin-bottom:14px}
.section-title{font-size:12px;font-weight:600;margin-bottom:6px;color:var(--dim);text-transform:uppercase;letter-spacing:.5px}
.search-wrap{position:relative}
.search-input{width:100%;padding:4px 8px;background:var(--input-bg);color:var(--input-fg);border:1px solid var(--input-border);border-radius:3px;outline:none;font-size:13px;font-family:inherit}
.search-input:focus{border-color:var(--vscode-focusBorder)}
.search-results{margin-top:4px;max-height:160px;overflow-y:auto;border:1px solid var(--input-border);border-radius:3px;display:none}
.search-results.visible{display:block}
.search-item{padding:4px 8px;cursor:pointer;display:flex;justify-content:space-between;font-size:12px}
.search-item:hover{background:var(--list-hover)}
.search-item .code{color:var(--dim)}
.stock-list{list-style:none}
.stock-item{display:flex;align-items:center;justify-content:space-between;padding:4px 6px;border-radius:3px}
.stock-item:hover{background:var(--list-hover)}
.stock-item .info{display:flex;gap:6px;align-items:center}
.stock-item .name{font-weight:500}
.stock-item .code{font-size:11px;color:var(--dim)}
.remove-btn{background:none;border:none;color:var(--dim);cursor:pointer;font-size:14px;padding:0 4px;line-height:1;border-radius:3px}
.remove-btn:hover{color:var(--error);background:var(--list-hover)}
.interval-wrap{display:flex;align-items:center;gap:6px}
.interval-input{width:80px;padding:4px 8px;background:var(--input-bg);color:var(--input-fg);border:1px solid var(--input-border);border-radius:3px;outline:none;font-size:13px;font-family:inherit}
.interval-input:focus{border-color:var(--vscode-focusBorder)}
.interval-label{font-size:12px;color:var(--dim)}
.save-btn{padding:3px 10px;background:var(--btn-bg);color:var(--btn-fg);border:none;border-radius:3px;cursor:pointer;font-size:12px;font-family:inherit}
.save-btn:hover{background:var(--btn-hover)}
.empty-msg{color:var(--dim);font-size:12px;font-style:italic;padding:4px 0}
.toast{position:fixed;bottom:12px;left:50%;transform:translateX(-50%);padding:4px 12px;border-radius:3px;font-size:12px;opacity:0;transition:opacity .3s;pointer-events:none}
.toast.error{background:#5a1d1d;color:#f48771}
.toast.show{opacity:1}
</style>
</head>
<body>
<div class="section">
<div class="section-title">搜索股票</div>
<div class="search-wrap">
<input class="search-input" id="searchInput" placeholder="输入股票代码或名称..." autocomplete="off">
<div class="search-results" id="searchResults"></div>
</div>
</div>
<div class="section">
<div class="section-title">自选股列表</div>
<ul class="stock-list" id="stockList"></ul>
<div class="empty-msg" id="emptyMsg">暂无自选股</div>
</div>
<div class="section">
<div class="section-title">刷新间隔</div>
<div class="interval-wrap">
<input class="interval-input" id="intervalInput" type="number" min="1000" max="60000" step="1000">
<span class="interval-label">毫秒</span>
<button class="save-btn" id="saveIntervalBtn">保存</button>
</div>
</div>
<div class="toast" id="toast"></div>
<script nonce="${nonce}">
(function(){
const vscode=acquireVsCodeApi();
const searchInput=document.getElementById('searchInput');
const searchResults=document.getElementById('searchResults');
const stockList=document.getElementById('stockList');
const emptyMsg=document.getElementById('emptyMsg');
const intervalInput=document.getElementById('intervalInput');
const saveIntervalBtn=document.getElementById('saveIntervalBtn');
const toastEl=document.getElementById('toast');
let searchTimer=null;
let currentStocks=[];

function showToast(msg,isError){
toastEl.textContent=msg;
toastEl.className='toast'+(isError?' error':'');
requestAnimationFrame(()=>{toastEl.classList.add('show')});
setTimeout(()=>{toastEl.classList.remove('show')},2000);
}

function renderStocks(){
stockList.innerHTML='';
emptyMsg.style.display=currentStocks.length===0?'block':'none';
currentStocks.forEach(function(code){
const li=document.createElement('li');
li.className='stock-item';
li.innerHTML='<span class="info"><span class="name"></span><span class="code">'+escapeHtml(code)+'</span></span><button class="remove-btn" data-code="'+escapeHtml(code)+')" title="删除">×</button>';
li.querySelector('.remove-btn').setAttribute('data-code',code);
stockList.appendChild(li);
});
}

function escapeHtml(s){
return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

searchInput.addEventListener('input',function(){
clearTimeout(searchTimer);
const val=searchInput.value.trim();
if(!val){searchResults.className='search-results';searchResults.innerHTML='';return}
searchTimer=setTimeout(function(){vscode.postMessage({type:'searchStock',payload:{keyword:val}})},300);
});

searchResults.addEventListener('click',function(e){
const item=e.target.closest('.search-item');
if(!item)return;
const code=item.getAttribute('data-code');
if(code){vscode.postMessage({type:'addStock',payload:{code:code}});searchInput.value='';searchResults.className='search-results';searchResults.innerHTML=''}
});

stockList.addEventListener('click',function(e){
const btn=e.target.closest('.remove-btn');
if(!btn)return;
const code=btn.getAttribute('data-code');
if(code){vscode.postMessage({type:'removeStock',payload:{code:code}})}
});

saveIntervalBtn.addEventListener('click',function(){
const val=parseInt(intervalInput.value,10);
if(isNaN(val)||val<1000||val>60000){showToast('间隔须在1000-60000毫秒之间',true);return}
vscode.postMessage({type:'setInterval',payload:{interval:val}});
});

window.addEventListener('message',function(event){
const msg=event.data;
if(msg.type==='stocksUpdated'){
currentStocks=msg.payload.stocks;
renderStocks();
}else if(msg.type==='intervalUpdated'){
intervalInput.value=msg.payload.interval;
}else if(msg.type==='searchResult'){
const results=msg.payload.results;
searchResults.innerHTML='';
if(results.length===0){searchResults.className='search-results';return}
searchResults.className='search-results visible';
results.forEach(function(item){
const div=document.createElement('div');
div.className='search-item';
div.setAttribute('data-code',item.code);
div.innerHTML='<span>'+escapeHtml(item.name)+'</span><span class="code">'+escapeHtml(item.code)+'</span>';
searchResults.appendChild(div);
});
}else if(msg.type==='error'){
showToast(msg.payload.message,true);
}
});

vscode.postMessage({type:'requestStocks'});
vscode.postMessage({type:'requestInterval'});
})();
</script>
</body>
</html>`;
    }
}

function getNonce(): string {
    let result = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
