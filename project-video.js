// Play the enzyme demo in its existing image slot, loading media only on request.
(function(){
  const shot = document.querySelector('#wd-ar .wd-shot, [data-project-video]');
  const panel = shot && shot.closest('.wdetail');
  if (!shot || shot.parentElement.classList.contains('wd-video-frame')) return;
  const source = new URL('assets/enzymatic-lab-demo-v13.mp4', document.currentScript.src).href;
  const frame = document.createElement('div');
  frame.className = 'wd-video-frame';
  shot.before(frame);
  frame.appendChild(shot);
  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'wd-video-play';
  play.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5v14l11-7z"/></svg>';
  const labels = {en:'Play enzyme project video', he:'ניגון סרטון פרויקט האנזים', ru:'Воспроизвести видео проекта ферментативной лаборатории'};
  function label(){
    play.setAttribute('aria-label', labels[document.documentElement.lang] || labels.en);
    if (video) video.setAttribute('aria-label', play.getAttribute('aria-label'));
  }
  let video;
  label();
  frame.appendChild(play);
  new MutationObserver(label).observe(document.documentElement, {attributes:true, attributeFilter:['lang']});
  function reset(){
    if (!video) return;
    video.pause();
    video.currentTime = 0;
    video.hidden = true;
    play.hidden = false;
  }
  play.addEventListener('click', function(){
    if (!video){
      video = document.createElement('video');
      video.className = 'wd-video-player';
      video.controls = true;
      video.playsInline = true;
      video.preload = 'none';
      video.poster = shot.src;
      video.src = source;
      video.tabIndex = 0;
      label();
      frame.appendChild(video);
      video.addEventListener('ended', function(){
        const hadFocus = document.activeElement === video;
        reset();
        if (hadFocus) play.focus({preventScroll:true});
      });
    }
    play.hidden = true;
    video.hidden = false;
    video.play().catch(function(){ /* Native controls remain available if playback is blocked. */ });
    video.focus({preventScroll:true});
  });
  if (panel) new MutationObserver(function(){ if (panel.hidden) reset(); })
    .observe(panel, {attributes:true, attributeFilter:['hidden']});
  document.addEventListener('visibilitychange', function(){ if (document.hidden && video) video.pause(); });
})();

