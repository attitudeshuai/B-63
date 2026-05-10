import * as https from 'https';
import { TextDecoder } from 'util';

export interface StockInfo {
    code: string;
    name: string;
    price: number;
    percent: number;
    open: number;
    high: number;
    low: number;
}

export class StockService {
    private decoder = new TextDecoder('gbk');

    public async fetchStockData(codes: string[]): Promise<StockInfo[]> {
        if (codes.length === 0) {
            return [];
        }

        const url = `https://hq.sinajs.cn/list=${codes.join(',')}`;

        return new Promise((resolve, reject) => {
            https.get(url, { headers: { 'Referer': 'https://finance.sina.com.cn' } }, (res) => {
                const chunks: Buffer[] = [];
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    const text = this.decoder.decode(buffer);
                    const stocks = this.parseResponse(text, codes);
                    resolve(stocks);
                });
                res.on('error', (err) => reject(err));
            }).on('error', (err) => reject(err));
        });
    }

    private parseResponse(text: string, codes: string[]): StockInfo[] {
        const lines = text.split('\n');
        const stocks: StockInfo[] = [];

        lines.forEach(line => {
            // format: var hq_str_sh600519="name,open,pre_close,price,high,low,buy,sell,volume,amount,...";
            const match = line.match(/hq_str_([a-z0-9]+)="([^"]+)"/);
            if (match) {
                const code = match[1];
                const data = match[2].split(',');
                if (data.length > 3) {
                    const name = data[0];
                    const preClose = parseFloat(data[2]);
                    const price = parseFloat(data[3]);
                    const percent = preClose > 0 ? ((price - preClose) / preClose) * 100 : 0;

                    stocks.push({
                        code,
                        name,
                        price,
                        percent,
                        open: parseFloat(data[1]),
                        high: parseFloat(data[4]),
                        low: parseFloat(data[5])
                    });
                }
            }
        });

        return stocks;
    }
}
