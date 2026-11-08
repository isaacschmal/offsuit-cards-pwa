export type SupportedLanguage = 'en' | 'es' | 'it';

export interface LanguageOption {
  code: SupportedLanguage;
  label: string;
  flag: string;
  shortLabel: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', flag: '🇺🇸', shortLabel: 'EN' },
  { code: 'es', label: 'Español', flag: '🇲🇽', shortLabel: 'ES' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹', shortLabel: 'IT' },
];

export function detectDeviceLanguage(): SupportedLanguage {
  if (typeof window === 'undefined' || !window.navigator) return 'en';
  const navLang = (
    window.navigator.language ||
    (window.navigator as unknown as { userLanguage?: string }).userLanguage ||
    ''
  ).toLowerCase();
  if (navLang.startsWith('es')) return 'es';
  if (navLang.startsWith('it')) return 'it';
  return 'en';
}

export interface CardGameCatalogItem {
  id: string;
  name: string;
  category: string;
  tag: string;
  tagColor: string;
  players: string;
  description: string;
  iconEmoji: string;
  accentGradient: string;
  status: 'active' | 'upcoming';
  rules: string[];
}

export const TRANSLATIONS = {
  en: {
    // Nav & Common
    home: 'Home',
    profile: 'Profile',
    close: 'Close',
    cancel: 'Cancel',
    save: 'Save',
    copied: 'Copied!',
    loading: 'Loading...',
    level: 'LVL',
    totalBalance: 'Total Balance',
    claimBonus: '+1,000 Reload',
    bonusClaimed: 'Reloaded!',
    onlineCount: '{count} online',
    playerFallback: 'Player',

    // Active Tables Section
    activeTablesTitle: 'Active Tables',
    yourTurn: 'Your turn',
    waitingOnPlayer: 'Turn of {name}',
    inProgress: 'In progress',
    rejoinTable: 'Return to table',
    cashOutChips: 'Cash out',
    cashOutSuccess: 'Withdrew {amount} chips to bankroll',

    // Connected Tables / Rooms Directory
    connectedTablesTitle: 'Connected Tables',
    roomsBtn: 'Rooms',
    joinBtn: 'Join',
    createTableBtn: 'Create Table',
    noOpenRoomsTitle: 'No open tables right now',
    noOpenRoomsDesc: 'Create a room and share the code with friends',

    // Card Games Catalog
    gameCatalogTitle: 'Game Catalog',
    gameCatalogSub: "Texas Hold'em, UNO and upcoming modes",
    gamesCountBadge: '{count} games',
    tagAvailable: 'Available',
    tagUpcoming: 'Coming Soon',
    rulesAndDetails: 'Rules & details',
    playPoker: 'Play Poker',
    voteMode: 'Vote mode',
    votedMode: 'Voted!',
    rulesTitle: '📜 Rules & Mechanics',
    votePrompt: '👍 Vote to prioritize this game',
    votedPrompt: '✓ You voted for this game!',
    liveAndAsyncAvailable: 'Live & turn-based multiplayer',

    // Create / Join Modal
    modalTitle: 'Tables & Multiplayer',
    pacingLabel: 'Game Pacing',
    pacingLive: 'Live (20s timer)',
    pacingAsync: 'Turn-based (Async)',
    modeLabel: 'Game Mode',
    modeReal: 'Real Friends',
    modeBots: 'Practice with Bots',
    buyInLabel: 'Table Buy-in (Chips)',
    roomNamePlaceholder: 'Table Name (e.g. Friends Poker)',
    createBtn: 'Create',
    orJoinWithCode: 'Or join with code (e.g. TABLE1)',
    goBtn: 'Go',

    // Safari PWA Banner
    safariBannerTitle: 'Play as an App on iPhone',
    safariBannerDesc: "Tap Share ⎋ and 'Add to Home Screen' to keep your account, chips and cards synced.",
    safariBannerDismiss: 'Dismiss',

    // First Time Welcome Modal
    welcomeTitle: 'Choose your Player Name',
    welcomeSub: 'Pick an avatar and a nickname so friends recognize you at the table.',
    welcomeInputPlaceholder: 'Your name or nickname',
    welcomeContinue: 'Enter Game',
    welcomeOrLink: 'Already have an account? Link it here',
    welcomeLinkPrompt: 'Paste your Sync Token or Player ID',
    welcomeLinkBtn: 'Link Account',

    // Poker Table HUD & Actions
    check: 'Check',
    call: 'Call',
    raise: 'Raise',
    fold: 'Fold',
    min: 'Min',
    pot: 'Pot',
    allIn: 'All-in',
    currentTurnWaiting: 'Waiting for {name}...',
    tableRoomInvite: '👥 Table #{id} ({count}/6)',
    tableInviteCopied: '¡Link #{id} copied!',
    practiceBotsBadge: '🤖 Practice vs Bots · Hand {hand}/100',
    allBotsEliminated: '🏆 All bots eliminated!',
    maxHandsReached: '🏁 100 hands limit reached',
    cashOutToMenu: 'Cash out {stack} chips to menu →',
    rebuyBuyIn: 'Rebuy table buy-in (+{amount})',
    exitTable: 'Exit',
    raiseModalTitle: 'Raise Bet',
    confirmRaise: 'Confirm Raise ({amount})',
    swipeHudHint: 'Swipe to switch between player card and odds',
    winOddsTitle: 'Win Probability',
    currentHandTitle: 'Current Hand',
    outsCount: '{count} outs to improve',

    // Leave Table Confirmation Modal
    leaveHandTitle: 'Leave Hand?',
    leaveHandDesc: 'You have active chips in the pot. Leaving now will forfeit them to the table.',
    leaveConfirmBtn: 'Leave Table',
    stayBtn: 'Stay',

    // Hand Evaluation Names
    hand_RoyalFlush: 'Royal Flush',
    hand_StraightFlush: 'Straight Flush',
    hand_FourOfAKind: 'Four of a Kind',
    hand_FullHouse: 'Full House',
    hand_Flush: 'Flush',
    hand_Straight: 'Straight',
    hand_ThreeOfAKind: 'Three of a Kind',
    hand_TwoPair: 'Two Pair',
    hand_Pair: 'Pair',
    hand_HighCard: 'High Card',
    hand_WinningHand: 'Winning Hand',

    // Profile & Settings
    profileTitle: 'Profile & Identity',
    settingsTitle: 'Settings',
    languageLabel: 'Language',
    playerIdLabel: 'Your ID',
    nameEditTitle: 'Edit Name & Avatar',
    saveProfile: 'Save Changes',
    cardBackTitle: 'Card Back Theme',
    cardBackDesc: 'Custom deck style for your table.',
    statsTitle: 'Playing Statistics',
    handsPlayed: 'Hands Played',
    handsWon: 'Hands Won',
    winRate: 'Win Rate',
    playstyleLabel: 'Playstyle',
    playstyleRadar: 'Style Radar',
    multiDeviceSync: 'Multi-Device Sync',
    syncDesc: 'Copy your token to seamlessly sync chips and rank to another device or browser.',
    copyTokenBtn: 'Copy Sync Token',
    linkAccountBtn: 'Link / Restore Account',
    friendsEncountered: 'Friends Encountered ({count})',
    noFriendsYet: 'No friends encountered yet. Join a table with others!',
    networkStatus: 'Multiplayer Engine',
    turnNotifications: 'Turn Notifications',
    notifEnabled: 'Enabled',
    notifEnableNow: 'Enable now',
    resetStatsBtn: 'Reset statistics to zero',
  },
  es: {
    // Nav & Common
    home: 'Inicio',
    profile: 'Perfil',
    close: 'Cerrar',
    cancel: 'Cancelar',
    save: 'Guardar',
    copied: '¡Copiado!',
    loading: 'Cargando...',
    level: 'NIVEL',
    totalBalance: 'Saldo Total',
    claimBonus: '+1,000 Recarga',
    bonusClaimed: '¡Recargado!',
    onlineCount: '{count} en línea',
    playerFallback: 'Jugador',

    // Active Tables Section
    activeTablesTitle: 'Tus Mesas Activas',
    yourTurn: 'Es tu turno',
    waitingOnPlayer: 'Turno de {name}',
    inProgress: 'En juego',
    rejoinTable: 'Volver a la mesa',
    cashOutChips: 'Retirar fichas',
    cashOutSuccess: 'Retiraste {amount} fichas a tu saldo',

    // Connected Tables / Rooms Directory
    connectedTablesTitle: 'Mesas Conectadas',
    roomsBtn: 'Salas',
    joinBtn: 'Unirse',
    createTableBtn: 'Crear Sala',
    noOpenRoomsTitle: 'No hay salas abiertas en este momento',
    noOpenRoomsDesc: 'Crea una sala y comparte el código con tus amigos',

    // Card Games Catalog
    gameCatalogTitle: 'Catálogo de Juegos',
    gameCatalogSub: "Texas Hold'em, UNO y próximas modalidades",
    gamesCountBadge: '{count} juegos',
    tagAvailable: 'Disponible',
    tagUpcoming: 'Próximamente',
    rulesAndDetails: 'Reglas & detalles',
    playPoker: 'Jugar Póker',
    voteMode: 'Votar modo',
    votedMode: '¡Votado!',
    rulesTitle: '📜 Reglas y Dinámica',
    votePrompt: '👍 Votar para que salga primero',
    votedPrompt: '✓ ¡Votaste por este juego!',
    liveAndAsyncAvailable: 'Multiplayer en vivo y por turnos',

    // Create / Join Modal
    modalTitle: 'Salas y Multijugador',
    pacingLabel: 'Ritmo de la Partida',
    pacingLive: 'En vivo (20s reloj)',
    pacingAsync: 'Por turnos (Async)',
    modeLabel: 'Modo de Juego',
    modeReal: 'Amigos reales',
    modeBots: 'Practicar con bots',
    buyInLabel: 'Entrada a la mesa (Fichas)',
    roomNamePlaceholder: 'Nombre (ej. Mesa de Amigos)',
    createBtn: 'Crear',
    orJoinWithCode: 'O únete con código (ej. MESA1)',
    goBtn: 'Ir',

    // Safari PWA Banner
    safariBannerTitle: 'Juega como App en tu iPhone',
    safariBannerDesc: "Toca Compartir ⎋ y 'Agregar al Inicio' para guardar tus fichas y cuenta sin perderlas.",
    safariBannerDismiss: 'Entendido',

    // First Time Welcome Modal
    welcomeTitle: 'Elige tu Nombre de Jugador',
    welcomeSub: 'Escoge un avatar y tu apodo para que tus amigos te reconozcan en la mesa.',
    welcomeInputPlaceholder: 'Tu nombre o apodo',
    welcomeContinue: 'Entrar al Juego',
    welcomeOrLink: '¿Ya tienes cuenta? Vincúlala aquí',
    welcomeLinkPrompt: 'Pega tu Token de Sincronización o ID',
    welcomeLinkBtn: 'Vincular Cuenta',

    // Poker Table HUD & Actions
    check: 'Check',
    call: 'Call',
    raise: 'Raise',
    fold: 'Fold',
    min: 'Mín',
    pot: 'Bote',
    allIn: 'All-in',
    currentTurnWaiting: 'Esperando turno de {name}...',
    tableRoomInvite: '👥 Sala #{id} ({count}/6)',
    tableInviteCopied: '¡Link #{id} copiado!',
    practiceBotsBadge: '🤖 Práctica vs Bots · Mano {hand}/100',
    allBotsEliminated: '🏆 ¡Todos los bots eliminados!',
    maxHandsReached: '🏁 Límite de 100 manos alcanzado',
    cashOutToMenu: 'Retirar {stack} fichas al menú →',
    rebuyBuyIn: 'Recomprar entrada (+{amount})',
    exitTable: 'Salir',
    raiseModalTitle: 'Aumentar apuesta',
    confirmRaise: 'Confirmar Raise ({amount})',
    swipeHudHint: 'Desliza para cambiar entre ficha de jugador y probabilidades',
    winOddsTitle: 'Probabilidad Victoria',
    currentHandTitle: 'Mano Actual',
    outsCount: '{count} cartas de mejora (outs)',

    // Leave Table Confirmation Modal
    leaveHandTitle: '¿Abandonar mano?',
    leaveHandDesc: 'Tienes fichas activas en el bote. Si sales ahora, se perderán a favor de la mesa.',
    leaveConfirmBtn: 'Retirarse',
    stayBtn: 'Quedarse',

    // Hand Evaluation Names
    hand_RoyalFlush: 'Escalera Real',
    hand_StraightFlush: 'Escalera de Color',
    hand_FourOfAKind: 'Póker (Cuarteto)',
    hand_FullHouse: 'Full House',
    hand_Flush: 'Color',
    hand_Straight: 'Escalera',
    hand_ThreeOfAKind: 'Trío',
    hand_TwoPair: 'Doble Pareja',
    hand_Pair: 'Pareja',
    hand_HighCard: 'Carta Alta',
    hand_WinningHand: 'Mano Ganadora',

    // Profile & Settings
    profileTitle: 'Perfil & Identidad',
    settingsTitle: 'Ajustes',
    languageLabel: 'Idioma',
    playerIdLabel: 'Tu ID',
    nameEditTitle: 'Editar Nombre y Avatar',
    saveProfile: 'Guardar Cambios',
    cardBackTitle: 'Reverso de Cartas',
    cardBackDesc: 'Estilo visual de baraja para tus mesas.',
    statsTitle: 'Estadísticas de Juego',
    handsPlayed: 'Manos Jugadas',
    handsWon: 'Manos Ganadas',
    winRate: 'Efectividad',
    playstyleLabel: 'Estilo de Juego',
    playstyleRadar: 'Radar de Estilo',
    multiDeviceSync: 'Sincronizar Dispositivos',
    syncDesc: 'Copia tu token para transferir tus fichas y nivel a otro teléfono o navegador.',
    copyTokenBtn: 'Copiar Token',
    linkAccountBtn: 'Vincular / Restaurar',
    friendsEncountered: 'Amigos Conocidos ({count})',
    noFriendsYet: 'Aún no has jugado con amigos. ¡Únete a una sala!',
    networkStatus: 'Motor Multijugador',
    turnNotifications: 'Notificaciones de Turno',
    notifEnabled: 'Activadas',
    notifEnableNow: 'Activar ahora',
    resetStatsBtn: 'Reiniciar estadísticas a cero',
  },
  it: {
    // Nav & Common
    home: 'Home',
    profile: 'Profilo',
    close: 'Chiudi',
    cancel: 'Annulla',
    save: 'Salva',
    copied: 'Copiato!',
    loading: 'Caricamento...',
    level: 'LIV',
    totalBalance: 'Saldo Totale',
    claimBonus: '+1.000 Ricarica',
    bonusClaimed: 'Ricaricato!',
    onlineCount: '{count} online',
    playerFallback: 'Giocatore',

    // Active Tables Section
    activeTablesTitle: 'Tavoli Attivi',
    yourTurn: 'Tocca a te',
    waitingOnPlayer: 'Turno di {name}',
    inProgress: 'In corso',
    rejoinTable: 'Rientra al tavolo',
    cashOutChips: 'Incassa chip',
    cashOutSuccess: 'Hai incassato {amount} chip nel tuo saldo',

    // Connected Tables / Rooms Directory
    connectedTablesTitle: 'Tavoli Connessi',
    roomsBtn: 'Stanze',
    joinBtn: 'Unisciti',
    createTableBtn: 'Crea Tavolo',
    noOpenRoomsTitle: 'Nessun tavolo aperto al momento',
    noOpenRoomsDesc: 'Crea una stanza e condividi il codice con i tuoi amici',

    // Card Games Catalog
    gameCatalogTitle: 'Catalogo Giochi',
    gameCatalogSub: "Texas Hold'em, UNO e nuove modalità",
    gamesCountBadge: '{count} giochi',
    tagAvailable: 'Disponibile',
    tagUpcoming: 'Prossimamente',
    rulesAndDetails: 'Regole & dettagli',
    playPoker: 'Gioca a Poker',
    voteMode: 'Vota modalità',
    votedMode: 'Votato!',
    rulesTitle: '📜 Regole e Dinamiche',
    votePrompt: '👍 Vota per farlo uscire prima',
    votedPrompt: '✓ Hai votato questo gioco!',
    liveAndAsyncAvailable: 'Multigiocatore live e a turni',

    // Create / Join Modal
    modalTitle: 'Tavoli e Multigiocatore',
    pacingLabel: 'Ritmo della Partita',
    pacingLive: 'Dal vivo (timer 20s)',
    pacingAsync: 'A turni (Async)',
    modeLabel: 'Modalità di Gioco',
    modeReal: 'Amici reali',
    modeBots: 'Pratica con i Bot',
    buyInLabel: 'Buy-in al tavolo (Chip)',
    roomNamePlaceholder: 'Nome tavolo (es. Tavolo Amici)',
    createBtn: 'Crea',
    orJoinWithCode: 'O unisciti con codice (es. TAVOLO1)',
    goBtn: 'Vai',

    // Safari PWA Banner
    safariBannerTitle: 'Gioca come App su iPhone',
    safariBannerDesc: "Tocca Condividi ⎋ e 'Aggiungi a Home' per non perdere mai il tuo saldo e il tuo account.",
    safariBannerDismiss: 'Ho capito',

    // First Time Welcome Modal
    welcomeTitle: 'Scegli il tuo Nome Giocatore',
    welcomeSub: 'Scegli un avatar e un nickname così i tuoi amici ti riconosceranno al tavolo.',
    welcomeInputPlaceholder: 'Il tuo nome o nickname',
    welcomeContinue: 'Entra nel Gioco',
    welcomeOrLink: 'Hai già un account? Collegalo qui',
    welcomeLinkPrompt: 'Incolla il tuo Token di Sincronizzazione o ID',
    welcomeLinkBtn: 'Collega Account',

    // Poker Table HUD & Actions
    check: 'Check',
    call: 'Call',
    raise: 'Raise',
    fold: 'Passa',
    min: 'Min',
    pot: 'Piatto',
    allIn: 'All-in',
    currentTurnWaiting: 'In attesa del turno di {name}...',
    tableRoomInvite: '👥 Tavolo #{id} ({count}/6)',
    tableInviteCopied: 'Link #{id} copiato!',
    practiceBotsBadge: '🤖 Pratica vs Bot · Mano {hand}/100',
    allBotsEliminated: '🏆 Tutti i bot eliminati!',
    maxHandsReached: '🏁 Limite di 100 mani raggiunto',
    cashOutToMenu: 'Incassa {stack} chip al menu →',
    rebuyBuyIn: 'Ricompera buy-in (+{amount})',
    exitTable: 'Esci',
    raiseModalTitle: 'Rilancio scommessa',
    confirmRaise: 'Conferma Rilancio ({amount})',
    swipeHudHint: 'Scorri per alternare tra scheda giocatore e probabilità',
    winOddsTitle: 'Probabilità Vittoria',
    currentHandTitle: 'Mano Attuale',
    outsCount: '{count} carte utili (outs)',

    // Leave Table Confirmation Modal
    leaveHandTitle: 'Lasciare la mano?',
    leaveHandDesc: 'Hai chip attive nel piatto. Se esci ora le perderai a favore del tavolo.',
    leaveConfirmBtn: 'Esci dal Tavolo',
    stayBtn: 'Rimani',

    // Hand Evaluation Names
    hand_RoyalFlush: 'Scala Reale',
    hand_StraightFlush: 'Scala Colore',
    hand_FourOfAKind: 'Poker (Quaterna)',
    hand_FullHouse: 'Full',
    hand_Flush: 'Colore',
    hand_Straight: 'Scala',
    hand_ThreeOfAKind: 'Tris',
    hand_TwoPair: 'Doppia Coppia',
    hand_Pair: 'Coppia',
    hand_HighCard: 'Carta Alta',
    hand_WinningHand: 'Mano Vincente',

    // Profile & Settings
    profileTitle: 'Profilo & Identità',
    settingsTitle: 'Impostazioni',
    languageLabel: 'Lingua',
    playerIdLabel: 'Il tuo ID',
    nameEditTitle: 'Modifica Nome e Avatar',
    saveProfile: 'Salva Modifiche',
    cardBackTitle: 'Dorso delle Carte',
    cardBackDesc: 'Stile del mazzo per i tuoi tavoli.',
    statsTitle: 'Statistiche di Gioco',
    handsPlayed: 'Mani Giocate',
    handsWon: 'Mani Vinte',
    winRate: 'Percentuale Vittorie',
    playstyleLabel: 'Stile di Gioco',
    playstyleRadar: 'Radar Stile',
    multiDeviceSync: 'Sincronizzazione Dispositivi',
    syncDesc: 'Copia il tuo token per trasferire chip e livello su un altro dispositivo o browser.',
    copyTokenBtn: 'Copia Token',
    linkAccountBtn: 'Collega / Ripristina',
    friendsEncountered: 'Amici Incontrati ({count})',
    noFriendsYet: 'Non hai ancora giocato con amici. Unisciti a un tavolo!',
    networkStatus: 'Motore Multigiocatore',
    turnNotifications: 'Notifiche di Turno',
    notifEnabled: 'Attivate',
    notifEnableNow: 'Attiva ora',
    resetStatsBtn: 'Azzera statistiche a zero',
  },
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS.en;

export function t(
  lang: SupportedLanguage,
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  const dictionary = TRANSLATIONS[lang] ?? TRANSLATIONS.en;
  let text: string = dictionary[key] ?? TRANSLATIONS.en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return text;
}

export function formatHandName(categoryName: string, lang: SupportedLanguage): string {
  const clean = categoryName.trim();
  switch (clean) {
    case 'Royal Flush':
      return t(lang, 'hand_RoyalFlush');
    case 'Straight Flush':
      return t(lang, 'hand_StraightFlush');
    case 'Four of a Kind':
      return t(lang, 'hand_FourOfAKind');
    case 'Full House':
      return t(lang, 'hand_FullHouse');
    case 'Flush':
      return t(lang, 'hand_Flush');
    case 'Straight':
      return t(lang, 'hand_Straight');
    case 'Three of a Kind':
      return t(lang, 'hand_ThreeOfAKind');
    case 'Two Pair':
      return t(lang, 'hand_TwoPair');
    case 'Pair':
      return t(lang, 'hand_Pair');
    case 'High Card':
      return t(lang, 'hand_HighCard');
    case 'Mano Ganadora':
    case 'Winning Hand':
    case 'Mano Vincente':
      return t(lang, 'hand_WinningHand');
    default:
      return clean;
  }
}

export function getLocalizedCardGames(lang: SupportedLanguage): CardGameCatalogItem[] {
  const isEn = lang === 'en';
  const isIt = lang === 'it';

  return [
    {
      id: 'poker',
      name: "Texas Hold'em Poker",
      category: isEn ? 'Cards & Betting' : isIt ? 'Carte & Scommesse' : 'Cartas & Apuestas',
      tag: t(lang, 'tagAvailable'),
      tagColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      players: isEn ? '2-6 Players' : isIt ? '2-6 Giocatori' : '2-6 Jugadores',
      description: isEn
        ? 'No-limit poker. Shared community pots, blinds, and live or turn-based action.'
        : isIt
        ? 'Poker no-limit. Piatti condivisi, bui e partite dal vivo o a turni.'
        : 'Póker sin límite. Botes compartidos, ciegas y partidas en vivo o por turnos.',
      iconEmoji: '♠️',
      accentGradient: 'from-blue-600/20 to-emerald-600/20',
      status: 'active',
      rules: isEn
        ? [
            'Each player is dealt 2 private hole cards.',
            '5 community cards are revealed in stages (Flop, Turn, River).',
            'Make the best 5-card combination to win the pot.',
          ]
        : isIt
        ? [
            'Ogni giocatore riceve 2 carte coperte.',
            'Vengono svelate 5 carte comunitarie (Flop, Turn, River).',
            'Componi la migliore combinazione di 5 carte per vincere il piatto.',
          ]
        : [
            'Cada jugador recibe 2 cartas privadas.',
            'Se revelan 5 cartas comunitarias (Flop, Turn, River).',
            'Forma la mejor combinación de 5 cartas para llevarte el bote.',
          ],
    },
    {
      id: 'uno',
      name: 'UNO Classic',
      category: isEn ? 'Cards & Party' : isIt ? 'Carte & Party' : 'Cartas & Fiesta',
      tag: t(lang, 'tagUpcoming'),
      tagColor: 'bg-[#fb923c]/15 text-[#fb923c] border-[#fb923c]/30',
      players: isEn ? '2-8 Players' : isIt ? '2-8 Giocatori' : '2-8 Jugadores',
      description: isEn
        ? 'Match colors and numbers. Action cards +2, +4, reverse, skip and wild color change.'
        : isIt
        ? 'Abbina colori e numeri. Carte azione +2, +4, cambio giro, salto e jolly.'
        : 'Empareja colores y números. Cartas de acción +2, +4, reversa y cambio de color.',
      iconEmoji: '🃏',
      accentGradient: 'from-red-600/20 via-amber-600/20 to-blue-600/20',
      status: 'upcoming',
      rules: isEn
        ? [
            'Match the top card on the discard pile by color or number.',
            'Play action cards: Draw Two, Skip, Reverse, and Wild Draw Four.',
            "Don't forget to shout UNO when down to your final card!",
          ]
        : isIt
        ? [
            'Scarta abbinando per colore o numero la carta in cima.',
            'Usa carte azione: Pesca 2, Salto, Inverti e Jolly Pesca 4.',
            'Non dimenticare di gridare UNO quando ti resta una sola carta!',
          ]
        : [
            'Empareja la carta en juego por color o por número.',
            'Usa cartas de acción: Roba 2, Salto, Reversa y Comodín +4.',
            '¡No olvides cantar UNO cuando te quede una sola carta!',
          ],
    },
    {
      id: 'blackjack',
      name: isEn ? 'Blackjack (21)' : isIt ? 'Blackjack (Ventuno)' : 'Blackjack (Veintiuno)',
      category: isEn ? 'Casino & Strategy' : isIt ? 'Casinò & Strategia' : 'Casino & Estrategia',
      tag: t(lang, 'tagUpcoming'),
      tagColor: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
      players: isEn ? '1-7 Players' : isIt ? '1-7 Giocatori' : '1-7 Jugadores',
      description: isEn
        ? "Hit or stand. Beat the dealer's hand without exceeding 21."
        : isIt
        ? 'Chiama o stai. Batti la mano del banco senza superare 21.'
        : 'Pide cartas o plántate. Supera la mano de la casa sin pasarte de 21.',
      iconEmoji: '🎲',
      accentGradient: 'from-indigo-600/20 to-purple-600/20',
      status: 'upcoming',
      rules: isEn
        ? [
            'Get a hand value closer to 21 than the dealer without busting.',
            'Face cards count as 10, Aces count as 1 or 11.',
            'Natural Blackjack (Ace + 10-value card) pays 3 to 2.',
          ]
        : isIt
        ? [
            "L'obiettivo è totalizzare 21 o battere il banco senza sballare.",
            "Le figure valgono 10, l'Asso vale 1 oppure 11.",
            'Il Blackjack naturale (Asso + figura/10) paga 3 a 2.',
          ]
        : [
            'El objetivo es sumar 21 o más que el crupier sin pasarte.',
            'Las figuras valen 10 y el As vale 1 u 11.',
            'Blackjack natural (As + 10/Figura) paga 3 a 2.',
          ],
    },
    {
      id: 'viuda',
      name: isEn
        ? 'La Viuda (Mexican Poker)'
        : isIt
        ? 'La Viuda (Poker Messicano)'
        : 'La Viuda (Póker Tapado)',
      category: isEn ? 'Traditional' : isIt ? 'Tradizionale' : 'Tradicional Mexicano',
      tag: t(lang, 'tagUpcoming'),
      tagColor: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
      players: isEn ? '3-6 Players' : isIt ? '3-6 Giocatori' : '3-6 Jugadores',
      description: isEn
        ? 'Classic 5-card showdown with a central hidden widow hand. Swap cards and compete for lives.'
        : isIt
        ? "Classico a 5 carte con una mano centrale 'vedova'. Scambia le carte e gioca per le vite."
        : 'Clásico de 5 cartas con baraja oculta central. Cambia tus cartas y compite por vidas.',
      iconEmoji: '👑',
      accentGradient: 'from-rose-600/20 to-amber-600/20',
      status: 'upcoming',
      rules: isEn
        ? [
            "Each player gets 5 cards, plus 5 extra cards in the center 'widow'.",
            'Choose whether to swap your initial hand with the widow before betting.',
            'Exchange cards one by one to build your strongest showdown hand.',
          ]
        : isIt
        ? [
            "Ogni giocatore riceve 5 carte più una 'vedova' di 5 carte al centro.",
            'Scegli se scambiare la tua mano con la vedova prima delle puntate.',
            'Scambia le carte una alla volta per formare la combinazione più forte.',
          ]
        : [
            'Cada jugador recibe 5 cartas y hay una "viuda" de 5 cartas en el centro.',
            'Elige jugar con tu mano o cambiarla por la viuda antes de que empiece la ronda.',
            'Intercambia cartas una a una para armar tu mejor jugada.',
          ],
    },
    {
      id: 'conquian',
      name: isEn ? 'Conquián / Rummy' : isIt ? 'Conquián / Ramino' : 'Conquián / Rummy',
      category: isEn ? 'Spanish Deck' : isIt ? 'Mazzo Spagnolo' : 'Mazo Español',
      tag: t(lang, 'tagUpcoming'),
      tagColor: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
      players: isEn ? '2-4 Players' : isIt ? '2-4 Giocatori' : '2-4 Jugadores',
      description: isEn
        ? 'The forefather of rummy. Form sets and sequences of 3 or more to empty your hand.'
        : isIt
        ? 'Il padre del ramino tradizionale. Crea tris e scale per calare tutte le carte.'
        : 'El juego tradicional de combinaciones. Forma tercias y corridas para vaciar tu mano.',
      iconEmoji: '🎴',
      accentGradient: 'from-cyan-600/20 to-teal-600/20',
      status: 'upcoming',
      rules: isEn
        ? [
            'Played with a traditional 40-card deck.',
            'Meld matching groups (three of a kind or straight sequences).',
            'The first player to lay down 9 cards wins the round.',
          ]
        : isIt
        ? [
            'Si gioca con mazzo tradizionale da 40 carte.',
            'Crea combinazioni valide (tris o scale dello stesso seme).',
            'Il primo giocatore a calare 9 carte vince la partita.',
          ]
        : [
            'Se juega con baraja de 40 cartas.',
            'Forma grupos de tres o más cartas (tercias o corridas).',
            'El primero en bajar 9 cartas gana la partida.',
          ],
    },
  ];
}
