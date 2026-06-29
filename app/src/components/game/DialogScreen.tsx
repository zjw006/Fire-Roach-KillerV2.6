import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SkipForward } from 'lucide-react';
import type { DialogConfig, DialogLine, SceneType } from '@/game/types';
import { AudioManager } from '@/game/audio';

// Get the correct background image for a scene + difficulty
function getDialogBgImage(sceneType: SceneType, difficulty?: string): string {
  const isHard = difficulty === 'hard';
  switch (sceneType) {
    case 'kitchen':
      return isHard ? '/assets/bg_kitchen_hard.jpg?v=3' : '/assets/bg_kitchen_easy.jpg?v=5';
    case 'sewer':
      return isHard ? '/assets/sewer_bg_hard.jpg?v=5' : '/assets/sewer_bg_easy.jpg?v=3';
    case 'dump':
      return isHard ? '/assets/bg_dump_hard.jpg?v=5' : '/assets/bg_dump_easy.jpg?v=3';
    case 'basement':
      return isHard ? '/assets/bg_basement_hard.jpg?v=5' : '/assets/bg_basement_easy.jpg?v=3';
    case 'rooftop':
      return isHard ? '/assets/bg_rooftop_hard.jpg?v=5' : '/assets/bg_rooftop_easy.jpg?v=4';
    case 'street':
      return isHard ? '/assets/bg_street_hard.jpg?v=6' : '/assets/bg_street_easy.jpg?v=6';
    case 'hospital':
      return '/assets/bg_hospital.jpg';
    default:
      return '/assets/bg.jpg';
  }
}

interface DialogScreenProps {
  config: DialogConfig;
  difficulty?: string;
  onComplete: () => void;
  onSkip: () => void;
  audio?: AudioManager;
}

const SPEAKER_COLORS: Record<string, { bg: string; text: string; border: string; bubble: string }> = {
  '蟑叔': {
    bg: 'bg-amber-900/60',
    text: 'text-amber-300',
    border: 'border-amber-600/40',
    bubble: 'bg-amber-900/70 border-amber-600/40',
  },
  '你': {
    bg: 'bg-stone-800/60',
    text: 'text-stone-300',
    border: 'border-stone-600/40',
    bubble: 'bg-stone-800/70 border-stone-600/40',
  },
  '螂老大': {
    bg: 'bg-red-900/60',
    text: 'text-red-300',
    border: 'border-red-600/40',
    bubble: 'bg-red-900/70 border-red-600/40',
  },
};

const SPEAKER_AVATAR: Record<string, string> = {
  '蟑叔': '/assets/avatar_zhangshu.png',
  '你': '/assets/avatar_player.png',
  '螂老大': '/assets/langlao-da.png',
};

// Match speaker names with suffixes like "螂老大（管道回声）" to base key "螂老大"
function getSpeakerKey(speaker: string): string {
  if (SPEAKER_AVATAR[speaker]) return speaker;
  // Check if speaker starts with any known key
  for (const key of Object.keys(SPEAKER_AVATAR)) {
    if (speaker.startsWith(key)) return key;
  }
  return '蟑叔'; // fallback
}

const SPEAKER_SIDE: Record<string, 'left' | 'right'> = {
  '蟑叔': 'left',
  '你': 'right',
  '螂老大': 'left',
};

function ChatBubble({
  line,
  displayedText,
  isTyping,
  isHistory,
}: {
  line: DialogLine;
  displayedText?: string;
  isTyping?: boolean;
  isHistory?: boolean;
}) {
  const speakerKey = getSpeakerKey(line.speaker);
  const side = SPEAKER_SIDE[speakerKey] || 'left';
  const isRight = side === 'right';
  const color = SPEAKER_COLORS[speakerKey] || SPEAKER_COLORS['蟑叔'];
  const text = isHistory ? line.text : (displayedText || '');

  return (
    <div className={`flex items-start gap-2 ${isRight ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar - fixed at top, never moves with text */}
      <div className="shrink-0 pt-1">
        <img
          src={SPEAKER_AVATAR[speakerKey]}
          alt={line.speaker}
          className="w-9 h-9 rounded-full object-cover border border-white/15"
          draggable={false}
        />
      </div>

      {/* Bubble - grows downward, avatar stays at top */}
      <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 border ${color.bubble}`}>
        <div className={`text-[11px] font-bold mb-0.5 ${color.text}`}>
          {line.speaker}
        </div>
        <p className="text-white/90 text-[13px] leading-relaxed">
          {text}
          {!isHistory && isTyping && (
            <span className="inline-block w-0.5 h-3.5 bg-white/60 ml-0.5 animate-pulse align-middle" />
          )}
        </p>
      </div>
    </div>
  );
}

