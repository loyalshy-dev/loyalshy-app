import Image from "next/image"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { PhoneFrame } from "./phone-frame"

// The team's app, said in one breath: the icon, one line, the stores, and
// the app itself on a phone. Store badges render only when the listing URLs
// are set, so a badge never points at nothing.
const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL
const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL

export async function StaffApp() {
  const t = await getTranslations("staffApp")

  return (
    <section id="staff-app" className="scroll-mt-24" style={{ background: "var(--mk-bg)" }}>
      <div className="mk-wrap grid grid-cols-1 items-center gap-12 py-20 lg:grid-cols-12 lg:gap-8 lg:py-28">
        <div className="flex flex-col items-center text-center lg:col-span-6 lg:items-start lg:text-left">
          <Image
            src="/staff-app/icon.webp"
            alt=""
            width={72}
            height={72}
            className="size-[72px] rounded-[18px]"
            style={{ boxShadow: "0 8px 24px oklch(0 0 0 / 0.18), 0 0 0 1px oklch(0 0 0 / 0.06)" }}
          />
          <h2 className="font-display mk-display-2 mt-6 max-w-[16ch]" style={{ color: "var(--mk-text)" }}>
            {t("title")}
          </h2>
          <p className="mk-lead mt-4 max-w-[40ch]">{t("subtitle")}</p>
          {(APP_STORE_URL || PLAY_STORE_URL) && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              {APP_STORE_URL && (
                <Link href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" aria-label={t("downloadAppStore")}>
                  <Image src="/staff-app/Download_on_the_App_Store_Badge_US-UK_RGB_blk_092917.svg" alt={t("downloadAppStore")} width={156} height={48} className="h-12 w-auto" />
                </Link>
              )}
              {PLAY_STORE_URL && (
                <Link href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" aria-label={t("downloadPlayStore")}>
                  <Image src="/staff-app/GetItOnGooglePlay_Badge_Web_color_English.svg" alt={t("downloadPlayStore")} width={180} height={48} className="h-12 w-auto" />
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-center lg:col-span-6 lg:justify-end">
          <PhoneFrame width={300} statusTime screenBackground="#F2F2F7">
            <Image
              src="/staff-app/today.webp"
              alt={t("screenAlt")}
              width={1170}
              height={2416}
              className="absolute inset-0 h-full w-full object-cover object-top"
              sizes="300px"
              loading="lazy"
            />
          </PhoneFrame>
        </div>
      </div>
    </section>
  )
}
