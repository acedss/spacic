import { cn } from "@/lib/utils"

interface Avatar {
  imageUrl: string
  profileUrl: string
}

interface AvatarCirclesProps {
  className?: string
  numPeople?: number
  avatarUrls: Avatar[]
}

export const AvatarCircles = ({
  numPeople,
  className,
  avatarUrls,
}: AvatarCirclesProps) => {
  return (
    <div className={cn("z-10 flex -space-x-4 rtl:space-x-reverse", className)}>
      {avatarUrls.map((url, index) => (
        <a key={index} href={url.profileUrl} target="_blank" rel="noopener noreferrer">
          <img
            className="h-10 w-10 rounded-full border-2 border-white dark:border-gray-800"
            src={url.imageUrl}
            width={40}
            height={40}
            alt={`Avatar ${index + 1}`}
          />
        </a>
      ))}
      {(numPeople ?? 0) > 0 && (
        <a className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-black text-center text-xs font-medium text-white hover:bg-gray-600 dark:border-gray-800 dark:bg-white dark:text-black"
          href="">
          +{numPeople}
        </a>
      )}
    </div>
  )
}

/* ─── ListenerAvatarStack ────────────────────────────────────────────────── */
/* Stacked colored-dot avatars for when we have listener count but no real
   profile images. Shows up to `maxVisible` hue-seeded dots + "+N more" pill. */
interface ListenerAvatarStackProps {
  count: number
  maxVisible?: number
  size?: number
  className?: string
}

export const ListenerAvatarStack = ({
  count,
  maxVisible = 5,
  size = 28,
  className,
}: ListenerAvatarStackProps) => {
  if (count <= 0) return null
  const visible = Math.min(maxVisible, count)
  const overflow = count - visible

  return (
    <div className={cn("flex items-center", className)}>
      <div className="flex -space-x-2">
        {Array.from({ length: visible }, (_, i) => {
          const hue = (i * 47) % 360
          return (
            <div
              key={i}
              className="rounded-full ring-2 ring-[oklch(0.12_0.02_285)] shrink-0"
              style={{
                width: size,
                height: size,
                background: `oklch(0.55 0.16 ${hue})`,
                boxShadow: `0 0 6px oklch(0.55 0.16 ${hue} / 0.5)`,
                zIndex: visible - i,
              }}
            />
          )
        })}
        {overflow > 0 && (
          <div
            className="rounded-full ring-2 ring-[oklch(0.12_0.02_285)] bg-white/10 grid place-items-center shrink-0"
            style={{ width: size, height: size, zIndex: 0 }}>
            <span className="mono text-white font-semibold"
              style={{ fontSize: Math.round(size * 0.32) }}>
              +{overflow > 999 ? '999' : overflow}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
