# Changelog

All notable changes to this project will be documented in this file.

## [1.0.1.0] - 2026-04-18

### Added
- `create_event` MCP tool now returns a glassmorphism invite card as an inline PNG image
- Card features: ambient amber/blue light orbs, glass overlay, QR code, event name + meta rows
- Invite card rendered at 3× native resolution (1440×891px) with RGBA transparent corners
- Added TTF font assets: Inter, Noto Sans SC, JetBrains Mono for Satori rendering

### Fixed
- Removed module-level db singleton that caused SQLite "database is locked" errors in parallel tests

## [1.0.0.0] - 2026-04-18

### Added
- Initial release: MCP server with create_event, join_event, get_attendees tools
- SQLite database with users, events, agents schema
- Web server with /join/:code endpoint
