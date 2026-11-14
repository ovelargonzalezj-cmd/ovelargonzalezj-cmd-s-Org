import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';

export type AppSection = 'inicio' | 'seguimiento' | 'asistente' | 'admin';

interface NavbarProps {
  activeSection: AppSection;
  onNavigate: (section: AppSection, anchorId?: string) => void;
  unreadNotifications: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeSection,
  onNavigate,
  unreadNotifications,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLinkClick = (section: AppSection, anchorId?: string) => {
    setMobileOpen(false);
    onNavigate(section, anchorId);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark (single clean element) */}
        <button
          type="button"
          onClick={() => handleLinkClick('inicio', 'top')}
          className="text-lg font-display font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] rounded"
        >
          AsunciónTech
        </button>

        {/* Zone 2: 4 concise single-line nav links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => handleLinkClick('inicio', 'servicios')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
              activeSection === 'inicio'
                ? 'text-slate-900 border-[#1D4ED8]'
                : 'border-transparent hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            Servicios
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('seguimiento', 'portal-seguimiento')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
              activeSection === 'seguimiento'
                ? 'text-slate-900 border-[#1D4ED8]'
                : 'border-transparent hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            Seguimiento{unreadNotifications > 0 ? ` (${unreadNotifications})` : ''}
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('asistente', 'asistente-ia')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
              activeSection === 'asistente'
                ? 'text-slate-900 border-[#1D4ED8]'
                : 'border-transparent hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            Asistente IA
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('admin', 'panel-admin')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
              activeSection === 'admin'
                ? 'text-slate-900 border-[#1D4ED8]'
                : 'border-transparent hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            Panel Admin
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleLinkClick('seguimiento', 'solicitar-reparacion')}
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1D4ED8]"
          >
            Solicitar Reparación
          </button>
          <button
            type="button"
            aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setMobileOpen((prev) => !prev)}
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
          <button
            type="button"
            onClick={() => handleLinkClick('inicio', 'servicios')}
            className="block w-full text-left px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
          >
            Servicios y Ubicación
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('seguimiento', 'portal-seguimiento')}
            className="block w-full text-left px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
          >
            Seguimiento en Tiempo Real {unreadNotifications > 0 ? `(${unreadNotifications})` : ''}
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('asistente', 'asistente-ia')}
            className="block w-full text-left px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
          >
            Asistente IA Técnico
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('admin', 'panel-admin')}
            className="block w-full text-left px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
          >
            Panel Administrativo
          </button>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => handleLinkClick('seguimiento', 'solicitar-reparacion')}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#1D4ED8] rounded-lg"
            >
              Solicitar Reparación
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
