USE [Navision]
GO
/****** Object:  StoredProcedure [dbo].[spGetCDDBalance]    Script Date: 6/15/2026 1:28:23 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
ALTER PROCEDURE [dbo].[spGetCDDBalance]
    @TransactionDate DATETIME = NULL
AS
BEGIN
    IF @TransactionDate IS NULL
        SET @TransactionDate = CAST(DATEADD(DAY, -1, GETDATE()) AS DATE);

    WITH DELDEP AS (
        -- branch list with zero values
        SELECT
            [Name]                      AS [Branch Name],
            [Code]                      AS [Branch Code],
            CAST(0 AS DECIMAL(18,4))    AS [DEL PHP],
            CAST(0 AS DECIMAL(18,4))    AS [DEL USD],
            CAST(0 AS DECIMAL(18,4))    AS [DEP PHP],
            CAST(0 AS DECIMAL(18,4))    AS [DEP USD]
        FROM [ETERMINAL PROD].[Navision].[dbo].[E-Business Services Inc_$Dimension Value]
        WHERE [Dimension Code] = 'UNIT'
          AND SUBSTRING([Code], 1, 1) < '5'
          AND LEN(TRIM([Code])) >= 8
          AND RIGHT([Code], 3) NOT IN ('000', '999')
          AND [Blocked] = 0

        UNION ALL

		-- cash deliveries only
        SELECT
            pvt2.[Name]                 AS [Branch Name],
            pvt2.[Branch Code],
            ISNULL(pvt2.PHP, 0),
            ISNULL(pvt2.USD, 0),
            CAST(0 AS DECIMAL(18,4)),
            CAST(0 AS DECIMAL(18,4))
        FROM (
            SELECT
                a.[Branch Code],
                b.[Name],
                a.[Currency Code],
                a.[Transfer Amount]
            FROM [ETERMINAL PROD].[Navision].[dbo].[Cash Delivery and Deposit] a
            INNER JOIN [ETERMINAL PROD].[Navision].[dbo].[E-Business Services Inc_$Dimension Value] b
                ON a.[Branch Code] = b.[Code]
            WHERE a.[Posting Date] = @TransactionDate
              AND a.[Transaction Type] <> 'DEP'
              AND a.[Status] = 2
        ) AS pvt1
        PIVOT (SUM([Transfer Amount]) FOR [Currency Code] IN (PHP, USD)) AS pvt2

        UNION ALL

        -- cash deposits only
        SELECT
            pvt4.[Name]                 AS [Branch Name],
            pvt4.[Branch Code],
            CAST(0 AS DECIMAL(18,4)),
            CAST(0 AS DECIMAL(18,4)),
            ISNULL(pvt4.PHP, 0),
            ISNULL(pvt4.USD, 0)
        FROM (
            SELECT
                a.[Branch Code],
                b.[Name],
                a.[Currency Code],
                a.[Transfer Amount]
            FROM [ETERMINAL PROD].[Navision].[dbo].[Cash Delivery and Deposit] a
            INNER JOIN [ETERMINAL PROD].[Navision].[dbo].[E-Business Services Inc_$Dimension Value] b
                ON a.[Branch Code] = b.[Code]
            WHERE a.[Posting Date] = @TransactionDate
              AND a.[Transaction Type] = 'DEP'
              AND a.[Status] = 2
        ) AS pvt3
        PIVOT (SUM([Transfer Amount]) FOR [Currency Code] IN (PHP, USD)) AS pvt4
    )
    SELECT
        TRIM([Branch Name])             AS [Branch Name],
        --[Branch Code],
        ISNULL(SUM([DEL PHP]), 0)       AS [Delivery PHP],
        ISNULL(SUM([DEL USD]), 0)       AS [Delivery USD],
        ISNULL(SUM([DEP PHP]), 0)       AS [Deposit PHP],
        ISNULL(SUM([DEP USD]), 0)       AS [Deposit USD]
    FROM DELDEP
    GROUP BY [Branch Name], [Branch Code]
    ORDER BY [Branch Name];
END