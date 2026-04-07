import { useMemo, useRef, useState } from 'react';

const THUMB = 72;
const GAP = 10;
const ROW_HEIGHT = THUMB + GAP;
const COLS = 6;
const OVERSCAN_ROWS = 2;

function Thumb({ file, onRemove }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);

  return (
    <div className="thumb-wrap" title={file.name}>
      <img className="thumb" src={url} alt={file.name} loading="lazy" onLoad={() => URL.revokeObjectURL(url)} />
      <button type="button" className="thumb-remove" onClick={onRemove} aria-label={`Remove ${file.name}`}>x</button>
    </div>
  );
}

export default function VirtualImageGrid({ files, onRemove }) {
  const viewportRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const totalRows = Math.ceil(files.length / COLS);
  const viewportHeight = 220;

  const firstVisibleRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS);
  const visibleRows = Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN_ROWS * 2;
  const lastVisibleRow = Math.min(totalRows, firstVisibleRow + visibleRows);
  const startIdx = firstVisibleRow * COLS;
  const endIdx = Math.min(files.length, lastVisibleRow * COLS);
  const visible = files.slice(startIdx, endIdx);

  return (
    <div
      ref={viewportRef}
      className="image-virtual-viewport"
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div className="image-virtual-spacer" style={{ height: totalRows * ROW_HEIGHT }}>
        <div className="image-thumbs" style={{ transform: `translateY(${firstVisibleRow * ROW_HEIGHT}px)` }}>
          {visible.map((file, i) => (
            <Thumb
              key={`${file.name}-${startIdx + i}-${file.size}`}
              file={file}
              onRemove={() => onRemove(startIdx + i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
