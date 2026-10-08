// 공식 기본 UI 색상 비교를 위해 첫 실행만 밝은 테마로 시작한다.
try {
  if (!localStorage.getItem('rhwp-settings')) {
    localStorage.setItem('rhwp-settings', JSON.stringify({theme:{mode:'light',skin:'default',skinChosen:true}}));
  }
} catch { /* 저장소를 사용할 수 없어도 실행한다. */ }
