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
        const hashes = auctionResults.filter(d=>d.to.toLowerCase() === buyer.toLowerCase()).map(d=>d.hash)
        const timeStamps = auctionResults.filter(d=>d.to.toLowerCase() === buyer.toLowerCase()).map(d=>d.timeStamp)
        return {to: buyer, value:String(amount), hashes, timeStamps, tokenSymbol: tokenSymbol, tokenDecimal: tokenDecimal}
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



