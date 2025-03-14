Program spec:

(1) Lets you input info from a database about auction results.
(2) Lets you input info from Uniswap about token transactions.
(3) Produces a spreadsheet that lists various facts about the token.
— Sortable database of transactions.
— Identifies unique wallets involved.
— Determines how much of a token a wallet started with/has.
— Determines money spent/received on the token per wallet.
— Classes wallets into types. Initial typology:

Token interaction type
———————————
• Small buyer (=<1 ETH, holds)
• Medium buyer (=<10 ETH, holds)
• Large buyer (>10 ETH, holds)
• Pump and dump (buys and sells same amount in rapid succession)
• Dump (sells all received from initial auction)
• Regular trader (buys then sells all of it after a moderate period)
• Other (anything else)

Wallet type
—————
• DEX arbitrager (many trades involving simultaneous use of multiple DEXes)
• Token-specific (only trades this token and ETH/USDC/etc.)
• Meme % (identifies the % of tokens transacted with that are meme tokens, with "meme token" being defined from a list that can be manually input)

(4) Displays the above in a sortable table.
(5) Lets you see totals for the whole dataset, e.g., total number of wallets of types A, B, C among all wallets that have transacted with the token.

I think this is slightly more than an MVP. If we decide to go ahead, we should define the MVP specifically, I believe the whole thing should be "easy" in the sense that any step that requires a lot of thought ("what buying and selling behavior defines a person who believes in the token but who is moderately disposed to despair?") will be able to be skipped or simplified.

https://docs.google.com/spreadsheets/d/1X3abfL4uvVUT-GieNvoP8jnd0ICFuBeo7ROtU2Amv6Y/edit?gid=1530656338#gid=1530656338