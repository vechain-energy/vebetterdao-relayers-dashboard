type SearchParamValue = string | number | boolean | null | undefined

type SearchParamsInput =
  | string
  | URLSearchParams
  | Record<string, SearchParamValue>

type ToAppUrlOptions = {
  basePath?: string
  origin?: string
}

const DUMMY_ORIGIN = "https://example.local"

export function normalizeBasePath(value: string | undefined): string {
  if (!value) return ""

  const trimmed = value.trim()
  if (!trimmed || trimmed === "/") return ""

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
  return withLeadingSlash.replace(/\/+$/, "")
}

function normalizeAppPath(path: string): string {
  if (!path) return "/"
  return path.startsWith("/") ? path : `/${path}`
}

function applySearchParams(
  searchParams: URLSearchParams,
  input: SearchParamsInput,
): void {
  if (typeof input === "string") {
    const parsed = new URLSearchParams(
      input.startsWith("?") ? input.slice(1) : input,
    )
    for (const [key, value] of parsed.entries()) {
      searchParams.set(key, value)
    }
    return
  }

  if (input instanceof URLSearchParams) {
    for (const [key, value] of input.entries()) {
      searchParams.set(key, value)
    }
    return
  }

  for (const [key, value] of Object.entries(input)) {
    if (value == null) continue
    searchParams.set(key, String(value))
  }
}

export const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH)

export function withBasePath(path: string, basePathOverride = basePath): string {
  const effectiveBasePath = normalizeBasePath(basePathOverride)
  const url = new URL(normalizeAppPath(path), DUMMY_ORIGIN)

  const pathname =
    effectiveBasePath &&
    (url.pathname === effectiveBasePath ||
      url.pathname.startsWith(`${effectiveBasePath}/`))
      ? url.pathname
      : url.pathname === "/"
        ? effectiveBasePath || "/"
        : `${effectiveBasePath}${url.pathname}`

  return `${pathname}${url.search}${url.hash}`
}

export function toAppUrl(
  path: string,
  searchParams?: SearchParamsInput,
  options: ToAppUrlOptions = {},
): string {
  const url = new URL(withBasePath(path, options.basePath), DUMMY_ORIGIN)

  if (searchParams) {
    applySearchParams(url.searchParams, searchParams)
  }

  const appPath = `${url.pathname}${url.search}${url.hash}`
  if (!options.origin) return appPath

  return new URL(appPath, options.origin).toString()
}
