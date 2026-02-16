"use client";

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { fetchStartups, StartupProfile, bookmarkStartup, unbookmarkStartup } from '@/api/startups';
import { StartupSearchBar } from '@/components/startups/StartupSearchBar';
import {
    TrendingUp,
    Rocket,
    Filter,
    Bookmark,
    BookmarkCheck,
    Globe,
    Users,
    FileText,
    ArrowUpRight,
    Briefcase,
    ChevronDown,
    Sparkles,
    Eye,
} from 'lucide-react';
import Link from 'next/link';

// ─── Stage utilities ──────────────────────────────
const stageLabels: Record<string, string> = {
    ideation: 'Ideation',
    mvp: 'MVP',
    scaling: 'Scaling',
    expansion: 'Expansion',
    maturity: 'Maturity',
};

const stageColors: Record<string, string> = {
    ideation: 'from-blue-500 to-cyan-500',
    mvp: 'from-violet-500 to-purple-500',
    scaling: 'from-green-500 to-emerald-500',
    expansion: 'from-orange-500 to-amber-500',
    maturity: 'from-red-500 to-rose-500',
};

const stageBg: Record<string, string> = {
    ideation: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    mvp: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
    scaling: 'bg-green-500/10 text-green-600 border-green-500/20',
    expansion: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    maturity: 'bg-red-500/10 text-red-600 border-red-500/20',
};

