import { useEffect, useRef } from "react";

interface HeroContentBackdropProps {
  heroId: string;
  surfaceId: string;
  endId: string;
}

const vertexShaderSource = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const fragmentShaderSource = `
precision mediump float;

#define BLOCK_PX 52.0

varying vec2 v_uv;
uniform vec2 u_resolution;
uniform float u_reveal;
uniform float u_noise_progress;
uniform float u_exit_progress;

float hash21(vec2 point) {
  return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
}

float hash31(vec3 point) {
  return fract(
    sin(dot(point, vec3(127.1, 311.7, 74.7))) * 43758.5453123
  );
}

void main() {
  float vertical = v_uv.y;
  float reveal = clamp(u_reveal, 0.0008, 1.0);
  float noiseProgress = clamp(u_noise_progress, 0.0, 1.0);
  float exitProgress = clamp(u_exit_progress, 0.0, 1.0);

  const float COLOR_STEPS = 8.0;
  float quantizedProgress =
    floor(noiseProgress * COLOR_STEPS + 0.0001) / COLOR_STEPS;

  vec2 fragment = gl_FragCoord.xy;
  vec2 block = floor(fragment / BLOCK_PX);
  float column = block.x;

  float blockNoise = hash21(
    block + vec2(quantizedProgress * 4.5, quantizedProgress * 3.5)
  );
  float flicker = hash31(
    vec3(column, block.y * 0.25, quantizedProgress * 5.5)
  );

  float wobble =
    (flicker - 0.5) * 0.09 * (1.0 - reveal * 0.85) *
    (1.0 - vertical * 0.28);
  float columnRise = hash21(vec2(column, 41.0)) * 0.16;
  float leadingEdge = reveal + max(0.0, columnRise + wobble);

  float alpha =
    1.0 - smoothstep(leadingEdge - 0.052, leadingEdge + 0.068, vertical);
  alpha = max(alpha, smoothstep(0.91, 1.0, reveal));

  float exitWobble =
    (flicker - 0.5) * 0.075 * (1.0 - exitProgress * 0.62);
  float exitEdge =
    exitProgress * 0.94 -
    columnRise +
    smoothstep(0.82, 1.0, exitProgress) * 0.24 +
    exitWobble;
  float exitEnabled = smoothstep(0.001, 0.035, exitProgress);
  float exitMask = mix(
    1.0,
    smoothstep(exitEdge - 0.052, exitEdge + 0.068, vertical),
    exitEnabled
  );
  alpha *= exitMask;

  vec3 backgroundColor = vec3(0.9608);

  vec3 blockLow = vec3(0.80, 0.806, 0.796);
  vec3 blockHigh = vec3(0.982, 0.984, 0.976);
  float softenedNoise = blockNoise * 0.65 + 0.175;
  vec3 blockColor = mix(blockLow, blockHigh, softenedNoise);

  float edgeDistance = min(
    abs(vertical - leadingEdge),
    abs(vertical - reveal)
  );
  float intro = 1.0 - smoothstep(0.0, 0.92, noiseProgress);
  float edgePresence =
    (1.0 - smoothstep(0.0, 0.12, edgeDistance)) * intro;
  float exitEdgePresence =
    (1.0 - smoothstep(0.0, 0.12, abs(vertical - exitEdge))) *
    exitEnabled *
    (1.0 - smoothstep(0.88, 1.0, exitProgress));
  float noiseAmount = intro * 0.30 + edgePresence * 0.50;
  float blockBlendCeiling = 1.0 - smoothstep(0.76, 0.9, reveal);
  float entryBlockMix =
    noiseAmount * (0.45 + 0.55 * softenedNoise) * blockBlendCeiling;
  float exitBlockMix =
    exitEdgePresence * (0.38 + 0.62 * softenedNoise) * 0.62;
  float blockMix = max(entryBlockMix, exitBlockMix);
  vec3 color = mix(backgroundColor, blockColor, min(blockMix, 1.0));

  vec2 gridCell = fract(fragment / BLOCK_PX);
  float horizontalInset =
    smoothstep(0.0, 0.04, gridCell.x) *
    smoothstep(1.0, 0.96, gridCell.x);
  float verticalInset =
    smoothstep(0.0, 0.04, gridCell.y) *
    smoothstep(1.0, 0.96, gridCell.y);
  float gridTail = mix(
    1.0,
    0.18,
    smoothstep(0.86, 1.0, noiseProgress)
  );
  // Exit (reversed) pass: bring the grid lines back while the surface
  // recedes — mirroring the entry pass — then fade them as the exit ends.
  float exitGrid =
    exitEnabled * (1.0 - smoothstep(0.86, 1.0, exitProgress));
  float gridStrength = max(gridTail, exitGrid);
  color -=
    (1.0 - horizontalInset * verticalInset) * 0.022 * gridStrength;

  float softenedAlpha = clamp(alpha, 0.0, 1.0);
  gl_FragColor = vec4(color * softenedAlpha, softenedAlpha);
}
`;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

