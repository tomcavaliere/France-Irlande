# Video Journal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the admin to upload short video clips from a phone alongside photos in the journal, displayed as thumbnails with a ▶ overlay in the same grid, opening in a full-screen lightbox.

**Architecture:** Videos are stored in Firebase Storage (`videos/{date}/{id}`); only the download URL (~100 chars) is written to RTDB (`videos/{date}/{id}`). `renderMediaHtml` replaces `renderPhotosHtml` and merges both collections. The lightbox detects photo vs video by the `id` prefix (`p` = photo, `v` = video).

**Tech Stack:** Firebase Storage v10.12.0 (modular), Firebase RTDB (existing), vanilla JS, no build step.

---

## File Map

| Action | File | What changes |
|---|---|---|
| Modify | `js/firebase-init.js` | Add Storage SDK imports + expose globals |
| Modify | `js/state.js` | Add `videos` and `videosUnsub` vars |
| Modify | `index.html` | CSS video styles, lightbox `<video>` element, `<script>` for videos.js |
| Modify | `js/ui.js` | Update `openLightbox` / `closeLightbox`, add `uploadVideo`/`deleteVideo` to ACTIONS |
| Modify | `js/photos.js` | Replace `renderPhotosHtml`/`patchPhotos` with `renderMediaHtml`/`patchMedia` |
| Create | `js/videos.js` | `uploadVideo`, `deleteVideo` |
| Modify | `js/journal.js` | Add videos RTDB listener in `loadStageContent`, update teardown and renders |

---

## Task 1: Firebase Storage SDK

**Files:**
- Modify: `js/firebase-init.js`

- [ ] **Step 1: Add Storage import and expose globals**

Replace the entire content of `js/firebase-init.js` with:

```js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, set, remove, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
var firebaseConfig = {
  apiKey: "AIzaSyA_1xAPK0D5_Mc_cuzJiKT04i9KzrEEDRc",
  authDomain: "france-irlande-bike.firebaseapp.com",
  databaseURL: "https://france-irlande-bike-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "france-irlande-bike",
  storageBucket: "france-irlande-bike.firebasestorage.app",
  messagingSenderId: "803737104785",
  appId: "1:803737104785:web:b2770a4d862ab90ee06a30"
};
var app = initializeApp(firebaseConfig);
var db = getDatabase(app);
var auth = getAuth(app);
window._fbDb = db;
window._fbRef = ref;
window._fbSet = set;
window._fbRemove = remove;
window._fbOnValue = onValue;
window._fbGet = get;
window._fbAuth = auth;
window._fbSignIn = signInWithEmailAndPassword;
window._fbSignOut = signOut;
window._fbOnAuth = onAuthStateChanged;
window._fbStorage = getStorage(app);
window._fbStorageRef = storageRef;
window._fbUploadResumable = uploadBytesResumable;
window._fbGetDownloadURL = getDownloadURL;
window._fbDeleteObject = deleteObject;
```

- [ ] **Step 2: Verify no console errors on page load**

Open the app in the browser. Open DevTools → Console. No red errors about firebase-storage. The `window._fbStorage` object should be defined (type `window._fbStorage` in the console).

- [ ] **Step 3: Commit**

```bash
git add js/firebase-init.js
git commit -m "feat(firebase): expose Firebase Storage SDK globals"
```

---

## Task 2: State variables

**Files:**
- Modify: `js/state.js`

- [ ] **Step 1: Add `videos` state variable**

In `js/state.js`, after the `// ==== PHOTOS ====` block (line 52-53), add:

```js
// ==== VIDEOS ====
var videos = {};  // { [date]: { [id]: url } }
```

- [ ] **Step 2: Add `videosUnsub` lazy listener map**

In `js/state.js`, after `var photosUnsub = {};        // { [date]: fn }` (line 65), add:

```js
var videosUnsub = {};        // { [date]: fn }
```

- [ ] **Step 3: Run tests to verify nothing broken**

```bash
npm test
```

Expected: all 34 tests pass.

- [ ] **Step 4: Commit**

```bash
git add js/state.js
git commit -m "feat(state): add videos and videosUnsub state vars"
```

---

## Task 3: CSS + lightbox HTML

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add video thumbnail CSS**

In `index.html`, find the CSS block ending at `.j-uploading{opacity:.5;pointer-events:none}` (around line 301). Add immediately after:

```css
/* Video thumbnails */
.j-video-wrap{position:relative}
.j-video-wrap video{width:100%;height:100%;object-fit:cover;pointer-events:none}
.j-video-play{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  background:rgba(0,0,0,.25);border:none;color:#fff;font-size:28px;cursor:pointer;width:100%;height:100%}
.j-video-play:active{background:rgba(0,0,0,.45)}
/* Lightbox video */
#lightboxVideo{max-width:95vw;max-height:90vh;border-radius:8px;display:none}
```

