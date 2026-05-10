import * as vscode from 'vscode';
import { StockInfo } from './stockService';

export class StockStatusBar {
    private statusBarItem: vscode.StatusBarItem;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.statusBarItem.command = 'ashare-watch.refresh';
        this.statusBarItem.tooltip = 'Click to Refresh A-Share Prices';
        this.statusBarItem.show();
    }

    public update(stocks: StockInfo[]) {
        if (stocks.length === 0) {
            this.statusBarItem.text = '$(graph) A-Share';
            this.statusBarItem.tooltip = 'Click to Refresh A-Share Prices';
            return;
        }

        const parts = stocks.map(stock => {
            // Standard Chinese market: Red for UP, Green for DOWN
            return `${stock.name} ${stock.price.toFixed(2)} ${stock.percent >= 0 ? '+' : ''}${stock.percent.toFixed(2)}%`;
        });

        this.statusBarItem.text = `$(graph) ${parts.join('  |  ')}`;
        
        // Tooltip using Markdown Table for horizontal layout
        const md = new vscode.MarkdownString();
        
        // Table Header
        md.appendMarkdown('| 名称 | 代码 | 当前价 | 涨跌幅 | 开盘 | 最高 | 最低 |\n');
        md.appendMarkdown('| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n');

        stocks.forEach(s => {
            const color = s.percent >= 0 ? 'red' : 'green';
            // Using bold for the name to highlight it
            const row = `| **${s.name}** | ${s.code} | ${s.price.toFixed(2)} | <span style="color:${color}">${s.percent.toFixed(2)}%</span> | ${s.open.toFixed(2)} | ${s.high.toFixed(2)} | ${s.low.toFixed(2)} |\n`;
            md.appendMarkdown(row);
        });
        
        md.appendMarkdown(`\n[Refresh](command:ashare-watch.refresh)`);
        md.isTrusted = true;
        this.statusBarItem.tooltip = md;
        
        // Simple color indication logic (global)
        if (stocks.length > 0) {
            const first = stocks[0];
            if (first.percent > 0) {
                this.statusBarItem.color = new vscode.ThemeColor('charts.red'); // Red for up
            } else if (first.percent < 0) {
                this.statusBarItem.color = new vscode.ThemeColor('charts.green'); // Green for down
            } else {
                this.statusBarItem.color = undefined;
            }
        }
    }

    public dispose() {
        this.statusBarItem.dispose();
    }
}
