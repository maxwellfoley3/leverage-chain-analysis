const _ = require('lodash');
const axios = require('axios');
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY
   

async function fetchBuyersData(tokenAddress, tokenOriginAddress) {

    const response = await axios.get(`https://api.etherscan.io/api?module=account&action=tokentx&contractaddress=${tokenAddress}&address=${tokenOriginAddress}&startblock=0&endblock=27025780&sort=asc&apikey=${ETHERSCAN_API_KEY}`)
    const auctionResults = response.data.result.filter(d=> d.from.toLowerCase() === tokenOriginAddress.toLowerCase())
    
    const buyers = auctionResults.map(auctionResults=>auctionResults.to)
    const uniqueBuyers = [...new Set(buyers)]

    const tokenSymbol = auctionResults[0].tokenSymbol
    const tokenDecimal = auctionResults[0].tokenDecimal

    return uniqueBuyers.map(buyer=>{
        let numEvents = 0;
        const amount = auctionResults.filter(d=>d.to.toLowerCase() === buyer.toLowerCase())
        .reduce((acc,d)=>{ 
            numEvents++;
            return acc+BigInt(d.value) }
        ,0n)
        return {to: buyer, value:String(amount), hashes: auctionResults.filter(d=>d.to.toLowerCase() === buyer.toLowerCase()).map(d=>d.hash), tokenSymbol: tokenSymbol, tokenDecimal: tokenDecimal}
    })
}

let lastTransactionTime = Date.now()
async function fetchTransactionsForBuyer(buyer, tokenAddress, tokenOriginAddress) {
    await sleep(Date.now() - lastTransactionTime > 250 ? 0 : 250 - (Date.now() - lastTransactionTime))
    const response = await axios.get(`https://api.etherscan.io/api?module=account&action=tokentx&contractaddress=${tokenAddress}&address=${buyer}&startblock=0&endblock=27025780&sort=asc&apikey=${ETHERSCAN_API_KEY}`)
    lastTransactionTime = Date.now()
    if (response.data.result.includes('Max calls per sec rate limit reached')) {
        await sleep(1000)
        return fetchTransactionsForBuyer(buyer, tokenAddress, tokenOriginAddress)
    }
    console.log('response', response.data.result)
    const newTransactions = response.data.result.filter(d=>d.from.toLowerCase() !== tokenOriginAddress.toLowerCase())
    return newTransactions
}
    /*transactions.push(...newTransactions)
    console.log(newTransactions)
        ws.send(JSON.stringify({ type: 'updateData', data: newTransactions, index: i }))
}
*/


// Problems: auction data token numbers in sprreadsheet does not match a


// filter by token holder 
// https://etherscan.io/token/0x3e6a1b21bd267677fa49be6425aebe2fc0f89bde?a=0x0f190180861875d79b57700747377ddae8bd2570

// go()

const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 3000 });

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'fetchBuyersData') {
                const tokenAddress = data.tokenAddress
                if (tokenAddress.length !== 42 || tokenAddress.slice(0,2) !== '0x' || !/^0x[0-9a-fA-F]{40}$/.test(tokenAddress)) {
                    throw new Error('Invalid token address')
                }
                const tokenOriginAddress = data.tokenOriginAddress
                if (tokenOriginAddress.length !== 42 || tokenOriginAddress.slice(0,2) !== '0x' || !/^0x[0-9a-fA-F]{40}$/.test(tokenOriginAddress)) {
                    throw new Error('Invalid token origin address')
                }
                const result = await fetchBuyersData(tokenAddress, tokenOriginAddress);
                ws.send(JSON.stringify({ type: 'updateBuyers', data: result }))
            }
            if (data.type === 'fetchTransactionsForBuyer') {
                const buyer = data.buyer
                const tokenAddress = data.tokenAddress
                const tokenOriginAddress = data.tokenOriginAddress
                const result = await fetchTransactionsForBuyer(buyer, tokenAddress, tokenOriginAddress)
                ws.send(JSON.stringify({ type: 'updateTransactions', data: result }))
            }
        } catch (error) {
            console.error('Error:', error);

            ws.send(JSON.stringify({ error: error.message }));
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

console.log('WebSocket server running on port 3000');

async function go() {
    try {
        await fetchData();
    } catch (error) {
        console.error('Error in go():', error);
    }
}

go()