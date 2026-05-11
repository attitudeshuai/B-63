import * as vscode from 'vscode';
import { StockService } from './stockService';
import { StockStatusBar } from './statusBar';
import { StockPanelProvider } from './stockPanelProvider';

let timer: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('A-Share Watch is now active!');

    const stockService = new StockService();
    const statusBar = new StockStatusBar();

    const fetchAndDisplay = async () => {
        const config = vscode.workspace.getConfiguration('ashare-watch');
        const codes = config.get<string[]>('stocks', []);
        
        try {
            const stocks = await stockService.fetchStockData(codes);
            statusBar.update(stocks);
        } catch (error) {
            console.error('Failed to fetch stock data', error);
        }
    };

    fetchAndDisplay();

    const config = vscode.workspace.getConfiguration('ashare-watch');
    const interval = config.get<number>('updateInterval', 5000);
    
    const refreshCommand = vscode.commands.registerCommand('ashare-watch.refresh', () => {
        fetchAndDisplay();
        vscode.window.showInformationMessage('A-Share View Refreshed');
    });

    startTimer(interval, fetchAndDisplay);

    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('ashare-watch')) {
            const newConfig = vscode.workspace.getConfiguration('ashare-watch');
            const newInterval = newConfig.get<number>('updateInterval', 5000);
            startTimer(newInterval, fetchAndDisplay);
            fetchAndDisplay();
        }
    }));

    const panelProvider = new StockPanelProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(StockPanelProvider.viewType, panelProvider)
    );

    context.subscriptions.push(statusBar);
    context.subscriptions.push(refreshCommand);
}

function startTimer(interval: number, callback: () => void) {
    if (timer) {
        clearInterval(timer);
    }
    timer = setInterval(callback, interval);
}

export function deactivate() {
    if (timer) {
        clearInterval(timer);
    }
}
