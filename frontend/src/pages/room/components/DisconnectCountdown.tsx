interface Props {
    countdown: number;
}

export const DisconnectCountdown = ({ countdown }: Props) => (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center backdrop-blur-sm">
        <div className="bg-zinc-900 border border-red-500/30 rounded-2xl p-10 text-center max-w-sm shadow-2xl">
            <div className="text-7xl font-bold text-red-400 mb-5 tabular-nums">{countdown}</div>
            <h3 className="text-xl font-semibold mb-2">Creator Disconnected</h3>
            <p className="text-zinc-400 text-sm">
                Room closing in {countdown} second{countdown !== 1 ? 's' : ''}...
            </p>
        </div>
    </div>
);
