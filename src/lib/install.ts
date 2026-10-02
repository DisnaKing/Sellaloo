// Chrome avisa de que la app se puede instalar antes de que la pantalla lo necesite:
// se guarda el aviso para enseñar el botón «Añadir» cuando toque.
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
}

export let installPrompt: InstallPrompt | null = null;

addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e as InstallPrompt;
});

export const isStandalone = () => matchMedia('(display-mode: standalone)').matches;
// El iPad moderno se presenta como Mac; se distingue porque tiene pantalla táctil.
export const isIos = () => /iPhone|iPad/.test(navigator.userAgent) || (/Mac/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
