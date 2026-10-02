# MMTreatments

Static dating-profile stimuli (fictional app "Kindred", AI matchmaker "Wingmate").

## Pages

- `olivia/olivia_profile.html?AI=0|1|2`
- `ethan/ethan_profile.html?AI=0|1|2`

`AI=0` (default if missing/invalid): profile only, every card has "Read more".
`AI=1`: target cards (family plans, relationship goal, achievement) show the short answer; details only via Wingmate.
`AI=2`: target cards show only the prompt title; short answer + details only via Wingmate.

In AI=1/2 the participant's questions are scripted: each one is autotyped into a read-only input and the participant presses Send. Set `ALLOW_FREE_TEXT = true` in `shared/profile.js` to let participants type their own questions instead.

Card content, scripted questions and replies, keyword matching, and the `APP_NAME` / `MATCHMAKER_NAME` constants live in `shared/profile.js`. Styles are in `shared/profile.css`. Persona basics (name, photo/video, job, height, interests) stay in each persona's HTML.

## Logging

Every interaction is sent to the parent frame and the console:

```js
{ source: "profile-stim", condition, persona, event, detail, t }
```

Events: `page_load`, `card_expand`, `card_collapse`, `ask_wingmate_click`, `sheet_open`, `sheet_close`, `question_autotyped`, `question_sent`, `reply_shown`, `like_click`, `skip_click`, `star_click`, `video_play`, `video_pause`, `video_ended`.

Example Qualtrics question JavaScript that stores the log in an embedded-data field `stimLog`:

```js
Qualtrics.SurveyEngine.addOnload(function () {
  var log = [];
  window.addEventListener("message", function (e) {
    if (!e.data || e.data.source !== "profile-stim") return;
    log.push(e.data);
    Qualtrics.SurveyEngine.setEmbeddedData("stimLog", JSON.stringify(log));
  });
});
```
