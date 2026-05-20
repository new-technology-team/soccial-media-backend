export const EMOJI_SET = [
  '😀',
  '😄',
  '😂',
  '🥹',
  '😍',
  '😘',
  '🤝',
  '🙏',
  '🔥',
  '🎉',
  '💙',
  '👍',
  '🤔',
  '😎',
  '😢',
  '😡',
  '❤️',
  '🤗',
  '👏',
  '💪',
  '🙌',
  '✨',
  '🎊',
  '💯',
  '🚀',
  '🌟',
]

export const MESSAGE_REACTIONS = [
  { type: 'smile', emoji: '😄', label: 'Cười' },
<<<<<<< HEAD
  { type: 'sad', emoji: '😢', label: 'BuĂ¡»“n' },
  { type: 'like', emoji: '👍', label: 'Like' },
  { type: 'love', emoji: '❤️', label: 'Tym' },
  { type: 'wow', emoji: '😮', label: 'BĂ¡º¥t ngờ' },
  { type: 'cry', emoji: '😭', label: 'Khóc' },
  { type: 'angry', emoji: '😡', label: 'TĂ¡»©c giĂ¡º­n' },
=======
  { type: 'sad', emoji: '😢', label: 'Buồn' },
  { type: 'like', emoji: '👍', label: 'Like' },
  { type: 'love', emoji: '❤️', label: 'Tym' },
  { type: 'wow', emoji: '😮', label: 'Bất ngờ' },
  { type: 'cry', emoji: '😭', label: 'Khóc' },
  { type: 'angry', emoji: '😡', label: 'Tức giận' },
>>>>>>> e1e0f981eaeaaf7229c1f05934c42d2d9ef91993
] as const

export const STICKER_PACKS: Record<string, string[]> = {
  Cute: ['🐼', '🐱', '🐶', '🦊', '🐵', '🐸', '🐯', '🦄'],
  Meme: ['🤣', '🫠', '😏', '😵', '🤯', '🤡', '👀', '💀'],
  Animals: ['🐨', '🐻', '🦁', '🐮', '🐷', '🐔', '🐧', '🐙'],
  Party: ['🎉', '🥳', '🎊', '🔥', '💥', '✨', '🍾', '🎈'],
}

export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    ...(import.meta.env.VITE_TURN_URL
      ? [
          {
            urls: import.meta.env.VITE_TURN_URL,
            username: import.meta.env.VITE_TURN_USERNAME,
            credential: import.meta.env.VITE_TURN_CREDENTIAL,
          },
        ]
      : []),
  ],
}