const smoothstep = (value: number) => {
  const clamped = clamp(value);
  return clamped * clamped * (3 - 2 * clamped);
};

const createShader = (
  context: WebGLRenderingContext,
  type: number,
  source: string,
) => {
  const shader = context.createShader(type);
  if (!shader) return null;

  context.shaderSource(shader, source);
  context.compileShader(shader);
  if (context.getShaderParameter(shader, context.COMPILE_STATUS)) {
    return shader;
  }

  context.deleteShader(shader);
  return null;
};

export function HeroContentBackdrop({
  heroId,
  surfaceId,
  endId,
}: HeroContentBackdropProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const hero = document.getElementById(heroId);
    const surface = document.getElementById(surfaceId);
    const endSection = document.getElementById(endId);
    if (!root || !canvas || !hero || !surface) return;

    const context = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
    });

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    let frame: number | null = null;
    let documentVisible = !document.hidden;
    let targetProgress = 0;
    let displayedProgress = 0;
    let targetExitProgress = 0;
    let displayedExitProgress = 0;
    let targetOpacity = 0;
    let displayedOpacity = 0;
    let renderScene:
      | ((progress: number, exitProgress: number) => void)
      | null = null;
    let disposeScene: (() => void) | null = null;

    const resizeCanvas = () => {
      const ratio = Math.min(1.75, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(window.innerWidth * ratio));
      const height = Math.max(1, Math.round(window.innerHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;
      }
    };

    if (context) {
      const vertexShader = createShader(
        context,
        context.VERTEX_SHADER,
        vertexShaderSource,
      );
      const fragmentShader = createShader(
        context,
        context.FRAGMENT_SHADER,
        fragmentShaderSource,
      );

      if (vertexShader && fragmentShader) {
        const program = context.createProgram();
        if (program) {
          context.attachShader(program, vertexShader);
          context.attachShader(program, fragmentShader);
          context.linkProgram(program);

          if (context.getProgramParameter(program, context.LINK_STATUS)) {
            const positionLocation = context.getAttribLocation(
              program,
              "a_position",
            );
            const resolutionLocation = context.getUniformLocation(
              program,
              "u_resolution",
            );
            const revealLocation = context.getUniformLocation(
              program,
              "u_reveal",
            );
            const noiseProgressLocation = context.getUniformLocation(
              program,
              "u_noise_progress",
            );
            const exitProgressLocation = context.getUniformLocation(
              program,
              "u_exit_progress",
            );
            const buffer = context.createBuffer();

            if (buffer) {
              context.bindBuffer(context.ARRAY_BUFFER, buffer);
              context.bufferData(
                context.ARRAY_BUFFER,
                new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
                context.STATIC_DRAW,
              );

              renderScene = (progress, exitProgress) => {
                resizeCanvas();
                context.viewport(0, 0, canvas.width, canvas.height);
                context.disable(context.DEPTH_TEST);
                context.enable(context.BLEND);
                context.blendFunc(
                  context.ONE,
                  context.ONE_MINUS_SRC_ALPHA,
                );
                context.clearColor(0, 0, 0, 0);
                context.clear(context.COLOR_BUFFER_BIT);
                context.useProgram(program);
                context.bindBuffer(context.ARRAY_BUFFER, buffer);
                context.enableVertexAttribArray(positionLocation);
                context.vertexAttribPointer(
                  positionLocation,
                  2,
                  context.FLOAT,
                  false,
                  0,
                  0,
                );
                context.uniform2f(
                  resolutionLocation,
                  canvas.width,
                  canvas.height,
                );
                context.uniform1f(
                  revealLocation,
                  0.06 + smoothstep(progress) * 0.94,
                );
                context.uniform1f(noiseProgressLocation, progress);
                context.uniform1f(exitProgressLocation, exitProgress);
                context.drawArrays(context.TRIANGLE_STRIP, 0, 4);
              };

              disposeScene = () => {
                context.deleteBuffer(buffer);
                context.deleteProgram(program);
              };
            }
          }

          if (!renderScene) context.deleteProgram(program);
        }
      }

      if (vertexShader) context.deleteShader(vertexShader);
      if (fragmentShader) context.deleteShader(fragmentShader);
    }

    if (!renderScene) {
      root.dataset.fallback = "true";
      renderScene = (progress, exitProgress) => {
        root.style.setProperty(
          "--hero-backdrop-reveal",
          `${smoothstep(progress) * 100}%`,
        );
        root.style.setProperty(
          "--hero-backdrop-exit",
          `${smoothstep(exitProgress) * 100}%`,
        );
      };
    }

    const updateTargets = () => {
      const viewportHeight = Math.max(1, window.innerHeight);
      const heroBounds = hero.getBoundingClientRect();
      const heroTravel = Math.max(0, -heroBounds.top);
      const start = viewportHeight * 0.98;
      const end = Math.max(
        start + viewportHeight * 0.36,
        hero.offsetHeight - viewportHeight,
      );
      const rawProgress = clamp((heroTravel - start) / (end - start));

      targetProgress = reducedMotion.matches
        ? rawProgress > 0.5
          ? 1
          : 0
        : rawProgress;

      const headerHeight =
        Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--header-height",
          ),
        ) || 0;
      const endTop =
        endSection?.getBoundingClientRect().top ??
        surface.getBoundingClientRect().bottom;
      const rawExitProgress = clamp(
        (viewportHeight - endTop) /
          Math.max(1, viewportHeight - headerHeight),
      );
      targetExitProgress = reducedMotion.matches
        ? rawExitProgress > 0.5
          ? 1
          : 0
        : rawExitProgress;
      targetOpacity =
        rawProgress > 0.001 && rawExitProgress < 0.999 ? 1 : 0;

      if (targetOpacity > 0.001 || displayedOpacity > 0.001) {
        root.style.visibility = "visible";
      }
    };

    const draw = () => {
      frame = null;
      if (!documentVisible) return;

      const smoothing = reducedMotion.matches ? 1 : 0.16;
      displayedProgress +=
        (targetProgress - displayedProgress) * smoothing;
      displayedExitProgress +=
        (targetExitProgress - displayedExitProgress) *
        (reducedMotion.matches ? 1 : 0.12);
      displayedOpacity +=
        (targetOpacity - displayedOpacity) * smoothing;

      if (Math.abs(targetProgress - displayedProgress) < 0.0004) {
        displayedProgress = targetProgress;
      }
      if (Math.abs(targetOpacity - displayedOpacity) < 0.0004) {
        displayedOpacity = targetOpacity;
      }
      if (
        Math.abs(targetExitProgress - displayedExitProgress) < 0.0004
      ) {
        displayedExitProgress = targetExitProgress;
      }

      root.style.opacity = displayedOpacity.toFixed(4);
      root.style.visibility =
        displayedOpacity > 0.001 ? "visible" : "hidden";
      renderScene?.(displayedProgress, displayedExitProgress);

      if (
        Math.abs(targetProgress - displayedProgress) > 0.0004 ||
        Math.abs(targetExitProgress - displayedExitProgress) > 0.0004 ||
        Math.abs(targetOpacity - displayedOpacity) > 0.0004
      ) {
        frame = window.requestAnimationFrame(draw);
      }
    };

    const requestDraw = () => {
      updateTargets();
      if (
        targetOpacity <= 0.001 &&
        displayedOpacity <= 0.001 &&
        frame === null
      ) {
        root.style.opacity = "0";
        root.style.visibility = "hidden";
        return;
      }
      if (documentVisible && frame === null) {
        frame = window.requestAnimationFrame(draw);
      }
    };

    const handleVisibility = () => {
      documentVisible = !document.hidden;
      if (!documentVisible && frame !== null) {
        window.cancelAnimationFrame(frame);
        frame = null;
      } else {
        requestDraw();
      }
    };

    resizeCanvas();
    requestDraw();
    window.addEventListener("scroll", requestDraw, { passive: true });
    window.addEventListener("resize", requestDraw);
    document.addEventListener("visibilitychange", handleVisibility);
    reducedMotion.addEventListener("change", requestDraw);

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestDraw);
      window.removeEventListener("resize", requestDraw);
      document.removeEventListener("visibilitychange", handleVisibility);
      reducedMotion.removeEventListener("change", requestDraw);
      disposeScene?.();
    };
  }, [endId, heroId, surfaceId]);

  return (
    <div
      ref={rootRef}
      className="hero-content-backdrop"
      aria-hidden="true"
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
