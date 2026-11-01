// Ícones de traço (Lucide, ISC) — só os usados, para não inflar o arquivo.
import {
  createElement, HardHat, Glasses, Shirt, Footprints, Hand, Ear, ShieldHalf, Bell, Clock, Zap, Lock, Radio, Map, ClipboardList, FileText, MessageSquare,
  BookOpen, Package, Gauge, Settings, User, Users, ChartColumn, GraduationCap, ClipboardCheck, Siren, HeartPulse, Wrench, LifeBuoy, Play, Pause, Search, Eye,
  TriangleAlert, Info, Check, X, ArrowLeft, ChevronRight, Battery, Wifi, LogOut, Monitor, Activity, Flame, ShieldCheck, Target, Compass, RotateCcw, Download, Upload,
  Plus, Trash2, Pencil, FlaskConical, Signal, Headset, Trophy, LogIn, KeyRound,
} from 'lucide';
const I: Record<string, any> = { HardHat, Glasses, Shirt, Footprints, Hand, Ear, ShieldHalf, Bell, Clock, Zap, Lock, Radio, Map, ClipboardList, FileText, MessageSquare, BookOpen, Package, Gauge, Settings, User, Users, ChartColumn, GraduationCap, ClipboardCheck, Siren, HeartPulse, Wrench, LifeBuoy, Play, Pause, Search, Eye, TriangleAlert, Info, Check, X, ArrowLeft, ChevronRight, Battery, Wifi, LogOut, Monitor, Activity, Flame, ShieldCheck, Target, Compass, RotateCcw, Download, Upload, Plus, Trash2, Pencil, FlaskConical, Signal, Headset, Trophy, LogIn, KeyRound };
export function ic(name: string, size = 18, stroke = 1.75): SVGElement {
  const node = I[name] || I.Info; const el = createElement(node) as unknown as SVGElement;
  el.setAttribute('width', String(size)); el.setAttribute('height', String(size)); el.setAttribute('stroke-width', String(stroke)); el.setAttribute('aria-hidden', 'true'); el.classList.add('ic'); return el;
}
/** Ícone por item de EPI/ferramenta. */
export const EPI_ICON: Record<string, string> = {
  capacete: 'HardHat', oculos: 'Glasses', oculos_ampla: 'Glasses', vestimenta: 'Shirt', botina: 'Footprints', protetor_facial: 'ShieldHalf', balaclava: 'User', luva_isolante: 'Hand', luva_cobertura: 'Hand', luva_pvc: 'Hand',
  protetor_auricular: 'Ear', detector_mt: 'Zap', detector_at: 'Zap', vara_manobra: 'Wrench', manivela_extracao: 'Wrench', alavanca_terra: 'Wrench', manivela_secc: 'Wrench', kit_bloqueio: 'Lock',
  aterr_mt: 'Zap', radio: 'Radio', lampada: 'Info', sinalizacao: 'TriangleAlert', tapete: 'Package', dea: 'HeartPulse',
};
