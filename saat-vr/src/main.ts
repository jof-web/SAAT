// SAAT — ponto de entrada: jogo (padrão), console do instrutor (#instrutor) ou pré-visualização do mundo (#preview).
import './version';
import './ui/style.css';
if (location.hash === '#instrutor') import('./game/app').then((m) => m.bootConsoleWindow());
else if (location.hash.startsWith('#preview')) import('./game/preview').then((m) => m.bootPreview());
else import('./game/app').then((m) => m.bootGame());
