'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Bell, BellRing, Search, Sparkles, PackageOpen, Radio, CircleCheck, X, RefreshCw, MessageCircle, Instagram, Download, Check } from 'lucide-react';

type Product = { id: string; name: string; description: string | null; quantity: number; price: number; entry_date: string; image_url: string | null; created_at?: string };
type Notice = { id: string; title: string; body: string; time: string };
type CatalogTerms = { id: number; title: string; content: string; updated_at?: string };

const DEFAULT_TERMS: CatalogTerms = {
  id: 1,
  title: 'Términos y condiciones',
  content: [
    '1. Disponibilidad de productos\nLa disponibilidad que aparece en el catálogo refleja la información recibida del inventario y puede cambiar. Confirma la existencia del producto antes de realizar el pago.',
    '2. Precios\nLos precios se muestran en dólares estadounidenses (USD), salvo que se indique lo contrario. El precio final debe confirmarse al momento de gestionar el pedido.',
    '3. Pedidos y confirmación\nEnviar una consulta o mensaje no reserva automáticamente un producto. Babi&Glow confirmará contigo la disponibilidad y los detalles del pedido.',
    '4. Descripción e imágenes\nLas imágenes y descripciones sirven como referencia. Puede haber pequeñas variaciones de presentación o empaque respecto a las fotografías.',
    '5. Actualizaciones\nEl catálogo, los precios, la disponibilidad y estas condiciones pueden actualizarse. La versión publicada en esta página es la que se encuentra vigente.'
  ].join('\n\n')
};

const money = (v: number) => new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(Number(v || 0));

/**
 * Android mobile browsers only reliably display persistent notifications created
 * through ServiceWorkerRegistration.showNotification(). Keep the in-page toast
 * as a separate fallback so an API/permission issue never hides the product alert.
 */
