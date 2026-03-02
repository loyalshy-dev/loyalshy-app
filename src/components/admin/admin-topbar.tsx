"use client"

import React from "react"
import { usePathname } from "next/navigation"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

const breadcrumbLabels: Record<string, string> = {
  admin: "Admin",
  users: "Users",
  restaurants: "Restaurants",
}

export function AdminTopbar() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)

  return (
    <header className="flex items-center h-14 px-4 lg:px-6 border-b border-border bg-background/80 backdrop-blur-sm shrink-0">
      <Breadcrumb>
        <BreadcrumbList>
          {segments.map((segment, i) => {
            const isLast = i === segments.length - 1
            const label = breadcrumbLabels[segment] ?? segment
            const href = "/" + segments.slice(0, i + 1).join("/")

            return (
              <React.Fragment key={segment}>
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage className="text-[13px] font-medium">
                      {label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      href={href}
                      className="text-[13px] text-muted-foreground hover:text-foreground"
                    >
                      {label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast && <BreadcrumbSeparator />}
              </React.Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  )
}
