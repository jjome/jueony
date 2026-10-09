// 공식 기본 UI 색상 비교를 위해 첫 실행만 밝은 테마로 시작한다.
// 로컬 콘솔에 코드 위치만 남긴다. 문서 내용이나 파일은 전송하지 않는다.
window.addEventListener('error', event => {
  if (event.error?.stack) console.error('[editor]', event.error.stack);
});
if (new URLSearchParams(location.search).get('child') === '1') document.documentElement.dataset.jueonyChild = 'true';
try {
  if (!localStorage.getItem('rhwp-settings')) {
    localStorage.setItem('rhwp-settings', JSON.stringify({theme:{mode:'light',skin:'default',skinChosen:true}}));
  }
} catch { /* 저장소를 사용할 수 없어도 실행한다. */ }
