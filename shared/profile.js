/* Shared profile logic for the dating-profile stimuli.
 *
 * Each persona page defines window.PROFILE before loading this file:
 *   { id: "olivia", first: "Olivia", full: "Olivia Carter",
 *     pron: { she: "she", her: "her", him: "her" } }   // subject, possessive, object
 *
 * URL parameter ?AI= selects the condition:
 *   0 (default, missing or invalid) – profile only; "Read more" expands every card
 *   1 – target cards show the short answer; details only via the matchmaker
 *   2 – target cards show only the title; short + details only via the matchmaker
 *
 * No storage, no network calls. Every interaction is posted to the parent frame.
 */

/* ---------- Config (rename here) ---------- */
var APP_NAME = "Kindred";
var MATCHMAKER_NAME = "Wingmate";
var MATCHMAKER_TAGLINE = APP_NAME + "'s AI matchmaker";  // neutral, platform-provided (never "{Name}'s matchmaker")
var TYPING_MIN_MS = 800;
var TYPING_MAX_MS = 1200;
var AUTOTYPE_MS_PER_CHAR = 22;    // speed at which the participant's question is typed into the input
var AUTOTYPE_PAUSE_MS = 700;      // pause after a Wingmate reply before the next question starts typing
var ALLOW_FREE_TEXT = false;      // false: input is read-only, participants only press Send on scripted questions

/* ---------- Prompt cards (same for both personas, first person) ----------
 * target: true  -> handled by the matchmaker in AI=1 / AI=2
 * question: scripted participant question, autotyped into the input ({She}/{she}/{her}/{him}/{Name} filled per persona)
 * keywords: free-text matching regexes; a leading "~" marks a generic word worth half a match
 * reply1 / reply2: scripted matchmaker replies for AI=1 / AI=2
 */
var PROMPTS = [
  {
    key: "weekend", target: false,
    title: "My ideal weekend",
    short: "Outdoors on Saturday afternoons, slow Sundays.",
    long: "Saturday afternoons I'm usually hiking or at the farmers' market with friends. Sundays I keep free: coffee, a long run, and cooking for the week.",
    keywords: ["weekend", "sunday", "hik", "farmers", "market", "outdoor", "~coffee", "running", "\\brun\\b", "free time", "hobb", "for fun", "saturday afternoon"]
  },
  {
    key: "family", target: true,
    title: "In five years, I hope…",
    short: "To be starting a family.",
    long: "I'd like to have kids in the next four or five years, ideally two. I'm close with my siblings and want that for my own kids. I'm flexible on timing and where we'd live.",
    question: "So {Name} told you where {she} hopes to be in five years. I'm curious, does {she} want kids?",
    keywords: ["kid", "child", "famil", "bab(y|ies)", "\\bsons?\\b", "daughter", "\\bparent", "\\bmoms?\\b", "\\bdads?\\b", "mother", "father", "sibling", "five years", "5 years", "~future"],
    reply1: "{Name} would like to have kids in the next four or five years, ideally two. {She}'s close with {her} siblings and wants that for {her} own family, and is flexible on timing and where to live.",
    reply2: "Yes, {Name} wants to start a family. {She}'d like to have kids in the next four or five years, ideally two. {She}'s close with {her} siblings and wants that for {her} own family, and is flexible on timing and where to live."
  },
  {
    key: "goal", target: true,
    title: "What I'm looking for",
    short: "Something that leads to marriage.",
    long: "I'm not here to date casually. I want a partner I could see marrying in the next couple of years. I'm happy to take things slow, but that's the direction.",
    question: "I'd love to know what {Name} is hoping to find on here. What kind of relationship is {she} looking for?",
    keywords: ["~looking", "relationship", "marr", "serious", "casual", "commit", "long[- ]term", "settle", "~partner", "wife", "husband", "hook ?up", "~dating", "\\bwant(s)? in\\b", "intention"],
    reply1: "{Name} isn't looking for anything casual. {She} wants a partner {she} could see marrying in the next couple of years, and is happy to take things slow on the way there.",
    reply2: "{Name} is looking for something that leads to marriage. {She} isn't interested in anything casual: {she} wants a partner {she} could see marrying in the next couple of years, and is happy to take things slow on the way there."
  },
  {
    key: "food", target: false,
    title: "Food I can't live without",
    short: "Mostly vegetarian, never picky.",
    long: "I don't cook meat at home, but I'm not strict when I'm out or at a friend's place. Happy to go anywhere for dinner.",
    keywords: ["food", "\\beat", "vegetarian", "vegan", "meat", "diet", "picky", "dinner", "restaurant", "cuisine", "~cook"]
  },
  {
    key: "proud", target: true,
    title: "Something I'm proud of",
    short: "A project I led won a national award.",
    long: "I was promoted this spring, and a project I led at work won a national industry award. I'm proud of it, but I'm working on not letting work take over my life.",
    question: "{Name} mentioned something {she}'s proud of. What's the story there?",
    keywords: ["proud", "~work", "\\bjob", "career", "award", "promot", "achiev", "accomplish", "~project", "success", "ambiti", "profession"],
    reply1: "{Name} was promoted this spring, and a project {she} led won a national industry award. {She}'s proud of it, but tries not to let work take over.",
    reply2: "{Name} is proud that a project {she} led won a national industry award, and {she} was also promoted this spring. {She}'s proud of it, but tries not to let work take over."
  },
  {
    key: "volunteer", target: false,
    title: "How I spend Saturday mornings",
    short: "Volunteering at a homeless shelter.",
    long: "I've helped at a shelter downtown most Saturday mornings for six years and now run the breakfast program. It's one of the most meaningful parts of my week.",
    keywords: ["volunteer", "shelter", "homeless", "charit", "saturday morning", "breakfast", "give back", "giving back", "~community", "~meaningful"]
  }
];

