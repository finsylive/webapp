"use client";

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import { GA_MEASUREMENT_ID, trackPageView, trackError } from '@/utils/analytics';

/**
 * Inner component that tracks route changes.
 * Wrapped in Suspense because useSearchParams() requires it.
 */
function AnalyticsPageTracker() {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (!GA_MEASUREMENT_ID) return;
        const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
        trackPageView(url);
    }, [pathname, searchParams]);

    return null;
}

/**
 * Global error listener — catches unhandled errors and promise rejections
 * and reports them to Google Analytics.
 */
function GlobalErrorTracker() {
    useEffect(() => {
        if (!GA_MEASUREMENT_ID) return;

        const handleError = (event: ErrorEvent) => {
            trackError(
                `Unhandled: ${event.message} at ${event.filename}:${event.lineno}`,
                false
            );
        };

        const handleRejection = (event: PromiseRejectionEvent) => {
            const reason = event.reason instanceof Error
                ? event.reason.message
                : String(event.reason);
            trackError(`Unhandled promise rejection: ${reason}`, false);
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleRejection);

        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleRejection);
        };
    }, []);

    return null;
}

/**
 * Google Analytics component — add to your root layout.
 *
 * Loads the GA4 script and automatically tracks:
 * - Page views on route changes
 * - Unhandled errors and promise rejections
 *
 * Set NEXT_PUBLIC_GA_MEASUREMENT_ID in .env.local to enable.
 * If the env var is not set, this component renders nothing.
 */
export function GoogleAnalytics() {
    if (!GA_MEASUREMENT_ID) return null;

    return (
        <>
            {/* GA4 script tags */}
            <Script
                strategy="lazyOnload"
                src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            />
            <Script
                id="google-analytics"
                strategy="lazyOnload"
                dangerouslySetInnerHTML={{
                    __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}', {
              page_auto_event: true,
              send_page_view: false,
            });
          `,
                }}
            />

            {/* Auto-track page views */}
            <Suspense fallback={null}>
                <AnalyticsPageTracker />
            </Suspense>

            {/* Auto-track unhandled errors */}
            <GlobalErrorTracker />
        </>
    );
}
