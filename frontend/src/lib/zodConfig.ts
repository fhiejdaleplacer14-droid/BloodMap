import { z } from 'zod'

// Zod probes `new Function` to compile fast validators. The production CSP
// (script-src 'self', no eval) blocks that, so validate without it. Imported
// first in main.tsx: schemas read this flag when they're built, at import time.
z.config({ jitless: true })
