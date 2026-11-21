// crudex motion (from design/motion/motion.js): scroll reveal, nav, parallax, statement scrub.
// Call initMotion() once after mount and return its cleanup. No library needed.
export function initMotion(root: ParentNode = document) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cleanups: (() => void)[] = [];

  root
    .querySelectorAll('[data-reveal-stagger], .m-hero, .m-list')
    .forEach((p) =>
      [...p.children].forEach((c, i) => (c as HTMLElement).style.setProperty('--i', String(i))),
    );

  // Reveal on scroll, once.
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      }),
    { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
  );
  root
    .querySelectorAll('[data-reveal]')
    .forEach((el) => (reduce ? el.classList.add('is-in') : io.observe(el)));
  cleanups.push(() => io.disconnect());
  if (reduce) return () => cleanups.forEach((f) => f());

  // Statement words are rendered as <span class="w"> by the page (Thai has no spaces to split on).
  const words = [...root.querySelectorAll<HTMLElement>('[data-scrub-words] .w')];
  const nav = root.querySelector('.m-nav');
  const para = [...root.querySelectorAll<HTMLElement>('[data-parallax]')];
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const vh = innerHeight;
      nav?.classList.toggle('is-scrolled', scrollY > 8);
      para.forEach((el) => {
        const r = el.parentElement!.getBoundingClientRect();
        const d = (r.top + r.height / 2 - vh / 2) * -parseFloat(el.dataset.parallax || '0.15');
        el.style.setProperty('--py', `${Math.max(-60, Math.min(60, d)).toFixed(1)}px`);
      });
      words.forEach((w) => {
        const t = w.getBoundingClientRect().top;
        w.style.setProperty(
          '--on',
          String(Math.max(0, Math.min(1, (vh * 0.72 - t) / (vh * 0.12)))),
        );
      });
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();
  cleanups.push(() => {
    removeEventListener('scroll', onScroll);
    removeEventListener('resize', onScroll);
  });
  return () => cleanups.forEach((f) => f());
}

/** Play a one-shot animation class, e.g. once(cell, 'm-flash'). */
export function once(el: Element, cls: string) {
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
  el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
}
