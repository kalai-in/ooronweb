import React, { useEffect } from 'react'
import { useSelector } from 'react-redux'
import HomeOfferModal from '../homepageoffermodal/HomeOfferModal'
import HomeSkeleton from './HomeSkeleton'
import HomeLayout from '../homelayout/HomeLayout'
import useIsHydrated from '@/hooks/useIsHydrated'

const HomePage = ({ initialHomeLayout = null, heading = null }) => {

    const setting = useSelector(state => state.Setting)
    const language = useSelector(state => state.Language.selectedLanguage)
    const hydrated = useIsHydrated()

    useEffect(() => { }, [language?.id])

    // `setting` comes from persisted redux, so it is null on the server and on the
    // first client render. Gating the whole page on it means SSR HTML would be
    // nothing but the skeleton. When gSSP resolved a zone and prefetched the
    // layout, render it straight away — the home sections don't need `setting`,
    // only the offer modal below does. Without SSR data the skeleton still shows.
    //
    // The `setting` read must be gated on `hydrated`: on the server `setting` is
    // null, but redux-persist populates it before the first client paint, so
    // reading it directly flips skeleton→layout (or vice-versa) between server
    // and client and React discards the tree (hydration error #418). Until
    // hydrated, decide purely from `initialHomeLayout` (available identically on
    // both sides); the persisted `setting` only refines the choice afterwards.
    const showSkeleton = hydrated
        ? setting?.setting == null && !initialHomeLayout
        : !initialHomeLayout;

    return (
        <>
            <div>
                {/* Single page H1 for SEO/accessibility. `heading` is an SSR prop
                    (identical on server and client, no persisted-redux read) so it
                    ships in the crawler HTML and never triggers a hydration mismatch.
                    Visually hidden — the home layout is image/section driven and has
                    no visible top-level title, but crawlers still require one H1. */}
                {heading && <h1 className="sr-only">{heading}</h1>}
                {showSkeleton ? <HomeSkeleton /> :
                    <>
                        <HomeLayout initialHomeLayout={initialHomeLayout} />
                        {/* Gate on `hydrated`: `setting` is null during SSR but
                            redux-persist fills it before the first client paint,
                            so without the gate the client renders the modal's
                            wrapper div that the server HTML doesn't have →
                            hydration mismatch. Modal is client-only UX anyway. */}
                        {hydrated && setting?.setting && setting?.setting?.popup_enabled === "1" &&
                            <HomeOfferModal />
                        }
                    </>
                }
            </div>
        </>
    )
}

export default HomePage