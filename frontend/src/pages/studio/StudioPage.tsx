import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { getMyRoom, upsertRoom, goLive, goOffline, getSongs, getCreatorRoomAnalytics } from '@/lib/roomService';
import { getMyPlaylists } from '@/lib/playlistService';
import { getMinigamesForRoom } from '@/lib/minigameService';
import { listBroadcastAssets } from '@/lib/broadcastService';
import type {
    CreatorRoomAnalytics, RoomInfo, Song,
    SavedPlaylist, Minigame, BroadcastAsset, RoomFeatureFlags,
} from '@/types/types';
import { BroadcastAssetsTab } from './components/BroadcastAssetsTab';
import { GoLiveDialog } from './components/GoLiveDialog';
import { StudioHeader } from './components/StudioHeader';
import { OverviewTab } from './components/OverviewTab';
import { PlaylistsTab } from './components/PlaylistsTab';
import { MinigamesTab } from './components/MinigamesTab';
import { SettingsTab } from './components/SettingsTab';
import { Card } from './components/studio-atoms';
import {
    TABS, toDate, toDateTimeInputValue,
    type AnalyticsGranularity, type StudioTab,
} from './components/studio-shared';

const StudioPage = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<StudioTab>('overview');

    const [room, setRoom] = useState<RoomInfo | null | undefined>(undefined);
    const [songs, setSongs] = useState<Song[]>([]);
    const [saving, setSaving] = useState(false);
    const [toggling, setToggling] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [goLiveDialogOpen, setGoLiveDialogOpen] = useState(false);
    const [songsLoading, setSongsLoading] = useState(true);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isPublic, setIsPublic] = useState(true);
    const [streamGoal, setStreamGoal] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
    const [coverImageKey, setCoverImageKey] = useState<string | null>(null);

    const [analytics, setAnalytics] = useState<CreatorRoomAnalytics | null>(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(true);
    const [analyticsGranularity, setAnalyticsGranularity] = useState<AnalyticsGranularity>('daily');
    const [analyticsRefreshTick, setAnalyticsRefreshTick] = useState(0);
    const [initialRange] = useState(() => {
        const to = new Date();
        const from = new Date(to.getTime() - 30 * 86_400_000);
        return { from: toDateTimeInputValue(from), to: toDateTimeInputValue(to) };
    });
    const [analyticsFrom, setAnalyticsFrom] = useState(initialRange.from);
    const [analyticsTo, setAnalyticsTo] = useState(initialRange.to);
    const [appliedAnalyticsGranularity, setAppliedAnalyticsGranularity] = useState<AnalyticsGranularity>('daily');
    const [appliedAnalyticsFrom, setAppliedAnalyticsFrom] = useState(initialRange.from);
    const [appliedAnalyticsTo, setAppliedAnalyticsTo] = useState(initialRange.to);

    const [playlists, setPlaylists] = useState<SavedPlaylist[]>([]);
    const [playlistsLoading, setPlaylistsLoading] = useState(false);

    const [broadcastAssets, setBroadcastAssets] = useState<BroadcastAsset[]>([]);
    const [broadcastsLoading, setBroadcastsLoading] = useState(false);

    const [featureFlags, setFeatureFlags] = useState<RoomFeatureFlags>({
        liveMic: true, chat: true, donations: true, voting: true,
        minigames: true, voteQueue: true, broadcasts: true,
    });

    const [minigames, setMinigames] = useState<Minigame[]>([]);
    const [minigamesLoading, setMinigamesLoading] = useState(false);

    useEffect(() => {
        Promise.all([getMyRoom(), getSongs(true)])
            .then(([myRoom, rawSongs]) => {
                const allSongs = rawSongs.filter((s, i, arr) => arr.findIndex(x => x._id === s._id) === i);
                setRoom(myRoom);
                setSongs(allSongs);
                setSongsLoading(false);
                if (myRoom) {
                    setTitle(myRoom.title);
                    setDescription(myRoom.description ?? '');
                    setIsPublic(myRoom.isPublic);
                    setStreamGoal(myRoom.streamGoal > 0 ? String(myRoom.streamGoal) : '');
                    setSelectedIds(myRoom.playlist.map(s => s._id));
                    if (myRoom.featureFlags) setFeatureFlags(myRoom.featureFlags);
                    if (myRoom.tags?.length) setSelectedTags(myRoom.tags);
                    if (myRoom.coverImageUrl) setCoverImageUrl(myRoom.coverImageUrl);
                    if (myRoom.coverImageKey) setCoverImageKey(myRoom.coverImageKey);
                }
            })
            .catch(() => { setError('Failed to load room data'); setSongsLoading(false); });
    }, []);

    useEffect(() => {
        let cancelled = false;
        setAnalyticsLoading(true);
        const load = async () => {
            try {
                const data = await getCreatorRoomAnalytics({
                    granularity: appliedAnalyticsGranularity,
                    from: toDate(appliedAnalyticsFrom)?.toISOString(),
                    to: toDate(appliedAnalyticsTo)?.toISOString(),
                });
                if (!cancelled) setAnalytics(data);
            } catch { if (!cancelled) toast.error('Failed to load analytics'); }
            finally { if (!cancelled) setAnalyticsLoading(false); }
        };
        void load();
        return () => { cancelled = true; };
    }, [appliedAnalyticsGranularity, appliedAnalyticsFrom, appliedAnalyticsTo, analyticsRefreshTick]);

    useEffect(() => {
        if (activeTab !== 'playlists') return;
        setPlaylistsLoading(true);
        getMyPlaylists()
            .then(setPlaylists)
            .catch(() => toast.error('Failed to load playlists'))
            .finally(() => setPlaylistsLoading(false));
    }, [activeTab]);

    useEffect(() => {
        if (activeTab !== 'broadcasts') return;
        setBroadcastsLoading(true);
        listBroadcastAssets()
            .then(setBroadcastAssets)
            .catch(() => toast.error('Failed to load broadcast assets'))
            .finally(() => setBroadcastsLoading(false));
    }, [activeTab]);

    useEffect(() => {
        if (activeTab !== 'minigames' || !room?._id) return;
        setMinigamesLoading(true);
        getMinigamesForRoom(room._id)
            .then(setMinigames)
            .catch(() => toast.error('Failed to load minigames'))
            .finally(() => setMinigamesLoading(false));
    }, [activeTab, room?._id]);

    const applyAnalyticsRange = () => {
        const fromDate = toDate(analyticsFrom);
        const toDateValue = toDate(analyticsTo);
        if (!fromDate || !toDateValue) return toast.error('Invalid date range');
        if (fromDate >= toDateValue) return toast.error('From must be before To');
        setAppliedAnalyticsGranularity(analyticsGranularity);
        setAppliedAnalyticsFrom(analyticsFrom);
        setAppliedAnalyticsTo(analyticsTo);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return setError('Room name is required');
        if (selectedIds.length === 0) return setError('Select at least one song');
        setError(null);
        setSaving(true);
        try {
            const saved = await upsertRoom({
                title: title.trim(),
                description: description.trim(),
                isPublic,
                playlistIds: selectedIds,
                streamGoal: streamGoal ? parseInt(streamGoal, 10) : 0,
                tags: selectedTags,
                coverImageUrl: coverImageKey,
            });
            setRoom(saved);
            toast.success('Room saved');
        } catch (err) { setError(err instanceof Error ? err.message : 'Failed to save'); }
        finally { setSaving(false); }
    };

    const handleGoLiveConfirm = useCallback(async () => {
        setGoLiveDialogOpen(false);
        if (!room) return;
        setToggling(true);
        try {
            await goLive(room._id);
            navigate('/studio/live');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to go live');
            setToggling(false);
        }
    }, [room, navigate]);

    const handleGoOffline = async () => {
        if (!room) return;
        setToggling(true);
        try {
            await goOffline(room._id);
            const refreshed = await getMyRoom();
            setRoom(refreshed);
            setAnalyticsRefreshTick(t => t + 1);
            toast.success('Room is now offline');
        } catch (err) { setError(err instanceof Error ? err.message : 'Failed to go offline'); }
        finally { setToggling(false); }
    };

    const loadPlaylistIntoRoom = (playlist: SavedPlaylist) => {
        setSelectedIds(playlist.songs.map(s => s._id));
        setActiveTab('settings');
        toast.success(`"${playlist.name}" loaded — save to apply`);
    };

    if (room === undefined) {
        return (
            <div className="max-w-5xl mx-auto py-12 px-6 space-y-8">
                <Skeleton className="h-8 w-48 bg-white/5 rounded-xl" />
                <div className="flex gap-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-24 rounded-xl bg-white/5" />)}</div>
                <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-2xl bg-white/5" />)}</div>
            </div>
        );
    }

    const isLive = room?.status === 'live';
    const hasRoom = !!room;

    return (
        <div className="max-w-5xl mx-auto py-12 px-6 space-y-7" style={{ color: 'var(--fg-1)' }}>
            <StudioHeader
                room={room}
                toggling={toggling}
                canGoLive={selectedIds.length > 0}
                onGoLive={() => setGoLiveDialogOpen(true)}
                onGoOffline={handleGoOffline}
            />

            {isLive && (
                <div className="flex items-center gap-3 rounded-2xl px-5 py-3 ring-1 ring-[oklch(0.72_0.22_20_/_0.3)]"
                    style={{ background: 'oklch(0.72 0.22 20 / 0.08)' }}>
                    <span className="live-dot shrink-0" />
                    <p className="text-[13px] text-[oklch(0.82_0.17_20)]">You are live — manage the session from your Live Dashboard</p>
                    <button onClick={() => navigate('/studio/live')} className="ml-auto mono text-[10px] text-[oklch(0.82_0.17_20)] underline press">Open →</button>
                </div>
            )}

            <div className="flex gap-1 p-1 rounded-2xl ring-1 ring-white/8 w-fit" style={{ background: 'var(--ink-2)' }}>
                {TABS.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-all press',
                            activeTab === tab.id
                                ? 'bg-white/10 text-white ring-1 ring-white/10'
                                : 'hover:text-white hover:bg-white/5'
                        )}
                        style={{ color: activeTab === tab.id ? undefined : 'var(--fg-3)' }}>
                        <tab.icon className="size-3.5" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'overview' && hasRoom && (
                <OverviewTab
                    room={room}
                    analytics={analytics}
                    analyticsLoading={analyticsLoading}
                    granularity={analyticsGranularity}
                    setGranularity={setAnalyticsGranularity}
                    from={analyticsFrom}
                    to={analyticsTo}
                    setFrom={setAnalyticsFrom}
                    setTo={setAnalyticsTo}
                    onApply={applyAnalyticsRange}
                    onRefresh={() => setAnalyticsRefreshTick(t => t + 1)}
                />
            )}
            {activeTab === 'overview' && !hasRoom && (
                <Card className="py-16 text-center">
                    <p className="text-[14px]" style={{ color: 'var(--fg-3)' }}>No channel yet — create one in the Settings tab</p>
                    <button onClick={() => setActiveTab('settings')} className="mt-4 h-9 px-5 rounded-xl bg-white text-[var(--ink-0)] text-[13px] font-semibold press">
                        Go to Settings
                    </button>
                </Card>
            )}

            {activeTab === 'playlists' && (
                <PlaylistsTab
                    songs={songs}
                    songsLoading={songsLoading}
                    playlists={playlists}
                    setPlaylists={setPlaylists}
                    playlistsLoading={playlistsLoading}
                    onLoadPlaylist={loadPlaylistIntoRoom}
                />
            )}

            {activeTab === 'broadcasts' && (
                <BroadcastAssetsTab
                    assets={broadcastAssets}
                    loading={broadcastsLoading}
                    onAssetsChange={setBroadcastAssets}
                />
            )}

            {activeTab === 'minigames' && (
                <MinigamesTab
                    roomId={room?._id}
                    isLive={isLive}
                    minigames={minigames}
                    setMinigames={setMinigames}
                    minigamesLoading={minigamesLoading}
                />
            )}

            {activeTab === 'settings' && (
                <SettingsTab
                    isLive={isLive}
                    hasRoom={hasRoom}
                    saving={saving}
                    error={error}
                    title={title} setTitle={setTitle}
                    description={description} setDescription={setDescription}
                    isPublic={isPublic} setIsPublic={setIsPublic}
                    streamGoal={streamGoal} setStreamGoal={setStreamGoal}
                    selectedTags={selectedTags} setSelectedTags={setSelectedTags}
                    coverImageUrl={coverImageUrl} setCoverImageUrl={setCoverImageUrl}
                    coverImageKey={coverImageKey} setCoverImageKey={setCoverImageKey}
                    songs={songs} songsLoading={songsLoading}
                    selectedIds={selectedIds} setSelectedIds={setSelectedIds}
                    onSave={handleSave}
                    onNavigateToPlaylists={() => setActiveTab('playlists')}
                    featureFlags={featureFlags} setFeatureFlags={setFeatureFlags}
                />
            )}

            <GoLiveDialog open={goLiveDialogOpen} onCancel={() => setGoLiveDialogOpen(false)} onConfirm={handleGoLiveConfirm} />
        </div>
    );
};

export default StudioPage;
