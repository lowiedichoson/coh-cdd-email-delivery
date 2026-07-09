CREATE PROCEDURE [dbo].[spGetEmailRecipients]
	@NotificationModule NVARCHAR(255)
AS
BEGIN
	SET NOCOUNT ON;

	SELECT
		TRIM([EmailTo]) AS [EmailTo],
		TRIM([EmailCC]) AS [EmailCC],
		TRIM([EmailBCC]) AS [EmailBCC]
	FROM [dbo].[EmailAddressesNotification]
	WHERE [NotificationModule] = @NotificationModule
	AND [Status] = 1; -- must be active
END