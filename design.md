# Design Document

## Architecture
- **Tech Stack**: Node.js, Express, Nanoid
- **Database**: In-memory object (for evaluation)
- **Logging**: Custom middleware with Affordmed API

## Key Decisions
1. **Shortcode Generation**: Used `nanoid` for uniqueness.
2. **Error Handling**: 
   - 400 (Bad Request) for invalid URLs/shortcodes
   - 404 (Not Found) for missing links
3. **Logging**: 
   - All API actions logged
   - Fallback to console if server fails

## API Flow
1. User → `POST /shorturls` → Returns short URL
2. User → `GET /abc123` → Redirects to original URL
3. User → `GET /shorturls/abc123` → Returns click stats