const NUMBERS_ES = 'uno · dos · tres · cuatro · cinco';

export function App() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-amber-50 px-6 text-center text-stone-800 dark:bg-stone-900 dark:text-stone-100">
      <header className="flex flex-col items-center gap-3">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          word<span className="text-orange-600 dark:text-orange-400">avi</span>
        </h1>
        <p className="text-sm uppercase tracking-widest text-stone-500 dark:text-stone-400">
          {NUMBERS_ES}
        </p>
      </header>
      <section className="flex max-w-md flex-col gap-2 text-lg">
        <p>Learning Spanish numbers — coming soon.</p>
        <p lang="ru">Учим испанские числа — скоро.</p>
      </section>
      <footer className="text-xs text-stone-400 dark:text-stone-500">v{__APP_VERSION__}</footer>
    </main>
  );
}