- [ ] **Step 2: Add `<video>` element to lightbox HTML**

Find the lightbox div in `index.html` (around line 587-590):

```html
<div class="lightbox" id="lightbox" data-action="closeLightbox">
  <button class="lightbox-close" data-action="closeLightbox">&#x2715;</button>
  <img id="lightboxImg" src="" alt="">
</div>
```

Replace with:

```html
<div class="lightbox" id="lightbox" data-action="closeLightbox">
  <button class="lightbox-close" data-action="closeLightbox">&#x2715;</button>
  <img id="lightboxImg" src="" alt="">
  <video id="lightboxVideo" controls autoplay playsinline></video>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(ui): add video thumbnail CSS and lightbox video element"
```

---

## Task 4: Update `ui.js` — lightbox + ACTIONS

**Files:**
- Modify: `js/ui.js`

- [ ] **Step 1: Update `openLightbox` to handle video**

In `js/ui.js`, replace the `openLightbox` function (lines 119-123):

```js
function openLightbox(id,i){
  var isVideo=id&&id.charAt(0)==='v';
  var lb=document.getElementById('lightbox');
  var img=document.getElementById('lightboxImg');
  var vid=document.getElementById('lightboxVideo');
  if(isVideo){
    var src=(videos[i]&&videos[i][id])||'';
    vid.src=src;
    img.style.display='none';
    vid.style.display='';
  }else{
    var src=(photos[i]&&photos[i][id])||id;
    img.src=src;
    img.style.display='';
    vid.style.display='none';
    if(vid){vid.pause();vid.src='';}
  }
  lb.classList.add('vis');
}
```

- [ ] **Step 2: Update `closeLightbox` to pause video**

Replace the `closeLightbox` function (line 124):

```js
function closeLightbox(){
  var vid=document.getElementById('lightboxVideo');
  if(vid){vid.pause();vid.src='';}
  document.getElementById('lightbox').classList.remove('vis');
}
```

- [ ] **Step 3: Add `uploadVideo` and `deleteVideo` to ACTIONS, update `openLightbox` entry**

In the `ACTIONS` object, replace the `openLightbox` entry (line 42) and add two new entries after `deletePhoto`:

```js
  openLightbox:function(a,b){openLightbox(a,b);},
  deletePhoto:function(a,b){deletePhoto(a,b);},
  uploadPhoto:function(a){uploadPhoto(a);},
  uploadVideo:function(a){uploadVideo(a);},
  deleteVideo:function(a,b){deleteVideo(a,b);},
```

(Replace the existing `openLightbox`, `deletePhoto`, `uploadPhoto` lines — positions are adjacent, just add the two video lines after `uploadPhoto`.)

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: 34 tests pass.

- [ ] **Step 5: Commit**

```bash
git add js/ui.js
git commit -m "feat(ui): update lightbox for video, add uploadVideo/deleteVideo actions"
```

---

## Task 5: `photos.js` — `renderMediaHtml` + `patchMedia`

**Files:**
- Modify: `js/photos.js`

- [ ] **Step 1: Replace `renderPhotosHtml` with `renderMediaHtml`**

In `js/photos.js`, replace the entire `renderPhotosHtml` function (lines 88-107) with:

```js
function renderMediaHtml(date){
  var stagePhotos=photos[date]||{};
  var stageVideos=videos[date]||{};
  var ed=escAttr(date);
  var items=[];
  Object.keys(stagePhotos).forEach(function(id){
    items.push({id:id,type:'photo',src:stagePhotos[id]});
  });
  Object.keys(stageVideos).forEach(function(id){
    items.push({id:id,type:'video',src:stageVideos[id]});
  });
  items.sort(function(a,b){return a.id<b.id?-1:a.id>b.id?1:0;});
  var html='<div class="j-photos" id="photos-'+ed+'">';
  items.forEach(function(item){
    var eid=escAttr(item.id);
    if(item.type==='photo'){
      html+='<div class="j-photo-wrap">'+
        '<img src="'+escAttr(item.src)+'" data-action="openLightbox" data-arg="'+eid+'" data-arg2="'+ed+'">'+
        (isAdmin?'<button class="j-photo-del" data-action="deletePhoto" data-arg="'+ed+'" data-arg2="'+eid+'">&#x2715;</button>':'')+
        '</div>';
    }else{
      html+='<div class="j-photo-wrap j-video-wrap">'+
        '<video src="'+escAttr(item.src)+'" preload="metadata" muted playsinline></video>'+
        '<button class="j-video-play" data-action="openLightbox" data-arg="'+eid+'" data-arg2="'+ed+'">&#x25B6;</button>'+
        (isAdmin?'<button class="j-photo-del" data-action="deleteVideo" data-arg="'+ed+'" data-arg2="'+eid+'">&#x2715;</button>':'')+
        '</div>';
    }
  });
  if(isAdmin){
    html+='<div class="j-photo-add" id="photos-add-'+ed+'" data-action="uploadPhoto" data-arg="'+ed+'">'+
      '<span class="j-photo-add-icon">&#x1f4f7;</span><span>Photo</span></div>';
    html+='<div class="j-photo-add" id="videos-add-'+ed+'" data-action="uploadVideo" data-arg="'+ed+'">'+
      '<span class="j-photo-add-icon">&#x1f3a5;</span><span>Vidéo</span></div>';
  }
  html+='</div>';
  return html;
}
```

