/* Shared profile logic for the dating-profile stimuli.
 *
 * Each persona page defines window.PROFILE before loading this file:
 *   { id: "olivia", first: "Olivia", full: "Olivia Carter",
 *     pron: { she: "she", her: "her", him: "her" } }   // subject, possessive, object
 *
 * URL parameter ?AI= selects the condition:
 *   0 (default, missing or invalid) – profile only; every card shows its short answer and details ("Show less" hides the details)
 *   1 – target cards show the short answer; details only via the matchmaker
 *   2 – target cards show only the title; short answer + details only via the matchmaker
 *
 * No storage, no network calls. Every interaction is posted to the parent frame.
 */

/* ---------- Config (rename here) ---------- */
var APP_NAME = "Kindred";
var MATCHMAKER_NAME = "Matchmaker";
var MATCHMAKER_TAGLINE = "AI by " + APP_NAME;  // neutral, platform-provided (never "{Name}'s matchmaker")
var TYPING_MIN_MS = 800;
var TYPING_MAX_MS = 1200;
var SENTENCE_GAP_MIN_MS = 700;    // typing pause before each further sentence of a Matchmaker reply
var SENTENCE_GAP_MAX_MS = 1100;
var AUTOTYPE_MS_PER_CHAR = 22;    // speed at which the participant's question is typed into the input
var AUTOTYPE_PAUSE_MS = 700;      // pause after a Matchmaker reply before the next question starts typing
var ALLOW_FREE_TEXT = false;      // false: input is read-only, participants only press Send on scripted questions

/* ---------- Prompt cards (first person; identical for both personas) ----------
 * short: shown on the card in AI=0 and AI=1          long: the details
 *   AI=0: short + long ("Show less" hides long)   AI=1: short on card, long via the matchmaker
 *   AI=2: title only, short + long via the matchmaker
 * A field may be a string or { olivia: "...", ethan: "..." } for persona-specific text.
 * target: true  -> handled by the matchmaker in AI=1 / AI=2
 * question: scripted participant question, autotyped into the input ({She}/{she}/{her}/{him}/{Name} filled per persona)
 * keywords: free-text matching regexes (only used when ALLOW_FREE_TEXT); a leading "~" marks a generic word worth half a match
 * reply1 / reply2: scripted matchmaker replies for AI=1 (long only) / AI=2 (short + long)
 */
