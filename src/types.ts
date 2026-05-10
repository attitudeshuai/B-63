export interface WebviewMessage {
    type: 'addStock' | 'removeStock' | 'updateInterval' | 'getState' | 'searchStock';
    payload?: any;
}

export interface ExtensionMessage {
    type: 'state' | 'error' | 'success' | 'searchResult';
    payload?: any;
}

export interface StockState {
    stocks: string[];
    updateInterval: number;
}
