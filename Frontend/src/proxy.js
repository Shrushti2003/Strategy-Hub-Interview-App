import { NextResponse } from "next/server"

export function proxy(request) {
  const { pathname } = request.nextUrl
  const hasSession = Boolean(request.cookies.get("token")?.value)

  if (pathname.startsWith("/dashboard") && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*"]
}
