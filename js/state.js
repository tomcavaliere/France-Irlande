// state.js
// Shared mutable application state and convenience wrappers.
// Loaded early — all other modules read/write these globals.

// ==== STATE ====
// Position live
var current = null;          // { lat, lon, kmTotal, kmDay, date, ts } ou null

// Cache des métadonnées d'étapes — chargé à l'ouverture de Carnet
var stages = {};             // { [date]: { lat, lon, kmTotal, kmDay, note, ts, published, journalDeleted } }

// Caches lazy par date (peuplés à la demande)
var journals = {};           // { [date]: "texte" }

// ==== ADMIN ====
var isAdmin = false;
var inactivityTimer = null;
var inactivityWarnTimer = null;
var INACTIVITY_MS = 3 * 60 * 1000;
var INACTIVITY_WARN_BEFORE_MS = 45 * 1000; // avertissement 45s avant la déconnexion

// ==== QUOTA RTDB ====
// Dernière mesure connue du quota photos. Rafraîchie à chaque login admin,
// après chaque upload réussi et après chaque suppression.
var _quotaState = { count: 0, bytes: 0, level: 'ok' };

var _lastActivity = Date.now();
var _sessionCountdown = null;

// ==== JOURNAL SAVE ====
var _journalSaveTimers = {}; // { [date]: timeoutId }

// ==== FIREBASE SUBSCRIPTIONS ====
var fbInitialized = false;
var lastCompletedCount = 0;
var journalDirty = false;
var _unsubCurrent = null, _unsubStages = null, _unsubExpenses = null;

// ==== MAP ====
var map, completedLayer, posMarker, campingLayer = null, campspaceLayer = null, waterLayer = null;
var campingsVisible = false, campspaceVisible = false, waterVisible = false;
var campingsCache = null; // cache {bbox_key: [features]}

// ==== WATER ====
var waterCacheKey = '';
var waterCacheData = [];
var waterLoading = false;

// ==== CONFIRM DIALOG ====
var _confirmResolve = null;

// ==== PHOTOS ====
var photos = {};  // { [date]: { [id]: base64 } }

// ==== VIDEOS ====
var videos = {};  // { [date]: { [id]: url } }

// ==== COMMENTAIRES ====
var comments = {};  // { [date]: { [id]: {name, text, ts} } }

// ==== DÉPENSES ====
var expenses = {};

// ==== JOURNAL LAZY LISTENERS ====
var journalsUnsub = {};      // { [date]: fn }
var commentsUnsub = {};      // { [date]: fn }
var bravosUnsub = {};        // { [date]: fn }
var photosUnsub = {};        // { [date]: fn }
var videosUnsub = {};        // { [date]: fn }
var photoObserver = null;

// ==== OFFLINE ====
var offlineQueue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
var isOnline = navigator.onLine;

// ==== CONVENIENCE WRAPPERS ====
// Delegates to Utils — keeps onclick handlers short.
function escAttr(s) { return Utils.escAttr(s); }
function escHtml(s) { return Utils.escHtml(s); }
function formatTime(ts) { return Utils.formatTime(ts); }
function computeKmDay(kmTotal, stg, todayISO) { return Utils.computeKmDay(kmTotal, stg, todayISO); }
function isOfflineable(path) { return Utils.isOfflineable(path); }
function actionLabel(path) { return Utils.actionLabel(path); }
function filterVisibleJournalDates(stg, admin) { return Utils.filterVisibleJournalDates(stg, admin); }
