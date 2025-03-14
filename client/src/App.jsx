import { useState, useEffect } from 'react'
import './App.css'

function truncateAddress(str) {
  if (!str || str.length <= 10) {
      return str;
  }
  
  const firstSix = str.substring(0, 6);
  const lastFour = str.substring(str.length - 4);
  
  return `${firstSix}...${lastFour}`;
}


function App() {
  const [tokenAddress, setTokenAddress] = useState('0x3e6a1b21bd267677fa49be6425aebe2fc0f89bde')
  const [tokenOriginAddress, setTokenOriginAddress] = useState('0x0b7fFc1f4AD541A4Ed16b40D8c37f0929158D101')
  const [socket, setSocket] = useState(null)
  const [message, setMessage] = useState('')
  const [buyers, setBuyers] = useState([])
  const [transactions, setTransactions] = useState([])
  const [currentBuyerToFetchIdx, setCurrentBuyerToFetchIdx] = useState(0)
  // running, paused, stopped
  const [mode, setMode] = useState('stopped')
 
  const makeCsv = () => {
    const dataString = `
    ,Buyer,Auction value,Auction txs,Sold after auction?,Post-auction values,Post-auction txs
    ${buyers.map((b,i) => {
      const soldAfterAuction = transactions[i]?.filter(t => t.from === b.to || t.to === b.to).length > 0
      const postAuctionTransactions = transactions[i]?.filter(t => t.from.toLowerCase() !== tokenOriginAddress.toLowerCase())
      const postAuctionValueStrings = postAuctionTransactions?.map(t => t.to === b.to ? '+' + formatValue(t.value, b.tokenDecimal) : '-' + formatValue(t.value, b.tokenDecimal)).join(',')
      const postAuctionTxStrings = postAuctionTransactions?.map(t => t.hash).join(',')
      return `${i},${b.to},${formatValue(b.value, b.tokenDecimal)},${b.hashes.join(' ')},${soldAfterAuction ? 'true' : 'false'},${postAuctionValueStrings},${postAuctionTxStrings}`
    }).join('\n')}
    `
    return dataString
  }

  // Function to download the CSV file
  const downloadCsv = () => {
    const data = makeCsv()
    // Create a Blob with the CSV data and type
    const blob = new Blob([data], { type: 'text/csv' });
    
    // Create a URL for the Blob
    const url = URL.createObjectURL(blob);
    
    // Create an anchor tag for downloading
    const a = document.createElement('a');
    
    // Set the URL and download attribute of the anchor tag
    a.href = url;
    a.download = 'download.csv';
    
    // Trigger the download by clicking the anchor tag
    a.click();
  }

  const loadProgressFromLocalStorage = () => {
    const progress = JSON.parse(localStorage.getItem(`progress`))
    if (progress) {
      // Set all states in one go
      setTokenAddress(progress.tokenAddress)
      setTokenOriginAddress(progress.tokenOriginAddress)
      setBuyers(progress.buyers)
      setTransactions(progress.transactions)
      setCurrentBuyerToFetchIdx(progress.currentBuyerToFetchIdx)
      setMode('paused')
    }
  }
  
  // Replace the existing useEffect with this
  useEffect(() => {
    loadProgressFromLocalStorage()
  }, [])
  


  useEffect(() => {
    if (transactions) {
      localStorage.setItem(`progress`, JSON.stringify({
        tokenAddress,
        tokenOriginAddress,
        currentBuyerToFetchIdx,
        buyers,
        transactions
      }))  
    }
  }, [tokenAddress, tokenOriginAddress, currentBuyerToFetchIdx, buyers, transactions])


  const setAddressesToQBio = () => {
    setTokenAddress('0x3e6a1b21bd267677fa49be6425aebe2fc0f89bde')
    setTokenOriginAddress('0x0b7fFc1f4AD541A4Ed16b40D8c37f0929158D101')
  }

  const setAddressesToCovid = () => {
    setTokenAddress('0xc85f5dd5880d5162faf5fdb24d40845b7c8f976f')
    setTokenOriginAddress('0x0b7ffc1f4ad541a4ed16b40d8c37f0929158d101')
  }

  const setAddressesToYuge = () => {
    setTokenAddress('0xfdc9d2a3cae56e484a85de3c2e812784a8184d0d')
    setTokenOriginAddress('0x0000000000000000000000000000000000000000')
  }

  const setAddressesToHydra = () => {
    setTokenAddress('0xaf04f0912e793620824f4442b03f4d984af29853')
    setTokenOriginAddress('0x0000000000000000000000000000000000000000')
  }

  const fetchTransactionsForBuyer = () => {
    if (socket && buyers.length > 0) {
      socket.send(JSON.stringify({ type: 'fetchTransactionsForBuyer', buyer: buyers[currentBuyerToFetchIdx].to, tokenAddress, tokenOriginAddress }))
    }
  }

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3000')

    ws.onopen = () => {
      console.log('Connected to server')
      setSocket(ws)
      setMessage('Connected to server')
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'updateBuyers') {
        setBuyers(data.data)
      }

      if (data.type === 'updateTransactions') {
        setTransactions(currentTransactions => {
          const newTransactions = [...currentTransactions, data.data]
          return newTransactions
        })
        setCurrentBuyerToFetchIdx(_currentBuyerToFetchIdx => _currentBuyerToFetchIdx + 1)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    ws.onclose = () => {
      console.log('Disconnected from server')
    }

    return () => {
      ws.close()
    }
  }, [])

  useEffect(() => {
    if (mode === 'running' && currentBuyerToFetchIdx === 0) {
      setTransactions([])
      setCurrentBuyerToFetchIdx(0)
      fetchTransactionsForBuyer()
    }
  }, [buyers])

  useEffect(() => {
    if (mode === 'running' && currentBuyerToFetchIdx < buyers.length) {
      fetchTransactionsForBuyer()
    }
  }, [currentBuyerToFetchIdx, mode])

  const fetchBuyersData = () => {
    setMode('running')
    if (tokenAddress.length !== 42 || tokenAddress.slice(0,2) !== '0x' || !/^0x[0-9a-fA-F]{40}$/.test(tokenAddress)) {
      alert('Invalid token address')
      return
    }

    if (tokenOriginAddress.length !== 42 || tokenOriginAddress.slice(0,2) !== '0x' || !/^0x[0-9a-fA-F]{40}$/.test(tokenOriginAddress)) {
      alert('Invalid token origin address')
      return
    }

    if (socket) {
      socket.send(JSON.stringify({ type: 'fetchBuyersData', tokenAddress, tokenOriginAddress }))
    }
  }

  const formatValue = (value, tokenDecimal) => {
    return String(BigInt(value) / (10n**BigInt(tokenDecimal)))
  }

  const stop = () => {
    setMode('stopped')
    setBuyers([])
    setTransactions([])
    setCurrentBuyerToFetchIdx(0)
    setTokenAddress('')
    setTokenOriginAddress('')
    setMessage('')
    localStorage.removeItem(`progress`)
  }

  const pause = () => {
    setMode('paused')
  }

  const run = () => {
    setMode('running')
    if (buyers.length === 0) {
      fetchBuyersData()
    }
  }

  const currentBuyerToFetch = buyers[currentBuyerToFetchIdx]
  return (
    <>
      <div>
        <div className="header">
          <h1>Auction Analysis</h1>
          <div className="buttons">
            <button onClick={run} className={mode !== 'running' ? 'active' : 'inactive'}><img src="play.svg" alt="Play"></img></button>
            <button onClick={pause} className={mode === 'running' ? 'active' : 'inactive'}><img src="pause.svg" alt="Pause"></img></button>
            <button onClick={stop} className={mode !== 'stopped' ? 'active' : 'inactive'}><img src="stop.svg" alt="Stop"></img></button>
          </div>
          { message && <p>{message}</p> }
        </div>
        <div className="token-input">
          <div className="labels">
            <div className="label"><b>Token address</b></div> 
            <div className="label"><b>Token origin address</b></div> 
            <div className="label">or choose one of these tokens</div>
            <div className="label">&nbsp;</div>
          </div>
          <div className="inputs">
            <input type="text" value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value)} />
            <input type="text" value={tokenOriginAddress} onChange={(e) => setTokenOriginAddress(e.target.value)} />
            <div className="token-icons">
              <a onClick={setAddressesToQBio}><img src="qbio.png" alt="qbio" /></a>
              <a onClick={setAddressesToCovid}><img src="covid.png" alt="covid" /></a>
              <a onClick={setAddressesToYuge}><img src="yuge.png" alt="yuge" /></a>
              <a onClick={setAddressesToHydra}><img src="hydra.png" alt="hydra" /></a>
            </div>
            <button onClick={() => fetchBuyersData()}>Fetch Data</button>
          </div>
        </div>
        { currentBuyerToFetch && <p>Fetching transactions for {currentBuyerToFetch.to}</p> }
        <button onClick={() => downloadCsv()}>Download CSV</button>
        <div className="table-container">
          {
            buyers.length > 0 ? (
          
            <table>
                <thead>
                  <tr>
                    <td></td>
                    <td>Address</td>
                    <td>Auction events</td>
                    <td>Sold?</td>
                    <td>Buy/sell events</td>
                  </tr>
                </thead>
                <tbody>
                  { buyers.length > 0 && buyers.map(({to,value,hashes, tokenSymbol, tokenDecimal },i)=>{
                    const flatTransactions = transactions.flat()
                    const secondaryTransactions = flatTransactions?.filter(d=>d.from === to || d.to === to)
                    return (
                        <tr key={i}>
                          <td>{i}</td>
                          <td className="address">
                            <a href={`https://etherscan.io/address/${to}`} target="_blank" rel="noopener noreferrer">{truncateAddress(to)}</a>
                          </td>
                          <td className="buy-events">{String(BigInt(value) / (10n**BigInt(tokenDecimal)))} {tokenSymbol} 
                            {hashes.length > 0 && hashes.map(hash => <a href={`https://etherscan.io/tx/${hash}`} target="_blank" rel="noopener noreferrer">  
                                  <img src ="open-in-new.svg" alt="open in new" />
                                </a>)}</td>
                          <td className="sold-icon">{secondaryTransactions?.length > 0 && secondaryTransactions.some(d=>d.from === to) ? <span>✅</span> : null}</td>
                          <td className="sell-events">{
                          to && to.toLowerCase() === currentBuyerToFetch.to.toLowerCase()
                          ?
                            <img className="loading" src="loading.gif" alt="Loading..." />
                          :
                          secondaryTransactions?.map(({hash,value, from},j) => {
                            return (
                              <div key={j}>
                                <span style={{ color: from === to ? 'red' : 'green' }}>
                                  {formatValue(value, tokenDecimal)} 
                                </span>
                                  &nbsp;{tokenSymbol}
                                <a href={`https://etherscan.io/tx/${hash}`} target="_blank" rel="noopener noreferrer">
                                  <img src ="open-in-new.svg" alt="open in new" />
                                </a>
                              </div>
                            )
                          })}</td>
                        </tr>)
                      })}
                </tbody>
            </table>)
            :
            <div className="no-data">No data to display yet</div>
          }
        </div>
      </div>
    </>
  )
}

export default App