// ─── Deal Card ─────────────────────────────────────
function DealCard({
    startup,
    userId,
    onBookmarkToggle,
}: {
    startup: StartupProfile;
    userId: string;
    onBookmarkToggle: (id: string, bookmarked: boolean) => void;
}) {
    const [bookmarked, setBookmarked] = useState(startup.is_bookmarked ?? false);
    const [toggling, setToggling] = useState(false);

    const handleBookmark = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (toggling) return;
        setToggling(true);

        if (bookmarked) {
            await unbookmarkStartup(userId, startup.id);
        } else {
            await bookmarkStartup(userId, startup.id);
        }
        setBookmarked(!bookmarked);
        onBookmarkToggle(startup.id, !bookmarked);
        setToggling(false);
    };

    const latestRound = startup.funding_rounds?.[0];

    return (
        <Link href={`/startups/${startup.id}`}>
            <div className="group relative backdrop-blur-xl bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:border-primary/30 hover:-translate-y-0.5">
                {/* Raising banner */}
                {startup.is_actively_raising && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 via-emerald-400 to-teal-500" />
                )}

                <div className="p-5">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <div
                                className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${stageColors[startup.stage] || 'from-primary to-primary/80'} shadow-lg`}
                            >
                                <Rocket className="h-5 w-5 text-white" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                                    {startup.brand_name}
                                </h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span
                                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${stageBg[startup.stage] || 'bg-primary/10 text-primary border-primary/20'}`}
                                    >
                                        {stageLabels[startup.stage] || startup.stage}
                                    </span>
                                    {startup.is_actively_raising && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-500/10 text-green-600 border border-green-500/20">
                                            <TrendingUp className="h-3 w-3" />
                                            Raising
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Bookmark */}
                        <button
                            onClick={handleBookmark}
                            disabled={toggling}
                            className={`flex-shrink-0 p-2 rounded-xl transition-all duration-200 ${bookmarked ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
                        >
                            {bookmarked ? (
                                <BookmarkCheck className="h-4.5 w-4.5" />
                            ) : (
                                <Bookmark className="h-4.5 w-4.5" />
                            )}
                        </button>
                    </div>

                    {/* Description */}
                    {startup.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
                            {startup.description}
                        </p>
                    )}

                    {/* Keywords */}
                    {startup.keywords && startup.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                            {startup.keywords.slice(0, 5).map((kw, i) => (
                                <span
                                    key={i}
                                    className="px-2.5 py-1 rounded-lg text-xs bg-accent/60 text-accent-foreground font-medium"
                                >
                                    {kw}
                                </span>
                            ))}
                            {startup.keywords.length > 5 && (
                                <span className="px-2.5 py-1 rounded-lg text-xs bg-muted text-muted-foreground">
                                    +{startup.keywords.length - 5}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Meta row */}
                    <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground pt-3 border-t border-border/60">
                        {startup.founders && startup.founders.length > 0 && (
                            <span className="flex items-center gap-1.5">
                                <Users className="h-3.5 w-3.5" />
                                {startup.founders.length} founder{startup.founders.length > 1 ? 's' : ''}
                            </span>
                        )}
                        {latestRound && (
                            <span className="flex items-center gap-1.5">
                                <Briefcase className="h-3.5 w-3.5" />
                                {latestRound.round_type?.replace('_', ' ') || 'Funded'}
                            </span>
                        )}
                        {startup.pitch_deck_url && (
                            <span className="flex items-center gap-1.5 text-primary">
                                <FileText className="h-3.5 w-3.5" />
                                Pitch deck
                            </span>
                        )}
                        {startup.website && (
                            <span className="flex items-center gap-1.5">
                                <Globe className="h-3.5 w-3.5" />
                                Website
                            </span>
                        )}
                        {typeof startup.view_count === 'number' && (
                            <span className="flex items-center gap-1.5 ml-auto">
                                <Eye className="h-3.5 w-3.5" />
                                {startup.view_count}
                            </span>
                        )}
                    </div>
                </div>

                {/* Hover reveal CTA */}
                <div className="absolute bottom-0 left-0 right-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 bg-gradient-to-t from-card via-card to-transparent pt-8 pb-4 px-5">
                    <div className="flex items-center justify-center gap-2 text-sm font-medium text-primary">
                        View Details <ArrowUpRight className="h-4 w-4" />
                    </div>
                </div>
            </div>
        </Link>
    );
}

// ─── Main Page ─────────────────────────────────────
export default function DealFlowPage() {
    return (
        <Suspense
            fallback={
                <DashboardLayout>
                    <div className="flex items-center justify-center py-20">
                        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                </DashboardLayout>
            }
        >
            <DealFlowContent />
        </Suspense>
    );
}

function DealFlowContent() {
    const { user } = useAuth();

    const [startups, setStartups] = useState<StartupProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const [offset, setOffset] = useState(0);

    // Filters
    const [search, setSearch] = useState('');
    const [stageFilter, setStageFilter] = useState('');
    const [raisingOnly, setRaisingOnly] = useState(true); // Default to raising for deal flow
    const [showFilters, setShowFilters] = useState(false);

    const loadStartups = useCallback(
        async (reset = false) => {
            setLoading(true);
            const newOffset = reset ? 0 : offset;

            const { data, hasMore: more } = await fetchStartups({
                limit: 20,
                offset: newOffset,
                stage: stageFilter || undefined,
                raising: raisingOnly || undefined,
                search: search || undefined,
            });

            if (reset) {
                setStartups(data || []);
                setOffset(20);
            } else {
                setStartups((prev) => [...prev, ...(data || [])]);
                setOffset((prev) => prev + 20);
            }
            setHasMore(!!more);
            setLoading(false);
        },
        [offset, stageFilter, raisingOnly, search]
    );

    // Load on filter change
    useEffect(() => {
        loadStartups(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stageFilter, raisingOnly]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => loadStartups(true), 400);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    // Stats
    const stats = useMemo(() => {
        return {
            total: startups.length,
            raising: startups.filter((s) => s.is_actively_raising).length,
            withDeck: startups.filter((s) => s.pitch_deck_url).length,
        };
    }, [startups]);

    const handleBookmarkToggle = (id: string, bookmarked: boolean) => {
        setStartups((prev) =>
            prev.map((s) => (s.id === id ? { ...s, is_bookmarked: bookmarked } : s))
        );
    };

    if (!user) {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center py-20">
                    <p className="text-muted-foreground">Please sign in to view deal flow.</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Hero Header */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-6 md:p-8 text-white">
                    <div className="absolute inset-0 overflow-hidden">
                        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/5 blur-2xl" />
                        <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-white/5 blur-2xl" />
                    </div>
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="h-5 w-5 text-emerald-200" />
                            <span className="text-sm font-medium text-emerald-200 tracking-wide uppercase">
                                Investor Deal Flow
                            </span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-bold mb-2">
                            Discover Opportunities
                        </h1>
                        <p className="text-emerald-100/80 text-sm md:text-base max-w-xl">
                            Browse startups actively raising, review pitch decks, and connect with
                            founders building the next big thing.
                        </p>

                        {/* Quick stats */}
                        <div className="flex items-center gap-6 mt-5">
                            <div>
                                <p className="text-2xl font-bold">{stats.total}</p>
                                <p className="text-xs text-emerald-200">Startups</p>
                            </div>
                            <div className="w-px h-8 bg-white/20" />
                            <div>
                                <p className="text-2xl font-bold">{stats.raising}</p>
                                <p className="text-xs text-emerald-200">Raising</p>
                            </div>
                            <div className="w-px h-8 bg-white/20" />
                            <div>
                                <p className="text-2xl font-bold">{stats.withDeck}</p>
                                <p className="text-xs text-emerald-200">Pitch Decks</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Search & Filter bar */}
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="flex-1">
                            <StartupSearchBar value={search} onChange={setSearch} />
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200 ${showFilters || stageFilter
                                    ? 'bg-primary text-primary-foreground border-primary shadow-md'
                                    : 'bg-card text-foreground border-border hover:bg-accent'
                                }`}
                        >
                            <Filter className="h-4 w-4" />
                            Filters
                            {stageFilter && (
                                <span className="ml-1 w-2 h-2 rounded-full bg-white" />
                            )}
                            <ChevronDown
                                className={`h-3.5 w-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`}
                            />
                        </button>
                    </div>

                    {/* Expanded filters */}
                    {showFilters && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-200 bg-card border border-border rounded-xl p-4">
                            <div className="flex flex-wrap gap-3">
                                {/* Stage pills */}
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        Stage
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => setStageFilter('')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!stageFilter
                                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                                                }`}
                                        >
                                            All Stages
                                        </button>
                                        {Object.entries(stageLabels).map(([key, label]) => (
                                            <button
                                                key={key}
                                                onClick={() =>
                                                    setStageFilter(stageFilter === key ? '' : key)
                                                }
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${stageFilter === key
                                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                                        : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                                                    }`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Raising toggle */}
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        Status
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setRaisingOnly(false)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!raisingOnly
                                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                                                }`}
                                        >
                                            All Startups
                                        </button>
                                        <button
                                            onClick={() => setRaisingOnly(true)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${raisingOnly
                                                    ? 'bg-green-600 text-white shadow-sm'
                                                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                                                }`}
                                        >
                                            <span className="flex items-center gap-1.5">
                                                <TrendingUp className="h-3 w-3" />
                                                Raising Only
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Results */}
                {loading && startups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="h-10 w-10 border-3 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="text-sm text-muted-foreground">Finding startups…</p>
                    </div>
                ) : startups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                            <Rocket className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                        <p className="font-semibold text-foreground mb-1">No startups found</p>
                        <p className="text-sm text-muted-foreground max-w-sm">
                            {raisingOnly
                                ? 'No startups are actively raising right now. Try showing all startups.'
                                : 'Try adjusting your filters or search terms.'}
                        </p>
                        {raisingOnly && (
                            <button
                                onClick={() => setRaisingOnly(false)}
                                className="mt-4 px-4 py-2 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                            >
                                Show All Startups
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Result count */}
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                Showing <span className="font-semibold text-foreground">{startups.length}</span>{' '}
                                {raisingOnly ? 'startups raising' : 'startups'}
                                {stageFilter && (
                                    <>
                                        {' '}
                                        in{' '}
                                        <span className="font-semibold text-foreground">
                                            {stageLabels[stageFilter]}
                                        </span>
                                    </>
                                )}
                            </p>
                        </div>

                        {/* Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {startups.map((startup) => (
                                <DealCard
                                    key={startup.id}
                                    startup={startup}
                                    userId={user.id}
                                    onBookmarkToggle={handleBookmarkToggle}
                                />
                            ))}
                        </div>

                        {/* Load more */}
                        {hasMore && (
                            <div className="flex justify-center pt-4 pb-8">
                                <button
                                    onClick={() => loadStartups(false)}
                                    disabled={loading}
                                    className="px-8 py-3 bg-card text-foreground rounded-xl text-sm font-medium border border-border hover:bg-accent transition-all duration-200 disabled:opacity-50 shadow-sm hover:shadow-md"
                                >
                                    {loading ? (
                                        <span className="flex items-center gap-2">
                                            <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                            Loading…
                                        </span>
                                    ) : (
                                        'Load More Startups'
                                    )}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </DashboardLayout>
    );
}
