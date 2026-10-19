/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Laravel API origin, e.g. http://localhost:8000 (no trailing slash). */
  readonly VITE_API_URL?: string
  /** Raster tile template; defaults to tile.openstreetmap.org (decisions: open items). */
  readonly VITE_MAP_TILE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