async function showSystemNotification(title: string, options: NotificationOptions = {}) {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration.active) {
        await registration.showNotification(title, options);
        return;
      }
    }

    // The Notification constructor throws in most mobile browsers (including Android).
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isMobile) new Notification(title, options);
  } catch (error) {
    // The in-page toast remains available even if browser/system notifications fail.
    console.warn('No se pudo mostrar la notificación del sistema:', error);
  }
}
export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'price-asc' | 'price-desc' | 'stock-desc' | 'stock-asc'>('recent');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notices, setNotices] = useState<Notice[]>([]);
  const [toastNotice, setToastNotice] = useState<Notice | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [showNotices, setShowNotices] = useState(false);
  const [showPwaPrompt, setShowPwaPrompt] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [connected, setConnected] = useState(false);
  const [terms, setTerms] = useState<CatalogTerms>(DEFAULT_TERMS);
  const [termsConnected, setTermsConnected] = useState(false);

  const loadTerms = useCallback(async () => {
    if (!supabase) return;
    const { data, error: termsError } = await supabase
      .from('catalog_terms')
      .select('id,title,content,updated_at')
      .eq('id', 1)
      .maybeSingle();

    if (termsError) {
      // El catálogo sigue funcionando con condiciones predeterminadas hasta que
      // se ejecute supabase/terms-and-conditions.sql en el proyecto Supabase.
      console.warn('No se pudieron cargar los términos desde Supabase:', termsError.message);
      return;
    }
    if (data) setTerms(data as CatalogTerms);
  }, []);

  const loadProducts = useCallback(async () => {
    if (!supabase) { setError('Faltan las variables de Supabase. Configura la URL y la clave publicable en Vercel.'); setLoading(false); return; }
    const { data, error: e } = await supabase.from('products').select('id,name,description,quantity,price,entry_date,image_url,created_at').order('created_at', { ascending: false });
    if (e) setError(`No se pudieron cargar los productos: ${e.message}`);
    else { setProducts((data || []) as Product[]); setError(''); }
    setLoading(false);
  }, []);

  const addNotice = useCallback((product: Product) => {
    const notice: Notice = {
      id: product.id + '-' + Date.now(),
      title: '¡Nuevo producto!',
      body: `${product.name} ya está en el catálogo.`,
      time: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
    };
    setNotices(prev => [notice, ...prev].slice(0, 20));

    // Mostrar un popup dentro de la página en todas las plataformas, Android incluido.
    setToastNotice(notice);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastNotice(current => current?.id === notice.id ? null : current);
      toastTimerRef.current = null;
    }, 8000);

    // Notificación del sistema opcional: requiere permiso y un service worker activo.
    void showSystemNotification('Babi&Glow · Nuevo producto', {
      body: notice.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: product.id,
      data: { url: '/' },
    });
  }, []);

  useEffect(() => {
    const handleInstallAvailable = (event: Event) => {
      // Guardar el evento para abrir el diálogo nativo solo después de que el
      // usuario pulse el botón de instalación en la cabecera.
      event.preventDefault();
      setDeferredInstallPrompt(event as Event & { prompt?: () => Promise<void>; userChoice?: Promise<{ outcome: string }> });
    };
    const handleInstalled = () => setDeferredInstallPrompt(null);

    if (typeof window !== 'undefined') {
      if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined);
      setPermission('Notification' in window ? Notification.permission : 'unsupported');
      window.addEventListener('beforeinstallprompt', handleInstallAvailable);
      window.addEventListener('appinstalled', handleInstalled);
    }

    void loadProducts();
    void loadTerms();
    if (!supabase) return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeinstallprompt', handleInstallAvailable);
        window.removeEventListener('appinstalled', handleInstalled);
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

    // Canal separado: los cambios en las condiciones se reflejan sin recargar
    // la página y no afectan el canal de actualización de productos.
    const termsChannel = supabase.channel('catalog-terms-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catalog_terms', filter: 'id=eq.1' }, payload => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          setTerms(payload.new as CatalogTerms);
        } else if (payload.eventType === 'DELETE') {
          setTerms(DEFAULT_TERMS);
        }
      })
      .subscribe(status => setTermsConnected(status === 'SUBSCRIBED'));

    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeinstallprompt', handleInstallAvailable);
        window.removeEventListener('appinstalled', handleInstalled);
      }
      void supabase?.removeChannel(channel);
      void supabase?.removeChannel(termsChannel);
    };
  }, [loadProducts, loadTerms, addNotice]);

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
  const enableNotifications = async () => {
    if (!('Notification' in window)) { setPermission('unsupported'); return; }
    if (Notification.permission === 'denied') {
      setPermission('denied');
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        void showSystemNotification('Babi & Glow', {
          body: '¡Listo! Las notificaciones están activadas.',
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          tag: 'babiglow-notifications-enabled',
          data: { url: '/' },
        });
      }
    } catch {
      setPermission('unsupported');
    }
  };
  const closePwaPrompt = () => {
    setShowPwaPrompt(false);
    setShowInstallHelp(false);
  };
  const installPwa = async () => {
    if (!deferredInstallPrompt) {
      // Muchos navegadores no permiten abrir el diálogo de instalación sin un evento
      // propio; mostrar pasos manuales es el comportamiento compatible.
      setShowInstallHelp(true);
      return;
    }
    try {
      await deferredInstallPrompt.prompt?.();
      const choice = await deferredInstallPrompt.userChoice;
      setDeferredInstallPrompt(null);
      if (choice?.outcome === 'accepted') {
        setShowPwaPrompt(false);
        setShowInstallHelp(false);
      } else {
        setShowInstallHelp(true);
      }
    } catch { setShowInstallHelp(true); }
  };
  const dismissToast = () => {
    setToastNotice(null);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  };
  const dismissNotice = (id: string) => setNotices(prev => prev.filter(n => n.id !== id));
  const purchaseWhatsAppUrl = (productName: string) => {
    const message = `¡Hola! Vi ${productName} en el catálogo de Babi&Glow y me gustaría adquirirlo. ¿Me podrían confirmar los detalles del pago y del retiro? ¡Gracias! 🌸`;
    return `https://wa.me/584248316536?text=${encodeURIComponent(message)}`;
  };

  return <main className="page-shell">
    {toastNotice && <div className="product-toast" role="status" aria-live="polite"><span className="product-toast-icon"><BellRing size={19}/></span><div className="product-toast-copy"><strong>{toastNotice.title}</strong><p>{toastNotice.body}</p><small>Novedad del catálogo · {toastNotice.time}</small></div><button className="product-toast-close" onClick={dismissToast} aria-label="Cerrar aviso"><X size={17}/></button></div>}
    {showPwaPrompt && <div className="notification-modal-backdrop" role="presentation" onClick={closePwaPrompt}><section className="notification-modal install-app-modal" role="dialog" aria-modal="true" aria-labelledby="pwa-modal-title" onClick={event => event.stopPropagation()}><button className="notification-modal-close" onClick={closePwaPrompt} aria-label="Cerrar ventana"><X size={18}/></button><div className="install-app-logo"><img src="/icons/icon-192.png" alt="Logo de la aplicación Babi&Glow"/></div><span className="eyebrow">APLICACIÓN WEB PROGRESIVA · PWA</span><h2 id="pwa-modal-title">Instalar Aplicación</h2><p>Instala Babi&Glow en tu dispositivo y abre nuestro catálogo desde un icono en tu pantalla de inicio.</p><ul className="install-benefits"><li><span><Check size={15}/></span><div><strong>Acceso directo</strong><small>Abre el catálogo sin tener que buscar el enlace.</small></div></li><li><span><Check size={15}/></span><div><strong>Experiencia como una app</strong><small>Entra desde tu pantalla de inicio, como cualquier aplicación.</small></div></li><li><span><Check size={15}/></span><div><strong>Productos y stock actualizados</strong><small>Consulta las novedades mientras tengas conexión a internet.</small></div></li></ul><button className="notification-modal-activate" onClick={() => void installPwa()}><Download size={17}/> {deferredInstallPrompt ? 'Instalar aplicación' : 'Ver cómo instalarla'}</button>{showInstallHelp && <p className="notification-modal-help">{/iphone|ipad|ipod/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '') ? 'En Safari, pulsa Compartir y luego “Añadir a pantalla de inicio”.' : /android/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '') ? 'En Chrome para Android, abre el menú ⋮ y busca “Instalar aplicación” o “Añadir a pantalla de inicio”. Si no aparece, abre el catálogo en Chrome actualizado y comprueba que estés usando la dirección HTTPS.' : 'En el menú del navegador, busca “Instalar aplicación” o “Añadir a pantalla de inicio”. La opción depende del navegador que estés usando.'}</p>}<button className="notification-modal-later" onClick={closePwaPrompt}>Seguir navegando</button><small>Gratis · Instálala cuando quieras</small></section></div>}
    <div className="announcement"><Sparkles size={14}/> Belleza que te inspira, novedades que te encantan</div>
    <header className="topbar">
      <a className="brand" href="#inicio" aria-label="Babi and Glow inicio"><img className="brand-logo" src="/logo-babi-glow.jpg" alt="Logo Babi&Glow"/><span className="brand-copy"><strong>BABI&GLOW</strong><small>Tu arte, tu estilo, tu esencia</small></span></a>
      <div className="top-actions"><span className={`live-pill ${connected ? 'online' : ''}`}><span className="live-dot"/>{connected ? 'Stock en vivo' : 'Conectando...'}</span><button type="button" className="app-install-button" onClick={() => { setShowNotices(false); setShowInstallHelp(false); setShowPwaPrompt(true); }} aria-label="Abrir ventana Instalar Aplicación" aria-haspopup="dialog" aria-expanded={showPwaPrompt} title="Instalar Aplicación"><img src="/logo-babi-glow.jpg" alt=""/><span className="app-install-download" aria-hidden="true"><Download size={12} strokeWidth={2.8}/></span></button><button className="bell-button" onClick={() => setShowNotices(v => !v)} aria-label="Ver notificaciones"><Bell size={19}/>{notices.length > 0 && <span className="notification-count">{notices.length}</span>}</button></div>
    </header>

    {showNotices && <section className="notice-panel"><div className="notice-head"><div><strong>Notificaciones</strong><small>Novedades del catálogo</small></div><button className="plain-icon" onClick={() => setShowNotices(false)} aria-label="Cerrar"><X size={18}/></button></div>{notices.length ? notices.map(n => <article className="notice-item" key={n.id}><span className="notice-icon"><BellRing size={17}/></span><div><strong>{n.title}</strong><p>{n.body}</p><small>{n.time}</small></div><button className="plain-icon" onClick={() => dismissNotice(n.id)} aria-label="Descartar"><X size={15}/></button></article>) : <p className="notice-empty">Todavía no hay novedades. Te avisaremos cuando se agreguen productos.</p>}{permission !== 'granted' && <button className="enable-notices" onClick={enableNotifications}><Bell size={16}/> Activar notificaciones del navegador</button>}{permission === 'denied' && <small className="permission-help">Las notificaciones están bloqueadas en tu navegador. Puedes habilitarlas desde los permisos del sitio.</small>}</section>}

    <section className="hero" id="inicio">
      <div className="hero-art" aria-label="Logo Babi&Glow">
        <div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/>
        <div className="hero-glow"><img src="/logo-babi-glow.jpg" alt="Logo Babi&Glow"/></div>
        <div className="floating-tag tag-top">Tu ritual diario ✦</div>
        <div className="floating-tag tag-bottom">Tu arte, tu estilo, tu esencia</div>
      </div>
      <div className="hero-content">
        <span className="eyebrow"><span/> EL UNIVERSO BABI & GLOW</span>
        <h1>Tu próximo favorito<br/>está <em>por descubrir.</em></h1>
        <p>Explora nuestra selección de belleza y cuidado personal. Mira precios, detalles y disponibilidad actualizados desde nuestro inventario.</p>
      </div>
      <div className="hero-caption">BELLEZA EN CADA DETALLE <span>✦</span></div>
    </section>

    <section className="catalog-section" id="catalogo"><div className="section-heading"><div><span className="eyebrow">NUESTRA SELECCIÓN</span><h2>Encuentra tu <em>glow.</em></h2><p>Productos seleccionados para realzar tu esencia.</p></div><div className="catalog-meta"><span className="stock-indicator"><span className="live-dot"/> Actualización en tiempo real</span><strong>{products.length} <small>{products.length === 1 ? 'producto' : 'productos'}</small></strong></div></div>
      <div className="catalog-tools"><label className="search-box"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nombre o característica..."/><kbd>⌕</kbd></label><label className="sort-box"><span>Ordenar:</span><select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} aria-label="Filtrar productos"><option value="recent">Más recientes</option><option value="name">Nombre (A-Z)</option><option value="price-asc">Precio: menor a mayor</option><option value="price-desc">Precio: mayor a menor</option><option value="stock-desc">Stock: mayor a menor</option><option value="stock-asc">Stock: menor a mayor</option></select></label><button className="refresh-button" onClick={() => { setLoading(true); void loadProducts(); }}><RefreshCw size={16}/> Actualizar</button></div>
      {error && <div className="error-banner">{error}</div>}
      {loading ? <div className="loading-grid">{[1,2,3,4].map(n => <div className="skeleton-card" key={n}><div/><span/><span/></div>)}</div> : filtered.length === 0 ? <div className="empty-state"><div className="empty-symbol"><PackageOpen size={27}/></div><h3>{query ? 'No encontramos coincidencias' : 'Pronto habrá algo especial'}</h3><p>{query ? 'Prueba con otro nombre o característica.' : 'Los nuevos productos aparecerán aquí automáticamente cuando se agreguen al inventario.'}</p>{query && <button className="text-button" onClick={() => setQuery('')}>Limpiar búsqueda</button>}</div> : <div className="product-grid">{filtered.map(p => <article className="product-card" key={p.id}><div className="product-image">{p.image_url ? <img src={p.image_url} alt={p.name} loading="lazy"/> : <div className="image-placeholder"><span>B<span>&</span>G</span><small>ESENCIALES DE BELLEZA</small></div>}{p.created_at && Date.now() - new Date(p.created_at).getTime() < 7 * 86400000 && <span className="new-badge">NUEVO ✦</span>}{p.quantity <= 0 && <span className="sold-badge">AGOTADO</span>}</div><div className="product-info"><span className="product-category">BABI & GLOW · BELLEZA</span><h3>{p.name}</h3><p className="product-description">{p.description || 'Un esencial para tu rutina de belleza.'}</p><div className="product-bottom"><div><strong className="price">{money(p.price)}</strong><small className={p.quantity > 0 ? 'available' : 'unavailable'}>{p.quantity > 0 ? `${p.quantity} disponibles` : 'Sin existencias'}</small></div><span className="product-sparkle"><Sparkles size={17}/></span></div><a className="buy-button" href={purchaseWhatsAppUrl(p.name)} target="_blank" rel="noopener noreferrer" aria-label={`Consultar compra de ${p.name} por WhatsApp`}><MessageCircle size={16}/> Comprar por WhatsApp</a></div></article>)}</div>}
      <div className="catalog-footnote"><Radio size={15}/><span>El catálogo se sincroniza automáticamente con el inventario principal.</span></div>
    </section>
    {permission !== 'granted' && <section className="notify-strip"><div className="notify-icon"><BellRing size={22}/></div><div><span className="eyebrow">NOVEDADES DE BABI & GLOW</span><h2>Las novedades, primero.</h2><p>Activa las notificaciones para enterarte cuando lleguen nuevos productos.</p></div><button onClick={enableNotifications}>Avisarme de novedades <span>↗</span></button></section>}
    <section className="contact-strip" id="contacto"><div className="contact-copy"><span className="eyebrow">¿TIENES ALGUNA DUDA?</span><h2>Estamos aquí para ayudarte.</h2><p>Consulta por WhatsApp o síguenos en Instagram para conocer más sobre nuestros productos.</p></div><div className="contact-actions"><a className="contact-button whatsapp-button" href="https://wa.me/584248316536" target="_blank" rel="noopener noreferrer"><MessageCircle size={19}/> Contactar por WhatsApp</a><a className="contact-button instagram-button" href="https://www.instagram.com/babiglow2026?exln=MTlvNmt4bDUwajV6cA==" target="_blank" rel="noopener noreferrer"><Instagram size={19}/> Instagram @babiglow2026</a></div></section>
    <section className="terms-section" id="terminos-y-condiciones" aria-labelledby="terms-title">
      <div className="terms-heading">
        <div><span className="eyebrow">INFORMACIÓN DE LA TIENDA</span><h2 id="terms-title">{terms.title || 'Términos y condiciones'}</h2></div>
        <span className={`terms-sync-status ${termsConnected ? 'is-live' : ''}`}><span className="live-dot"/>{termsConnected ? 'Sincronizado en tiempo real' : 'Condiciones de Babi&Glow'}</span>
      </div>
      <div className="terms-body">
        {(terms.content || DEFAULT_TERMS.content).split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      </div>
      <p className="terms-sync-note">Esta información se administra en Supabase y se actualizará aquí automáticamente cuando se modifique desde el sistema de inventario.</p>
    </section>
    <footer className="footer"><a className="brand footer-brand" href="#inicio"><img className="brand-logo" src="/logo-babi-glow.jpg" alt="Logo Babi&Glow"/><span className="brand-copy"><strong>BABI&GLOW</strong><small>Tu arte, tu estilo, tu esencia</small></span></a><p>Hecho para brillar, todos los días.</p><span>© {new Date().getFullYear()} Babi&Glow</span></footer>
  </main>;
}
