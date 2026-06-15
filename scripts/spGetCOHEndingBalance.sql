USE [Navision]
GO
/****** Object:  StoredProcedure [dbo].[spGetCOHEndingBalance]    Script Date: 6/15/2026 1:28:19 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
ALTER PROCEDURE [dbo].[spGetCOHEndingBalance]
	@TransactionDate DATETIME = NULL
AS
BEGIN
	SET NOCOUNT ON;

	IF @TransactionDate IS NULL
	BEGIN
		SET @TransactionDate = CAST(DATEADD(DAY, -1,  GETDATE()) AS DATE);
	END;

	WITH AR AS (
		-- list active branches first with 0 values on AR PHP, AR USD, MV PHP, MV USD
		SELECT
			[Name]  AS [Branch Name],
			[Code]  AS [Branch Code],
			CAST(0 AS decimal(18,4)) AS [AR PHP],
			CAST(0 AS decimal(18,4)) AS [AR USD],
			CAST(0 AS decimal(18,4)) AS [MV PHP],
			CAST(0 AS decimal(18,4)) AS [MV USD]
		FROM [ETERMINAL PROD].[Navision].[dbo].[E-Business Services Inc_$Dimension Value]
		WHERE [Dimension Code] = 'UNIT'
		AND SUBSTRING([Code],1,1) < '5'
		AND LEN(LTRIM(RTRIM([Code]))) >= 8
		AND (RIGHT([Code],3) <> '000' AND RIGHT([Code],3) <> '999')
		AND [Blocked] = 0

		UNION ALL

		-- get topsheet balances pivoted to AR PHP / AR USD
		SELECT
			[Branch Name],
			[Branch Code],
			pvt2.PHP,
			pvt2.USD,
			0,
			0
		FROM (
			SELECT [Branch Code], [Branch Name], [Currency Code], [Ending Balance]
			FROM [ETERMINAL PROD].[Navision].[dbo].[E-Business Services Inc_$AR Topsheet]
			WHERE [TopSheet Date] = @TransactionDate
		) AS pvt1
		PIVOT ( SUM([Ending Balance]) FOR [Currency Code] IN (PHP, USD) ) AS pvt2

		UNION ALL

		-- get main vault balances pivoted to MV PHP, MV USD
		SELECT
			[Branch Name],
			[Branch Code],
			0,
			0,
			pvt4.PHP,
			pvt4.USD
		FROM (
			SELECT [Branch Code], [Branch Name], [Currency Code], [Ending Balance]
			FROM [ETERMINAL PROD].[Navision].[dbo].[E-Business Services Inc_$AR Main Vault]
			WHERE [ARMV Date] = @TransactionDate
		) AS pvt3
		PIVOT ( SUM([Ending Balance]) FOR [Currency Code] IN (PHP, USD) ) AS pvt4
	)
	SELECT
		TRIM([Branch Name]) AS [Branch Name],
		--[Branch Code],
		--ISNULL(SUM([MV PHP]),0) AS [MV PHP],
		--ISNULL(SUM([MV USD]),0) AS [MV USD],
		--ISNULL(SUM([AR PHP]),0) AS [AR PHP],
		--ISNULL(SUM([AR USD]),0) AS [AR USD],
		ISNULL(SUM([MV PHP]),0) + ISNULL(SUM([AR PHP]),0) AS [COH PHP],
		ISNULL(SUM([MV USD]),0) + ISNULL(SUM([AR USD]),0) AS [COH USD]
	FROM AR
	GROUP BY [Branch Name], [Branch Code]
	ORDER BY [Branch Name];
END