- [ ] **Step 2: Replace `patchPhotos` with `patchMedia`**

Replace the `patchPhotos` function (lines 108-114):

```js
function patchMedia(date){
  var container=document.getElementById('photos-'+date);
  if(!container)return;
  var tmp=document.createElement('div');
  tmp.innerHTML=renderMediaHtml(date);
  container.replaceWith(tmp.firstChild);
}
```

- [ ] **Step 3: Update `patchPhotos` calls inside `photos.js` itself**

In `uploadPhoto` (line 58): change `patchPhotos(i)` → `patchMedia(i)`.
In `deletePhoto` (line 84): change `patchPhotos(i)` → `patchMedia(i)`.

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: 34 tests pass.

- [ ] **Step 5: Commit**

```bash
git add js/photos.js
git commit -m "feat(photos): replace renderPhotosHtml/patchPhotos with renderMediaHtml/patchMedia"
```

---

## Task 6: Create `js/videos.js`

**Files:**
- Create: `js/videos.js`

- [ ] **Step 1: Create the file**

Create `js/videos.js` with this content:

```js
// videos.js
// Video upload and deletion — Firebase Storage (file) + RTDB (URL).

function uploadVideo(date){
  if(!isAdmin)return;
  if(!isOnline){
    alert('Upload impossible hors-ligne. Les vidéos ne sont pas mises en cache. Réessaie au retour du réseau.');
    return;
  }
  if(_quotaState.level==='block'){
    alert('Quota Firebase atteint (≥ 90%). Upload bloqué. Supprime d\'anciennes photos avant d\'en ajouter.');
    return;
  }
  var input=document.createElement('input');
  input.type='file';input.accept='video/*';
  input.onchange=function(){
    var file=input.files[0];
    if(!file)return;
    var id='v'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
    var addBtn=document.getElementById('videos-add-'+date);
    var progressSpan=addBtn?addBtn.querySelector('span:last-child'):null;
    if(addBtn)addBtn.classList.add('j-uploading');
    var sRef=window._fbStorageRef(window._fbStorage,'videos/'+date+'/'+id);
    var uploadTask=window._fbUploadResumable(sRef,file);
    uploadTask.on('state_changed',
      function(snapshot){
        var pct=Math.round(snapshot.bytesTransferred/snapshot.totalBytes*100);
        if(progressSpan)progressSpan.textContent=pct+'%';
      },
      function(err){
        console.error('[uploadVideo] upload failed',err);
        if(addBtn)addBtn.classList.remove('j-uploading');
        if(progressSpan)progressSpan.textContent='Vidéo';
      },
      function(){
        var snapRef=uploadTask.snapshot.ref;
        window._fbGetDownloadURL(snapRef)
          .then(function(url){
            return window._fbSet(
              window._fbRef(window._fbDb,'videos/'+date+'/'+id),url
            ).then(function(){return url;});
          })
          .then(function(url){
            if(!videos[date])videos[date]={};
            videos[date][id]=url;
            patchMedia(date);
            if(addBtn)addBtn.classList.remove('j-uploading');
            if(progressSpan)progressSpan.textContent='Vidéo';
          })
          .catch(function(err){
            console.error('[uploadVideo] post-upload failed',err);
            if(addBtn)addBtn.classList.remove('j-uploading');
            if(progressSpan)progressSpan.textContent='Vidéo';
          });
      }
    );
  };
  input.click();
}

function deleteVideo(date,id){
  if(!isAdmin)return;
  confirmDialog({
    title:'Supprimer la vidéo',
    message:'Cette vidéo sera définitivement supprimée. Action irréversible.'
  }).then(function(ok){
    if(!ok)return;
    var sRef=window._fbStorageRef(window._fbStorage,'videos/'+date+'/'+id);
    window._fbDeleteObject(sRef)
      .catch(function(err){console.error('[deleteVideo] storage delete failed',err);});
    window._fbRemove(window._fbRef(window._fbDb,'videos/'+date+'/'+id))
      .catch(function(err){console.error('[deleteVideo] rtdb remove failed',err);});
    if(videos[date])delete videos[date][id];
    patchMedia(date);
  });
}
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: 34 tests pass.

- [ ] **Step 3: Commit**

```bash
git add js/videos.js
git commit -m "feat(videos): add uploadVideo and deleteVideo module"
```

---

## Task 7: Wire videos into `journal.js`

**Files:**
- Modify: `js/journal.js`

- [ ] **Step 1: Add videos RTDB listener in `loadStageContent`**

In `js/journal.js`, in the `loadStageContent` function, after the photos listener block (after line 116, the `});` closing `photosUnsub`), add:

```js
  videosUnsub[date]=window._fbOnValue(window._fbRef(window._fbDb,'videos/'+date),function(snap){
    videos[date]=snap.val()||{};
    patchMedia(date);
  });
