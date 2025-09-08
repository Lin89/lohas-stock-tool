document.addEventListener('DOMContentLoaded', function () {
    const stockCodeInput = document.getElementById('stockCode');
    const yearsInput = document.getElementById('years');
    const generateBtn = document.getElementById('generateBtn');
    const chartDom = document.getElementById('chart');
    const messageDiv = document.getElementById('message');

    const myChart = echarts.init(chartDom);
    let option;

    generateBtn.addEventListener('click', fetchDataAndDrawChart);
    stockCodeInput.addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            fetchDataAndDrawChart();
        }
    });

    // ========== 新增的計算函數 ==========

    // 計算移動平均線 (Moving Average)
    function calculateMA(data, windowSize) {
        let result = [];
        for (let i = 0; i < data.length; i++) {
            if (i < windowSize - 1) {
                result.push(null); // 前面的數據不足以計算，返回 null
            } else {
                let sum = 0;
                for (let j = 0; j < windowSize; j++) {
                    sum += data[i - j];
                }
                result.push(sum / windowSize);
            }
        }
        return result;
    }

    // 計算標準差 (Standard Deviation)
    function calculateStdDev(data, windowSize) {
        let result = [];
        for (let i = 0; i < data.length; i++) {
            if (i < windowSize - 1) {
                result.push(null);
            } else {
                const window = data.slice(i - windowSize + 1, i + 1);
                const mean = window.reduce((a, b) => a + b) / windowSize;
                const squareDiffs = window.map(value => Math.pow(value - mean, 2));
                const avgSquareDiff = squareDiffs.reduce((a, b) => a + b) / windowSize;
                result.push(Math.sqrt(avgSquareDiff));
            }
        }
        return result;
    }

    // ========== 修改後的資料抓取與繪圖函數 ==========

    async function fetchDataAndDrawChart() {
        const stockCode = stockCodeInput.value.trim();
        const years = parseInt(yearsInput.value);

        if (!stockCode) {
            alert('請輸入股票代碼！');
            return;
        }

        messageDiv.textContent = `正在抓取 ${stockCode} 的資料並計算中，請稍候...`;
        myChart.showLoading();

        // 判斷股票代碼後綴
        const marketSuffix = stockCode.startsWith(('0','1','2','3','4','5','6','8')) ? '.TW' : '.TWO';
        const yfStockCode = stockCode + marketSuffix;

        // 計算時間範圍
        const endDate = Math.floor(new Date().getTime() / 1000); // 當前時間戳 (秒)
        const startDate = Math.floor(new Date(new Date().setFullYear(new Date().getFullYear() - (years + 2))).getTime() / 1000); // N+2 年前
        
        // 使用 CORS 代理來抓取 Yahoo Finance API 資料
        const corsProxy = 'https://cors-anywhere.herokuapp.com/'; // 注意: 這是公開的代理，僅供個人專案使用
        const apiUrl = `${corsProxy}https://query1.finance.yahoo.com/v8/finance/chart/${yfStockCode}?period1=${startDate}&period2=${endDate}&interval=1d`;
        
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`無法獲取資料，伺服器回應: ${response.status}`);
            }

            const rawData = await response.json();
            if (!rawData.chart.result || rawData.chart.result.length === 0 || !rawData.chart.result[0].indicators.quote[0].close) {
                 throw new Error(`找不到 ${stockCode} 的股價資料，請檢查代碼是否正確。`);
            }

            // 處理獲取的資料
            const timestamps = rawData.chart.result[0].timestamp;
            const closePrices = rawData.chart.result[0].indicators.quote[0].close;

            // 在前端進行計算
            const ma_period = 480; // 兩年線
            const trendLine = calculateMA(closePrices, ma_period);
            const stdDev = calculateStdDev(closePrices, ma_period);

            const optimisticLine = [];
            const resistanceLine = [];
            const supportLine = [];
            const pessimisticLine = [];

            for (let i = 0; i < trendLine.length; i++) {
                if (trendLine[i] !== null) {
                    optimisticLine.push(trendLine[i] + 2 * stdDev[i]);
                    resistanceLine.push(trendLine[i] + 1 * stdDev[i]);
                    supportLine.push(trendLine[i] - 1 * stdDev[i]);
                    pessimisticLine.push(trendLine[i] - 2 * stdDev[i]);
                } else {
                    optimisticLine.push(null);
                    resistanceLine.push(null);
                    supportLine.push(null);
                    pessimisticLine.push(null);
                }
            }

            const formattedData = {
                dates: timestamps.map(ts => {
                    const d = new Date(ts * 1000);
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                }),
                close: closePrices.map(p => p ? p.toFixed(2) : null),
                trend: trendLine.map(p => p ? p.toFixed(2) : null),
                optimistic: optimisticLine.map(p => p ? p.toFixed(2) : null),
                resistance: resistanceLine.map(p => p ? p.toFixed(2) : null),
                support: supportLine.map(p => p ? p.toFixed(2) : null),
                pessimistic: pessimisticLine.map(p => p ? p.toFixed(2) : null),
            };

            messageDiv.textContent = `圖表已生成：${stockCode}`;
            drawChart(stockCode, formattedData);

        } catch (error) {
            console.error('Error:', error);
            messageDiv.textContent = `發生錯誤：${error.message}. 您可能需要點擊並啟用 CORS 代理的臨時存取權限。`;
            myChart.hideLoading();
            // 在新分頁打開 CORS 代理請求授權頁面
            window.open(corsProxy, '_blank');
        }
    }

    // 繪圖函數 (與之前版本相同，無需修改)
    function drawChart(stockCode, data) {
        // ... (這部分函數跟前一版的程式碼完全一樣)
        myChart.hideLoading();
        option = {
            title: {
                text: `${stockCode} 樂活五線譜`
            },
            tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
            legend: { data: ['收盤價', '趨勢線', '樂觀線', '壓力線', '支撐線', '悲觀線'] },
            grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
            xAxis: { type: 'category', boundaryGap: false, data: data.dates },
            yAxis: { type: 'value', scale: true, axisLabel: { formatter: '{value}' } },
            dataZoom: [{ type: 'inside', start: 0, end: 100 }, { start: 0, end: 100 }],
            series: [
                { name: '收盤價', type: 'line', data: data.close, showSymbol: false, lineStyle: { color: '#333', width: 2 } },
                { name: '樂觀線', type: 'line', data: data.optimistic, showSymbol: false, lineStyle: { color: '#ff4d4f', opacity: 0.8 } },
                { name: '壓力線', type: 'line', data: data.resistance, showSymbol: false, lineStyle: { color: '#ffa940', opacity: 0.8, type: 'dashed' } },
                { name: '趨勢線', type: 'line', data: data.trend, showSymbol: false, lineStyle: { color: '#1890ff', width: 2 } },
                { name: '支撐線', type: 'line', data: data.support, showSymbol: false, lineStyle: { color: '#73d13d', opacity: 0.8, type: 'dashed' } },
                { name: '悲觀線', type: 'line', data: data.pessimistic, showSymbol: false, lineStyle: { color: '#36c360', opacity: 0.8 } }
            ]
        };
        myChart.setOption(option);
    }
});