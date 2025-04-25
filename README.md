# Meeting BaaS API Documentation Server

MCP server for fetching and serving Meeting BaaS API documentation from `https://docs.meetingbaas.com/llms/`.

## Documentation Tools

This server registers the following documentation tools in `api/tools/utils/docs.ts`:

- **listCategories** - List all available categories
- **getAllDocs** - Get all documentation content
- **getApiDocs** - Get API documentation
- **getCalendarsDocs** - Get Calendars API docs
- **getMeetingsDocs** - Get Meetings API docs
- **getUsersDocs** - Get Users API docs
- **getWebhooksDocs** - Get Webhooks API docs
- **getSdkDocs** - Get SDK docs
- **getTypeScriptSdkDocs** - Get TypeScript SDK docs
- **getTypeScriptSdkCommonDocs** - Get TypeScript SDK common docs
- **getTypeScriptSdkBotsDocs** - Get TypeScript SDK bots docs
- **getTypeScriptSdkCalendarsDocs** - Get TypeScript SDK calendars docs
- **getTypeScriptSdkWebhooksDocs** - Get TypeScript SDK webhooks docs
- **getTranscriptSeekerDocs** - Get Transcript Seeker docs
- **getSpeakingBotsDocs** - Get Speaking Bots docs
- **getDocsByCategory** - Get docs by specific category name

### Utility Tools

- **docHelpAssistant** - Echo a message with a Documentation Helper prefix (📚 MeetingBaaS Docs Assistant)

## Documentation Sources

Documentation is fetched from `https://docs.meetingbaas.com/llms/` with these categories:

- `/all` - All documentation content
- `/api` - API documentation
- `/calendars` - Calendars API
- `/meetings` - Meetings API
- `/users` - Users API
- `/webhooks` - Webhooks API
- `/sdk` - SDK docs
- `/typescript-sdk` - TypeScript SDK
- `/typescript-sdk-common` - Common TypeScript SDK methods
- `/typescript-sdk-bots` - Bot-related TypeScript SDK
- `/typescript-sdk-calendars` - Calendar-related TypeScript SDK
- `/typescript-sdk-webhooks` - Webhook-related TypeScript SDK
- `/transcript-seeker` - Transcript Seeker
- `/speaking-bots` - Speaking Bots

## Technical Requirements

### Environment Variables
- `REDIS_URL`: Required for session management
- `NODE_ENV`: "development" for dev mode
- `LOG_LEVEL`: Log level (default: "info")

### Authentication Methods
1. Headers (in order of precedence):
   - `x-meeting-baas-api-key`
   - `x-meetingbaas-apikey`
   - `x-api-key`
   - `Authorization` (Bearer token)

2. Request body (POST):
   ```json
   {
     "apiKey": "your-api-key"
   }
   ```

### Vercel Configuration
- Requires Redis
- Enable [Fluid compute](https://vercel.com/docs/functions/fluid-compute)
- Set max duration to 800 in `vercel.json` for Pro/Enterprise accounts

## Community & Support

- [Discord](https://discord.com/invite/dsvFgDTr6c)
- [Github](https://github.com/Meeting-Baas/Meeting-Bot-As-A-Service)
- Twitter
- Slack/Teams channels for customers