var PROMPTS = [
  {
    key: "family", target: true,
    title: "Family Plans",
    short: "Want children",
    long: "I'd like to be engaged in the next couple of years and start a family by my early thirties, ideally two or three kids. I'm looking for someone who's sure they want kids and who'd want to split parenting equally.",
    question: "So {Name} told you about {her} family plans. I'm curious, does {she} want kids?",
    keywords: ["kid", "child", "famil", "bab(y|ies)", "\\bparent", "\\bmoms?\\b", "\\bdads?\\b", "mother", "father", "thirties", "engaged", "~future"],
    reply1: "{Name} would like to be engaged in the next couple of years and start a family by {her} early thirties, ideally with two or three kids. {She}'s looking for someone who's sure they want kids and who'd want to split parenting equally.",
    reply2: "Yes, {Name} wants children. {She}'d like to be engaged in the next couple of years and start a family by {her} early thirties, ideally with two or three kids. {She}'s looking for someone who's sure they want kids and who'd want to split parenting equally."
  },
  {
    key: "passions", target: true,
    title: "Passions & Lifestyle",
    short: "Volunteering",
    long: "I've tutored at a youth literacy program every Saturday morning for five years, and last year they named me volunteer of the year. A few of the kids I started with are now reading at grade level, and honestly that means more to me than anything I've done at work.",
    question: "I'd love to know what {Name} is passionate about. How does {she} like to spend {her} time?",
    keywords: ["passion", "interest", "hobb", "volunteer", "tutor", "literacy", "free time", "for fun", "lifestyle", "saturday", "weekend", "give back", "giving back", "~community"],
    reply1: "{Name} has tutored at a youth literacy program every Saturday morning for five years, and last year {she} was named volunteer of the year. A few of the kids {she} started with are now reading at grade level, and {she} says that means more to {him} than anything {she}'s done at work.",
    reply2: "{Name}'s big passion is volunteering. {She}'s tutored at a youth literacy program every Saturday morning for five years, and last year {she} was named volunteer of the year. A few of the kids {she} started with are now reading at grade level, and {she} says that means more to {him} than anything {she}'s done at work."
  },
  {
    key: "career", target: true,
    title: "Career",
    short: "Product Manager · Tech",
    long: "I was promoted last year to lead a product team of 12, one of the youngest managers at my company. Launch seasons can mean 60-hour weeks, and I'm aiming for a director role in the next few years, so I need someone who won't take it personally when work gets intense.",
    question: "What's {Name}'s work life like? I'm curious how busy {she} gets.",
    keywords: ["~work", "\\bjob", "career", "promot", "product", "manager", "\\btech", "\\bteam", "busy", "hours", "director", "ambiti", "profession"],
    reply1: "{Name} was promoted last year to lead a product team of 12, one of the youngest managers at {her} company. Launch seasons can mean 60-hour weeks, and {she}'s aiming for a director role in the next few years, so {she} needs someone who won't take it personally when work gets intense.",
    reply2: "{Name} is a product manager in tech. {She} was promoted last year to lead a product team of 12, one of the youngest managers at {her} company. Launch seasons can mean 60-hour weeks, and {she}'s aiming for a director role in the next few years, so {she} needs someone who won't take it personally when work gets intense."
  },
  {
    key: "past", target: true,
    title: "Past Relationships",
    short: "Back to dating after a long-term relationship",
    long: "I was engaged until two years ago; we called it off a few months before the wedding. It was mutual, but it took me a while to feel ready again. It taught me what I need most in a relationship, which is honest communication, and I'm ready to meet someone now.",
    question: "{Name} mentioned {her} past relationships. What's {her} story there?",
    keywords: ["relationship", "\\bex\\b", "engage", "wedding", "\\blast\\b", "\\bpast\\b", "broke up", "break ?up", "called it off", "divorc", "single", "~dating"],
    reply1: "{Name} was engaged until two years ago, and they called it off a few months before the wedding. It was mutual, but it took {him} a while to feel ready again. It taught {him} that what {she} needs most in a relationship is honest communication, and {she}'s ready to meet someone now.",
    reply2: "{Name} is back to dating after a long-term relationship. {She} was engaged until two years ago, and they called it off a few months before the wedding. It was mutual, but it took {him} a while to feel ready again. It taught {him} that what {she} needs most in a relationship is honest communication, and {she}'s ready to meet someone now."
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
  function pick(v) { return (v && typeof v === "object") ? v[P.id] : v; } // persona-specific text

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
    var short = pick(p.short), long = pick(p.long);

    if (!viaMatchmaker) {
      // Short answer + details shown by default; "Show less" hides the details.
      card.appendChild(el("div", "prompt-answer", short));
      var more = el("div", "prompt-answer small prompt-more", long);
      more.id = "more-" + p.key;
      var btn = el("button", "read-more", "Show less");
      btn.type = "button";
      btn.setAttribute("aria-expanded", "true");
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
      if (COND === 1) card.appendChild(el("div", "prompt-answer", short));
      var note = el("div", "wm-note");
      var txt = el("div", "wm-note-text");
      txt.innerHTML = SPARK;
      txt.appendChild(el("span", "", COND === 2
        ? P.first + " shared this with " + MATCHMAKER_NAME + "."
        : P.first + " shared more about this with " + MATCHMAKER_NAME + "."));
      note.appendChild(txt);
      card.appendChild(note);
    }
    list.appendChild(card);
  });

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
    log("ask_matchmaker_click", { from: "action_bar" });
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
   * Questions follow card order.
   */
  var TARGETS = PROMPTS.filter(function (p) { return p.target; });
  var byKey = {};
  PROMPTS.forEach(function (p) { byKey[p.key] = p; });
  var asked = {};          // key -> true once sent
  var pendingKey = null;   // question that should be in the input
  var stagedKey = null;    // question currently (being) typed into the input
  var stagedDone = false;  // autotype for stagedKey has finished
  var typeTimer = null;
  var busy = false;        // waiting for a Matchmaker reply

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
      addMsg("bot", "Hi! I'm " + APP_NAME + "'s AI " + MATCHMAKER_NAME + ". I can tell you more about what " + P.first + " has shared with me.");
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
    if (!p.target) return { text: "That's on " + P.first + "'s profile: “" + pick(p.short) + "”", matched: p.key, target: false };
    return { text: fill(pick(COND === 2 ? p.reply2 : p.reply1)), matched: p.key, target: true };
  }

  function sendQuestion(text, source, cardKey, via) {
    busy = true;
    updateSend();
    addMsg("user", text);
    var a = answerFor(cardKey ? byKey[cardKey] : null);
    log("question_sent", { text: text, source: source, via: via, matched: a.matched, target: !!a.target });
    // Each sentence arrives as its own bubble, with a typing indicator before it.
    var sentences = a.text.match(/[^.!?]+[.!?]+["”]?(\s+|$)/g) || [a.text];
    sentences = sentences.map(function (x) { return x.trim(); });
    var prevRow = null;
    (function next(k) {
      var typing = el("div", "wm-msg bot" + (k ? " cont" : ""));
      typing.innerHTML = '<div class="wm-avatar sm" aria-hidden="true">' + AVATAR + '</div><div class="wm-bubble wm-typing" aria-label="' + MATCHMAKER_NAME + ' is typing"><span></span><span></span><span></span></div>';
      if (prevRow) prevRow.querySelector(".wm-avatar").classList.add("ghost"); // avatar only beside the latest bubble
      logBox.appendChild(typing);
      logBox.scrollTop = logBox.scrollHeight;
      var delay = k === 0
        ? TYPING_MIN_MS + Math.random() * (TYPING_MAX_MS - TYPING_MIN_MS)
        : SENTENCE_GAP_MIN_MS + Math.random() * (SENTENCE_GAP_MAX_MS - SENTENCE_GAP_MIN_MS);
      setTimeout(function () {
        typing.remove();
        prevRow = addMsg("bot", sentences[k]);
        if (k) prevRow.classList.add("cont");
        if (k + 1 < sentences.length) { next(k + 1); return; }
        log("reply_shown", { matched: a.matched, target: !!a.target, text: a.text, bubbles: sentences.length });
        busy = false;
        updateSend();
        setTimeout(function () { refresh("after_reply"); }, AUTOTYPE_PAUSE_MS);
      }, delay);
    })(0);
  }
})();