```

- [ ] **Step 2: Add `videosUnsub` to teardown in `renderJournal`**

In `js/journal.js`, in the `renderJournal` function, find the teardown line (around line 153):

```js
  [journalsUnsub, photosUnsub, commentsUnsub, bravosUnsub].forEach(function(map){
```

Replace with:

```js
  [journalsUnsub, photosUnsub, videosUnsub, commentsUnsub, bravosUnsub].forEach(function(map){
```

- [ ] **Step 3: Clear `videos` on `renderJournal`**

In the same `renderJournal` function, find the reset line (around line 158-159):

```js
  journalsUnsub={};photosUnsub={};commentsUnsub={};bravosUnsub={};
  photos={};comments={};
```

Replace with:

```js
  journalsUnsub={};photosUnsub={};videosUnsub={};commentsUnsub={};bravosUnsub={};
  photos={};videos={};comments={};
```

- [ ] **Step 4: Replace `renderPhotosHtml` call with `renderMediaHtml`**

In `renderJournal`, find (around line 200):

```js
      renderPhotosHtml(date)+
```

Replace with:

```js
      renderMediaHtml(date)+
```

- [ ] **Step 5: Replace `patchPhotos` call in `patchJournal`**

In `patchJournal` function (around line 41):

```js
    patchPhotos(date);
```

Replace with:

```js
    patchMedia(date);
```

- [ ] **Step 6: Run tests**

```bash
npm test
```

Expected: 34 tests pass.

- [ ] **Step 7: Commit**

```bash
git add js/journal.js
git commit -m "feat(journal): wire videos RTDB listener and renderMediaHtml"
```

---

## Task 8: Add `videos.js` script tag to `index.html`

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add script tag**

In `index.html`, find:

```html
<script defer src="js/photos.js"></script>
```

Add immediately after:

```html
<script defer src="js/videos.js"></script>
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: 34 tests pass.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(html): load videos.js module"
```

---

## Task 9: Manual verification

> No automated tests required (all code is DOM + Firebase I/O). These are the acceptance criteria to verify in the browser.

- [ ] **Step 1: Enable Firebase Storage in the console**

Go to Firebase Console → Build → Storage → click "Commencer" to activate it (one-time). Choose `europe-west1` as region (same as RTDB).

- [ ] **Step 2: Deploy updated RTDB rules**

Firebase Console → Realtime Database → Règles → paste content of `firebase.rules.json` → Publier.

- [ ] **Step 3: Deploy Storage rules**

Firebase Console → Storage → Règles → paste content of `storage.rules` → Publier.

- [ ] **Step 4: Visitor view — no video controls visible**

Open the app without logging in. Navigate to the Carnet tab. Confirm no "🎥 Vidéo" button is visible.

- [ ] **Step 5: Admin upload flow**

Log in as admin. Navigate to Carnet. Open a journal entry for today's date. Confirm two buttons are visible: "📷 Photo" and "🎥 Vidéo". Tap "🎥 Vidéo", select a short video from the phone/filesystem. Confirm a progress percentage appears on the button during upload. After upload completes, confirm the video thumbnail appears in the grid (first frame visible as thumbnail).

- [ ] **Step 6: Visitor can play video**

Log out (or open in incognito). Navigate to the same journal entry. Confirm the video thumbnail is visible with a ▶ overlay. Tap ▶ → video opens in lightbox, plays with audio/controls. Tap ✕ → video stops and lightbox closes.

- [ ] **Step 7: Admin delete flow**

Log in as admin. Tap ✕ on a video thumbnail. Confirm "Supprimer la vidéo" dialog appears. Confirm deletion → thumbnail disappears. Verify in Firebase Console that the file is gone from Storage and the RTDB node is removed.

- [ ] **Step 8: Mixed grid order**

Upload a photo and a video for the same date. Confirm they are sorted chronologically by upload timestamp (not all photos first, then all videos).

- [ ] **Step 9: Final commit if any loose ends**

```bash
npm test
git status
```

All 34 tests pass. No uncommitted changes.
