import { useEffect, useState } from 'react';

const STEPS = [
  { key: 'Queued',                 label: 'Queued',         icon: '⏳', pct: 0   },
  { key: 'Extracting last frame',  label: 'Extract Frame',  icon: '🎞',  pct: 10  },
  { key: 'Removing background',   label: 'Remove BG',      icon: '✂️', pct: 30  },
  { key: 'Adding sticker border', label: 'Add Border',      icon: '🖼',  pct: 55  },
  { key: 'Creating image slideshow', label: 'Slideshow',   icon: '🎠',  pct: 70  },
  { key: 'Composing final video', label: 'Compose',         icon: '🎬',  pct: 85  },
  { key: 'Done',                  label: 'Complete',        icon: '✅',  pct: 100 },
];

function getStepIndex(step) {
  if (!step) return 0;
  const idx = STEPS.findIndex(s => step.toLowerCase().includes(s.key.split(' ')[0].toLowerCase()));
  return idx === -1 ? 0 : idx;
}

export default function ProgressTracker({ status }) {
  const [dots, setDots] = useState('');
  const currentStep = status?.step || 'Queued';
  const progress = status?.progress ?? 0;
  const currentIdx = getStepIndex(currentStep);

  // Animated loading dots
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="progress-tracker" role="status" aria-live="polite">
      <div className="processing-header">
        <h2>Processing your video{dots}</h2>
        <p className="processing-hint">This may take 30–90 seconds depending on video length.</p>
      </div>

      {/* Progress Bar */}
      <div className="progress-bar-widget">
        <div className="progress-bar-wrapper" aria-label={`${progress}% complete`}>
          <div className="progress-bar" style={{ width: `${progress}%` }}>
            <span className="progress-glow" />
          </div>
        </div>
        <div className="progress-labels">
          <span className="progress-step-label">{currentStep}</span>
          <span className="progress-pct">{progress}%</span>
        </div>
      </div>

      {/* Steps Grid */}
      <div className="steps-grid" role="list">
        {STEPS.map((step, i) => {
          const state = i < currentIdx ? 'done' : i === currentIdx ? 'active' : 'pending';
          return (
            <div
              key={step.key}
              className={`step step--${state}`}
              role="listitem"
              aria-current={state === 'active'}
            >
              <span className="step-icon">{step.icon}</span>
              <span className="step-label">{step.label}</span>
              {state === 'done' && <span className="step-check">✓</span>}
              {state === 'active' && <span className="step-pulse" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
