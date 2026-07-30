import type { CSSProperties } from "react";

interface TypewriterTextProps {
  text: string;
  className?: string;
  start: number;
  duration: number;
  showCursor?: boolean;
  persistCursor?: boolean;
  persistCursorAt?: number;
}

export function TypewriterText({
  text,
  className = "",
  start,
  duration,
  showCursor = true,
  persistCursor = false,
  persistCursorAt = start + duration,
}: TypewriterTextProps) {
  const characters = Array.from(text);
  const step = characters.length > 1 ? duration / (characters.length - 1) : 0;

  return (
    <span className={className} aria-label={text}>
      <span aria-hidden="true">
        {characters.map((character, index) => {
          const characterStart = start + step * index;
          const cursorDuration =
            index < characters.length - 1
              ? Math.max(step, 0.04)
              : Math.max(start + duration - characterStart, 0.1);

          return (
            <span className="typewriter-unit" key={`${character}-${index}`}>
              <span
                className="typewriter-character"
                style={{ animationDelay: `${characterStart}s` }}
              >
                {character === " " ? "\u00A0" : character}
              </span>
              {showCursor && (
                <span
                  className="typewriter-cursor typewriter-cursor--moving"
                  style={
                    {
                      "--cursor-start": `${characterStart}s`,
                      "--cursor-duration": `${cursorDuration}s`,
                    } as CSSProperties
                  }
                />
              )}
            </span>
          );
        })}
        {persistCursor && (
          <span
            className="typewriter-cursor typewriter-cursor--persist"
            aria-hidden="true"
            style={
              {
                "--cursor-start": `${persistCursorAt}s`,
              } as CSSProperties
            }
          />
        )}
      </span>
    </span>
  );
}
