/**
 * Deterministic avatar utilities.
 * Given a username string, produces:
 *  - A fun emoji that never changes for that user
 *  - A unique gradient color pair
 */

const AVATAR_EMOJIS = [
  // Animals
  "🦊",
  "🐼",
  "🦁",
  "🐸",
  "🐵",
  "🦄",
  "🐙",
  "🦋",
  "🐢",
  "🦈",
  "🐳",
  "🦅",
  "🐝",
  "🦜",
  "🐺",
  "🦇",
  "🐲",
  "🦀",
  "🐬",
  "🦉",
  "🐯",
  "🦎",
  "🐧",
  "🦩",
  "🐨",
  "🦥",
  "🐻",
  "🦦",
  "🐮",
  "🦧",
  "🐷",
  "🦭",
  "🐹",
  "🐰",
  "🦝",
  "🦫",
  "🦬",
  "🦣",
  "🦃",
  "🦚",
  "🦂",
  "🐍",
  "🦑",
  "🐠",
  "🐡",
  "🦐",
  "🐊",
  "🦏",
  "🐘",
  "🦒",
  "🦘",
  "🐆",
  "🐅",
  "🐃",
  "🦌",
  "🐫",
  // Space & nature
  "🌋",
  "🌊",
  "🔥",
  "⚡",
  "🌙",
  "☄️",
  "🪐",
  "🌸",
  "🍄",
  "🌵",
  "🎋",
  "🌴",
  "🍀",
  "🌺",
  "🪷",
  "🌻",
  // Objects & symbols
  "💎",
  "🎲",
  "🎯",
  "🏆",
  "🎸",
  "🎭",
  "🧿",
  "🔮",
  "⚔️",
  "🛡️",
  "🚀",
  "🎪",
  "🧬",
  "🪬",
  "👾",
  "🤖",
  "👻",
  "🎃",
  "🧊",
  "🫧",
  "🪩",
  "🎵",
  "🧸",
  "🪆",
  // Food & fun
  "🍕",
  "🍩",
  "🧁",
  "🍉",
  "🍋",
  "🥝",
  "🌶️",
  "🍣",
  "🧇",
  "🥐",
  "🍪",
  "🫐",
  "🥥",
  "🍑",
  "🫒",
  "🥑",
] as const;

const GRADIENT_PAIRS: [string, string][] = [
  ["#FF6B6B", "#FFE66D"],
  ["#A18CD1", "#FBC2EB"],
  ["#43E97B", "#38F9D7"],
  ["#FA709A", "#FEE140"],
  ["#30CFD0", "#330867"],
  ["#A9C9FF", "#FFBBEC"],
  ["#F093FB", "#F5576C"],
  ["#4FACFE", "#00F2FE"],
  ["#667EEA", "#764BA2"],
  ["#F77062", "#FE5196"],
  ["#6A11CB", "#2575FC"],
  ["#FF9A9E", "#FAD0C4"],
  ["#FDCBF1", "#E6DEE9"],
  ["#89F7FE", "#66A6FF"],
  ["#FCCB90", "#D57EEB"],
  ["#E0C3FC", "#8EC5FC"],
];

function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getAvatarEmoji(name: string): string {
  const hash = hashString(name.toLowerCase());
  return AVATAR_EMOJIS[hash % AVATAR_EMOJIS.length];
}

export function getAvatarGradient(name: string): [string, string] {
  const hash = hashString(name.toLowerCase());
  return GRADIENT_PAIRS[hash % GRADIENT_PAIRS.length];
}