/* ---------- Setup ---------- */
(function () {
  var P = window.PROFILE;
  var raw = new URLSearchParams(window.location.search).get("AI");
  var COND = (raw === "1" || raw === "2") ? Number(raw) : 0;

  function fill(s) {
    return s.replace(/\{(\w+)\}/g, function (m, k) {
      if (k === "Name") return P.first;
      if (k === "She") return cap(P.pron.she);
      if (k === "Her") return cap(P.pron.her);
      if (P.pron[k] !== undefined) return P.pron[k];
      return m;
    });
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ---------- Logging ---------- */
  function log(event, detail) {
    var payload = { source: "profile-stim", condition: COND, persona: P.id, event: event, detail: detail === undefined ? null : detail, t: Date.now() };
    try { window.parent.postMessage(payload, "*"); } catch (e) { /* ignore */ }
    try { console.log("[profile-stim]", payload); } catch (e) { /* ignore */ }
  }

  document.title = P.full + " — " + APP_NAME;
  document.body.setAttribute("data-condition", String(COND));
  if (COND > 0) document.body.classList.add("ai-on");

  var SPARK = '<svg class="wm-spark" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.1 6.4 6.4 2.1-6.4 2.1L12 19.5l-2.1-6.4L3.5 11l6.4-2.1z"/><path d="M19 15.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z"/></svg>';

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  /* ---------- Prompt cards ---------- */
  var list = document.getElementById("promptList");
  PROMPTS.forEach(function (p, i) {
    var card = el("div", "card prompt-card");
    card.setAttribute("data-card", p.key);
    card.appendChild(el("div", "prompt-label", p.title));

    var viaMatchmaker = p.target && COND > 0;

    if (!(p.target && COND === 2)) {
      card.appendChild(el("div", "prompt-answer", p.short));
    }

    if (!viaMatchmaker) {
      var more = el("div", "prompt-answer small prompt-more", p.long);
      more.id = "more-" + p.key;
      more.hidden = true;
      var btn = el("button", "read-more", "Read more");
      btn.type = "button";
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-controls", more.id);
      btn.addEventListener("click", function () {
        var open = more.hidden;
        more.hidden = !open;
        btn.textContent = open ? "Show less" : "Read more";
        btn.setAttribute("aria-expanded", String(open));
        log(open ? "card_expand" : "card_collapse", { card: p.key, position: i + 1 });
      });
      card.appendChild(more);
      card.appendChild(btn);
    } else {
      var note = el("div", "wm-note");
      var txt = el("div", "wm-note-text");
      txt.innerHTML = SPARK;
      txt.appendChild(el("span", "", COND === 2
        ? P.first + " shared this with " + MATCHMAKER_NAME + "."
        : P.first + " shared more about this with " + MATCHMAKER_NAME + "."));
      var ask = el("button", "wm-ask", "Ask " + MATCHMAKER_NAME);
      ask.type = "button";
      ask.addEventListener("click", function () {
        log("ask_wingmate_click", { from: "card", card: p.key, position: i + 1 });
        askFromCard(p.key, ask);
      });
      note.appendChild(txt);
      note.appendChild(ask);
      card.appendChild(note);
    }
    list.appendChild(card);
  });

  /* ---------- Video ---------- */
  var video = document.getElementById("profileVideo");
  var videoCard = document.getElementById("videoCard");
  var playIcon = document.getElementById("playIcon");
  var playText = document.getElementById("playText");
  var playing = false;
  function setPaused() {
    playing = false;
    playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
    playText.textContent = "Play video";
  }
  videoCard.addEventListener("click", function () {
    if (!playing) {
      video.play(); playing = true;
      playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
      playText.textContent = "Pause";
      log("video_play", null);
    } else {
      video.pause(); setPaused();
      log("video_pause", null);
    }
  });
  video.addEventListener("ended", function () { setPaused(); video.load(); log("video_ended", null); });

  /* ---------- Action bar ---------- */
  var likeBtn = document.getElementById("likeBtn");
  likeBtn.addEventListener("click", function () {
    likeBtn.classList.add("liked");
    log("like_click", null);
  });
  document.getElementById("skipBtn").addEventListener("click", function () { log("skip_click", null); });
  document.getElementById("starBtn").addEventListener("click", function () { log("star_click", null); });

  log("page_load", { ai_param: raw, viewport: window.innerWidth + "x" + window.innerHeight, in_iframe: window.parent !== window });

  if (COND === 0) return; // No matchmaker anywhere in the profile-only condition.

  /* ---------- Matchmaker (AI=1, AI=2) ---------- */
  var wmBtn = el("button", "action-wm");
  wmBtn.type = "button";
  wmBtn.innerHTML = SPARK;
  wmBtn.appendChild(el("span", "", "Ask " + MATCHMAKER_NAME + " about " + P.first));
  likeBtn.parentNode.insertBefore(wmBtn, likeBtn.nextSibling);
  wmBtn.addEventListener("click", function () {
    log("ask_wingmate_click", { from: "action_bar" });
    openSheet(wmBtn, "action_bar");
  });

  var AVATAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.1 6.4 6.4 2.1-6.4 2.1L12 19.5l-2.1-6.4L3.5 11l6.4-2.1z"/><path d="M19 15.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z"/></svg>';

  var layer = el("div", "wm-layer");
  layer.hidden = true;
  layer.innerHTML =
    '<div class="wm-backdrop"></div>' +
    '<div class="wm-sheet" role="dialog" aria-modal="true" aria-labelledby="wmTitle" aria-describedby="wmSub" tabindex="-1">' +
      '<div class="wm-handle" aria-hidden="true"></div>' +
      '<div class="wm-head">' +
        '<div class="wm-avatar">' + AVATAR + '</div>' +
        '<div class="wm-titles"><div class="wm-title" id="wmTitle"></div><div class="wm-sub" id="wmSub"></div></div>' +
        '<button type="button" class="wm-close" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>' +
      '</div>' +
      '<div class="wm-log" role="log" aria-live="polite"></div>' +
      '<div class="wm-foot">' +
        '<div class="wm-hint" aria-live="polite"></div>' +
        '<form class="wm-form" autocomplete="off">' +
          '<label class="sr-only" for="wmInput"></label>' +
          '<textarea class="wm-input" id="wmInput" rows="1" maxlength="300"></textarea>' +
          '<button type="submit" class="wm-send" aria-label="Send" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>' +
        '</form>' +
      '</div>' +
    '</div>';
  document.body.appendChild(layer);

  var sheet = layer.querySelector(".wm-sheet");
  var logBox = layer.querySelector(".wm-log");
  var hint = layer.querySelector(".wm-hint");
  var form = layer.querySelector(".wm-form");
  var input = layer.querySelector(".wm-input");
  var sendBtn = layer.querySelector(".wm-send");
  layer.querySelector("#wmTitle").textContent = MATCHMAKER_NAME + " · " + MATCHMAKER_TAGLINE;
  layer.querySelector("#wmSub").textContent = "Answers using what " + P.first + " has shared. Only shares what " + P.first + " has approved.";
  layer.querySelector('label[for="wmInput"]').textContent = "Your question for " + MATCHMAKER_NAME;
  input.readOnly = !ALLOW_FREE_TEXT;
  input.placeholder = ALLOW_FREE_TEXT ? "Ask about " + P.first + "…" : "";

  /* ----- Scripted question flow -----
   * The participant's next question is autotyped into the input; they only press Send.
   * Questions follow card order, except that "Ask Wingmate" on a card jumps to that card's question.
   */
  var TARGETS = PROMPTS.filter(function (p) { return p.target; });
  var byKey = {};
  PROMPTS.forEach(function (p) { byKey[p.key] = p; });
  var asked = {};          // key -> true once sent
  var answerRow = {};      // key -> Wingmate reply element
  var pendingKey = null;   // question that should be in the input
  var stagedKey = null;    // question currently (being) typed into the input
  var stagedDone = false;  // autotype for stagedKey has finished
  var typeTimer = null;
  var busy = false;        // waiting for a Wingmate reply

  function nextUnasked() {
    for (var j = 0; j < TARGETS.length; j++) if (!asked[TARGETS[j].key]) return TARGETS[j].key;
    return null;
  }

  function autosize() {
    input.style.height = "auto";
    input.style.height = (input.scrollHeight + 3) + "px";
  }

  function setHint() {
    if (busy) hint.textContent = "";
    else if (stagedKey && stagedDone) hint.textContent = "Press send to ask " + MATCHMAKER_NAME + ".";
    else hint.textContent = "";
  }

  function updateSend() {
    // Send stays disabled until the scripted question is fully typed, so it is always read before sending.
    var can = !busy && ((!!stagedKey && stagedDone) || (ALLOW_FREE_TEXT && !stagedKey && input.value.trim() !== ""));
    if (!can && document.activeElement === sendBtn) sheet.focus();
    sendBtn.disabled = !can;
    sendBtn.classList.toggle("ready", can && stagedDone);
    setHint();
  }

  function clearInput() {
    clearTimeout(typeTimer);
    stagedKey = null; stagedDone = false;
    input.value = "";
    autosize();
  }

  function stage(key, trigger) {
    clearInput();
    if (!key) { updateSend(); return; }
    stagedKey = key;
    var full = fill(byKey[key].question);
    var n = 0;
    updateSend();
    (function step() {
      n++;
      input.value = full.slice(0, n);
      autosize();
      if (n < full.length) { typeTimer = setTimeout(step, AUTOTYPE_MS_PER_CHAR); return; }
      stagedDone = true;
      updateSend();
      if (layer.contains(document.activeElement)) sendBtn.focus();
      log("question_autotyped", { card: key, trigger: trigger, text: full });
    })();
  }

  // Bring the input in line with pendingKey (called on open and after each reply).
  function refresh(trigger) {
    if (!isOpen || busy) return;
    if (!pendingKey || asked[pendingKey]) pendingKey = nextUnasked();
    if (pendingKey === stagedKey && stagedDone) { updateSend(); return; }
    stage(pendingKey, trigger);
  }

  function askFromCard(key, btn) {
    if (!asked[key]) pendingKey = key;
    openSheet(btn, "card:" + key);
    if (asked[key] && answerRow[key]) {
      var row = answerRow[key];
      setTimeout(function () {
        row.scrollIntoView({ block: "center", behavior: "smooth" });
        row.classList.add("flash");
        setTimeout(function () { row.classList.remove("flash"); }, 1500);
      }, 320);
    }
  }

  function submit(via) {
    if (busy || sendBtn.disabled) return;
    var typed = input.value.trim();
    var key, text, source;
    if (stagedKey) {
      key = stagedKey; text = fill(byKey[key].question); source = "scripted";
    } else if (ALLOW_FREE_TEXT && typed) {
      text = typed; var m = match(text); key = m ? m.key : null; source = "typed";
    } else return;
    if (key && byKey[key].target) asked[key] = true;
    if (key === pendingKey) pendingKey = null;
    clearInput();
    sendQuestion(text, source, key, via);
  }

  form.addEventListener("submit", function (e) { e.preventDefault(); submit("send_button"); });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit("enter_key"); }
  });
  input.addEventListener("input", function () {
    if (stagedKey && input.value.trim() !== fill(byKey[stagedKey].question)) { clearTimeout(typeTimer); stagedKey = null; stagedDone = false; }
    autosize(); updateSend();
  });

  var greeted = false;
  var isOpen = false;
  var opener = null;
  var background = [document.querySelector(".desktop-shell"), document.querySelector(".action-bar")];

  function openSheet(fromEl, via) {
    if (isOpen) return;
    isOpen = true;
    opener = fromEl;
    layer.hidden = false;
    background.forEach(function (b) { b.setAttribute("inert", ""); b.setAttribute("aria-hidden", "true"); });
    document.body.classList.add("wm-locked");
    void layer.offsetHeight; // reflow so the slide-up transition runs
    layer.classList.add("open");
    sheet.focus();
    if (!greeted) {
      greeted = true;
      addMsg("bot", "Hi! I'm " + MATCHMAKER_NAME + ", " + MATCHMAKER_TAGLINE + ". I can tell you more about what " + P.first + " has shared with me.");
    }
    log("sheet_open", { via: via });
    setTimeout(function () { refresh(via); }, 350); // start typing once the sheet has slid up
  }

  function closeSheet(via) {
    if (!isOpen) return;
    isOpen = false;
    if (!stagedDone) clearInput(); // an interrupted autotype restarts on the next open
    layer.classList.remove("open");
    background.forEach(function (b) { b.removeAttribute("inert"); b.removeAttribute("aria-hidden"); });
    document.body.classList.remove("wm-locked");
    setTimeout(function () { if (!isOpen) layer.hidden = true; }, 300);
    if (opener && opener.focus) opener.focus();
    log("sheet_close", { via: via });
  }

  layer.querySelector(".wm-close").addEventListener("click", function () { closeSheet("close_button"); });
  layer.querySelector(".wm-backdrop").addEventListener("click", function () { closeSheet("backdrop"); });

  // Esc closes; Tab is trapped inside the sheet.
  document.addEventListener("keydown", function (e) {
    if (!isOpen) return;
    if (e.key === "Escape" || e.key === "Esc") { e.preventDefault(); closeSheet("escape"); return; }
    if (e.key !== "Tab") return;
    var f = Array.prototype.filter.call(
      sheet.querySelectorAll("button, textarea, input, [tabindex]:not([tabindex='-1'])"),
      function (n) { return !n.disabled && n.offsetParent !== null; });
    if (!f.length) { e.preventDefault(); return; }
    var first = f[0], last = f[f.length - 1];
    if (!layer.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  document.addEventListener("focusin", function (e) {
    if (isOpen && !layer.contains(e.target)) sheet.focus();
  });

  function addMsg(who, text) {
    var row = el("div", "wm-msg " + who);
    if (who === "bot") {
      var av = el("div", "wm-avatar sm");
      av.innerHTML = AVATAR;
      av.setAttribute("aria-hidden", "true");
      row.appendChild(av);
    }
    var b = el("div", "wm-bubble", text);
    if (who === "bot") b.insertAdjacentHTML("afterbegin", '<span class="sr-only">' + MATCHMAKER_NAME + ': </span>');
    row.appendChild(b);
    logBox.appendChild(row);
    logBox.scrollTop = logBox.scrollHeight;
    return row;
  }

  // Keyword matching, used only when ALLOW_FREE_TEXT is true.
  function match(q) {
    var s = " " + q.toLowerCase() + " ";
    var best = null, bestScore = 0;
    PROMPTS.forEach(function (p) {
      var score = 0;
      p.keywords.forEach(function (k) {
        var weak = k.charAt(0) === "~";
        if (new RegExp(weak ? k.slice(1) : k).test(s)) score += weak ? 0.5 : 1;
      });
      if (score > bestScore) { best = p; bestScore = score; }
    });
    return best;
  }

  function answerFor(p) {
    if (!p) return { text: fill("{Name} hasn't shared that with me. You could ask {him} directly once you match."), matched: "none" };
    if (!p.target) return { text: "That's on " + P.first + "'s profile: “" + p.short + "”", matched: p.key, target: false };
    return { text: fill(COND === 2 ? p.reply2 : p.reply1), matched: p.key, target: true };
  }

  function sendQuestion(text, source, cardKey, via) {
    busy = true;
    updateSend();
    addMsg("user", text);
    var a = answerFor(cardKey ? byKey[cardKey] : null);
    log("question_sent", { text: text, source: source, via: via, matched: a.matched, target: !!a.target });
    var typing = el("div", "wm-msg bot");
    typing.innerHTML = '<div class="wm-avatar sm" aria-hidden="true">' + AVATAR + '</div><div class="wm-bubble wm-typing" aria-label="' + MATCHMAKER_NAME + ' is typing"><span></span><span></span><span></span></div>';
    logBox.appendChild(typing);
    logBox.scrollTop = logBox.scrollHeight;
    var delay = TYPING_MIN_MS + Math.random() * (TYPING_MAX_MS - TYPING_MIN_MS);
    setTimeout(function () {
      typing.remove();
      var row = addMsg("bot", a.text);
      if (a.target) answerRow[a.matched] = row;
      log("reply_shown", { matched: a.matched, target: !!a.target, text: a.text });
      busy = false;
      updateSend();
      setTimeout(function () { refresh("after_reply"); }, AUTOTYPE_PAUSE_MS);
    }, delay);
  }
})();
