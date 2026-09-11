(() => {
  let toastTimer;
  window.triadToast = text => {
    const toast = document.getElementById('toast');
    toast.textContent = text; toast.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.hidden = true, 4000);
  };
  const fullscreen = document.getElementById('fullscreen');
  fullscreen.onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else window.triadToast('이 브라우저는 전체 화면을 지원하지 않습니다. 홈 화면에 추가하면 더 넓게 플레이할 수 있습니다.');
    } catch { window.triadToast('전체 화면을 열 수 없습니다. 현재 화면에서도 플레이할 수 있습니다.'); }
  };
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('./sw.js', {scope:'./'}).catch(() => {
      // Online play works even if offline installation is unavailable.
    });
  }
})();
