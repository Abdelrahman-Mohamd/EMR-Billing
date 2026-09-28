import { useEffect, type ReactNode, type Ref } from 'react'
import logoUrl from '@/assets/logo.png'
import artUrl from '../assets/login.webp'

/** 1×1 transparent GIF: what a narrow screen loads instead of the art. */
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

/**
 * The page every signed-out screen shares — sign in, and the forgot-password
 * steps. Its look is the approved prototype's sign-in page: a photograph with
 * the product line on the left, the content on the right, the art dropped
 * below 1024px.
 *
 * What changed from the prototype, and why:
 * - The content sits in the vertical middle (`my-auto`) instead of at the top.
 *   `my-auto` rather than `justify-center` so a short screen or an open phone
 *   keyboard scrolls instead of clipping the top.
 * - The content comes first in the document and the art second (swapped back
 *   visually), so a screen reader meets the heading and fields first, and the
 *   art's line is a paragraph rather than an `h2` above the `h1`.
 * - `min-h-dvh`, not `height: 100%`: mobile browsers' collapsing toolbars.
 * - Phones never download the 200 kB photograph (see `<picture>` below).
 */
export function AuthLayout({
  documentTitle,
  title,
  lede,
  titleRef,
  children,
}: {
  /** The browser tab's title, before " · EMR Billing". */
  documentTitle: string
  /** The page's `h1`. A second, lighter part goes in a `<span className="text-n500 font-light">`. */
  title: ReactNode
  lede: ReactNode
  /** Lets a multi-step screen move focus to the heading when the step changes. */
  titleRef?: Ref<HTMLHeadingElement>
  children: ReactNode
}) {
  // The tab title is how a screen-reader user, and anyone with ten tabs open,
  // knows where they are. Setting it is an effect on something outside React.
  useEffect(() => {
    const previous = document.title
    document.title = `${documentTitle} · EMR Billing`
    return () => {
      document.title = previous
    }
  }, [documentTitle])

  return (
    <div className="bg-canvas flex min-h-dvh lg:flex-row-reverse">
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto px-5 py-8 sm:px-12 sm:py-10">
        <div className="mx-auto my-auto w-full max-w-[520px]">
          <img src={logoUrl} alt="EMR" className="h-auto w-[104px]" />

          <h1
            ref={titleRef}
            tabIndex={-1}
            className="text-ink mt-7 text-[clamp(32px,6vw,42px)] leading-[1.05] font-normal outline-none"
          >
            {title}
          </h1>
          <p className="text-row text-n600 mt-3.5 leading-relaxed [overflow-wrap:anywhere]">{lede}</p>

          {children}
        </div>
      </main>

      <aside className="bg-brand-deep relative hidden w-[min(600px,42vw)] flex-none overflow-hidden lg:block">
        {/* The <source> only matches where the panel is shown, so a phone
            fetches the 1×1 placeholder, not the photograph. */}
        <picture>
          <source media="(min-width: 1024px)" srcSet={artUrl} />
          <img src={BLANK} alt="" decoding="async" className="absolute inset-0 size-full object-cover" />
        </picture>
        <div aria-hidden="true" className="bg-brand absolute inset-0 opacity-20" />
        {/* Art direction from the prototype: a deep teal from the bottom so
            the white copy stays readable over any part of the photograph. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-[72%] bg-gradient-to-t from-[rgb(0_40_58/0.92)] to-transparent"
        />
        <div className="absolute inset-0 flex flex-col justify-end px-11 py-10">
          <div aria-hidden="true" className="bg-sand mb-6 h-px w-[46px]" />
          <p className="max-w-[16ch] text-[clamp(30px,3vw,40px)] leading-[1.12] font-normal text-white">
            Every claim, owned from session to payment.
          </p>
          <p className="text-row mt-[18px] max-w-[44ch] leading-relaxed text-white/85">
            The revenue cycle for Physical Therapy and multi-specialty practices — from the finalized clinical
            note to the posted payment.
          </p>
        </div>
      </aside>
    </div>
  )
}
