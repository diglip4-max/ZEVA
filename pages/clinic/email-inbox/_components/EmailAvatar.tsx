import React from "react";

const AVATAR_PALETTE: [string, string][] = [
  ["#8a6d3f", "#c9a24b"],
  ["#3f5a68", "#6f9aad"],
  ["#5c4a6b", "#9a7fb0"],
  ["#4a6b56", "#7fae8f"],
  ["#6b4a4a", "#b07d7d"],
  ["#4a556b", "#7d8fb0"],
];

function paletteFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[h];
}

function initialsFor(name?: string) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

interface EmailAvatarProps {
  name?: string;
  unread?: boolean;
  size?: number;
}

export default function EmailAvatar({ name = "?", unread, size = 36 }: EmailAvatarProps) {
  const [c1, c2] = paletteFor(name);
  return (
    <div className="pi-avatar-wrap" style={{ width: size, height: size }}>
      <div
        className="pi-avatar"
        style={{
          background: `linear-gradient(135deg, ${c1}, ${c2})`,
          width: size,
          height: size,
          fontSize: size * 0.33,
        }}
      >
        {initialsFor(name)}
      </div>
      {unread && <span className="pi-avatar-dot" />}
    </div>
  );
}
