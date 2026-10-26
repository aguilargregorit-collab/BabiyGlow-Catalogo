'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Bell, BellRing, Search, Sparkles, PackageOpen, Radio, CircleCheck, X, RefreshCw, MessageCircle, Instagram } from 'lucide-react';

type Product = { id: string; name: string; description: string | null; quantity: number; price: number; entry_date: string; image_url: string | null; created_at?: string };
type Notice = { id: string; title: string; body: string; time: string };
const money = (v: number) => new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(Number(v || 0));
export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'price-asc' | 'price-desc' | 'stock-desc' | 'stock-asc'>('recent');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notices, setNotices] = useState<Notice[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [showNotices, setShowNotices] = useState(false);
  const [showWelcomePrompt, setShowWelcomePrompt] = useState(false);
  const [showPwaPrompt, setShowPwaPrompt] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [connected, setConnected] = useState(false);

  const loadProducts = useCallback(async () => {
    if (!supabase) { setError('Faltan las variables de Supabase. Configura la URL y la clave publicable en Vercel.'); setLoading(false); return; }
    const { data, error: e } = await supabase.from('products').select('id,name,description,quantity,price,entry_date,image_url,created_at').order('created_at', { ascending: false });
    if (e) setError(`No se pudieron cargar los productos: ${e.message}`);
    else { setProducts((data || []) as Product[]); setError(''); }
    setLoading(false);
  }, []);

  const addNotice = useCallback((product: Product) => {
    const notice = { id: product.id + '-' + Date.now(), title: '¡Nuevo producto!', body: `${product.name} ya está en el catálogo.`, time: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) };
    setNotices(prev => [notice, ...prev].slice(0, 20));
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try { new Notification('Babi&Glow · Nuevo producto', { body: notice.body, icon: '/icons/icon-192.png', tag: product.id }); } catch { /* La notificación visual interna seguirá funcionando. */ }
    }
  }, []);

  useEffect(() => {
    let installFallbackTimer: ReturnType<typeof setTimeout> | undefined;
    let installedHandler: (() => void) | undefined;
    const handleInstallAvailable = (event: Event) => {
      event.preventDefault();
      const installEvent = event as Event & { prompt?: () => Promise<void>; userChoice?: Promise<{ outcome: string }> };
      setDeferredInstallPrompt(installEvent);
      try {
        if (!window.localStorage.getItem('babiglow-pwa-prompt-seen-v3') && !window.matchMedia('(display-mode: standalone)').matches) {
          setShowWelcomePrompt(false);
          setShowPwaPrompt(true);
        }
      } catch { setShowPwaPrompt(true); setShowWelcomePrompt(false); }
    };
    if (typeof window !== 'undefined') {
      if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined);
      const currentPermission = 'Notification' in window ? Notification.permission : 'unsupported';
      setPermission(currentPermission);
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      let pwaPromptSeen = false;
      let notificationPromptSeen = false;
      try {
        pwaPromptSeen = !!window.localStorage.getItem('babiglow-pwa-prompt-seen-v3');
        notificationPromptSeen = !!window.localStorage.getItem('babiglow-notification-prompt-seen-v3');
      } catch { /* Si el almacenamiento está bloqueado, seguimos mostrando los avisos. */ }
      if (!pwaPromptSeen && !isStandalone) {
        // Algunos navegadores disparan beforeinstallprompt después de cargar la página;
        // si no lo hacen, mostramos igualmente instrucciones de instalación manual.
        installFallbackTimer = setTimeout(() => {
          try {
            if (!window.localStorage.getItem('babiglow-pwa-prompt-seen-v3') && !window.matchMedia('(display-mode: standalone)').matches) {
              setShowPwaPrompt(true);
            }
          } catch { setShowPwaPrompt(true); }
        }, 500);
      } else if (currentPermission !== 'granted' && !notificationPromptSeen) {
        setShowWelcomePrompt(true);
      }
      window.addEventListener('beforeinstallprompt', handleInstallAvailable);
      installedHandler = () => {
        setShowPwaPrompt(false);
        setDeferredInstallPrompt(null);
        try { window.localStorage.setItem('babiglow-pwa-prompt-seen-v3', '1'); } catch {}
        if (currentPermission !== 'granted') {
          try { if (!window.localStorage.getItem('babiglow-notification-prompt-seen-v3')) setShowWelcomePrompt(true); } catch { setShowWelcomePrompt(true); }
        }
      };
      window.addEventListener('appinstalled', installedHandler);
    }

    // Cargar productos y suscribirse a Supabase fuera del bloque de eventos del navegador.
    void loadProducts();
    if (!supabase) return () => {
      if (installFallbackTimer) clearTimeout(installFallbackTimer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeinstallprompt', handleInstallAvailable);
        if (installedHandler) window.removeEventListener('appinstalled', installedHandler);
      }
    };
    const channel = supabase.channel('catalog-products-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, payload => {
        if (payload.eventType === 'INSERT') {
          const product = payload.new as Product;
          setProducts(prev => [product, ...prev.filter(p => p.id !== product.id)]);
          addNotice(product);
        } else if (payload.eventType === 'UPDATE') {
          const product = payload.new as Product;
          setProducts(prev => prev.map(p => p.id === product.id ? product : p));
        } else if (payload.eventType === 'DELETE') {
          const old = payload.old as Partial<Product>;
          setProducts(prev => prev.filter(p => p.id !== old.id));
        }
      })
      .subscribe(status => setConnected(status === 'SUBSCRIBED'));
    return () => {
      if (installFallbackTimer) clearTimeout(installFallbackTimer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeinstallprompt', handleInstallAvailable);
        if (installedHandler) window.removeEventListener('appinstalled', installedHandler);
      }
      void supabase?.removeChannel(channel);
    };
  }, [loadProducts, addNotice]);

  const filtered = useMemo(() => {
    const matching = products.filter(p => `${p.name} ${p.description || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
    return [...matching].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
      if (sortBy === 'price-asc') return Number(a.price || 0) - Number(b.price || 0);
      if (sortBy === 'price-desc') return Number(b.price || 0) - Number(a.price || 0);
      if (sortBy === 'stock-desc') return Number(b.quantity || 0) - Number(a.quantity || 0);
      if (sortBy === 'stock-asc') return Number(a.quantity || 0) - Number(b.quantity || 0);
      const dateA = new Date(a.created_at || a.entry_date || 0).getTime() || 0;
      const dateB = new Date(b.created_at || b.entry_date || 0).getTime() || 0;
      return dateB - dateA;
    });
  }, [products, query, sortBy]);
  const closeWelcomePrompt = () => {
    setShowWelcomePrompt(false);
    try { window.localStorage.setItem('babiglow-notification-prompt-seen-v3', '1'); } catch {}
  };
  const enableNotifications = async () => {
    if (!('Notification' in window)) { setPermission('unsupported'); closeWelcomePrompt(); return; }
    const result = await Notification.requestPermission(); setPermission(result);
    closeWelcomePrompt();
    if (result === 'granted') {
      try { new Notification('Babi & Glow', { body: '¡Listo! Te avisaremos cuando se agreguen productos mientras tengas abierto el catálogo.', icon: '/icons/icon-192.png' }); } catch {}
    }
  };
  const closePwaPrompt = () => {
    setShowPwaPrompt(false);
    try { window.localStorage.setItem('babiglow-pwa-prompt-seen-v3', '1'); } catch {}
    try { if (permission !== 'granted' && !window.localStorage.getItem('babiglow-notification-prompt-seen-v3')) setShowWelcomePrompt(true); } catch { if (permission !== 'granted') setShowWelcomePrompt(true); }
  };
  const installPwa = async () => {
    if (!deferredInstallPrompt) {
      // iOS/Safari y algunos navegadores no ofrecen el evento de instalación;
      // mostrar instrucciones reales en lugar de cerrar el aviso sin explicar.
      setShowInstallHelp(true);
      return;
    }
    try {
      await deferredInstallPrompt.prompt?.();
      const choice = await deferredInstallPrompt.userChoice;
      setDeferredInstallPrompt(null);
      if (choice?.outcome === 'accepted') {
        setShowPwaPrompt(false);
        try { window.localStorage.setItem('babiglow-pwa-prompt-seen-v3', '1'); } catch {}
        try { if (permission !== 'granted' && !window.localStorage.getItem('babiglow-notification-prompt-seen-v3')) setShowWelcomePrompt(true); } catch {}
      } else closePwaPrompt();
    } catch { setShowInstallHelp(true); }
  };
  const dismissNotice = (id: string) => setNotices(prev => prev.filter(n => n.id !== id));
  const purchaseWhatsAppUrl = (productName: string) => {
    const message = `¡Hola! Vi ${productName} en el catálogo de Babi&Glow y me gustaría adquirirlo. ¿Me podrían confirmar los detalles del pago y del retiro? ¡Gracias! 🌸`;
    return `https://wa.me/584248316536?text=${encodeURIComponent(message)}`;
  };

  return <main className="page-shell">
    {showPwaPrompt && <div className="notification-modal-backdrop" role="presentation"><section className="notification-modal" role="dialog" aria-modal="true" aria-labelledby="pwa-modal-title"><button className="notification-modal-close" onClick={closePwaPrompt} aria-label="Cerrar aviso"><X size={18}/></button><div className="notification-modal-icon"><Sparkles size={27}/></div><span className="eyebrow">BABI & GLOW EN TU DISPOSITIVO</span><h2 id="pwa-modal-title">¡Instala nuestra app!</h2><p>Agrega Babi&Glow a tu pantalla de inicio para abrir el catálogo fácilmente y tenerlo siempre a mano.</p><button className="notification-modal-activate" onClick={() => void installPwa()}><Sparkles size={17}/> {deferredInstallPrompt ? 'Instalar aplicación' : 'Cómo instalar la app'}</button>{showInstallHelp && <p className="notification-modal-help">{/iphone|ipad|ipod/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '') ? 'En Safari, pulsa Compartir y luego “Añadir a pantalla de inicio”.' : 'En el menú del navegador, busca “Instalar aplicación” o “Añadir a pantalla de inicio”. Si no aparece, abre este catálogo en Chrome o en el navegador compatible de tu dispositivo.'}</p>}<button className="notification-modal-later" onClick={closePwaPrompt}>Ahora no, gracias</button><small>Una experiencia práctica, directamente desde tu dispositivo.</small></section></div>}
    {showWelcomePrompt && !showPwaPrompt && <div className="notification-modal-backdrop" role="presentation"><section className="notification-modal" role="dialog" aria-modal="true" aria-labelledby="notification-modal-title"><button className="notification-modal-close" onClick={closeWelcomePrompt} aria-label="Cerrar aviso"><X size={18}/></button><div className="notification-modal-icon"><BellRing size={27}/></div><span className="eyebrow">NOVEDADES BABI & GLOW</span><h2 id="notification-modal-title">¡No te pierdas ningún producto!</h2><p>Activa las notificaciones para que no te pierdas ningún producto y puedas enterarte de las novedades de Babi&Glow.</p>{permission === 'unsupported' ? <p className="notification-modal-help">Este navegador no permite notificaciones. Puedes seguir explorando el catálogo normalmente.</p> : permission === 'denied' ? <p className="notification-modal-help">Las notificaciones están bloqueadas en tu navegador. Puedes habilitarlas desde los permisos del sitio.</p> : <button className="notification-modal-activate" onClick={() => void enableNotifications()}><Bell size={17}/> Activar notificaciones</button>}<button className="notification-modal-later" onClick={closeWelcomePrompt}>Ahora no, gracias</button><small>Solo te avisaremos de novedades del catálogo.</small></section></div>}
    <div className="announcement"><Sparkles size={14}/> Belleza que te inspira, novedades que te encantan</div>
    <header className="topbar">
      <a className="brand" href="#inicio" aria-label="Babi and Glow inicio"><img className="brand-logo" src="/logo-babi-glow.jpg" alt="Logo Babi&Glow"/><span className="brand-copy"><strong>BABI&GLOW</strong><small>Tu arte, tu estilo, tu esencia</small></span></a>
      <div className="top-actions"><span className={`live-pill ${connected ? 'online' : ''}`}><span className="live-dot"/>{connected ? 'Stock en vivo' : 'Conectando...'}</span><button className="bell-button" onClick={() => setShowNotices(v => !v)} aria-label="Ver notificaciones"><Bell size={19}/>{notices.length > 0 && <span className="notification-count">{notices.length}</span>}</button></div>
    </header>

    {showNotices && <section className="notice-panel"><div className="notice-head"><div><strong>Notificaciones</strong><small>Novedades del catálogo</small></div><button className="plain-icon" onClick={() => setShowNotices(false)} aria-label="Cerrar"><X size={18}/></button></div>{notices.length ? notices.map(n => <article className="notice-item" key={n.id}><span className="notice-icon"><BellRing size={17}/></span><div><strong>{n.title}</strong><p>{n.body}</p><small>{n.time}</small></div><button className="plain-icon" onClick={() => dismissNotice(n.id)} aria-label="Descartar"><X size={15}/></button></article>) : <p className="notice-empty">Todavía no hay novedades. Te avisaremos cuando se agreguen productos.</p>}{permission !== 'granted' && <button className="enable-notices" onClick={enableNotifications}><Bell size={16}/> Activar notificaciones del navegador</button>}{permission === 'denied' && <small className="permission-help">Las notificaciones están bloqueadas en tu navegador. Puedes habilitarlas desde los permisos del sitio.</small>}</section>}

    <section className="hero" id="inicio"><div className="hero-content"><span className="eyebrow"><span/> EL UNIVERSO BABI & GLOW</span><h1>Tu próximo favorito<br/>está <em>por descubrir.</em></h1><p>Explora nuestra selección de belleza y cuidado personal. Mira precios, detalles y disponibilidad actualizados desde nuestro inventario.</p><a className="hero-link" href="#catalogo">Explorar productos <span>↓</span></a></div><div className="hero-art"><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><div className="hero-glow"><img src="/logo-babi-glow.jpg" alt="Babi&Glow"/></div><div className="floating-tag tag-top">Tu ritual diario ✦</div><div className="floating-tag tag-bottom">Tu arte, tu estilo, tu esencia</div></div><div className="hero-caption">BELLEZA EN CADA DETALLE <span>✦</span></div></section>

    <section className="catalog-section" id="catalogo"><div className="section-heading"><div><span className="eyebrow">NUESTRA SELECCIÓN</span><h2>Encuentra tu <em>glow.</em></h2><p>Productos seleccionados para realzar tu esencia.</p></div><div className="catalog-meta"><span className="stock-indicator"><span className="live-dot"/> Actualización en tiempo real</span><strong>{products.length} <small>{products.length === 1 ? 'producto' : 'productos'}</small></strong></div></div>
      <div className="catalog-tools"><label className="search-box"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nombre o característica..."/><kbd>⌕</kbd></label><label className="sort-box"><span>Ordenar:</span><select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} aria-label="Filtrar productos"><option value="recent">Más recientes</option><option value="name">Nombre (A-Z)</option><option value="price-asc">Precio: menor a mayor</option><option value="price-desc">Precio: mayor a menor</option><option value="stock-desc">Stock: mayor a menor</option><option value="stock-asc">Stock: menor a mayor</option></select></label><button className="refresh-button" onClick={() => { setLoading(true); void loadProducts(); }}><RefreshCw size={16}/> Actualizar</button></div>
      {error && <div className="error-banner">{error}</div>}
      {loading ? <div className="loading-grid">{[1,2,3,4].map(n => <div className="skeleton-card" key={n}><div/><span/><span/></div>)}</div> : filtered.length === 0 ? <div className="empty-state"><div className="empty-symbol"><PackageOpen size={27}/></div><h3>{query ? 'No encontramos coincidencias' : 'Pronto habrá algo especial'}</h3><p>{query ? 'Prueba con otro nombre o característica.' : 'Los nuevos productos aparecerán aquí automáticamente cuando se agreguen al inventario.'}</p>{query && <button className="text-button" onClick={() => setQuery('')}>Limpiar búsqueda</button>}</div> : <div className="product-grid">{filtered.map(p => <article className="product-card" key={p.id}><div className="product-image">{p.image_url ? <img src={p.image_url} alt={p.name} loading="lazy"/> : <div className="image-placeholder"><span>B<span>&</span>G</span><small>ESENCIALES DE BELLEZA</small></div>}{p.created_at && Date.now() - new Date(p.created_at).getTime() < 7 * 86400000 && <span className="new-badge">NUEVO ✦</span>}{p.quantity <= 0 && <span className="sold-badge">AGOTADO</span>}</div><div className="product-info"><span className="product-category">BABI & GLOW · BELLEZA</span><h3>{p.name}</h3><p className="product-description">{p.description || 'Un esencial para tu rutina de belleza.'}</p><div className="product-bottom"><div><strong className="price">{money(p.price)}</strong><small className={p.quantity > 0 ? 'available' : 'unavailable'}>{p.quantity > 0 ? `${p.quantity} disponibles` : 'Sin existencias'}</small></div><span className="product-sparkle"><Sparkles size={17}/></span></div><a className="buy-button" href={purchaseWhatsAppUrl(p.name)} target="_blank" rel="noopener noreferrer" aria-label={`Consultar compra de ${p.name} por WhatsApp`}><MessageCircle size={16}/> Comprar por WhatsApp</a></div></article>)}</div>}
      <div className="catalog-footnote"><Radio size={15}/><span>El catálogo se sincroniza automáticamente con el inventario principal.</span></div>
    </section>
    {permission !== 'granted' && <section className="notify-strip"><div className="notify-icon"><BellRing size={22}/></div><div><span className="eyebrow">NOVEDADES DE BABI & GLOW</span><h2>Las novedades, primero.</h2><p>Activa las notificaciones para enterarte cuando lleguen nuevos productos.</p></div><button onClick={enableNotifications}>Avisarme de novedades <span>↗</span></button></section>}
    <section className="contact-strip" id="contacto"><div className="contact-copy"><span className="eyebrow">¿TIENES ALGUNA DUDA?</span><h2>Estamos aquí para ayudarte.</h2><p>Consulta por WhatsApp o síguenos en Instagram para conocer más sobre nuestros productos.</p></div><div className="contact-actions"><a className="contact-button whatsapp-button" href="https://wa.me/584248316536" target="_blank" rel="noopener noreferrer"><MessageCircle size={19}/> Contactar por WhatsApp</a><a className="contact-button instagram-button" href="https://www.instagram.com/babiglow2026?exln=MTlvNmt4bDUwajV6cA==" target="_blank" rel="noopener noreferrer"><Instagram size={19}/> Instagram @babiglow2026</a></div></section>
    <footer className="footer"><a className="brand footer-brand" href="#inicio"><img className="brand-logo" src="/logo-babi-glow.jpg" alt="Logo Babi&Glow"/><span className="brand-copy"><strong>BABI&GLOW</strong><small>Tu arte, tu estilo, tu esencia</small></span></a><p>Hecho para brillar, todos los días.</p><span>© {new Date().getFullYear()} Babi&Glow</span></footer>
  </main>;
}
