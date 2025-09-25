const _ = require('lodash');
const axios = require('axios');
require('dotenv').config();
const express = require('express');
const app = express();
const server = require('http').createServer();

const port = 3000;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY
   

async function fetchBuyersData(tokenAddress, tokenOriginAddress) {
    let allTransactions = [];
    const blockRangeSize = 500000;

    console.log(`Starting to fetch transactions for token ${tokenAddress} with backward pagination (500,000 blocks per request)...`);

    // Get the latest block number
    let latestBlock;
    try {
        console.log('Fetching latest block number...');
        const blockResponse = await axios.get(`https://api.etherscan.io/api?module=proxy&action=eth_blockNumber&apikey=${ETHERSCAN_API_KEY}`);
        
        // Convert hex to decimal
        latestBlock = parseInt(blockResponse.data.result, 16);
        console.log(`Latest block number: ${latestBlock}`);
        
    } catch (error) {
        console.error('Error fetching latest block number:', error.message);
        if (error.message.includes('rate limit')) {
            console.log('Rate limit hit, waiting 1 second before retrying...');
            await sleep(1000);
            // Retry getting block number
            const blockResponse = await axios.get(`https://api.etherscan.io/api?module=proxy&action=eth_blockNumber&apikey=${ETHERSCAN_API_KEY}`);
            if (blockResponse.data.status === '1') {
                latestBlock = parseInt(blockResponse.data.result, 16);
                console.log(`Latest block number (retry): ${latestBlock}`);
            } else {
                throw new Error(`Failed to get block number: ${blockResponse.data.message}`);
            }
        } else {
            throw error;
        }
    }

    // Start from the latest block and work backwards
    let currentEndBlock = latestBlock;
    let consecutiveEmptyRanges = 0;
    const maxConsecutiveEmpty = 2; // Stop after 2 consecutive empty ranges

    while (currentEndBlock >= 0 && consecutiveEmptyRanges < maxConsecutiveEmpty) {
        const currentStartBlock = Math.max(0, currentEndBlock - blockRangeSize + 1);
        
        try {
            console.log(`Fetching transactions from block ${currentStartBlock} to ${currentEndBlock}...`);
            const response = await axios.get(`https://api.etherscan.io/api?module=account&action=tokentx&contractaddress=${tokenAddress}&startblock=${currentStartBlock}&endblock=${currentEndBlock}&sort=asc&apikey=${ETHERSCAN_API_KEY}`);
            
            if (response.data.message === "No transactions found") {
                consecutiveEmptyRanges++;
                console.log(`No transactions found in blocks ${currentStartBlock}-${currentEndBlock}. Empty ranges: ${consecutiveEmptyRanges}`);
            } else { 
                const blockTransactions = response.data.result || [];
                
                if (blockTransactions.length === 0) {
                    consecutiveEmptyRanges++;
                    console.log(`No transactions found in blocks ${currentStartBlock}-${currentEndBlock}. Empty ranges: ${consecutiveEmptyRanges}`);
                } else {
                    consecutiveEmptyRanges = 0; // Reset counter when we find transactions
                    allTransactions = allTransactions.concat(blockTransactions);
                    console.log(`Fetched ${blockTransactions.length} transactions from blocks ${currentStartBlock}-${currentEndBlock}. Total so far: ${allTransactions.length}`);
                }
            }
            
            // Move to previous block range
            currentEndBlock = currentStartBlock - 1;
            
            // Wait 1 second between requests
            if (currentEndBlock >= 0) {
                await sleep(1000);
            }
            
        } catch (error) {
            console.error(`Error fetching block range ${currentStartBlock}-${currentEndBlock}:`, error.message);
            if (error.message.includes('rate limit')) {
                console.log('Rate limit hit, waiting 1 second before retrying...');
                await sleep(1000);
                // Retry the same block range
                continue;
            } else {
                throw error;
            }
        }
    }

    if (consecutiveEmptyRanges >= maxConsecutiveEmpty) {
        console.log(`Stopped pagination after ${maxConsecutiveEmpty} consecutive empty ranges`);
    } else {
        console.log('Reached block 0, stopping pagination');
    }

    console.log(`Finished fetching all transactions. Total: ${allTransactions.length}`);
    const transactions = allTransactions; //.filter(d=> d.from.toLowerCase() === tokenOriginAddress.toLowerCase())
    const transactionsByBuyer = _.groupBy(transactions, 'to')

    /*
    const processedTransactionsByBuyer = Object.keys(transactionsByBuyer).map(buyer=>{
        const transactions = transactionsByBuyer[buyer]
        const auctionsTransactions = transactions.filter(d=>d.from.toLowerCase() === tokenOriginAddress.toLowerCase())
        const postAuctionTransactions = transactions.filter(d=>d.from.toLowerCase() !== tokenOriginAddress.toLowerCase())
        const amount = transactions.reduce((acc,d)=>acc+BigInt(d.value),0n)
        return {auctionsAmount:String(auctionsAmount), amount:String(totalAmount)}
    })*/

    // sort by earliest transaction time
    const sortedTransactionsByBuyer = Object.keys(transactionsByBuyer).map(buyer => {
        const txs = transactionsByBuyer[buyer]
        return txs.sort((a,b)=>a.timeStamp - b.timeStamp)
    }).sort((a,b)=>{
        //const aTransactions = transactionsByBuyer[a]
        //const bTransactions = transactionsByBuyer[b]
        return a[0].timeStamp - b[0].timeStamp
    })

    return sortedTransactionsByBuyer
    
    /*
    const onlyAuctionResults = auctionResults.filter(d=> d.from.toLowerCase() === tokenOriginAddress.toLowerCase())
    console.log('auctionResults.length', auctionResults.length, 'onlyAuctionResults.length', onlyAuctionResults.length)
    const buyers = auctionResults.map(auctionResults=>auctionResults.to)
    const uniqueBuyers = [...new Set(buyers)]

    const tokenSymbol = auctionResults[0].tokenSymbol
    const tokenDecimal = auctionResults[0].tokenDecimal

    return uniqueBuyers.map(buyer=>{
        let numEvents = 0;
        const amount = onlyAuctionResults.filter(d=>d.to.toLowerCase() === buyer.toLowerCase())
        .reduce((acc,d)=>{ 
            numEvents++;
            return acc+BigInt(d.value) }
        ,0n)
        const hashes = onlyAuctionResults.filter(d=>d.to.toLowerCase() === buyer.toLowerCase()).map(d=>d.hash)
        const timeStamps = onlyAuctionResults.filter(d=>d.to.toLowerCase() === buyer.toLowerCase()).map(d=>d.timeStamp)
        return {to: buyer, value:String(amount), hashes, timeStamps, tokenSymbol: tokenSymbol, tokenDecimal: tokenDecimal}
    })*/
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
    const newTransactions = response.data.result.filter(d=>d.from.toLowerCase() !== tokenOriginAddress.toLowerCase())
    return newTransactions
}

const WebSocket = require('ws');
const wss = new WebSocket.Server({ server });

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

/// serve static files
app.use(express.static('../client/dist'));

server.on('request', app);

server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});



