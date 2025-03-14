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

return;
const fetchUniswapData = async () => {
    const API_KEY = '4cb1053471a52dd739fc8af685b21d5d';
    const url = `https://gateway.thegraph.com/api/${API_KEY}/subgraphs/id/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV`;

    // https://github.com/Uniswap/v3-subgraph/blob/main/schema.graphql#L353
    const query = `
    {
        swaps(orderBy: timestamp, orderDirection: asc, where:
        { pool: "0x4830570554606cbc37478ab773fde991261fd99c",
         recipient: "0x29909b9c97845d5eb998b4aa41664a46c5dc35c6" }
        ) {
            pool {
                token0 {
                    id
                    symbol
                }
                token1 {
                    id
                    symbol
                }
            }
            sender
            recipient
            timestamp
            amount0
            amount1
            transaction {
                id
                blockNumber
            }
        }

    }
  `;

  // https://www.reddit.com/r/UniSwap/comments/su4iad/how_to_use_the_uniswap_api_to_access_historical/

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body:  JSON.stringify({ query })
        });

        const data = await response.json();

        if (data.errors) {
            console.error("GraphQL Errors:", data.errors);
            return;
        }

        const swaps = data.data.swaps.map((d)=>{
            return {
                ...d,
                timestamp: new Date(d.timestamp * 1000).toISOString(),
                
            }
        })

        const groupBySender = _.groupBy(swaps, 'sender');
        console.log('data',swaps.slice(0,10),groupBySender[Object.keys(groupBySender)[0]]);
        // Print results
        /*
        data.data.swaps.forEach((swap) => {
            console.log(`Transaction: ${swap.transaction.id}, Sender: ${swap.sender}, Amount0: ${swap.amount0}, Amount1: ${swap.amount1}`);
        });*/

    } catch (error) {
        console.error("Error fetching data:", error);
    }
};

// https://etherscan.io/tx/0x9a18a406a66407d0730fbfb84f034c65c071f9519f2b0f957a8383d608c62ca7

// Call the function
fetchUniswapData();