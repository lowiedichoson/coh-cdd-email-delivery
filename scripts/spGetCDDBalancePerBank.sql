USE [Navision]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

ALTER PROCEDURE [dbo].[spGetCDDBalancePerBank]
    @TransactionDate DATETIME = NULL
AS
BEGIN
    IF @TransactionDate IS NULL
        SET @TransactionDate = CAST(DATEADD(DAY, -1, GETDATE()) AS DATE);

    WITH BankData AS (
        SELECT
            a.[Bank Code],
            CASE WHEN a.[Transaction Type] = 'DEP' THEN 'DEP' ELSE 'DEL' END AS [TxnGroup],
            a.[Currency Code],
            a.[Transfer Amount]
        FROM [Navision].[dbo].[Cash Delivery and Deposit] a
        WHERE a.[Posting Date] = @TransactionDate
          AND a.[Status] = 2
    ),
    Pivoted AS (
        SELECT
            [Bank Code],
            ISNULL([DEL_PHP], 0) AS [Delivery PHP],
            ISNULL([DEL_USD], 0) AS [Delivery USD],
            ISNULL([DEP_PHP], 0) AS [Deposit PHP],
            ISNULL([DEP_USD], 0) AS [Deposit USD]
        FROM (
            SELECT
                [Bank Code],
                [TxnGroup] + '_' + [Currency Code] AS [Category],
                SUM([Transfer Amount]) AS [Amount]
            FROM BankData
            GROUP BY [Bank Code], [TxnGroup], [Currency Code]
        ) src
        PIVOT (
            SUM([Amount]) FOR [Category] IN ([DEL_PHP], [DEL_USD], [DEP_PHP], [DEP_USD])
        ) pvt
    )
    -- Normal banks (excludes specific PNB/UCB branches)
    SELECT
        CASE
            WHEN SUBSTRING([Bank Code], 2, 3) = 'MBC' THEN 'MBT'
            WHEN SUBSTRING([Bank Code], 2, 3) = 'RCB' THEN 'RCBC'
            WHEN SUBSTRING([Bank Code], 2, 3) = 'SEC' THEN 'SBC'
            WHEN SUBSTRING([Bank Code], 2, 3) = 'PNB' THEN 'PNB-Main'
            WHEN SUBSTRING([Bank Code], 2, 3) = 'UCB' THEN 'UCPB-Main'
            ELSE SUBSTRING([Bank Code], 2, 3)
        END                             AS [Bank Code],
        SUM([Delivery PHP])             AS [Delivery PHP],
        SUM([Delivery USD])             AS [Delivery USD],
        SUM([Deposit PHP])              AS [Deposit PHP],
        SUM([Deposit USD])              AS [Deposit USD]
    FROM Pivoted
    WHERE [Bank Code] NOT IN ('PPNB-002', 'DPNB-002', 'PUCB-001', 'DUCB-002')
    GROUP BY SUBSTRING([Bank Code], 2, 3)

    UNION

    -- Excluded PNB/UCB branches (mapped to different bank names)
    SELECT
        CASE
            WHEN SUBSTRING([Bank Code], 2, 3) = 'PNB' THEN 'PNB-Bangued'
            WHEN SUBSTRING([Bank Code], 2, 3) = 'UCB' THEN 'UCPB-Aklan'
            ELSE SUBSTRING([Bank Code], 2, 3)
        END                             AS [Bank Code],
        SUM([Delivery PHP])             AS [Delivery PHP],
        SUM([Delivery USD])             AS [Delivery USD],
        SUM([Deposit PHP])              AS [Deposit PHP],
        SUM([Deposit USD])              AS [Deposit USD]
    FROM Pivoted
    WHERE [Bank Code] IN ('PPNB-002', 'DPNB-002', 'PUCB-001', 'DUCB-002')
    GROUP BY SUBSTRING([Bank Code], 2, 3);
END