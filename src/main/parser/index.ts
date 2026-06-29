export * from './types'
export { registerParser, detectParser, getParser, listParsers } from './registry'

// ── Register all parsers ──────────────────────────────────────────────────────
// Import order determines detection priority when multiple parsers could match.

import { registerParser } from './registry'
import { dbLogParser } from './parsers/db-log'
import { pasoeAccessParser } from './parsers/pasoe-access'
import { pasoeAppParser } from './parsers/pasoe-app'
import { catalinaParser } from './parsers/catalina'
import { pasoeWebappParser } from './parsers/pasoe-webapp'

registerParser(dbLogParser)
registerParser(pasoeAccessParser)
registerParser(pasoeAppParser)
registerParser(catalinaParser)
registerParser(pasoeWebappParser)