export const DialogScreen: React.FC<DialogScreenProps> = ({ config, difficulty, onComplete, onSkip, audio }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const [bgLoaded, setBgLoaded] = useState(false);
  const [lines, setLines] = useState<DialogLine[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickCounterRef = useRef(0);

  // Dynamic background image based on scene + difficulty
  const bgImage = getDialogBgImage(config.sceneType, difficulty);

  // Pause BGM when dialog opens, resume on close
  useEffect(() => {
    audio?.pauseBGM();
    return () => {
      audio?.resumeBGM();
    };
  }, [audio]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setBgLoaded(true);
    img.src = bgImage;
  }, [bgImage]);

  const currentLine = config.lines[currentIndex];

  // Typing effect with sound
  useEffect(() => {
    setIsTyping(true);
    setDisplayedText('');
    tickCounterRef.current = 0;
    let charIndex = 0;
    const text = currentLine.text;
    const speed = 30;

    // Play switch sound when new line starts
    audio?.playDialogSwitch();

    typingRef.current = setInterval(() => {
      if (charIndex < text.length) {
        setDisplayedText(text.slice(0, charIndex + 1));
        charIndex++;
        tickCounterRef.current++;
        // Play typing tick every 3 characters
        if (tickCounterRef.current % 3 === 0) {
          audio?.playDialogTypingTick();
        }
      } else {
        setIsTyping(false);
        if (typingRef.current) clearInterval(typingRef.current);
      }
    }, speed);

    return () => {
      if (typingRef.current) clearInterval(typingRef.current);
    };
  }, [currentIndex, currentLine.text, audio]);

  // Auto-scroll: only scrollIntoView on the bottom anchor, never jump to top
  useEffect(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    });
  }, [lines.length, displayedText]);

  const advanceLine = useCallback(() => {
    const fullLine = config.lines[currentIndex];
    setLines(prev => [...prev, fullLine]);
    if (currentIndex < config.lines.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsComplete(true);
      setTimeout(onComplete, 500);
    }
  }, [currentIndex, config.lines, onComplete]);

  const handleClick = useCallback(() => {
    // Play click sound on every tap
    audio?.playDialogSwitch();
    if (isTyping) {
      // Skip typing - show full text
      setDisplayedText(currentLine.text);
      setIsTyping(false);
      if (typingRef.current) clearInterval(typingRef.current);
      return;
    }
    advanceLine();
  }, [isTyping, currentLine.text, advanceLine, audio]);

  const handleSkip = useCallback(() => {
    onSkip();
  }, [onSkip]);

  const progress = ((currentIndex + (isTyping ? 0 : 1)) / config.lines.length) * 100;

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col overflow-hidden cursor-pointer select-none"
      onClick={() => { audio?.playClick(); handleClick(); }}
    >
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-700"
        style={{ backgroundImage: `url(${bgImage})`, opacity: bgLoaded ? 1 : 0 }}
      />
      <div className="absolute inset-0 bg-black/65" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-4 py-3">
        <div>
          <h2 className="text-lg font-bold text-white/90 tracking-wider">{config.title}</h2>
          <div className="w-20 h-0.5 bg-white/20 mt-1" />
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); handleSkip(); }}
          className="flex items-center gap-1.5 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1.5 text-stone-400 hover:text-white transition-all border border-stone-700/50"
        >
          <SkipForward size={14} />
          <span className="text-xs">跳过</span>
        </button>
      </div>

      {/* Progress bar */}
      <div className="relative z-10 px-4 pb-2">
        <div className="bg-stone-800/60 rounded-full h-1 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-center text-[10px] text-stone-500 mt-1">
          {currentIndex + 1} / {config.lines.length}
        </div>
      </div>

      {/* Chat area */}
      <div
        ref={scrollRef}
        className="relative z-10 flex-1 overflow-y-auto px-4 py-2 space-y-3"
      >
        {/* Past completed lines */}
        {lines.map((item, idx) => (
          <ChatBubble key={idx} line={item} isHistory />
        ))}

        {/* Current typing line */}
        {!isComplete && (
          <ChatBubble
            line={currentLine}
            displayedText={displayedText}
            isTyping={isTyping}
          />
        )}

        {/* Bottom anchor for auto-scroll */}
        <div ref={bottomRef} className="h-1" />
      </div>

      {/* Click hint */}
      <div className="relative z-10 text-center pb-3 pt-1">
        <span className="text-[10px] text-stone-500">
          {isTyping ? '点击跳过打字' : isComplete ? '即将开始...' : '点击继续'}
        </span>
      </div>
    </div>
  );
};
