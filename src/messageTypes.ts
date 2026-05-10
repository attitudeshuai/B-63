export type MessageType =
    | 'addStock'
    | 'removeStock'
    | 'setInterval'
    | 'requestStocks'
    | 'requestInterval'
    | 'searchStock';

export interface PanelMessage {
    readonly type: MessageType;
    readonly payload?: unknown;
}

export interface AddStockPayload {
    readonly code: string;
}

export interface RemoveStockPayload {
    readonly code: string;
}

export interface SetIntervalPayload {
    readonly interval: number;
}

export interface SearchStockPayload {
    readonly keyword: string;
}

export type ExtensionMessageType =
    | 'stocksUpdated'
    | 'intervalUpdated'
    | 'searchResult'
    | 'error';

export interface ExtensionMessage {
    readonly type: ExtensionMessageType;
    readonly payload?: unknown;
}

export interface StocksUpdatedPayload {
    readonly stocks: string[];
}

export interface IntervalUpdatedPayload {
    readonly interval: number;
}

export interface SearchResultPayload {
    readonly results: SearchResultItem[];
}

export interface SearchResultItem {
    readonly code: string;
    readonly name: string;
}

export interface ErrorPayload {
    readonly message: string;
}
