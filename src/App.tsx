import { GalleryScreen } from '@/screens/GalleryScreen';

const NUMBERS_ES = 'uno · dos · tres · cuatro · cinco';

/** Hidden component gallery, for visual smokechecks against the design mockups. */
function galleryRequested(): boolean {
  return typeof location !== 'undefined' && new URLSearchParams(location.search).has('gallery');
}

export function App() {
  if (galleryRequested()) return <GalleryScreen />;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-screen text-center">
      <header className="flex flex-col items-center gap-3">
        <h1 className="font-display text-5xl font-bold">
          word<span className="text-accent">aví</span>
        </h1>
        <p lang="es" className="numerals text-caption uppercase tracking-widest text-text-muted">
          {NUMBERS_ES}
        </p>
      </header>
      <section className="flex max-w-md flex-col gap-2 text-body-lg">
        <p>Learning Spanish numbers — coming soon.</p>
        <p lang="ru">Учим испанские числа — скоро.</p>
      </section>
      <footer className="text-caption text-text-faint">v{__APP_VERSION__}</footer>
    </main>
  );
}
