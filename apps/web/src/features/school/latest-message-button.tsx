import { ArrowDown } from 'lucide-react';
import { useEffect, useState, type RefObject } from 'react';
import { Button } from '@/components/ui/button';

export function LatestMessageButton({ viewport }: { viewport: RefObject<HTMLDivElement | null> }) {
  const [away, setAway] = useState(false);
  useEffect(() => {
    const region = viewport.current;
    if (!region) return;
    function measure() {
      if (region) setAway(region.scrollHeight - region.clientHeight - region.scrollTop > 96);
    }
    region.addEventListener('scroll', measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(region);
    return () => {
      region.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, [viewport]);

  if (!away) return null;
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className="latest-message-button absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 gap-1.5 shadow-sm"
      onClick={() => {
        const region = viewport.current;
        if (region) {
          region.scrollTo({ top: region.scrollHeight, behavior: 'instant' });
          region.focus({ preventScroll: true });
        }
      }}
    >
      <ArrowDown aria-hidden="true" /> ข้อความล่าสุด
    </Button>
  );
}
