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
    appTitle: 'Card Games',
    chipsUnit: 'chips',
    walletLabel: 'Wallet',
    inTablesLabel: 'In tables',
    totalBalance: 'Total Balance',
    claimBonus: '+1,000 Reload',
    bonusClaimed: 'Reloaded!',
    onlineCount: '{count} online',
    playerFallback: 'Player',

    // Active Tables Section
    activeTablesTitle: 'Active Tables',
    activeHandSub: 'Active hand · Leave or rejoin anytime',
    yourTurn: 'Your turn',
    waitingOnPlayer: 'Turn of {name}',
    inProgress: 'In progress',
    rejoinTable: 'Return to table',
    cashOutChips: 'Cash out',
    cashOutSuccess: 'Withdrew {amount} chips to bankroll',
    pacingTurnsShort: '⏳ Turns',
    pacingLiveShort: '⚡ Live',
    tableLabel: 'Table',

    // Connected Tables / Rooms Directory
    connectedTablesTitle: 'Connected Tables',
    roomsBtn: 'Rooms',
    joinBtn: 'Join',
    createTableBtn: 'Create Table',
    noOpenRoomsTitle: 'No open tables right now',
    noOpenRoomsDesc: 'Create a room and share the code with friends',
    quickCodePlaceholder: 'Enter table code (e.g. TABLE1)...',
    bankruptTitle: 'Bankrupt (0 chips)',
    bankruptDesc: 'Claim your recovery bonus (+200) to return to the tables',
    insufficientWalletTitle: 'No chips in wallet (0 available)',
    insufficientWalletDesc: 'Cash out an active table above or claim recovery bonus when at 0 total.',
    liveTablesTitle: 'Live Tables',
    liveTablesDesc: 'Play with real friends connected online (no bots)',
    liveTablesBadge: 'Real Friends · Live',
    turnBasedTitle: 'Turn-Based',
    turnBasedDesc: 'Take your time with friends, get notified on your turn',
    turnBasedBadge: 'Real Friends · Async',
    practiceBotsTitle: 'Practice vs Bots',
    practiceBotsDesc: 'Train your strategies instantly against 5 AI bots',
    practiceBotsBadgeShort: '5 AI Bots',
    buyInShort: 'Buy-in',
    playersLabel: 'players',
    blindsLabel: 'Blinds',
    botsRuleNote: 'In bot practice, max buy-in is 100 and session lasts max 100 hands.',
    roomsModalTitle: 'Open Tables & Create Room',
    roomsModalSub: 'Live rooms expire after 2h idle (7d for turn-based)',
    emptyRoomsModalDesc: 'No open rooms right now · Create one below and share the code with friends.',
    deleteRoomLabel: 'Delete room',

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
    pacingLive: 'Live (25s timer)',
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
    linkModalTitle: 'Link your existing account',
    linkModalSub: 'If you already created your account in the Home Screen app or another browser, link it here',
    savedAccountsTitle: 'Saved accounts on this device:',
    useThisAccount: 'Use this →',
    linkIdPrompt: 'Or enter your ID or paste the sync link:',
    linkIdPlaceholder: 'ID (e.g. p_abc123) or ?sync=... link',
    linkAndContinue: 'Link & Continue',
    linkError: 'Account not found. Check the code.',
    backToNewProfile: '← Back to create new profile',
    welcomeAskName: "What's your name?",
    welcomeAskSub: 'Pick your name and avatar to sit at the tables with friends',
    welcomeNameExample: 'Your name (e.g. Isaac, Leo, Carlos...)',
    chooseAvatar: 'Choose your 3D Avatar',
    continueBtn: 'Continue',
    alreadyHaveAccountAsk: 'Already created an account? Link with ID',

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
    tableInviteCopied: 'Link #{id} copied!',
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
    waitingSeatName: 'Waiting...',
    openSeatLabel: 'Open',
    waitingForFriends: 'Waiting for friends in #{id}...',
    inviteFriendBtn: 'Invite friend',
    waitingNextHand: 'Seated · Joining next hand',
    waitingSoloHost: 'Share #{id} to start when 1 friend joins',
    noClockAsync: '⏳ Turn-based · No timer',
    atTableChips: '{amount} at table',

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
    friendsLabel: 'Friends',
    addedSingular: 'added',
    addedPlural: 'added',
    createRoomShort: 'CREATE ROOM',
    inviteFriendsShort: 'INVITE FRIENDS',
    cardBacksLabel: 'Card backs',
    activeBackLabel: 'Active back:',
    rankProgressLabel: 'Rank progress',
    accountIdentityTitle: 'Account Identity',
    copyIdBtn: 'Copy ID',
    copySyncLinkBtn: 'Copy Safari / PWA sync link',
    syncLinkCopied: 'Link copied! Open in Safari or PWA',
    linkInputPlaceholder: 'Link with ID or ?sync=... link',
    linkBtn: 'Link',
    linkSuccessMsg: 'Account linked successfully!',
    linkIdSuccessMsg: 'Profile updated with ID: {id}!',
    linkFailMsg: 'Could not link account. Check the code.',
    statisticsHeading: 'Statistics',
    handsPlayedLabel: '{count} hands played',
    noHandsYetSub: 'No hands yet · Play hands to reveal your style',
    radarAggressive: 'Aggressive',
    radarAggressiveSub: 'More bets & raises',
    radarPassive: 'Passive',
    radarPassiveSub: 'More calls',
    radarTight: 'Tight',
    radarTightSub: 'Less hands',
    radarLoose: 'Loose',
    radarLooseSub: 'More hands',
    editProfileTitle: 'Edit Profile & Avatar',
    yourPlayerNameLabel: 'Your player name',
    cardBacksSheetTitle: 'Card Backs',
    rankSheetTitle: 'Rank Progress · Level {level}',
    currentXpLabel: 'Current XP: {xp} XP',
    xpToNextLevelLabel: '{xp} XP to Level {level}',
    xpEarnInfo: 'Earn +4 XP per decision and +25 XP when winning a hand.',
    selectEmoteTitle: 'Select Table Emote',
    friendPlaceholder: "Friend's name (e.g. Leo)",
    addBtn: 'Add',
    noAddedFriends: 'No friends added yet · Share your room link on WhatsApp or add friends above.',
    friendBadge: 'Friend',
    inviteLinkCopied: 'Invite link copied!',
    shareInviteLinkBtn: 'Share invite link',
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
    appTitle: 'Juegos de Cartas',
    chipsUnit: 'fichas',
    walletLabel: 'Billetera',
    inTablesLabel: 'En mesas',
    totalBalance: 'Saldo Total',
    claimBonus: '+1,000 Recarga',
    bonusClaimed: '¡Recargado!',
    onlineCount: '{count} en línea',
    playerFallback: 'Jugador',

    // Active Tables Section
    activeTablesTitle: 'Tus Mesas Activas',
    activeHandSub: 'Mano activa · Sal o vuelve cuando quieras',
    yourTurn: 'Es tu turno',
    waitingOnPlayer: 'Turno de {name}',
    inProgress: 'En juego',
    rejoinTable: 'Volver a la mesa',
    cashOutChips: 'Retirar fichas',
    cashOutSuccess: 'Retiraste {amount} fichas a tu saldo',
    pacingTurnsShort: '⏳ Turnos',
    pacingLiveShort: '⚡ En Vivo',
    tableLabel: 'Mesa',

    // Connected Tables / Rooms Directory
    connectedTablesTitle: 'Mesas Conectadas',
    roomsBtn: 'Salas',
    joinBtn: 'Unirse',
    createTableBtn: 'Crear Sala',
    noOpenRoomsTitle: 'No hay salas abiertas en este momento',
    noOpenRoomsDesc: 'Crea una sala y comparte el código con tus amigos',
    quickCodePlaceholder: 'Escribe un código de sala (ej. MESA1)...',
    bankruptTitle: 'Bancarrota (0 fichas)',
    bankruptDesc: 'Reclama tu bono de recuperación (+200) para volver a las mesas',
    insufficientWalletTitle: 'Sin fichas en tu billetera',
    insufficientWalletDesc: 'Cobra fichas de una mesa activa arriba para abrir otra sala.',
    liveTablesTitle: 'Mesas en Vivo',
    liveTablesDesc: 'Juega con amigos reales conectados (sin bots)',
    liveTablesBadge: 'Solo Reales · En Vivo',
    turnBasedTitle: 'Por Turnos',
    turnBasedDesc: 'Sin prisa entre amigos, te avisa cuando te toca',
    turnBasedBadge: 'Solo Reales · Turnos',
    practiceBotsTitle: 'Práctica vs Bots',
    practiceBotsDesc: 'Entrena jugadas al instante contra los 5 bots IA',
    practiceBotsBadgeShort: '5 Bots IA',
    buyInShort: 'Entrada',
    playersLabel: 'jugadores',
    blindsLabel: 'Ciegas',
    botsRuleNote: 'En práctica con bots el buy-in máximo es 100 y la sesión dura máx. 100 manos.',
    roomsModalTitle: 'Salas Abiertas & Crear Mesa',
    roomsModalSub: 'Las salas en vivo expiran tras 2h sin actividad (7d por turnos)',
    emptyRoomsModalDesc: 'No hay salas abiertas en este momento · Crea una sala abajo y comparte el código con tus amigos.',
    deleteRoomLabel: 'Eliminar sala',

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
    pacingLive: 'En vivo (25s reloj)',
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
    linkModalTitle: 'Vincular tu cuenta existente',
    linkModalSub: 'Si ya creaste tu cuenta en la app de inicio o en otro navegador, vincúlala aquí',
    savedAccountsTitle: 'Cuentas guardadas en este dispositivo:',
    useThisAccount: 'Usar esta →',
    linkIdPrompt: 'O escribe tu ID o pega el enlace de sincronización:',
    linkIdPlaceholder: 'ID (ej. p_abc123) o enlace ?sync=...',
    linkAndContinue: 'Vincular y Continuar',
    linkError: 'No se pudo encontrar la cuenta. Verifica el código.',
    backToNewProfile: '← Volver a crear nuevo perfil',
    welcomeAskName: '¿Cómo te llamas?',
    welcomeAskSub: 'Elige tu nombre y avatar para sentarte en las mesas con tus amigos',
    welcomeNameExample: 'Tu nombre (ej. Isaac, Leo, Carlos...)',
    chooseAvatar: 'Elige tu Avatar 3D',
    continueBtn: 'Continuar',
    alreadyHaveAccountAsk: '¿Ya creaste tu cuenta antes? Vincular con ID',

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
    waitingSeatName: 'Esperando...',
    openSeatLabel: 'Libre',
    waitingForFriends: 'Esperando amigos en #{id}...',
    inviteFriendBtn: 'Invitar amigo',
    waitingNextHand: 'Sentado · Entras en la próxima mano',
    waitingSoloHost: 'Comparte #{id} para empezar cuando se una 1 amigo',
    noClockAsync: '⏳ Por turnos · Sin reloj',
    atTableChips: '{amount} en mesa',

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
    friendsLabel: 'Amigos',
    addedSingular: 'agregado',
    addedPlural: 'agregados',
    createRoomShort: 'CREAR SALA',
    inviteFriendsShort: 'INVITAR AMIGOS',
    cardBacksLabel: 'Card backs',
    activeBackLabel: 'Dorso activo:',
    rankProgressLabel: 'Progreso de rango',
    accountIdentityTitle: 'Identidad de Cuenta',
    copyIdBtn: 'Copiar ID',
    copySyncLinkBtn: 'Copiar enlace para sincronizar con Safari / PWA',
    syncLinkCopied: '¡Enlace copiado! Ábrelo en Safari o PWA',
    linkInputPlaceholder: 'Vincular con ID o enlace ?sync=...',
    linkBtn: 'Vincular',
    linkSuccessMsg: '¡Cuenta vinculada con éxito!',
    linkIdSuccessMsg: '¡Perfil actualizado con ID: {id}!',
    linkFailMsg: 'No se pudo vincular la cuenta. Revisa el código.',
    statisticsHeading: 'Estadísticas',
    handsPlayedLabel: '{count} manos jugadas',
    noHandsYetSub: 'Sin partidas aún · Juega manos para ver tu estilo',
    radarAggressive: 'Agresivo',
    radarAggressiveSub: 'Más apuestas y subidas',
    radarPassive: 'Pasivo',
    radarPassiveSub: 'Más calls',
    radarTight: 'Tight',
    radarTightSub: 'Menos manos',
    radarLoose: 'Loose',
    radarLooseSub: 'Más manos',
    editProfileTitle: 'Editar Perfil y Avatar',
    yourPlayerNameLabel: 'Tu nombre de jugador',
    cardBacksSheetTitle: 'Dorsos de Cartas',
    rankSheetTitle: 'Progreso de Rango · Nivel {level}',
    currentXpLabel: 'XP Actual: {xp} XP',
    xpToNextLevelLabel: 'Faltan {xp} XP para Nivel {level}',
    xpEarnInfo: 'Ganas +4 XP por cada decisión y +25 XP al ganar una mano.',
    selectEmoteTitle: 'Seleccionar Emote de Mesa',
    friendPlaceholder: 'Nombre de tu amigo (ej. Leo)',
    addBtn: 'Agregar',
    noAddedFriends: 'Aún no tienes amigos agregados · Comparte el enlace de tu sala por WhatsApp o agrega a tus amigos arriba.',
    friendBadge: 'Amigo',
    inviteLinkCopied: '¡Enlace de invitación copiado!',
    shareInviteLinkBtn: 'Compartir enlace de invitación',
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
    appTitle: 'Giochi di Carte',
    chipsUnit: 'chip',
    walletLabel: 'Portafoglio',
    inTablesLabel: 'Nei tavoli',
    totalBalance: 'Saldo Totale',
    claimBonus: '+1.000 Ricarica',
    bonusClaimed: 'Ricaricato!',
    onlineCount: '{count} online',
    playerFallback: 'Giocatore',

    // Active Tables Section
    activeTablesTitle: 'Tavoli Attivi',
    activeHandSub: 'Mano attiva · Esci o rientra quando vuoi',
    yourTurn: 'Tocca a te',
    waitingOnPlayer: 'Turno di {name}',
    inProgress: 'In corso',
    rejoinTable: 'Rientra al tavolo',
    cashOutChips: 'Incassa chip',
    cashOutSuccess: 'Hai incassato {amount} chip nel tuo saldo',
    pacingTurnsShort: '⏳ Turni',
    pacingLiveShort: '⚡ Dal Vivo',
    tableLabel: 'Tavolo',

    // Connected Tables / Rooms Directory
    connectedTablesTitle: 'Tavoli Connessi',
    roomsBtn: 'Stanze',
    joinBtn: 'Unisciti',
    createTableBtn: 'Crea Tavolo',
    noOpenRoomsTitle: 'Nessun tavolo aperto al momento',
    noOpenRoomsDesc: 'Crea una stanza e condividi il codice con i tuoi amici',
    quickCodePlaceholder: 'Inserisci codice tavolo (es. TAVOLO1)...',
    bankruptTitle: 'Bancarotta (0 chip)',
    bankruptDesc: 'Richiedi il tuo bonus di recupero (+200) per tornare ai tavoli',
    insufficientWalletTitle: 'Portafoglio vuoto (0 chip disponibili)',
    insufficientWalletDesc: 'Incassa le chip da un tavolo attivo qui sopra per aprire un nuovo tavolo.',
    liveTablesTitle: 'Tavoli dal Vivo',
    liveTablesDesc: 'Gioca con amici reali connessi (senza bot)',
    liveTablesBadge: 'Amici Reali · Dal Vivo',
    turnBasedTitle: 'A Turni',
    turnBasedDesc: 'Con calma tra amici, ricevi una notifica al tuo turno',
    turnBasedBadge: 'Amici Reali · A turni',
    practiceBotsTitle: 'Pratica vs Bot',
    practiceBotsDesc: 'Allenati subito contro 5 bot con IA',
    practiceBotsBadgeShort: '5 Bot IA',
    buyInShort: 'Buy-in',
    playersLabel: 'giocatori',
    blindsLabel: 'Bui',
    botsRuleNote: 'Nei tavoli contro i bot il buy-in massimo è 100 e dura max 100 mani.',
    roomsModalTitle: 'Tavoli Aperti & Crea Stanza',
    roomsModalSub: 'Le stanze live scadono dopo 2h inattive (7g a turni)',
    emptyRoomsModalDesc: 'Nessuna stanza aperta al momento · Creane una qui sotto e condividi il codice.',
    deleteRoomLabel: 'Elimina stanza',

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
    pacingLive: 'Dal vivo (timer 25s)',
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
    linkModalTitle: 'Collega il tuo account',
    linkModalSub: "Se hai già creato il tuo account nell'app o in un altro browser, collegalo qui",
    savedAccountsTitle: 'Account salvati su questo dispositivo:',
    useThisAccount: 'Usa questo →',
    linkIdPrompt: 'Oppure inserisci il tuo ID o incolla il link di sincronizzazione:',
    linkIdPlaceholder: 'ID (es. p_abc123) o link ?sync=...',
    linkAndContinue: 'Collega e Continua',
    linkError: 'Account non trovato. Controlla il codice.',
    backToNewProfile: '← Torna a creare un nuovo profilo',
    welcomeAskName: 'Come ti chiami?',
    welcomeAskSub: 'Scegli il tuo nome e avatar per sederti ai tavoli con gli amici',
    welcomeNameExample: 'Il tuo nome (es. Marco, Giulia, Leo...)',
    chooseAvatar: 'Scegli il tuo Avatar 3D',
    continueBtn: 'Continua',
    alreadyHaveAccountAsk: 'Hai già un account? Collega con ID',

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
    waitingSeatName: 'In attesa...',
    openSeatLabel: 'Libero',
    waitingForFriends: 'In attesa di amici in #{id}...',
    inviteFriendBtn: 'Invita amico',
    waitingNextHand: 'Seduto · Entri alla prossima mano',
    waitingSoloHost: 'Condividi #{id} per iniziare appena entra 1 amico',
    noClockAsync: '⏳ A turni · Nessun timer',
    atTableChips: '{amount} al tavolo',

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
    friendsLabel: 'Amici',
    addedSingular: 'aggiunto',
    addedPlural: 'aggiunti',
    createRoomShort: 'CREA STANZA',
    inviteFriendsShort: 'INVITA AMICI',
    cardBacksLabel: 'Dorsi carte',
    activeBackLabel: 'Dorso attivo:',
    rankProgressLabel: 'Progresso grado',
    accountIdentityTitle: 'Identità Account',
    copyIdBtn: 'Copia ID',
    copySyncLinkBtn: 'Copia link sincronizzazione Safari / PWA',
    syncLinkCopied: 'Link copiato! Aprilo in Safari o PWA',
    linkInputPlaceholder: 'Collega con ID o link ?sync=...',
    linkBtn: 'Collega',
    linkSuccessMsg: 'Account collegato con successo!',
    linkIdSuccessMsg: 'Profilo aggiornato con ID: {id}!',
    linkFailMsg: "Impossibile collegare l'account. Controlla il codice.",
    statisticsHeading: 'Statistiche',
    handsPlayedLabel: '{count} mani giocate',
    noHandsYetSub: 'Nessuna mano ancora · Gioca per scoprire il tuo stile',
    radarAggressive: 'Aggressivo',
    radarAggressiveSub: 'Più puntate e rilanci',
    radarPassive: 'Passivo',
    radarPassiveSub: 'Più call',
    radarTight: 'Tight',
    radarTightSub: 'Meno mani',
    radarLoose: 'Loose',
    radarLooseSub: 'Più mani',
    editProfileTitle: 'Modifica Profilo e Avatar',
    yourPlayerNameLabel: 'Il tuo nome giocatore',
    cardBacksSheetTitle: 'Dorsi delle Carte',
    rankSheetTitle: 'Progresso Grado · Livello {level}',
    currentXpLabel: 'XP Attuale: {xp} XP',
    xpToNextLevelLabel: '{xp} XP al Livello {level}',
    xpEarnInfo: 'Guadagni +4 XP per ogni decisione e +25 XP vincendo una mano.',
    selectEmoteTitle: 'Seleziona Emote del Tavolo',
    friendPlaceholder: 'Nome amico (es. Leo)',
    addBtn: 'Aggiungi',
    noAddedFriends: 'Nessun amico aggiunto ancora · Condividi il link su WhatsApp o aggiungi amici sopra.',
    friendBadge: 'Amico',
    inviteLinkCopied: 'Link di invito copiato!',
    shareInviteLinkBtn: 'Condividi link di invito',
  },
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS.en;

export function getLocalizedCardBackName(
  colorId: 'slate' | 'indigo' | 'emerald' | 'crimson',
  lang: SupportedLanguage
): string {
  const names: Record<'slate' | 'indigo' | 'emerald' | 'crimson', Record<SupportedLanguage, string>> = {
    slate: { en: 'Classic Slate', es: 'Clásico Gris', it: 'Grigio Classico' },
    indigo: { en: 'Royal Indigo', es: 'Índigo Real', it: 'Indaco Reale' },
    emerald: { en: 'Casino Emerald', es: 'Esmeralda Casino', it: 'Smeraldo Casinò' },
    crimson: { en: 'Midnight Crimson', es: 'Carmesí Nocturno', it: 'Cremisi Notturno' },
  };
  return names[colorId]?.[lang] ?? names.slate[lang];
}

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
