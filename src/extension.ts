import * as vscode from 'vscode';
import { StockService } from './stockService';
import { StockStatusBar } from './statusBar';

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

    // Initial fetch
    fetchAndDisplay();

    // Set up polling
    const config = vscode.workspace.getConfiguration('ashare-watch');
    const interval = config.get<number>('updateInterval', 5000);
    
    // Refresh command
    const refreshCommand = vscode.commands.registerCommand('ashare-watch.refresh', () => {
        fetchAndDisplay();
        vscode.window.showInformationMessage('A-Share View Refreshed');
    });

    // Start timer
    startTimer(interval, fetchAndDisplay);

    // Watch for config changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('ashare-watch')) {
            const newConfig = vscode.workspace.getConfiguration('ashare-watch');
            const newInterval = newConfig.get<number>('updateInterval', 5000);
            startTimer(newInterval, fetchAndDisplay);
            fetchAndDisplay();
        }
    }));

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
